import { useState, useEffect } from 'react'
import TaskViewerPage from './components/TaskViewer'
import { GlowTest } from './components/GlowTest'
import { TaskPanel } from './components/TaskPanel'
import { ChatPanel } from './components/ChatPanel'
import { DraftCard, DraftModal } from './components/Drafts'
import { ProspectListItem, ProspectProfile } from './components/Prospects'
import type { Prospect, Draft, AgentTask } from './types'
import { isContactable } from './types'

type PipelineStage = 'all' | 'needs_enrichment' | 'needs_draft' | 'ready_to_send' | 'contacted'

const pipelineStageLabels: Record<PipelineStage, string> = {
  all: 'All Prospects',
  needs_enrichment: 'Needs Enrichment',
  needs_draft: 'Needs Draft',
  ready_to_send: 'Ready to Send',
  contacted: 'Contacted',
}

interface Stats {
  prospects: number
  high_signal: number
  ships_fast: number
  ai_native: number
  sources: number
  rejected: number
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

function App() {
  // All hooks must be called unconditionally at the top
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'drafts' | 'prospects' | 'sources'>('prospects')
  const [draftModal, setDraftModal] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('all')
  const [contactableOnly, setContactableOnly] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null)
  const [activeBulkJob, setActiveBulkJob] = useState<{
    id: string
    action: 'enrich' | 'draft' | 'test'
    status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed'
    total: number
    completed: number
    failed: number
  } | null>(null)
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([])
  const [chatOpen, setChatOpen] = useState(false)

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
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Subscribe to bulk job updates via SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/bulk/stream')

    eventSource.addEventListener('init', (e) => {
      const jobs = JSON.parse(e.data)
      // Find the most recent active job (running or pending)
      const activeJob = jobs.find((j: typeof activeBulkJob) => j && (j.status === 'running' || j.status === 'pending'))
      if (activeJob) {
        setActiveBulkJob(activeJob)
      }
    })

