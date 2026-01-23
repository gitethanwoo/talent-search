import { useState, useEffect } from 'react'
import type { AgentTask } from '../../types'
import { StreamEventView } from './StreamEventView'

type PanelMode = 'minimized' | 'normal' | 'expanded'
type TaskView = 'active' | 'history'

export function TaskPanel() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [mode, setMode] = useState<PanelMode>('minimized')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [view, setView] = useState<TaskView>('active')
  const [userMinimized, setUserMinimized] = useState(false)

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
  const displayedTasks = view === 'active' ? activeTasks : historyTasks
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null

  useEffect(() => {
    if (!selectedTaskId && runningCount > 0) {
      const firstRunning = tasks.find(t => t.status === 'running')
      if (firstRunning) setSelectedTaskId(firstRunning.id)
    }
  }, [tasks, selectedTaskId, runningCount])

  // Auto-expand when tasks start running (unless user manually minimized)
  useEffect(() => {
    if (runningCount > 0 && mode === 'minimized' && !userMinimized) {
      setMode('normal')
    }
  }, [runningCount, mode, userMinimized])

  // Minimized mode
  if (mode === 'minimized') {
    return (
      <div
        className="fixed bottom-4 right-4 bg-zinc-950 border border-zinc-800 shadow-2xl z-50 cursor-pointer hover:bg-zinc-900/50 transition-colors"
        onClick={() => { setMode('normal'); setUserMinimized(false) }}
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

  // Expanded mode
  if (mode === 'expanded') {
    return (
      <div className="fixed inset-4 bg-zinc-950 border border-zinc-800 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Agent Tasks</span>
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
              onClick={() => { setMode('minimized'); setUserMinimized(true) }}
              className="p-1.5 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
              title="Minimize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-80 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
            {displayedTasks.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="font-mono text-xs text-zinc-600">
                  {view === 'active' ? 'No active tasks' : 'No task history'}
                </div>
              </div>
            ) : (
              displayedTasks.map(task => {
                const hasEvents = task.events && task.events.length > 0
                const isClickable = hasEvents || task.status === 'running'
                return (
                  <div
                    key={task.id}
                    className={`px-4 py-3 border-b border-zinc-900 transition-colors ${
                      isClickable ? 'cursor-pointer' : ''
                    } ${
                      selectedTaskId === task.id ? 'bg-zinc-800/50' : isClickable ? 'hover:bg-zinc-900/50' : ''
                    }`}
                    onClick={() => isClickable && setSelectedTaskId(task.id)}
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
                )
              })
            )}
          </div>

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

  // Normal mode
  const normalTasks = view === 'active' ? activeTasks : historyTasks.slice(0, 10)

  return (
    <div className="fixed bottom-4 right-4 w-[500px] bg-zinc-950 border border-zinc-800 shadow-2xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Tasks</span>
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
            onClick={() => { setMode('minimized'); setUserMinimized(true) }}
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
          normalTasks.map(task => {
            const hasEvents = task.events && task.events.length > 0
            const isClickable = hasEvents || task.status === 'running'
            return (
              <div
                key={task.id}
                className={`px-4 py-3 border-b border-zinc-900 last:border-0 ${isClickable ? 'cursor-pointer hover:bg-zinc-900/30' : ''}`}
                onClick={() => { if (isClickable) { setSelectedTaskId(task.id); setMode('expanded') } }}
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
            )
          })
        )}
      </div>
    </div>
  )
}
