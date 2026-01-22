import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import TaskViewerPage from './components/TaskViewer'

interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
}

interface AgentTask {
  id: string
  action: string
  target: string
  status: 'running' | 'done' | 'error'
  startedAt: string
  completedAt?: string
  error?: string
  lastOutput?: string
  fullOutput?: string
  events?: StreamEvent[]
}

interface Stats {
  prospects: number
  high_signal: number
  ships_fast: number
  ai_native: number
  sources: number
  rejected: number
}

interface Prospect {
  id: number
  github_username: string
  name: string | null
  email: string | null
  twitter: string | null
  location: string | null
  company: string | null
  signal: string
  ships_fast: number
  ai_native: number
  source: string | null
  outreach_status: string | null
  notes: string | null
  bio: string | null
  comp_fit: string | null
  outreach_context: string | null
  fit: string | null
}

interface Draft {
  id: number
  github_username: string
  name: string | null
  email: string | null
  twitter: string | null
  subject: string
  body: string
  channel: string
  status: string
  created_at: string
}

interface Source {
  source_type: string
  source_name: string
  checked_at: string
}

interface Data {
  stats: Stats
  prospects: Prospect[]
  drafts: Draft[]
  sources: Source[]
}

function mailto(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function Tooltip({ children, text }: { children: ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  const [delayedShow, setDelayedShow] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (show) {
      timer = setTimeout(() => setDelayedShow(true), 300)
    } else {
      setDelayedShow(false)
    }
    return () => clearTimeout(timer)
  }, [show])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {delayedShow && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-mono bg-zinc-800 text-zinc-200 border border-zinc-700 whitespace-nowrap">
          {text}
        </span>
      )}
    </span>
  )
}

