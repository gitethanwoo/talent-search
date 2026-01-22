import { useState } from 'react'
import type { Draft } from '../../types'
import { mailto } from '../../utils'

interface DraftCardProps {
  draft: Draft
  index: number
}

export function DraftCard({ draft, index }: DraftCardProps) {
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
