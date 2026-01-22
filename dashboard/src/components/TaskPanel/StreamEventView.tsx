import { useState } from 'react'
import type { StreamEvent } from '../../types'
import { ToolBadge } from './ToolBadge'

export function StreamEventView({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(false)

  if (event.type === 'text') {
    return <div className="py-1.5 text-zinc-300 leading-relaxed text-sm">{event.content}</div>
  }

  if (event.type === 'tool_call') {
    const shortContent = event.content.length > 80 ? event.content.slice(0, 80) + '...' : event.content
    const isLong = event.content.length > 80

    return (
      <div className="py-1 flex items-start gap-2">
        <span className="text-zinc-600 text-xs mt-0.5">▶</span>
        <ToolBadge tool={event.tool || 'Unknown'} />
        {isLong ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="font-mono text-xs text-zinc-500 hover:text-zinc-400 text-left flex-1 min-w-0"
          >
            <span className="break-all">{expanded ? event.content : shortContent}</span>
          </button>
        ) : (
          <span className="font-mono text-xs text-zinc-500 break-all">{event.content}</span>
        )}
      </div>
    )
  }

  if (event.type === 'tool_result') {
    if (!event.content || event.content.trim().length === 0) return null

    return (
      <div className="py-0.5 ml-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors text-xs font-mono"
        >
          <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
          <span>{expanded ? 'Hide' : 'Show'} output ({event.content.length} chars)</span>
        </button>
        {expanded && (
          <pre className="mt-1 p-2 bg-zinc-900/50 border border-zinc-800 font-mono text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
            {event.content}
          </pre>
        )}
      </div>
    )
  }

  return null
}
