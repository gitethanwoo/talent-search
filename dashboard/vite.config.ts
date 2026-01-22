import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import Database from 'better-sqlite3'

// SQLite database path
const DB_PATH = path.resolve(__dirname, '../prospects.db')

function getDbData() {
  const db = new Database(DB_PATH, { readonly: true })

  const scalar = (sql: string) => (db.prepare(sql).get() as Record<string, number>)[Object.keys(db.prepare(sql).get() as object)[0]]
  const query = (sql: string) => db.prepare(sql).all()

  const data = {
    stats: {
      prospects: scalar("SELECT COUNT(*) FROM prospects"),
      contactable: scalar("SELECT COUNT(*) FROM prospects WHERE email IS NOT NULL OR twitter IS NOT NULL"),
      high_signal: scalar("SELECT COUNT(*) FROM prospects WHERE signal='high'"),
      ships_fast: scalar("SELECT COUNT(*) FROM prospects WHERE ships_fast=1"),
      ai_native: scalar("SELECT COUNT(*) FROM prospects WHERE ai_native=1"),
      sources: scalar("SELECT COUNT(*) FROM sources_checked"),
      rejected: scalar("SELECT COUNT(*) FROM rejected"),
    },
    prospects: query(`
      SELECT id, github_username, name, email, twitter, location, company,
             signal, ships_fast, ai_native, source, outreach_status,
             notes, comp_fit, outreach_context, bio, fit
      FROM prospects
      ORDER BY CASE fit WHEN 'unlikely' THEN 2 ELSE 1 END,
               CASE signal WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               ships_fast DESC
    `),
    drafts: query(`
      SELECT m.id, p.github_username, p.name, p.email, p.twitter,
             m.subject, m.body, m.channel, m.status, m.created_at
      FROM outreach_messages m
      JOIN prospects p ON p.id = m.prospect_id
      ORDER BY m.created_at DESC
    `),
    sources: query(`
      SELECT source_type, source_name, checked_at
      FROM sources_checked
      ORDER BY checked_at DESC
    `),
  }

  db.close()
  return data
}

interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
}

interface Task {
  id: string
  action: string
  target: string
  status: 'running' | 'done' | 'error'
  startedAt: string
  completedAt?: string
  error?: string
  outputFile?: string
  lastOutput?: string
  fullOutput?: string
  events?: StreamEvent[]
}

// Task store - load from SQLite on startup
const tasks: Map<string, Task> = new Map()
let taskCounter = 0

function loadTasksFromDb() {
  try {
    const db = new Database(DB_PATH, { readonly: true })
    const rows = db.prepare(`
      SELECT id, action, target, status, started_at, completed_at, error
      FROM tasks ORDER BY started_at DESC LIMIT 50
    `).all() as Array<{id: string, action: string, target: string, status: string, started_at: string, completed_at: string | null, error: string | null}>

    for (const row of rows) {
      tasks.set(row.id, {
        id: row.id,
        action: row.action,
        target: row.target,
        status: row.status as 'running' | 'done' | 'error',
        startedAt: row.started_at,
        completedAt: row.completed_at || undefined,
        error: row.error || undefined,
        events: [] // Events not persisted for now
      })
      // Track highest task number
      const num = parseInt(row.id.replace('task-', ''))
      if (num > taskCounter) taskCounter = num
    }
    db.close()
    console.log(`\x1b[35m[DB]\x1b[0m Loaded ${rows.length} tasks from history`)
  } catch (e) {
    console.error('[DB] Failed to load tasks:', e)
  }
}

function saveTaskToDb(task: Task) {
  try {
    const db = new Database(DB_PATH)
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, action, target, status, started_at, completed_at, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(task.id, task.action, task.target, task.status, task.startedAt, task.completedAt || null, task.error || null)
    db.close()
  } catch (e) {
    console.error('[DB] Failed to save task:', e)
  }
}

// Load existing tasks on module init
loadTasksFromDb()

// SSE clients for streaming updates
const sseClients: Set<ServerResponse> = new Set()

