import { useState } from 'react'
import type { Draft, Prospect } from '../../types'
import { mailto } from '../../utils'

interface EditableDraftProps {
  draft: Draft
  prospect: Prospect
  onRewrite: () => void
}

export function EditableDraft({ draft, prospect, onRewrite }: EditableDraftProps) {
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasChanges = subject !== draft.subject || body !== draft.body

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_draft',
          draftId: draft.id,
          subject,
          body
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setSubject(draft.subject)
    setBody(draft.body)
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30">
      {/* Subject */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Subject</div>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full bg-transparent text-amber-400 outline-none border-b border-transparent focus:border-amber-500/50 transition-colors"
        />
      </div>
      {/* Body */}
      <div className="px-4 py-4">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={Math.max(6, body.split('\n').length + 2)}
          className="w-full bg-transparent text-sm text-zinc-300 leading-relaxed outline-none resize-y min-h-[150px]"
        />
      </div>
      {/* Actions */}
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {prospect.email ? (
            <a
              href={mailto(prospect.email, subject, body)}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
            >
              Send Email
            </a>
          ) : prospect.twitter ? (
            <a
              href={`https://twitter.com/${prospect.twitter.replace('@', '')}`}
              target="_blank"
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-all"
            >
              DM on X
            </a>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">No contact method</span>
          )}
          <button
            onClick={onRewrite}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 text-zinc-500 border border-zinc-700 hover:text-amber-400 hover:border-amber-500/50 transition-all"
          >
            Rewrite
          </button>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <button
                onClick={handleDiscard}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-all"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
          {saved && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Saved</span>
          )}
          {!hasChanges && !saved && (
            <span className="font-mono text-[10px] text-zinc-700">{draft.channel}</span>
          )}
        </div>
      </div>
    </div>
  )
}
