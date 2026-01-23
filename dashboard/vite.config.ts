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
             notes, comp_fit, outreach_context, bio, fit, enriched_at
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

// Bulk job types and storage
interface BulkJob {
  id: string
  action: 'enrich' | 'draft' | 'test'
  prospectIds: number[]
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed'
  total: number
  completed: number
  failed: number
  completedIds: number[]
  failedIds: { id: number; error: string }[]
  createdAt: string
  updatedAt: string
}

const bulkJobs: Map<string, BulkJob> = new Map()
let bulkJobCounter = 0

// SSE clients for bulk job updates
const bulkJobClients: Set<ServerResponse> = new Set()

function broadcastBulkJobUpdate(job: BulkJob) {
  const data = JSON.stringify(job)
  bulkJobClients.forEach(client => {
    client.write(`data: ${data}\n\n`)
  })
}

function saveBulkJobToDb(job: BulkJob) {
  try {
    const db = new Database(DB_PATH)
    db.prepare(`
      INSERT OR REPLACE INTO bulk_jobs (id, action, prospect_ids, status, total, completed, failed, completed_ids, failed_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.action,
      JSON.stringify(job.prospectIds),
      job.status,
      job.total,
      job.completed,
      job.failed,
      JSON.stringify(job.completedIds),
      JSON.stringify(job.failedIds),
      job.createdAt,
      job.updatedAt
    )
    db.close()
  } catch (e) {
    console.error('[DB] Failed to save bulk job:', e)
  }
}

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

// Chat session types and storage
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  events?: ChatStreamEvent[]
}

interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
}

interface ChatSession {
  id: string
  messages: ChatMessage[]
  status: 'idle' | 'streaming' | 'error'
  currentResponse: string
  currentEvents: ChatStreamEvent[]
  createdAt: string
  updatedAt: string
}

const chatSessions: Map<string, ChatSession> = new Map()
let chatSessionCounter = 0

// SSE clients for chat streaming
const chatClients: Set<ServerResponse> = new Set()

function broadcastChatUpdate(session: ChatSession) {
  const data = JSON.stringify(session)
  chatClients.forEach(client => {
    client.write(`data: ${data}\n\n`)
  })
}

function getProspectContext(): string {
  const db = new Database(DB_PATH, { readonly: true })

  const stats = {
    total: (db.prepare("SELECT COUNT(*) as c FROM prospects").get() as {c: number}).c,
    enriched: (db.prepare("SELECT COUNT(*) as c FROM prospects WHERE enriched_at IS NOT NULL").get() as {c: number}).c,
    contactable: (db.prepare("SELECT COUNT(*) as c FROM prospects WHERE email IS NOT NULL OR twitter IS NOT NULL").get() as {c: number}).c,
    highSignal: (db.prepare("SELECT COUNT(*) as c FROM prospects WHERE signal='high'").get() as {c: number}).c,
  }

  const prospects = db.prepare(`
    SELECT github_username, name, email, twitter, company, signal, fit, enriched_at, outreach_status, bio, outreach_context
    FROM prospects
    ORDER BY CASE signal WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    LIMIT 50
  `).all() as Array<Record<string, unknown>>

  const drafts = db.prepare(`
    SELECT p.github_username, m.subject, m.status
    FROM outreach_messages m
    JOIN prospects p ON p.id = m.prospect_id
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all() as Array<Record<string, unknown>>

  db.close()

  return `## Prospect Pipeline Overview
- Total prospects: ${stats.total}
- Enriched: ${stats.enriched}
- Contactable (has email or twitter): ${stats.contactable}
- High signal: ${stats.highSignal}

## Top Prospects (by signal strength)
${prospects.map(p => `- @${p.github_username}${p.name ? ` (${p.name})` : ''}: signal=${p.signal}, fit=${p.fit || 'unknown'}, ${p.enriched_at ? 'enriched' : 'not enriched'}, status=${p.outreach_status || 'not contacted'}${p.company ? `, company: ${p.company}` : ''}${p.bio ? `\n  Bio: ${p.bio}` : ''}${p.outreach_context ? `\n  Context: ${p.outreach_context}` : ''}`).join('\n')}

## Recent Drafts
${drafts.map(d => `- @${d.github_username}: "${d.subject}" (${d.status})`).join('\n') || 'No drafts yet'}`
}

function broadcastTaskUpdate(task: Task) {
  const data = JSON.stringify(task)
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`)
  })
}

// Process a bulk job in background with sliding window concurrency
async function processBulkJob(job: BulkJob) {
  const MAX_CONCURRENT = 10

  job.status = 'running'
  job.updatedAt = new Date().toISOString()
  saveBulkJobToDb(job)
  broadcastBulkJobUpdate(job)

  // Get prospect data
  const db = new Database(DB_PATH, { readonly: true })
  const prospects = db.prepare(`
    SELECT id, github_username, name, email, twitter
    FROM prospects
    WHERE id IN (${job.prospectIds.join(',')})
  `).all() as Array<{ id: number; github_username: string; name: string | null; email: string | null; twitter: string | null }>
  db.close()

  // Create a map for quick lookup
  const prospectMap = new Map(prospects.map(p => [p.id, p]))

  // Process a single prospect and update progress immediately
  async function processOne(prospectId: number): Promise<void> {
    const prospect = prospectMap.get(prospectId)
    if (!prospect) {
      job.failed++
      job.failedIds.push({ id: prospectId, error: 'Prospect not found' })
      return
    }

    try {
      // Mock test action - just sleep and optionally fail randomly
      if (job.action === 'test') {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))
        if (Math.random() < 0.1) {
          throw new Error('Simulated random failure')
        }
        job.completed++
        job.completedIds.push(prospectId)
        return
      }

      // Build action payload for real actions
      const actionPayload = job.action === 'enrich'
        ? { action: 'enrich', username: prospect.github_username, name: prospect.name }
        : { action: 'draft', username: prospect.github_username, name: prospect.name, email: prospect.email, twitter: prospect.twitter }

      // Send to action endpoint (this triggers the Claude subprocess)
      const response = await fetch('http://localhost:5173/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionPayload)
      })

      if (response.ok) {
        const { taskId } = await response.json() as { taskId: string }

        // Poll for task completion
        let taskDone = false
        let taskError: string | null = null
        while (!taskDone) {
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Check if bulk job was cancelled
          const currentJob = bulkJobs.get(job.id)
          if (currentJob?.status === 'cancelled') {
            taskError = 'Bulk job cancelled'
            break
          }

          // Check task status from our in-memory store
          const task = tasks.get(taskId)
          if (!task) {
            taskError = 'Task not found'
            break
          }
          if (task.status === 'done') {
            taskDone = true
          } else if (task.status === 'error') {
            taskError = task.error || 'Task failed'
            break
          }
        }

        if (taskDone) {
          job.completed++
          job.completedIds.push(prospectId)
        } else {
          job.failed++
          job.failedIds.push({ id: prospectId, error: taskError || 'Unknown error' })
        }
      } else {
        job.failed++
        job.failedIds.push({ id: prospectId, error: `HTTP ${response.status}` })
      }
    } catch (e) {
      job.failed++
      job.failedIds.push({ id: prospectId, error: String(e) })
    }
  }

  // Sliding window concurrency: always keep MAX_CONCURRENT running until done
  let nextIndex = 0
  const activePromises = new Map<number, Promise<void>>()

  // Helper to broadcast updates (debounced to avoid overwhelming clients)
  let updatePending = false
  function scheduleUpdate() {
    if (updatePending) return
    updatePending = true
    setTimeout(() => {
      updatePending = false
      job.updatedAt = new Date().toISOString()
      saveBulkJobToDb(job)
      broadcastBulkJobUpdate(job)
      console.log(`\x1b[36m[BULK]\x1b[0m Job ${job.id}: ${job.completed}/${job.total} completed, ${job.failed} failed`)
    }, 100) // Debounce 100ms
  }

  // Start initial batch of concurrent operations
  while (nextIndex < job.prospectIds.length && activePromises.size < MAX_CONCURRENT) {
    const prospectId = job.prospectIds[nextIndex]
    const idx = nextIndex
    nextIndex++

    const promise = processOne(prospectId).then(() => {
      activePromises.delete(idx)
      scheduleUpdate()
    })
    activePromises.set(idx, promise)
  }

  // Keep the pool full until all items are processed
  while (activePromises.size > 0) {
    // Check if cancelled
    const currentJob = bulkJobs.get(job.id)
    if (currentJob?.status === 'cancelled') {
      console.log(`\x1b[33m[BULK]\x1b[0m Job ${job.id} was cancelled, waiting for ${activePromises.size} active tasks to finish`)
      // Wait for active tasks but don't start new ones
      await Promise.all(activePromises.values())
      job.status = 'cancelled'
      break
    }

    // Wait for at least one to complete
    await Promise.race(activePromises.values())

    // Fill up the pool with new work
    while (nextIndex < job.prospectIds.length && activePromises.size < MAX_CONCURRENT) {
      const currentJob = bulkJobs.get(job.id)
      if (currentJob?.status === 'cancelled') break

      const prospectId = job.prospectIds[nextIndex]
      const idx = nextIndex
      nextIndex++

      const promise = processOne(prospectId).then(() => {
        activePromises.delete(idx)
        scheduleUpdate()
      })
      activePromises.set(idx, promise)
    }
  }

  // Final status
  const finalJob = bulkJobs.get(job.id)
  if (finalJob?.status !== 'cancelled') {
    job.status = job.failed === job.total ? 'failed' : 'completed'
  } else {
    job.status = 'cancelled'
  }
  job.updatedAt = new Date().toISOString()
  saveBulkJobToDb(job)
  broadcastBulkJobUpdate(job)

  console.log(`\x1b[32m[BULK]\x1b[0m Job ${job.id} finished: ${job.status} (${job.completed}/${job.total} completed, ${job.failed} failed)`)
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

      // SSE endpoint for bulk job updates
      server.middlewares.use('/api/bulk/stream', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          })

          // Send initial state of all bulk jobs
          const jobList = Array.from(bulkJobs.values()).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          res.write(`event: init\ndata: ${JSON.stringify(jobList)}\n\n`)

          bulkJobClients.add(res)
          console.log('\x1b[35m[BULK-SSE]\x1b[0m Client connected, total:', bulkJobClients.size)

          req.on('close', () => {
            bulkJobClients.delete(res)
            console.log('\x1b[35m[BULK-SSE]\x1b[0m Client disconnected, total:', bulkJobClients.size)
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Cancel a bulk job
      server.middlewares.use('/api/bulk/cancel', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => body += chunk.toString())
          req.on('end', () => {
            try {
              const { jobId } = JSON.parse(body)
              const job = bulkJobs.get(jobId)
              if (job && job.status === 'running') {
                job.status = 'cancelled'
                job.updatedAt = new Date().toISOString()
                saveBulkJobToDb(job)
                broadcastBulkJobUpdate(job)
                console.log(`\x1b[33m[BULK]\x1b[0m Cancelled job ${jobId}`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, job }))
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Job not found or not running' }))
              }
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Invalid request' }))
            }
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Create a new bulk job
      server.middlewares.use('/api/bulk', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => body += chunk.toString())
          req.on('end', () => {
            try {
              const { action, prospectIds } = JSON.parse(body) as { action: 'enrich' | 'draft' | 'test'; prospectIds: number[] }

              if (!action || !['enrich', 'draft', 'test'].includes(action) || !prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Missing or invalid action/prospectIds' }))
                return
              }

              const jobId = `bulk-${++bulkJobCounter}`
              const now = new Date().toISOString()

              const job: BulkJob = {
                id: jobId,
                action,
                prospectIds,
                status: 'pending',
                total: prospectIds.length,
                completed: 0,
                failed: 0,
                completedIds: [],
                failedIds: [],
                createdAt: now,
                updatedAt: now
              }

              bulkJobs.set(jobId, job)
              saveBulkJobToDb(job)
              broadcastBulkJobUpdate(job)

              console.log(`\x1b[36m[BULK]\x1b[0m Created job ${jobId}: ${action} ${prospectIds.length} prospects`)

              // Start processing in background
              processBulkJob(job)

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, jobId, job }))
            } catch (e) {
              console.error('[BULK] Error creating job:', e)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Failed to create job' }))
            }
          })
        } else if (req.method === 'GET') {
          // List all bulk jobs
          const jobList = Array.from(bulkJobs.values()).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(jobList))
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Chat SSE stream
      server.middlewares.use('/api/chat/stream', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          })

          // Send current session if exists
          const sessions = Array.from(chatSessions.values())
          if (sessions.length > 0) {
            const latest = sessions[sessions.length - 1]
            res.write(`event: init\ndata: ${JSON.stringify(latest)}\n\n`)
          } else {
            res.write(`event: init\ndata: null\n\n`)
          }

          chatClients.add(res)
          console.log('\x1b[35m[CHAT-SSE]\x1b[0m Client connected, total:', chatClients.size)

          req.on('close', () => {
            chatClients.delete(res)
            console.log('\x1b[35m[CHAT-SSE]\x1b[0m Client disconnected, total:', chatClients.size)
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Get or create chat session
      server.middlewares.use('/api/chat/session', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const sessions = Array.from(chatSessions.values())
          const latest = sessions.length > 0 ? sessions[sessions.length - 1] : null
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(latest))
        } else if (req.method === 'DELETE') {
          // Clear chat history
          chatSessions.clear()
          chatSessionCounter = 0
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } else {
          res.writeHead(405)
          res.end()
        }
      })

      // Send chat message
      server.middlewares.use('/api/chat', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => body += chunk.toString())
          req.on('end', () => {
            try {
              const { message } = JSON.parse(body) as { message: string }

              if (!message || !message.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Empty message' }))
                return
              }

              // Get or create session
              let session: ChatSession
              const sessions = Array.from(chatSessions.values())
              if (sessions.length > 0) {
                session = sessions[sessions.length - 1]
              } else {
                const sessionId = `chat-${++chatSessionCounter}`
                session = {
                  id: sessionId,
                  messages: [],
                  status: 'idle',
                  currentResponse: '',
                  currentEvents: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
                chatSessions.set(sessionId, session)
              }

              // Add user message
              session.messages.push({ role: 'user', content: message })
              session.status = 'streaming'
              session.currentResponse = ''
              session.currentEvents = []
              session.updatedAt = new Date().toISOString()
              broadcastChatUpdate(session)

              // Build conversation for context
              const conversationHistory = session.messages.slice(0, -1).map(m =>
                `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`
              ).join('\n\n')

              const userPrompt = conversationHistory
                ? `${conversationHistory}\n\nHuman: ${message}`
                : message

              console.log('\x1b[36m[CHAT]\x1b[0m Processing message:', message.slice(0, 50) + '...')

              // Spawn Claude with system context - let it discover everything else
              const systemPrompt = `You're embedded in the Tenex dashboard - a prospect/recruiting pipeline for finding AI engineers. The SQLite database is at ../prospects.db. You can query it, read files, edit the dashboard code (it's a React/Vite app in the current directory), or do anything else helpful. Keep responses concise.`

              const child = spawn('claude', [
                '-p', userPrompt,
                '--append-system-prompt', systemPrompt,
                '--allowedTools', 'Bash,Read,Glob,Grep,WebFetch,WebSearch,Skill,Task,Write,Edit',
                '--output-format', 'stream-json',
                '--verbose',
              ], {
                cwd: path.resolve(__dirname, '..'),
                stdio: ['ignore', 'pipe', 'pipe']
              })

              let responseText = ''
              const events: ChatStreamEvent[] = []

              child.stdout?.on('data', (data: Buffer) => {
                const text = data.toString()
                const lines = text.split('\n').filter(l => l.trim())

                for (const line of lines) {
                  try {
                    const event = JSON.parse(line)

                    // Handle assistant messages
                    if (event.type === 'assistant' && event.message?.content) {
                      for (const block of event.message.content) {
                        if (block.type === 'text' && block.text) {
                          responseText += block.text
                          events.push({ type: 'text', content: block.text })
                        }
                        if (block.type === 'tool_use') {
                          const input = block.input?.command || block.input?.url || block.input?.pattern || block.input?.file_path || block.input?.query || block.input?.skill || JSON.stringify(block.input || {}).slice(0, 200)
                          events.push({ type: 'tool_call', tool: block.name, content: input })
                          console.log('\x1b[36m[CHAT]\x1b[0m Tool call:', block.name)
                        }
                      }
                    }

                    // Handle tool results
                    if (event.type === 'user' && event.tool_use_result) {
                      const result = event.tool_use_result
                      const output = result.stdout || result.content || ''
                      if (output && output.trim()) {
                        events.push({ type: 'tool_result', content: output.slice(0, 500) })
                      }
                    }

                    session.currentResponse = responseText
                    session.currentEvents = events
                    session.updatedAt = new Date().toISOString()
                    broadcastChatUpdate(session)
                  } catch {
                    // Ignore parse errors
                  }
                }
              })

              child.stderr?.on('data', (data: Buffer) => {
                console.error('\x1b[31m[CHAT-ERR]\x1b[0m', data.toString())
              })

              child.on('close', (code) => {
                if (code === 0 && responseText) {
                  // Save both content and tool events with the message
                  session.messages.push({
                    role: 'assistant',
                    content: responseText,
                    events: events.filter(e => e.type !== 'text') // Keep tool_call and tool_result
                  })
                  session.status = 'idle'
                  session.currentResponse = ''
                  session.currentEvents = []
                  console.log('\x1b[32m[CHAT]\x1b[0m Response complete')
                } else {
                  session.status = 'error'
                  console.error('\x1b[31m[CHAT]\x1b[0m Error, exit code:', code)
                }
                session.updatedAt = new Date().toISOString()
                broadcastChatUpdate(session)
              })

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, sessionId: session.id }))

            } catch (e) {
              console.error('[CHAT] Error:', e)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Failed to process message' }))
            }
          })
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
              } else if (action.action === 'update_draft') {
                // Direct DB update for draft edits
                const db = new Database(DB_PATH)
                db.prepare(`UPDATE outreach_messages SET subject = ?, body = ? WHERE id = ?`).run(action.subject, action.body, action.draftId)
                db.close()
                console.log(`\x1b[32m[DRAFT]\x1b[0m Updated draft ${action.draftId}`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
                return
              } else if (action.action === 'delete_draft') {
                // Delete a draft
                const db = new Database(DB_PATH)
                db.prepare(`DELETE FROM outreach_messages WHERE id = ?`).run(action.draftId)
                db.close()
                console.log(`\x1b[31m[DRAFT]\x1b[0m Deleted draft ${action.draftId}`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
                return
              } else if (action.action === 'update_outreach_status') {
                // Direct DB update for outreach status
                const db = new Database(DB_PATH)
                db.prepare(`UPDATE prospects SET outreach_status = ? WHERE github_username = ?`).run(action.status, action.username)
                db.close()
                console.log(`\x1b[32m[STATUS]\x1b[0m Set ${action.username} to ${action.status}`)
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

2. Pick a source. Options:

   - Twitter/Nitter: Great for real-time content - engineers post about what they're building daily.
     Use /agent-browser to search nitter.poast.org
     Search ideas: "gemini flash", "opus", "vibe coding", "cursor composer", "ai agent", "mcp server", "agent skills", "just launched", "just shipped", "open sourced", "weekend project", "vercel/ai", "browser-use", "anthropic sdk", "claude code", "ralph loop", "ralph tui"

   - Hacker News: WebFetch the Algolia API for Show HN posts about AI tools

   - GitHub: Use gh CLI to find information about contributors who may use AI. GitHub can often be a good source to find an email, real contributions, or a personal website.

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
