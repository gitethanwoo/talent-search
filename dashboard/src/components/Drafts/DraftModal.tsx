import { useState } from 'react'
import type { Draft } from '../../types'
import { mailto } from '../../utils'

interface DraftModalProps {
  draft: Draft
  onClose: () => void
}

export function DraftModal({ draft, onClose }: DraftModalProps) {
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

        <div className="px-6 py-3 border-b border-zinc-800/50">
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Subject</div>
          <div className="text-zinc-300 italic">{draft.subject}</div>
        </div>

        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto">
          <div className="font-mono text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </div>
        </div>

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
