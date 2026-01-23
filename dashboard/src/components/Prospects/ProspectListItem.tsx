import type { Prospect } from '../../types'
import { isContactable } from '../../utils'

interface ProspectListItemProps {
  p: Prospect
  isSelected: boolean
  isChecked: boolean
  onClick: () => void
  onCheckClick: (e: React.MouseEvent) => void
  hasDraft: boolean
  showCheckbox: boolean
}

export function ProspectListItem({ p, isSelected, isChecked, onClick, onCheckClick, hasDraft, showCheckbox }: ProspectListItemProps) {
  const signalColors = {
    high: 'bg-emerald-500',
    medium: 'bg-amber-500',
    low: 'bg-zinc-600'
  }
  const contactable = isContactable(p)

  return (
    <div
      onClick={e => showCheckbox ? onCheckClick(e) : onClick()}
      className={`px-4 py-3 border-b border-zinc-900 cursor-pointer transition-all ${
        isSelected ? 'bg-zinc-800/70 border-l-2 border-l-cyan-500' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'
      } ${!contactable ? 'opacity-50' : ''} ${showCheckbox ? 'select-none' : ''}`}
    >
      <div className="flex items-center gap-3">
        {showCheckbox && (
          <div className="flex items-center justify-center w-5 h-5 cursor-pointer flex-shrink-0">
            <div className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${
              isChecked
                ? 'bg-cyan-500 border-cyan-500'
                : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
            }`}>
              {isChecked && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}
        <img
          src={`https://github.com/${p.github_username}.png?size=40`}
          alt=""
          className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0"
        />
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${signalColors[p.signal as keyof typeof signalColors] || signalColors.low}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-300 truncate">{p.name || p.github_username}</span>
            {hasDraft && <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">draft</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-zinc-600">@{p.github_username}</span>
            {p.company && <span className="font-mono text-[10px] text-zinc-700 truncate">· {p.company}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