function StatCard({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div className="group relative">
      <div className={`absolute inset-0 ${accent || 'bg-zinc-700'} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }} />
      <div className="relative border border-zinc-800 bg-zinc-950 p-4 transition-all duration-300 group-hover:border-zinc-600" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}>
        <div className={`font-mono text-4xl font-bold tracking-tighter ${accent ? accent.replace('bg-', 'text-') : 'text-zinc-300'}`}>
          {value.toString().padStart(2, '0')}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 mt-1">{label}</div>
      </div>
    </div>
  )
}

function DraftCard({ draft, index }: { draft: Draft; index: number }) {
  const [open, setOpen] = useState(false)
  const [rewriting, setRewriting] = useState(false)

  const handleRewrite = (e: React.MouseEvent) => {
    e.stopPropagation()
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rewrite',
        draftId: draft.id,
        username: draft.github_username,
        name: draft.name,
        subject: draft.subject,
        body: draft.body
      })
    })
    setRewriting(true)
    setTimeout(() => setRewriting(false), 3000)
  }

  const contactButton = draft.email ? (
    <a
      href={mailto(draft.email, draft.subject, draft.body)}
      className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 hover:border-emerald-400 transition-all"
      onClick={e => e.stopPropagation()}
    >
      → Send Email
    </a>
  ) : draft.twitter ? (
    <a
      href={`https://twitter.com/${draft.twitter.replace('@', '')}`}
      target="_blank"
      className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 hover:border-sky-400 transition-all"
      onClick={e => e.stopPropagation()}
    >
      → DM on X
    </a>
  ) : (
    <span className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 text-zinc-600 border border-zinc-800">No Contact</span>
  )

  return (
    <div
      className="border-l-2 border-zinc-800 hover:border-amber-500 transition-colors duration-300"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className="cursor-pointer flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-zinc-600 text-xs">{(index + 1).toString().padStart(2, '0')}</span>
          <div>
            <span className="font-medium text-zinc-200">{draft.name || draft.github_username}</span>
            <span className="mx-3 text-zinc-700">—</span>
            <span className="text-zinc-500 italic">{draft.subject}</span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 text-zinc-500 border border-zinc-800">{draft.channel}</span>
          {contactButton}
          <span className={`font-mono text-zinc-600 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▸</span>
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pl-12">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">
              {draft.email || 'no email on file'}
            </div>
            <button
              onClick={handleRewrite}
              disabled={rewriting}
              className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-all ${
                rewriting
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'text-zinc-500 border-zinc-700 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10'
              }`}
            >
              {rewriting ? '↻ Rewriting...' : '↻ Rewrite'}
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ label, color, action }: { label: string; color: 'cyan' | 'emerald' | 'red'; action: object }) {
  const [clicked, setClicked] = useState(false)

  const colorStyles = {
    cyan: 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 active:bg-cyan-500/40',
    emerald: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/40',
    red: 'border-red-500/30 text-red-400 hover:bg-red-500/20 active:bg-red-500/40'
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    })
    setClicked(true)
    setTimeout(() => setClicked(false), 1500)
  }

  return (
    <button
      onClick={handleClick}
      className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 border transition-all duration-150 active:scale-95 ${colorStyles[color]} ${clicked ? 'bg-white/10' : ''}`}
    >
      {clicked ? '✓ Sent' : label}
    </button>
  )
}

function DraftModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [rewriting, setRewriting] = useState(false)

  const handleRewrite = () => {
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rewrite',
        draftId: draft.id,
        username: draft.github_username,
        name: draft.name,
        subject: draft.subject,
        body: draft.body
      })
    })
    setRewriting(true)
    setTimeout(() => setRewriting(false), 3000)
  }

  const contactButton = draft.email ? (
    <a
      href={mailto(draft.email, draft.subject, draft.body)}
      className="font-mono text-xs uppercase tracking-wider px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
    >
      → Send Email
    </a>
  ) : draft.twitter ? (
    <a
      href={`https://twitter.com/${draft.twitter.replace('@', '')}`}
      target="_blank"
      className="font-mono text-xs uppercase tracking-wider px-4 py-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-all"
    >
      → DM on X
    </a>
  ) : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <div className="font-medium text-zinc-200">{draft.name || draft.github_username}</div>
            <div className="font-mono text-xs text-zinc-500 mt-1">{draft.email || draft.twitter || 'no contact'}</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Subject */}
        <div className="px-6 py-3 border-b border-zinc-800/50">
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Subject</div>
          <div className="text-zinc-300 italic">{draft.subject}</div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto">
          <div className="font-mono text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={handleRewrite}
            disabled={rewriting}
            className={`font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-all ${
              rewriting
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'text-zinc-500 border-zinc-700 hover:text-amber-400 hover:border-amber-500/50'
            }`}
          >
            {rewriting ? '↻ Rewriting...' : '↻ Rewrite'}
          </button>
          {contactButton}
        </div>
      </div>
    </div>
  )
}

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
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${colors[tool] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
      {tool}
    </span>
  )
}

