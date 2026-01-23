import type { Prospect, Draft } from '../../types'
import { ActionButton } from '../ActionButton'
import { PipelineProgress } from './PipelineProgress'
import { EditableDraft } from './EditableDraft'

interface ProspectProfileProps {
  p: Prospect
  drafts: Draft[]
  onDraftClick: (draft: Draft) => void
  activeTaskType: 'enrich' | 'draft' | null
}

export function ProspectProfile({ p, drafts, onDraftClick, activeTaskType }: ProspectProfileProps) {
  const prospectDrafts = drafts.filter(d => d.github_username === p.github_username)

  const signalStyles = {
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-zinc-800 text-zinc-500 border-zinc-700'
  }
  const signalClass = signalStyles[p.signal as keyof typeof signalStyles] || signalStyles.low

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          {/* Left: Avatar + Name */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0 w-14 h-14 flex items-center justify-center">
              {/* Double pendulum glow via nested epicycles */}
              {activeTaskType && (
                <>
                  {/* Soft ambient base */}
                  <div
                    className={`absolute inset-0 rounded-full blur-lg ${
                      activeTaskType === 'enrich' ? 'bg-cyan-500/30' : 'bg-emerald-500/30'
                    }`}
                    style={{ animation: 'glowBreathe 5s ease-in-out infinite' }}
                  />
                  {/* Epicycle 1: 10s (small orbits for compact avatar) */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ animation: 'orbit1-sm 10s linear infinite' }}
                  >
                    {/* Epicycle 2: 15s reverse */}
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ animation: 'orbit2-sm 15s linear infinite' }}
                    >
                      {/* Epicycle 3: 17s */}
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ animation: 'orbit3-sm 17s linear infinite' }}
                      >
                        {/* Wandering glow source */}
                        <div
                          className={`w-12 h-12 rounded-full blur-md ${
                            activeTaskType === 'enrich' ? 'bg-cyan-400' : 'bg-emerald-400'
                          }`}
                          style={{ animation: 'glowFlicker 3.7s ease-in-out infinite' }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <img
                src={`https://github.com/${p.github_username}.png?size=80`}
                alt=""
                className="relative w-14 h-14 rounded-full bg-zinc-800"
              />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white">{p.name || p.github_username}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <a
                  href={`https://github.com/${p.github_username}`}
                  target="_blank"
                  className="flex items-center gap-1.5 font-mono text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  {p.github_username}
                </a>
                {p.company && <span className="text-sm text-zinc-600">{p.company}</span>}
                {p.location && <span className="text-sm text-zinc-600">{p.location}</span>}
              </div>
            </div>
          </div>

          {/* Right: Pipeline progress */}
          <div className="flex-shrink-0">
            <PipelineProgress prospect={p} hasDraft={prospectDrafts.length > 0} />
          </div>
        </div>

        {/* Action buttons - bigger */}
        <div className="flex items-center gap-3 mt-5">
          <ActionButton label="Enrich" color="cyan" action={{ action: 'enrich', username: p.github_username, name: p.name }} />
          <ActionButton label="Draft" color="emerald" action={{ action: 'draft', username: p.github_username, name: p.name, email: p.email, twitter: p.twitter }} />
          {p.fit !== 'unlikely' ? (
            <ActionButton label="Mark Unlikely" color="red" action={{ action: 'set_fit', username: p.github_username, fit: 'unlikely' }} />
          ) : (
            <ActionButton label="Mark Likely" color="emerald" action={{ action: 'set_fit', username: p.github_username, fit: 'likely' }} />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Signal & Fit */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Signal</div>
                <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${signalClass}`}>{p.signal}</span>
              </div>
              <div className="text-sm text-zinc-400 leading-relaxed">
                {p.notes || 'No signal notes recorded yet.'}
              </div>
            </div>
            <div className="p-4 border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Fit</div>
                {p.fit === 'likely' && (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">likely</span>
                )}
                {p.fit === 'unlikely' && (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border bg-zinc-800 text-zinc-500 border-zinc-700">unlikely</span>
                )}
                {!p.fit && (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-zinc-700 text-zinc-600">unknown</span>
                )}
              </div>
              <div className="text-sm text-zinc-400 leading-relaxed">
                {p.comp_fit || 'No fit assessment recorded yet.'}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Email</div>
              {p.email ? (
                <a href={`mailto:${p.email}`} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">{p.email}</a>
              ) : (
                <span className="text-sm text-zinc-700">Not found</span>
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Twitter</div>
              {p.twitter ? (
                <a href={`https://twitter.com/${p.twitter.replace('@', '')}`} target="_blank" className="text-sm text-sky-400 hover:text-sky-300 transition-colors">{p.twitter}</a>
              ) : (
                <span className="text-sm text-zinc-700">Not found</span>
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Source</div>
              <span className="text-sm text-zinc-500">{p.source || '—'}</span>
            </div>
          </div>

          {/* Personal Site */}
          {(p.personal_site || p.blog) && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Website</div>
              <a
                href={p.personal_site || p.blog || ''}
                target="_blank"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                {p.personal_site || p.blog}
              </a>
            </div>
          )}

          {/* Bio */}
          {p.bio && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Bio</div>
              <div className="text-sm text-zinc-300 leading-relaxed">{p.bio}</div>
            </div>
          )}

          {/* Outreach Context */}
          {p.outreach_context && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Outreach Context</div>
              <div className="text-sm text-zinc-400 leading-relaxed">{p.outreach_context}</div>
            </div>
          )}

          {/* Drafts */}
          {prospectDrafts.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Draft Message</div>
              {prospectDrafts.map(draft => (
                <EditableDraft key={draft.id} draft={draft} prospect={p} onRewrite={() => onDraftClick(draft)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
