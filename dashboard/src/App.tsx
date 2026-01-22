import { useState, useEffect } from 'react'
import TaskViewerPage from './components/TaskViewer'
import { TaskPanel } from './components/TaskPanel'
import { DraftCard, DraftModal } from './components/Drafts'
import { ProspectListItem, ProspectProfile } from './components/Prospects'
import type { Prospect, Draft } from './types'
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
  // Simple routing: /components shows the component preview page
  const isComponentPage = window.location.pathname === '/components' || window.location.search.includes('view=components')

  if (isComponentPage) {
    return <TaskViewerPage />
  }

  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'drafts' | 'prospects' | 'sources'>('prospects')
  const [draftModal, setDraftModal] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('all')
  const [contactableOnly, setContactableOnly] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())

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

  // Helper to determine prospect's pipeline stage
  const getProspectStage = (p: Prospect, drafts: Draft[]): PipelineStage => {
    const hasDraft = drafts.some(d => d.github_username === p.github_username)
    const isContacted = ['in_progress', 'replied', 'interested', 'closed'].includes(p.outreach_status || '')

    if (isContacted) return 'contacted'
    if (hasDraft) return 'ready_to_send'
    if (p.enriched_at) return 'needs_draft'
    return 'needs_enrichment'
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

  // Bulk action handlers
  const handleBulkEnrich = () => {
    const prospects = data?.prospects.filter(p => checkedIds.has(p.id)) || []
    prospects.forEach(p => {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', username: p.github_username, name: p.name })
      })
    })
    setCheckedIds(new Set())
    setBulkMode(false)
  }

  const handleBulkDraft = () => {
    const prospects = data?.prospects.filter(p => checkedIds.has(p.id)) || []
    prospects.forEach(p => {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft', username: p.github_username, name: p.name, email: p.email, twitter: p.twitter })
      })
    })
    setCheckedIds(new Set())
    setBulkMode(false)
  }

  const MAX_BULK_SELECT = 10

  const handleSelectAll = () => {
    if (checkedIds.size > 0) {
      setCheckedIds(new Set())
    } else {
      // Select up to MAX_BULK_SELECT
      setCheckedIds(new Set(filteredProspects.slice(0, MAX_BULK_SELECT).map(p => p.id)))
    }
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
                  {currentBulkAction && (
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

              {/* Bulk Actions Bar - contextual based on pipeline stage */}
              {bulkMode && currentBulkAction && checkedIds.size > 0 && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Clear
                    </button>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {checkedIds.size}/{MAX_BULK_SELECT} selected
                    </span>
                  </div>
                  {currentBulkAction === 'enrich' && (
                    <button
                      onClick={handleBulkEnrich}
                      className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all"
                    >
                      Enrich {checkedIds.size}
                    </button>
                  )}
                  {currentBulkAction === 'draft' && (
                    <button
                      onClick={handleBulkDraft}
                      className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                    >
                      Draft {checkedIds.size}
                    </button>
                  )}
                </div>
              )}

              {/* Select prompt when in bulk mode but none selected */}
              {bulkMode && currentBulkAction && checkedIds.size === 0 && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-900/30 flex-shrink-0 flex items-center justify-between">
                  <button
                    onClick={handleSelectAll}
                    className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Select First {Math.min(MAX_BULK_SELECT, filteredProspects.length)}
                  </button>
                  <span className="font-mono text-[10px] text-zinc-700">max {MAX_BULK_SELECT}</span>
                </div>
              )}

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filteredProspects.map((p) => (
                  <ProspectListItem
                    key={p.id}
                    p={p}
                    isSelected={selectedProspectId === p.id}
                    isChecked={checkedIds.has(p.id)}
                    onClick={() => setSelectedProspectId(p.id)}
                    onCheck={(checked) => {
                      const newSet = new Set(checkedIds)
                      if (checked && newSet.size < MAX_BULK_SELECT) {
                        newSet.add(p.id)
                      } else if (!checked) {
                        newSet.delete(p.id)
                      }
                      setCheckedIds(newSet)
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
      </div>
    </div>
  )
}

export default App
