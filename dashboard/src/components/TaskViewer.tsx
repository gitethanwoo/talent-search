import { useState } from 'react'

interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
  timestamp?: string
}

interface MockTask {
  id: string
  action: string
  target: string
  status: 'running' | 'done' | 'error'
  events: StreamEvent[]
}

// Mock data for UI iteration
const MOCK_TASKS: MockTask[] = [
  {
    id: 'task-1',
    action: 'enrich',
    target: 'finbarr',
    status: 'running',
    events: [
      { type: 'text', content: "I'll enrich the prospect @finbarr. Let me start by checking their current data." },
      { type: 'tool_call', tool: 'Bash', content: 'sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username=\'finbarr\'"' },
      { type: 'tool_result', tool: 'Bash', content: `id  github_username  name            email                    twitter   location
5   finbarr          Finbarr Taylor  finbarrtaylor@gmail.com  @finbarr  Silicon Valley, CA` },
      { type: 'text', content: "Good, I have their basic info. Now let me verify and expand on this by checking GitHub for more details." },
      { type: 'tool_call', tool: 'WebFetch', content: 'https://api.github.com/users/finbarr' },
      { type: 'tool_result', tool: 'WebFetch', content: `{
  "login": "finbarr",
  "name": "Finbarr Taylor",
  "company": "Init.ai (acquired)",
  "blog": "https://finbarr.ca",
  "location": "San Francisco",
  "bio": "Building things. Previously co-founded Init.ai (acquired by Apple).",
  "public_repos": 42,
  "followers": 1205
}` },
      { type: 'text', content: "Excellent! I found their personal site. Let me check for additional contact methods and recent activity." },
      { type: 'tool_call', tool: 'WebFetch', content: 'https://finbarr.ca' },
      { type: 'tool_call', tool: 'Bash', content: 'gh api users/finbarr/events --jq \'.[0:5] | .[] | .type\'' },
    ]
  },
  {
    id: 'task-2',
    action: 'draft',
    target: 'atomic14',
    status: 'done',
    events: [
      { type: 'text', content: "I'll draft a personalized outreach message for @atomic14." },
      { type: 'tool_call', tool: 'Bash', content: 'sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username=\'atomic14\'"' },
      { type: 'tool_result', tool: 'Bash', content: `id  github_username  name             email                     signal  notes
12  atomic14         Chris (atomic14)  chris@cmgresearch.com    high    97 contributions to vercel/ai SDK` },
      { type: 'text', content: "Based on their contributions to the Vercel AI SDK, I'll craft a message highlighting their AI expertise." },
      { type: 'tool_call', tool: 'Bash', content: `sqlite3 prospects.db "INSERT INTO outreach_messages (prospect_id, channel, message_type, subject, body, status) VALUES (12, 'email', 'initial', 'Your Vercel AI contributions', 'Hey Chris...', 'draft')"` },
      { type: 'tool_result', tool: 'Bash', content: '' },
      { type: 'text', content: "Draft saved successfully. The message references their specific contributions to the Vercel AI SDK." },
    ]
  },
  {
    id: 'task-3',
    action: 'enrich',
    target: 'test-user',
    status: 'error',
    events: [
      { type: 'text', content: "I'll enrich the prospect @test-user." },
      { type: 'tool_call', tool: 'Bash', content: 'sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username=\'test-user\'"' },
      { type: 'tool_result', tool: 'Bash', content: 'Error: no such user found' },
      { type: 'text', content: "The prospect @test-user was not found in the database." },
    ]
  }
]