    eventSource.onmessage = (e) => {
      const job = JSON.parse(e.data)
      setActiveBulkJob(job)
      // Refresh data when job completes
      if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
        fetchData()
        // Clear the active job after a delay so user can see final state
        setTimeout(() => setActiveBulkJob(null), 3000)
      }
    }

    eventSource.onerror = () => {
      console.error('[BULK-SSE] Connection error')
    }

    return () => eventSource.close()
  }, [])

  // Subscribe to task updates for active task indicators
  useEffect(() => {
    const eventSource = new EventSource('/api/tasks/stream')

    eventSource.addEventListener('init', (e) => {
      const taskList = JSON.parse(e.data) as AgentTask[]
      setActiveTasks(taskList.filter(t => t.status === 'running'))
    })

    eventSource.onmessage = (e) => {
      const task = JSON.parse(e.data) as AgentTask
      setActiveTasks(prev => {
        if (task.status === 'running') {
          const exists = prev.find(t => t.id === task.id)
          if (exists) return prev.map(t => t.id === task.id ? task : t)
          return [...prev, task]
        } else {
          return prev.filter(t => t.id !== task.id)
        }
      })
    }

    return () => eventSource.close()
  }, [])

  // Get active task type for a prospect
  const getActiveTaskType = (username: string): 'enrich' | 'draft' | null => {
    const task = activeTasks.find(t => t.target === username && t.status === 'running')
    if (!task) return null
    if (task.action === 'enrich') return 'enrich'
    if (task.action === 'draft') return 'draft'
    return null
  }

  // Helper to determine prospect's pipeline stage
  const getProspectStage = (p: Prospect, drafts: Draft[]): PipelineStage => {
    const hasDraft = drafts.some(d => d.github_username === p.github_username)
    const isContacted = ['contacted', 'replied', 'interested', 'closed'].includes(p.outreach_status || '')

    if (isContacted) return 'contacted'
    if (!p.enriched_at) return 'needs_enrichment'  // Check enrichment first
    if (hasDraft) return 'ready_to_send'
    return 'needs_draft'
  }

  // Compute pipeline stage counts
  const stageCounts = data ? (Object.keys(pipelineStageLabels) as PipelineStage[]).reduce((acc, key) => {
    if (key === 'all') {
      acc[key] = data.prospects.length
    } else {
      acc[key] = data.prospects.filter(p => getProspectStage(p, data.drafts) === key).length
    }
    return acc
  }, {} as Record<PipelineStage, number>) : {} as Record<PipelineStage, number>

  // Filter prospects based on pipeline stage and contactable filter
  const selectedProspect = data && selectedProspectId ? data.prospects.find(p => p.id === selectedProspectId) : null

  const filteredProspects = data ? data.prospects.filter(p => {
    const matchesStage = pipelineStage === 'all' || getProspectStage(p, data.drafts) === pipelineStage
    const matchesContactable = !contactableOnly || isContactable(p)
    return matchesStage && matchesContactable
  }) : []

  // Determine which bulk action to show based on current filter
  const bulkActionForStage: Record<PipelineStage, 'enrich' | 'draft' | null> = {
    all: null, // Too ambiguous
    needs_enrichment: 'enrich',
    needs_draft: 'draft',
    ready_to_send: null, // Manual send
    contacted: null, // Already done
  }
  const currentBulkAction = bulkActionForStage[pipelineStage]

  // Bulk action handlers - uses server-side job queue
  const handleBulkAction = async (action: 'enrich' | 'draft' | 'test') => {
    const prospectIds = Array.from(checkedIds)
    if (prospectIds.length === 0) return

    setCheckedIds(new Set())
    setBulkMode(false)

    try {
      const response = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prospectIds })
      })

      if (!response.ok) {
        console.error('Failed to create bulk job')
      }
    } catch (e) {
      console.error('Error creating bulk job:', e)
    }
  }

  const handleCancelBulkJob = async () => {
    if (!activeBulkJob) return

    try {
      await fetch('/api/bulk/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeBulkJob.id })
      })
    } catch (e) {
      console.error('Error cancelling bulk job:', e)
    }
  }

  const handleSelectAll = () => {
    if (checkedIds.size > 0) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filteredProspects.map(p => p.id)))
    }
  }

  // Simple routing for dev/test pages
  const pathname = window.location.pathname
  if (pathname === '/components' || window.location.search.includes('view=components')) {
    return <TaskViewerPage />
  }
  if (pathname === '/glow') {
    return <GlowTest />
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="font-mono text-zinc-600 animate-pulse">LOADING_</div>
      </div>
    )
  }

  return (
    <div className={`h-screen bg-zinc-950 flex flex-col overflow-hidden transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      <TaskPanel />
      <ChatPanel isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />

      {/* Main content wrapper - shrinks when chat is open */}
      <div className={`flex flex-col flex-1 min-h-0 transition-all duration-300 ${chatOpen ? 'mr-[420px]' : ''}`}>
      {draftModal && <DraftModal draft={draftModal} onClose={() => setDraftModal(null)} />}

      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative px-6 pt-6 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-4">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-white">TALNT</h1>
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Prospect Intelligence</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen(true)}
                className="font-mono text-xs uppercase tracking-wider px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-400 transition-all flex items-center gap-2"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                  <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/>
                </svg>
                Assistant
              </button>
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
          </div>
          <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-800 to-transparent" />
        </header>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-zinc-900">
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
          <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-900">
            <div className="space-y-1">
              {data.drafts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="font-mono text-zinc-700 text-sm">NO_DRAFTS_PENDING</div>
                </div>
              ) : (
                data.drafts.map((d, i) => <DraftCard key={d.id} draft={d} index={i} />)
              )}
            </div>
            {/* Bottom CTA */}
            <div className="py-12 flex justify-center">
              <button
                onClick={() => {
                  setTab('prospects')
                  setPipelineStage('needs_draft')
                }}
                className="font-mono text-xs uppercase tracking-wider px-6 py-3 text-zinc-500 border border-zinc-800 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
              >
                + Create Drafts
              </button>
            </div>
          </div>
        )}

        {/* Prospects Tab - Split View */}
        {tab === 'prospects' && (
          <div className="flex border border-zinc-900 flex-1 min-h-0">
            {/* Left: Prospect List */}
            <div className="w-80 border-r border-zinc-900 flex flex-col flex-shrink-0">
              {/* Pipeline Stage Filter */}
              <div className="p-3 border-b border-zinc-900 space-y-2 flex-shrink-0">
                <select
                  value={pipelineStage}
                  onChange={e => {
                    setPipelineStage(e.target.value as PipelineStage)
                    setCheckedIds(new Set())
                    setBulkMode(false)
                  }}
                  className="w-full font-mono text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1.5 focus:outline-none focus:border-zinc-600 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  {(Object.keys(pipelineStageLabels) as PipelineStage[]).map(key => (
                    <option key={key} value={key}>
                      {pipelineStageLabels[key]} ({stageCounts[key]})
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={contactableOnly}
                      onChange={e => setContactableOnly(e.target.checked)}
                      className="w-3 h-3 bg-zinc-900 border border-zinc-700 rounded-none text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                      Contactable only
                    </span>
                  </label>
                  {!activeBulkJob && (
                    <button
                      onClick={() => {
                        setBulkMode(!bulkMode)
                        if (bulkMode) setCheckedIds(new Set())
                      }}
                      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-all ${
                        bulkMode
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {bulkMode ? 'Cancel' : 'Select'}
                    </button>
                  )}
                </div>
              </div>

              {/* Active Bulk Job Progress Bar */}
              {activeBulkJob && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-900/70 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {activeBulkJob.status === 'running' && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {activeBulkJob.status === 'running' ? `${activeBulkJob.action}ing` : activeBulkJob.status}
                      </span>
                      <span className="font-mono text-xs text-zinc-300">
                        {activeBulkJob.completed}/{activeBulkJob.total}
                      </span>
                      {activeBulkJob.failed > 0 && (
                        <span className="font-mono text-[10px] text-red-400">
                          ({activeBulkJob.failed} failed)
                        </span>
                      )}
                    </div>
                    {activeBulkJob.status === 'running' && (
                      <button
                        onClick={handleCancelBulkJob}
                        className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeBulkJob.status === 'completed' ? 'bg-emerald-500' :
                        activeBulkJob.status === 'cancelled' ? 'bg-amber-500' :
                        activeBulkJob.status === 'failed' ? 'bg-red-500' :
                        'bg-cyan-500'
                      }`}
                      style={{ width: `${(activeBulkJob.completed / activeBulkJob.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bulk Actions Bar - contextual based on pipeline stage */}
              {bulkMode && checkedIds.size > 0 && !activeBulkJob && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {checkedIds.size === filteredProspects.length ? 'Clear All' : 'Select All'}
                    </button>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {checkedIds.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentBulkAction === 'enrich' && (
                      <button
                        onClick={() => handleBulkAction('enrich')}
                        className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all"
                      >
                        Enrich {checkedIds.size}
                      </button>
                    )}
                    {currentBulkAction === 'draft' && (
                      <button
                        onClick={() => handleBulkAction('draft')}
                        className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                      >
                        Draft {checkedIds.size}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Select prompt when in bulk mode but none selected */}
              {bulkMode && checkedIds.size === 0 && !activeBulkJob && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-900/30 flex-shrink-0">
                  <button
                    onClick={handleSelectAll}
                    className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Select All ({filteredProspects.length})
                  </button>
                </div>
              )}

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filteredProspects.map((p, index) => (
                  <ProspectListItem
                    key={p.id}
                    p={p}
                    isSelected={selectedProspectId === p.id}
                    isChecked={checkedIds.has(p.id)}
                    onClick={() => setSelectedProspectId(p.id)}
                    onCheckClick={(e) => {
                      const newSet = new Set(checkedIds)
                      const willBeChecked = !checkedIds.has(p.id)

                      // Shift+click for range selection
                      if (e.shiftKey && lastCheckedIndex !== null && willBeChecked) {
                        const start = Math.min(lastCheckedIndex, index)
                        const end = Math.max(lastCheckedIndex, index)
                        for (let i = start; i <= end; i++) {
                          newSet.add(filteredProspects[i].id)
                        }
                      } else {
                        if (willBeChecked) newSet.add(p.id)
                        else newSet.delete(p.id)
                      }

                      setCheckedIds(newSet)
                      setLastCheckedIndex(index)
                    }}
                    hasDraft={data.drafts.some(d => d.github_username === p.github_username)}
                    showCheckbox={bulkMode}
                  />
                ))}
              </div>
            </div>

            {/* Right: Profile Detail */}
            <div className="flex-1 bg-zinc-950/50 overflow-y-auto">
              {selectedProspect ? (
                <ProspectProfile
                  p={selectedProspect}
                  drafts={data.drafts}
                  onDraftClick={(draft) => setDraftModal(draft)}
                  activeTaskType={getActiveTaskType(selectedProspect.github_username)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-mono text-zinc-700 text-sm">SELECT_PROSPECT</div>
                    <div className="font-mono text-zinc-800 text-xs mt-1">Click a prospect to view details</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sources Tab */}
        {tab === 'sources' && (
          <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-900">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-950">
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
            {/* Bottom CTA */}
            <div className="py-12 flex justify-center">
              <button
                onClick={() => {
                  fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'research' })
                  })
                }}
                className="font-mono text-xs uppercase tracking-wider px-6 py-3 text-zinc-500 border border-zinc-800 hover:text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M9 6a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 6z" />
                  <path fillRule="evenodd" d="M2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9zm7-5.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" clipRule="evenodd" />
                </svg>
                Find More Prospects
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default App