function StreamEventView({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(true)

  if (event.type === 'text') {
    return <div className="py-1.5 text-zinc-300 leading-relaxed text-sm">{event.content}</div>
  }

  if (event.type === 'tool_call') {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 text-xs">▶</span>
          <ToolBadge tool={event.tool || 'Unknown'} />
        </div>
        <div className="ml-4 pl-3 border-l border-zinc-800 mt-1">
          <pre className="font-mono text-xs text-zinc-500 whitespace-pre-wrap break-all">{event.content}</pre>
        </div>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    const isLong = event.content.length > 300
    return (
      <div className="py-1 ml-4 pl-3 border-l border-zinc-800">
        {isLong ? (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors text-xs font-mono"
            >
              <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
              <span>{expanded ? 'Hide' : 'Show'} ({event.content.length} chars)</span>
            </button>
            {expanded && (
              <pre className="mt-1 p-2 bg-zinc-900/50 border border-zinc-800 font-mono text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
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

type PanelMode = 'minimized' | 'normal' | 'expanded'
type TaskView = 'active' | 'history'

function TaskPanel() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [mode, setMode] = useState<PanelMode>('normal')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [view, setView] = useState<TaskView>('active')

  // Use SSE for real-time streaming updates
  useEffect(() => {
    const eventSource = new EventSource('/api/tasks/stream')

    eventSource.addEventListener('init', (e) => {
      const taskList = JSON.parse(e.data)
      setTasks(taskList)
      setConnected(true)
    })

    eventSource.onmessage = (e) => {
      const updatedTask = JSON.parse(e.data) as AgentTask
      setTasks(prev => {
        const existing = prev.find(t => t.id === updatedTask.id)
        if (existing) {
          return prev.map(t => t.id === updatedTask.id ? updatedTask : t)
        } else {
          return [updatedTask, ...prev]
        }
      })
    }

    eventSource.onerror = () => {
      setConnected(false)
    }

    return () => eventSource.close()
  }, [])

  const runningCount = tasks.filter(t => t.status === 'running').length
  const completedCount = tasks.filter(t => t.status !== 'running').length
  const activeTasks = tasks.filter(t => t.status === 'running')
  const historyTasks = tasks.filter(t => t.status !== 'running')
  const displayedTasks = view === 'active' ? (activeTasks.length > 0 ? activeTasks : tasks.slice(0, 5)) : historyTasks
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null

  // Auto-select first running task if none selected
  useEffect(() => {
    if (!selectedTaskId && runningCount > 0) {
      const firstRunning = tasks.find(t => t.status === 'running')
      if (firstRunning) setSelectedTaskId(firstRunning.id)
    }
  }, [tasks, selectedTaskId, runningCount])

  // Minimized: just a small bar
  if (mode === 'minimized') {
    return (
      <div
        className="fixed bottom-4 right-4 bg-zinc-950 border border-zinc-800 shadow-2xl z-50 cursor-pointer hover:bg-zinc-900/50 transition-colors"
        onClick={() => setMode('normal')}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Tasks</span>
          {runningCount > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="font-mono text-xs text-amber-400">{runningCount}</span>
            </span>
          )}
          {!connected && <span className="w-2 h-2 bg-red-400 rounded-full" title="Disconnected" />}
        </div>
      </div>
    )
  }

  // Expanded: takes most of the screen
  if (mode === 'expanded') {
    return (
      <div className="fixed inset-4 bg-zinc-950 border border-zinc-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Agent Tasks</span>
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5">
              <button
                onClick={() => setView('active')}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1 transition-all ${
                  view === 'active' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                Active {runningCount > 0 && <span className="text-amber-400 ml-1">{runningCount}</span>}
              </button>
              <button
                onClick={() => setView('history')}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1 transition-all ${
                  view === 'history' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                History {completedCount > 0 && <span className="text-zinc-500 ml-1">{completedCount}</span>}
              </button>
            </div>
            {!connected && <span className="text-xs text-red-400">(reconnecting...)</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('normal')}
              className="p-1.5 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
              title="Restore"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setMode('minimized')}
              className="p-1.5 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
              title="Minimize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Split view: task list on left, output on right */}
        <div className="flex flex-1 min-h-0">
          {/* Task list */}
          <div className="w-80 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
            {displayedTasks.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="font-mono text-xs text-zinc-600">
                  {view === 'active' ? 'No active tasks' : 'No task history'}
                </div>
              </div>
            ) : (
              displayedTasks.map(task => (
                <div
                  key={task.id}
                  className={`px-4 py-3 border-b border-zinc-900 cursor-pointer transition-colors ${
                    selectedTaskId === task.id ? 'bg-zinc-800/50' : 'hover:bg-zinc-900/50'
                  }`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-2">
                    {task.status === 'running' && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />}
                    {task.status === 'done' && <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />}
                    {task.status === 'error' && <span className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />}
                    <span className="font-mono text-xs uppercase text-zinc-500">{task.action}</span>
                    <span className="font-mono text-sm text-zinc-300 truncate">@{task.target}</span>
                  </div>
                  {view === 'history' && task.completedAt && (
                    <div className="font-mono text-[10px] text-zinc-600 mt-1">
                      {new Date(task.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Output panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedTask ? (
              <>
                <div className="px-4 py-2 border-b border-zinc-800 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-300">{selectedTask.action}</span>
                      <span className="text-zinc-600">→</span>
                      <span className="font-mono text-sm text-zinc-400">@{selectedTask.target}</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {selectedTask.status === 'running' ? 'running...' : selectedTask.status}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-zinc-900/30">
                  {selectedTask.events && selectedTask.events.length > 0 ? (
                    <div className="space-y-1">
                      {selectedTask.events.map((event, i) => (
                        <StreamEventView key={i} event={event} />
                      ))}
                      {selectedTask.status === 'running' && (
                        <div className="flex items-center gap-2 py-2">
                          <span className="inline-block w-2 h-4 bg-amber-400/80 animate-pulse" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-zinc-600 font-mono text-sm">No output yet...</div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-sm">
                Select a task to view output
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Normal mode: bottom-right panel
  const normalTasks = view === 'active' ? (activeTasks.length > 0 ? activeTasks : tasks.slice(0, 3)) : historyTasks.slice(0, 10)

  return (
    <div className="fixed bottom-4 right-4 w-[500px] bg-zinc-950 border border-zinc-800 shadow-2xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Tasks</span>
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 p-0.5">
            <button
              onClick={() => setView('active')}
              className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 transition-all ${
                view === 'active' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              Active{runningCount > 0 && <span className="text-amber-400 ml-1">{runningCount}</span>}
            </button>
            <button
              onClick={() => setView('history')}
              className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 transition-all ${
                view === 'history' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              History
            </button>
          </div>
          {!connected && <span className="text-xs text-red-400">(reconnecting...)</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('expanded')}
            className="p-1.5 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
            title="Expand"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => setMode('minimized')}
            className="p-1.5 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
            title="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {normalTasks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="font-mono text-xs text-zinc-600">
              {view === 'active' ? 'No active tasks' : 'No task history'}
            </div>
          </div>
        ) : (
          normalTasks.map(task => (
            <div
              key={task.id}
              className="px-4 py-3 border-b border-zinc-900 last:border-0 cursor-pointer hover:bg-zinc-900/30"
              onClick={() => { setSelectedTaskId(task.id); setMode('expanded') }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {task.status === 'running' && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
                  {task.status === 'done' && <span className="w-2 h-2 bg-emerald-400 rounded-full" />}
                  {task.status === 'error' && <span className="w-2 h-2 bg-red-400 rounded-full" />}
                  <span className="font-mono text-xs uppercase text-zinc-500">{task.action}</span>
                  <span className="font-mono text-sm text-zinc-300">@{task.target}</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-600">
                  {task.status === 'running' ? 'running...' : task.status}
                </span>
              </div>
              {view === 'history' && task.completedAt && (
                <div className="font-mono text-[10px] text-zinc-600 mb-1">
                  {new Date(task.completedAt).toLocaleString()}
                </div>
              )}
              {task.lastOutput && view === 'active' && (
                <div className="mt-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded">
                  <pre className="font-mono text-xs text-zinc-400 whitespace-pre-wrap break-words leading-relaxed line-clamp-4">{task.lastOutput}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ProspectRow({ p, isExpanded, onToggle, hasDraft, onDraftClick }: { p: Prospect; isExpanded: boolean; onToggle: () => void; hasDraft: boolean; onDraftClick?: () => void }) {
  const signalStyles = {
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-zinc-800 text-zinc-500 border-zinc-700'
  }
  const signalClass = signalStyles[p.signal as keyof typeof signalStyles] || signalStyles.low

  const outreachStyles: Record<string, string> = {
    not_contacted: 'bg-zinc-800 text-zinc-500 border-zinc-700',
    in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    replied: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    interested: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    closed: 'bg-red-500/20 text-red-400 border-red-500/30'
  }
  const outreachStatus = p.outreach_status || 'not_contacted'
  const outreachClass = outreachStyles[outreachStatus] || outreachStyles.not_contacted

  const hasDetails = p.notes || p.bio || p.company || p.location || p.comp_fit || p.outreach_context
  const contactable = isContactable(p)

  return (
    <>
      <tr
        className={`border-t border-zinc-900 hover:bg-zinc-900/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-zinc-900/50' : ''} ${!contactable ? 'opacity-50' : ''}`}
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <a
            href={`https://github.com/${p.github_username}`}
            className="font-mono text-sm text-zinc-400 hover:text-white transition-colors"
            target="_blank"
            onClick={e => e.stopPropagation()}
          >
            @{p.github_username}
          </a>
        </td>
        <td className="py-3 px-4 text-zinc-300">{p.name || <span className="text-zinc-700">—</span>}</td>
        <td className="py-3 px-4 text-center">
          <ContactIcons p={p} />
        </td>
        <td className="py-3 px-4">
          {p.email ? (
            <a href={`mailto:${p.email}`} className="font-mono text-xs text-zinc-500 hover:text-emerald-400 transition-colors" onClick={e => e.stopPropagation()}>{p.email}</a>
          ) : <span className="text-zinc-800">—</span>}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border ${signalClass}`}>{p.signal}</span>
            {p.fit === 'unlikely' && (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border bg-zinc-800 text-zinc-500 border-zinc-700">unlikely</span>
            )}
            {p.fit === 'likely' && (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">likely</span>
            )}
          </div>
        </td>
                <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border whitespace-nowrap ${outreachClass}`}>{outreachStatus.replace('_', ' ')}</span>
            {hasDraft && (
              <Tooltip text="Draft ready - click to view">
                <button
                  onClick={(e) => { e.stopPropagation(); onDraftClick?.() }}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
        </td>
        <td className="py-3 px-4 max-w-[140px]">
          <div className="flex items-center gap-2">
            <Tooltip text={p.source || ''}>
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider truncate block max-w-[120px]">{p.source || '—'}</span>
            </Tooltip>
            {hasDetails && (
              <span className={`font-mono text-zinc-600 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionButton
              label="Enrich"
              color="cyan"
              action={{ action: 'enrich', username: p.github_username, name: p.name }}
            />
            <ActionButton
              label="Draft"
              color="emerald"
              action={{ action: 'draft', username: p.github_username, name: p.name, email: p.email, twitter: p.twitter }}
            />
            {p.fit !== 'unlikely' ? (
              <ActionButton
                label="Unlikely"
                color="red"
                action={{ action: 'set_fit', username: p.github_username, fit: 'unlikely' }}
              />
            ) : (
              <ActionButton
                label="Likely"
                color="emerald"
                action={{ action: 'set_fit', username: p.github_username, fit: 'likely' }}
              />
            )}
          </div>
        </td>
      </tr>
      {hasDetails && (
        <tr className={!contactable ? 'opacity-50' : ''}>
          <td colSpan={8} className="p-0">
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="px-4 py-4 pl-12 bg-zinc-900/30 border-t border-zinc-800/50">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left column - Basic info */}
                  <div className="space-y-3">
                    {p.bio && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Bio</div>
                        <div className="text-sm text-zinc-400">{p.bio}</div>
                      </div>
                    )}
                    {(p.company || p.location) && (
                      <div className="flex gap-6">
                        {p.company && (
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Company</div>
                            <div className="text-sm text-zinc-300">{p.company}</div>
                          </div>
                        )}
                        {p.location && (
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Location</div>
                            <div className="text-sm text-zinc-300">{p.location}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Right column - Evidence/notes */}
                  <div className="space-y-3">
                    {p.notes && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Notes / Evidence</div>
                        <div className="text-sm text-zinc-400 whitespace-pre-wrap">{p.notes}</div>
                      </div>
                    )}
                    {p.comp_fit && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Comp Fit</div>
                        <div className="text-sm text-zinc-400">{p.comp_fit}</div>
                      </div>
                    )}
                    {p.outreach_context && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Outreach Context</div>
                        <div className="text-sm text-zinc-400">{p.outreach_context}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

type OutreachFilter = 'all' | 'not_contacted' | 'in_progress' | 'replied' | 'interested' | 'closed'

const outreachFilterLabels: Record<OutreachFilter, string> = {
  all: 'All',
  not_contacted: 'Not Contacted',
  in_progress: 'In Progress',
  replied: 'Replied',
  interested: 'Interested',
  closed: 'Closed'
}

function isContactable(p: Prospect): boolean {
  return !!(p.email || p.twitter)
}

function ContactIcons({ p }: { p: Prospect }) {
  const hasEmail = !!p.email
  const hasTwitter = !!p.twitter

  if (!hasEmail && !hasTwitter) {
    return <span className="text-zinc-700">—</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      {hasEmail && (
        <span title={p.email || 'Email'} className="text-emerald-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
            <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
          </svg>
        </span>
      )}
      {hasTwitter && (
        <a
          href={`https://twitter.com/${p.twitter?.replace('@', '')}`}
          target="_blank"
          title={p.twitter || 'Twitter'}
          className="text-sky-400 hover:text-sky-300 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
    </div>
  )
}

function App() {
  // Simple routing: /components shows the component preview page
  const isComponentPage = window.location.pathname === '/components' || window.location.search.includes('view=components')

  if (isComponentPage) {
    return <TaskViewerPage />
  }

  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'drafts' | 'prospects' | 'sources'>('prospects')
  const [draftModal, setDraftModal] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [expandedProspectId, setExpandedProspectId] = useState<number | null>(null)
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>('all')
  const [contactableOnly, setContactableOnly] = useState(false)

  const fetchData = () => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setTimeout(() => setLoaded(true), 100)
      })
      .catch(console.error)
  }

  useEffect(() => {
    fetchData()
    // Refresh data every 5 seconds for live updates
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Compute outreach filter counts
  const outreachCounts = data ? (Object.keys(outreachFilterLabels) as OutreachFilter[]).reduce((acc, key) => {
    if (key === 'all') {
      acc[key] = data.prospects.length
    } else {
      acc[key] = data.prospects.filter(p => (p.outreach_status || 'not_contacted') === key).length
    }
    return acc
  }, {} as Record<OutreachFilter, number>) : {} as Record<OutreachFilter, number>

  // Compute contactable count
  const contactableCount = data ? data.prospects.filter(isContactable).length : 0

  // Filter prospects based on outreach status and contactable filter
  const filteredProspects = data ? data.prospects.filter(p => {
    const matchesOutreach = outreachFilter === 'all' || (p.outreach_status || 'not_contacted') === outreachFilter
    const matchesContactable = !contactableOnly || isContactable(p)
    return matchesOutreach && matchesContactable
  }) : []

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="font-mono text-zinc-600 animate-pulse">LOADING_</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-zinc-950 transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      <TaskPanel />
      {draftModal && <DraftModal draft={draftModal} onClose={() => setDraftModal(null)} />}
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-4">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-white">TENEX</h1>
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Prospect Intelligence</span>
            </div>
            <button
              onClick={() => {
                fetch('/api/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'research' })
                })
              }}
              className="font-mono text-xs uppercase tracking-wider px-4 py-2 bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 hover:border-violet-400 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M9 6a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 6z" />
                <path fillRule="evenodd" d="M2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9zm7-5.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" clipRule="evenodd" />
              </svg>
              Find Candidates
            </button>
          </div>
          <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-800 to-transparent" />
        </header>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-12">
          <StatCard value={data.stats.prospects} label="Total" />
          <StatCard value={contactableCount} label="Contactable" accent="bg-cyan-500" />
          <StatCard value={data.stats.high_signal} label="High Signal" accent="bg-emerald-500" />
          <StatCard value={data.stats.sources} label="Sources" accent="bg-amber-500" />
          <StatCard value={data.stats.rejected} label="Rejected" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-zinc-900">
          {(['drafts', 'prospects', 'sources'] as const).map(t => (
            <button
              key={t}
              className={`font-mono text-xs uppercase tracking-[0.15em] px-6 py-3 transition-all border-b-2 -mb-px ${
                tab === t
                  ? 'text-white border-white'
                  : 'text-zinc-600 border-transparent hover:text-zinc-400'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
              <span className={`ml-2 ${tab === t ? 'text-zinc-400' : 'text-zinc-700'}`}>
                {t === 'drafts' ? data.drafts.length : t === 'prospects' ? data.prospects.length : data.sources.length}
              </span>
            </button>
          ))}
        </div>

        {/* Drafts Tab */}
        {tab === 'drafts' && (
          <div className="space-y-1">
            {data.drafts.length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-zinc-700 text-sm">NO_DRAFTS_PENDING</div>
              </div>
            ) : (
              data.drafts.map((d, i) => <DraftCard key={d.id} draft={d} index={i} />)
            )}
          </div>
        )}

        {/* Prospects Tab */}
        {tab === 'prospects' && (
          <div>
            {/* Filters */}
            <div className="mb-4 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Filter by status:</span>
                <select
                  value={outreachFilter}
                  onChange={e => setOutreachFilter(e.target.value as OutreachFilter)}
                  className="font-mono text-sm bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-2 focus:outline-none focus:border-zinc-600 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  {(Object.keys(outreachFilterLabels) as OutreachFilter[]).map(key => (
                    <option key={key} value={key}>
                      {outreachFilterLabels[key]} ({outreachCounts[key]})
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={contactableOnly}
                  onChange={e => setContactableOnly(e.target.checked)}
                  className="w-4 h-4 bg-zinc-900 border border-zinc-700 rounded-none text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  Contactable only
                </span>
              </label>
            </div>
            <div className="border border-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Handle</th>
                    <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Name</th>
                    <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Contact</th>
                    <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Email</th>
                    <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Signal</th>
                                        <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Outreach</th>
                    <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 max-w-[140px]">Source</th>
                    <th className="text-right py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProspects.map((p) => (
                    <ProspectRow
                      key={p.id}
                      p={p}
                      isExpanded={expandedProspectId === p.id}
                      onToggle={() => setExpandedProspectId(expandedProspectId === p.id ? null : p.id)}
                      hasDraft={data.drafts.some(d => d.github_username === p.github_username)}
                      onDraftClick={() => {
                        const draft = data.drafts.find(d => d.github_username === p.github_username)
                        if (draft) setDraftModal(draft)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sources Tab */}
        {tab === 'sources' && (
          <div className="border border-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 w-12">#</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 w-32">Type</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Source</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 w-48">Checked</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s, i) => (
                  <tr key={i} className="border-t border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-700 text-xs">{(i + 1).toString().padStart(2, '0')}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 text-amber-400 border border-amber-500/30 bg-amber-500/10">{s.source_type}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-zinc-400">{s.source_name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600">{s.checked_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-zinc-900 flex items-center justify-between">
          <div className="font-mono text-[10px] text-zinc-700 uppercase tracking-wider">
            Refresh: <code className="text-zinc-500 ml-1">python3 export.py</code>
          </div>
          <div className="font-mono text-[10px] text-zinc-800">
            TENEX INTELLIGENCE v0.1
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