function ToolBadge({ tool }: { tool: string }) {
  const colors: Record<string, string> = {
    Bash: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    WebFetch: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    WebSearch: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    Read: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Edit: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    Grep: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    TodoWrite: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
  }

  const colorClass = colors[tool] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${colorClass}`}>
      {tool}
    </span>
  )
}

function StreamEventView({ event, isLast }: { event: StreamEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(true)

  if (event.type === 'text') {
    return (
      <div className="py-2 text-zinc-300 leading-relaxed">
        {event.content}
      </div>
    )
  }

  if (event.type === 'tool_call') {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-zinc-600">▶</span>
          <ToolBadge tool={event.tool || 'Unknown'} />
        </div>
        <div className="ml-4 pl-3 border-l border-zinc-800">
          <pre className="font-mono text-xs text-zinc-500 whitespace-pre-wrap break-all">{event.content}</pre>
        </div>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    const hasContent = event.content && event.content.trim().length > 0
    if (!hasContent) return null

    const isLong = event.content.length > 200

    return (
      <div className="py-1 ml-4 pl-3 border-l border-zinc-800">
        {isLong ? (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors text-xs font-mono"
            >
              <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
              <span>{expanded ? 'Hide' : 'Show'} output ({event.content.length} chars)</span>
            </button>
            {expanded && (
              <pre className="mt-2 p-3 bg-zinc-900/50 border border-zinc-800 font-mono text-xs text-zinc-400 whitespace-pre-wrap break-all overflow-x-auto max-h-[300px] overflow-y-auto">
                {event.content}
              </pre>
            )}
          </div>
        ) : (
          <pre className="p-2 bg-zinc-900/30 font-mono text-xs text-zinc-500 whitespace-pre-wrap break-all">
            {event.content}
          </pre>
        )}
      </div>
    )
  }

  return null
}

function TaskCard({ task, isSelected, onSelect }: { task: MockTask; isSelected: boolean; onSelect: () => void }) {
  const statusColors = {
    running: 'bg-amber-400',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }

  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3 border-b border-zinc-800 cursor-pointer transition-all ${
        isSelected ? 'bg-zinc-800/50 border-l-2 border-l-amber-500' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[task.status]} ${task.status === 'running' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{task.action}</span>
            <span className="font-mono text-sm text-zinc-300 truncate">@{task.target}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskOutput({ task }: { task: MockTask }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${
            task.status === 'running' ? 'bg-amber-400 animate-pulse' :
            task.status === 'done' ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
          <span className="font-mono text-sm text-zinc-300">{task.action}</span>
          <span className="text-zinc-600">→</span>
          <span className="font-mono text-sm text-zinc-400">@{task.target}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          {task.status}
        </span>
      </div>

      {/* Output stream */}
      <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50">
        <div className="space-y-1">
          {task.events.map((event, i) => (
            <StreamEventView key={i} event={event} isLast={i === task.events.length - 1} />
          ))}
          {task.status === 'running' && (
            <div className="flex items-center gap-2 py-2 text-zinc-600">
              <span className="inline-block w-2 h-4 bg-amber-400/80 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TaskViewerPage() {
  const [selectedTaskId, setSelectedTaskId] = useState(MOCK_TASKS[0].id)
  const selectedTask = MOCK_TASKS.find(t => t.id === selectedTaskId)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">Component Preview</h1>
            <p className="font-mono text-xs text-zinc-600 mt-1">Task Viewer with mock data</p>
          </div>
          <a href="/" className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        <div className="border border-zinc-800 bg-zinc-900/30 h-[600px] flex">
          {/* Task list */}
          <div className="w-72 border-r border-zinc-800 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">Agent Tasks</span>
              <span className="ml-2 font-mono text-xs text-amber-400">
                {MOCK_TASKS.filter(t => t.status === 'running').length} running
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {MOCK_TASKS.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => setSelectedTaskId(task.id)}
                />
              ))}
            </div>
          </div>

          {/* Output panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedTask ? (
              <TaskOutput task={selectedTask} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-sm">
                Select a task
              </div>
            )}
          </div>
        </div>

        {/* Design notes */}
        <div className="mt-6 p-4 border border-zinc-800 bg-zinc-900/20">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-3">Design Notes</h3>
          <ul className="font-mono text-xs text-zinc-600 space-y-1">
            <li>• Tool badges color-coded by type (Bash=green, WebFetch=blue, etc.)</li>
            <li>• Tool results collapsible when long (&gt;200 chars)</li>
            <li>• Running tasks have pulsing cursor indicator</li>
            <li>• Left border accent on selected task</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
