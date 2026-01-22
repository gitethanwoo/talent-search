import { useState, useEffect } from 'react'

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
          <div className="font-mono text-[10px] text-zinc-600 mb-2 uppercase tracking-wider">
            {draft.email || 'no email on file'}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProspectRow({ p, index, isExpanded, onToggle }: { p: Prospect; index: number; isExpanded: boolean; onToggle: () => void }) {
  const signalStyles = {
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-zinc-800 text-zinc-500 border-zinc-700'
  }
  const signalClass = signalStyles[p.signal as keyof typeof signalStyles] || signalStyles.low

  const hasDetails = p.notes || p.bio || p.company || p.location || p.comp_fit || p.outreach_context

  return (
    <>
      <tr
        className={`border-t border-zinc-900 hover:bg-zinc-900/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-zinc-900/50' : ''}`}
        onClick={onToggle}
      >
        <td className="py-3 px-4 font-mono text-zinc-700 text-xs">{(index + 1).toString().padStart(2, '0')}</td>
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
        <td className="py-3 px-4">
          {p.email ? (
            <a href={`mailto:${p.email}`} className="font-mono text-xs text-zinc-500 hover:text-emerald-400 transition-colors" onClick={e => e.stopPropagation()}>{p.email}</a>
          ) : <span className="text-zinc-800">—</span>}
        </td>
        <td className="py-3 px-4">
          <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border ${signalClass}`}>{p.signal}</span>
        </td>
        <td className="py-3 px-4 text-center">
          {p.ships_fast ? <span className="text-blue-400">●</span> : <span className="text-zinc-800">○</span>}
        </td>
        <td className="py-3 px-4 text-center">
          {p.ai_native ? <span className="text-violet-400">●</span> : <span className="text-zinc-800">○</span>}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider max-w-[120px] truncate">{p.source || '—'}</span>
            {hasDetails && (
              <span className={`font-mono text-zinc-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
            )}
          </div>
        </td>
      </tr>
      {hasDetails && (
        <tr>
          <td colSpan={8} className="p-0">
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
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

function App() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'drafts' | 'prospects' | 'sources'>('prospects')
  const [loaded, setLoaded] = useState(false)
  const [expandedProspectId, setExpandedProspectId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/data.json')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setTimeout(() => setLoaded(true), 100)
      })
      .catch(console.error)
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="font-mono text-zinc-600 animate-pulse">LOADING_</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-zinc-950 transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-baseline gap-4 mb-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-white">TENEX</h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Prospect Intelligence</span>
          </div>
          <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-800 to-transparent" />
        </header>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-3 mb-12">
          <StatCard value={data.stats.prospects} label="Total" />
          <StatCard value={data.stats.high_signal} label="High Signal" accent="bg-emerald-500" />
          <StatCard value={data.stats.ships_fast} label="Ships Fast" accent="bg-blue-500" />
          <StatCard value={data.stats.ai_native} label="AI Native" accent="bg-violet-500" />
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
          <div className="border border-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600 w-12">#</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Handle</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Name</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Email</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Signal</th>
                  <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600" title="Ships Fast">⚡</th>
                  <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600" title="AI Native">🤖</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.prospects.map((p, i) => (
                  <ProspectRow
                    key={p.id}
                    p={p}
                    index={i}
                    isExpanded={expandedProspectId === p.id}
                    onToggle={() => setExpandedProspectId(expandedProspectId === p.id ? null : p.id)}
                  />
                ))}
              </tbody>
            </table>
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