function broadcastTaskUpdate(task: Task) {
  const data = JSON.stringify(task)
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`)
  })
}

// Plugin to handle action logging from the UI and trigger Claude
function actionLoggerPlugin() {
  const logFile = path.resolve(__dirname, '../actions.log')

  return {
    name: 'action-logger',
    configureServer(server: ViteDevServer) {
      // Live data from SQLite
      server.middlewares.use('/api/data', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          try {
            const data = getDbData()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } catch (e) {
            console.error('[DB ERROR]', e)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Database error' }))
          }
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // SSE endpoint for streaming task updates
      server.middlewares.use('/api/tasks/stream', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          })

          // Send initial state
          const taskList = Array.from(tasks.values()).sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
          res.write(`event: init\ndata: ${JSON.stringify(taskList)}\n\n`)

          sseClients.add(res)
          console.log('\x1b[35m[SSE]\x1b[0m Client connected, total:', sseClients.size)

          req.on('close', () => {
            sseClients.delete(res)
            console.log('\x1b[35m[SSE]\x1b[0m Client disconnected, total:', sseClients.size)
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Get all tasks (fallback for non-streaming)
      server.middlewares.use('/api/tasks', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const taskList = Array.from(tasks.values()).sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(taskList))
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Submit new action
      server.middlewares.use('/api/action', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => body += chunk.toString())
          req.on('end', () => {
            const timestamp = new Date().toISOString()
            const logLine = `[${timestamp}] ${body}\n`
            fs.appendFileSync(logFile, logLine)
            console.log('\x1b[36m[ACTION]\x1b[0m', body)

            // Parse action and trigger Claude
            try {
              const action = JSON.parse(body)
              let prompt = ''
              let taskAction = action.action

              // Tool restrictions per action type
              const toolsByAction: Record<string, string[]> = {
                enrich: ['Bash', 'WebFetch', 'WebSearch', 'TodoWrite', 'Read', 'Skill'],
                draft: ['Bash', 'Read', 'TodoWrite', 'Skill'],
                reject: ['Bash'],
                rewrite: ['Bash', 'Read', 'Skill'],
                research: ['Bash', 'WebFetch', 'WebSearch', 'TodoWrite', 'Read', 'Task', 'Skill'],
              }

              if (action.action === 'enrich') {
                prompt = `/prospect-enricher

Enrich the prospect @${action.username} (${action.name || 'unknown'}).

1. First get their current data:
   sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username='${action.username}'"

2. Work through the enrichment checklist to find:
   - Email (check GitHub, commits, website, Google)
   - Twitter handle
   - LinkedIn URL
   - Personal website/blog
   - Verify current role/company
   - Evidence for ships_fast and ai_native
   - comp_fit reasoning
   - outreach_context (personalization hooks)

3. Update the database with findings:
   sqlite3 prospects.db "UPDATE prospects SET
     email=COALESCE('{email}', email),
     twitter=COALESCE('{twitter}', twitter),
     ...
     enriched_at=datetime('now')
   WHERE github_username='${action.username}'"

Be thorough - check every source. Update the DB when done.`
              } else if (action.action === 'draft') {
                prompt = `/prospect-outreach

Draft a personalized outreach message for @${action.username} (${action.name || 'unknown'}).

1. First get their enrichment data:
   sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username='${action.username}'"

2. Read the outreach skill for templates and tone guidelines.

3. Write a personalized email:
   - Subject must reference their SPECIFIC work
   - Body must mention the signal that flagged them
   - Use Alex Lieberman's voice (direct, confident)
   - Under 100 words
   - Include video link placeholder

4. Save the draft to database:
   sqlite3 prospects.db "INSERT INTO outreach_messages (prospect_id, channel, message_type, subject, body, status)
   VALUES ((SELECT id FROM prospects WHERE github_username='${action.username}'), 'email', 'initial', '{subject}', '{body}', 'draft')"

5. Update prospect status:
   sqlite3 prospects.db "UPDATE prospects SET outreach_status='in_progress' WHERE github_username='${action.username}'"`
              } else if (action.action === 'reject') {
                prompt = `Reject prospect @${action.username} from the pipeline.

1. First get their data:
   sqlite3 prospects.db "SELECT * FROM prospects WHERE github_username='${action.username}'"

2. Move to rejected table:
   sqlite3 prospects.db "INSERT INTO rejected (github_username, name, reason, rejected_at)
   SELECT github_username, name, 'Manually rejected from dashboard', datetime('now')
   FROM prospects WHERE github_username='${action.username}'"

3. Delete from prospects:
   sqlite3 prospects.db "DELETE FROM prospects WHERE github_username='${action.username}'"

4. Confirm the rejection was successful.`
              } else if (action.action === 'rewrite') {
                prompt = `/prospect-outreach

Rewrite this outreach email for @${action.username} (${action.name || 'unknown'}).

CURRENT DRAFT (ID: ${action.draftId}):
Subject: ${action.subject}
Body:
${action.body}

INSTRUCTIONS:
1. First, get the prospect's full context:
   sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username='${action.username}'"

2. Read the outreach skill for tone and template guidelines.

3. Write a BETTER version of this email:
   - Keep the same general intent but make it more compelling
   - Reference their specific work more naturally
   - Make it sound more human, less templated
   - Keep it under 100 words
   - Use Alex Lieberman's voice (direct, confident, not salesy)

4. Update the existing draft in the database:
   sqlite3 prospects.db "UPDATE outreach_messages SET
     subject='{new_subject}',
     body='{new_body}'
   WHERE id=${action.draftId}"

5. Confirm what you changed and why.`
              } else if (action.action === 'set_fit') {
                // Direct DB update, no Claude needed
                const db = new Database(DB_PATH)
                db.prepare(`UPDATE prospects SET fit = ? WHERE github_username = ?`).run(action.fit, action.username)
                db.close()
                console.log(`\x1b[32m[FIT]\x1b[0m Set ${action.username} to ${action.fit}`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
                return
              } else if (action.action === 'research') {
                const source = action.source || 'any'
                prompt = `/prospect-researcher

Find new AI engineer prospects${source !== 'any' ? ` from ${source}` : ''}.

INSTRUCTIONS:
1. First check what sources have been checked recently:
   sqlite3 -header -column prospects.db "SELECT source_type, source_name, checked_at FROM sources_checked ORDER BY checked_at DESC LIMIT 10"

2. Pick a source that needs refreshing (or a new one). Good options:
   - Twitter/Nitter: Use /agent-browser skill to search nitter.poast.org for "built with claude", "vibe coding", "shipped in a weekend"
   - Hacker News: WebFetch the Algolia API for Show HN posts about AI tools, agents
   - GitHub: Use gh CLI to find contributors to AI repos (vercel/ai, anthropics/claude-code, etc.)

3. For each potential prospect:
   - Check if already in DB: sqlite3 prospects.db "SELECT 1 FROM prospects WHERE github_username='{user}' UNION SELECT 1 FROM rejected WHERE github_username='{user}'"
   - Qualify: Do they ship fast? AI-native? Would they like uncapped comp?
   - Add good ones, reject others with reason

4. Log the source as checked when done.

5. Report what you found: how many new prospects added, notable finds.`
              }

              if (prompt) {
                // Create task
                const taskId = `task-${++taskCounter}`
                const outputFile = path.resolve(__dirname, `../task-outputs/${taskId}.log`)

                // Ensure output directory exists
                fs.mkdirSync(path.dirname(outputFile), { recursive: true })

                const task: Task = {
                  id: taskId,
                  action: taskAction,
                  target: action.username,
                  status: 'running',
                  startedAt: timestamp,
                  outputFile,
                  fullOutput: ''
                }
                tasks.set(taskId, task)
                saveTaskToDb(task)
                broadcastTaskUpdate(task)

                const tools = toolsByAction[taskAction] || ['Bash']
                console.log('\x1b[33m[EXEC]\x1b[0m', `[${taskId}]`, `claude -p "..." --tools ${tools.join(',')}`)

                // Spawn with restricted tools and pre-approved permissions
                const child = spawn('claude', [
                  '-p', prompt,
                  '--tools', tools.join(','),
                  '--allowedTools', tools.join(','),
                  '--output-format', 'stream-json',
                  '--verbose'
                ], {
                  cwd: path.resolve(__dirname, '..'),
                  stdio: ['ignore', 'pipe', 'pipe']
                })

                let outputBuffer = ''
                const events: StreamEvent[] = []

                function parseStreamJson(line: string): StreamEvent | null {
                  try {
                    const event = JSON.parse(line)

                    if (event.type === 'assistant' && event.message?.content) {
                      for (const block of event.message.content) {
                        if (block.type === 'text' && block.text) {
                          return { type: 'text', content: block.text }
                        }
                        if (block.type === 'tool_use') {
                          const input = block.input?.command || block.input?.url || block.input?.pattern || block.input?.file_path || block.input?.query || JSON.stringify(block.input).slice(0, 200)
                          return { type: 'tool_call', tool: block.name, content: input }
                        }
                      }
                    }

                    if (event.type === 'user' && event.tool_use_result) {
                      const result = event.tool_use_result
                      const output = result.stdout || result.content || ''
                      if (output && output.trim()) {
                        return { type: 'tool_result', content: output }
                      }
                    }

                    return null
                  } catch {
                    return null
                  }
                }

                child.stdout?.on('data', (data: Buffer) => {
                  const text = data.toString()
                  outputBuffer += text
                  fs.appendFileSync(outputFile, text)

                  // Parse each line of JSON into structured events
                  const lines = text.split('\n').filter(l => l.trim())
                  for (const line of lines) {
                    const event = parseStreamJson(line)
                    if (event) {
                      events.push(event)
                    }
                  }

                  task.events = events
                  // Keep text summary for lastOutput
                  task.lastOutput = events.slice(-5).map(e =>
                    e.type === 'text' ? e.content :
                    e.type === 'tool_call' ? `▶ ${e.tool}: ${e.content.slice(0, 50)}...` :
                    e.content.slice(0, 100)
                  ).join('\n')
                  broadcastTaskUpdate(task)
                })

                child.stderr?.on('data', (data: Buffer) => {
                  const text = data.toString()
                  outputBuffer += `[err] ${text}`
                  fs.appendFileSync(outputFile, `[stderr] ${text}`)
                  events.push({ type: 'text', content: `[stderr] ${text}` })
                  task.events = events
                  broadcastTaskUpdate(task)
                })

                child.on('close', (code) => {
                  const completedAt = new Date().toISOString()
                  if (code !== 0) {
                    console.error(`[${taskId}] ERROR: exit code ${code}`)
                    task.status = 'error'
                    task.error = `Exit code ${code}`
                  } else {
                    console.log(`\x1b[32m[${taskId}] DONE\x1b[0m`)
                    task.status = 'done'
                  }
                  task.completedAt = completedAt
                  saveTaskToDb(task)
                  broadcastTaskUpdate(task)
                })

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, taskId }))
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              }
            } catch (e) {
              console.error('[PARSE ERROR]', e)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Parse error' }))
            }
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), actionLoggerPlugin()],
})
