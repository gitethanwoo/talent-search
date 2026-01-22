import type { Prospect } from '../../types'
import { isContactable } from '../../utils'

interface ProspectListItemProps {
  p: Prospect
  isSelected: boolean
  onClick: () => void
  hasDraft: boolean
}

export function ProspectListItem({ p, isSelected, onClick, hasDraft }: ProspectListItemProps) {
  const signalColors = {
    high: 'bg-emerald-500',
    medium: 'bg-amber-500',
    low: 'bg-zinc-600'
  }
  const contactable = isContactable(p)

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 border-b border-zinc-900 cursor-pointer transition-all ${
        isSelected ? 'bg-zinc-800/70 border-l-2 border-l-cyan-500' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'
      } ${!contactable ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
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
