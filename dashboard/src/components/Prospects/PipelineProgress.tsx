import type { Prospect } from '../../types'

interface PipelineProgressProps {
  prospect: Prospect
  hasDraft: boolean
}

export function PipelineProgress({ prospect, hasDraft }: PipelineProgressProps) {
  const stages = [
    { key: 'found', label: 'Found', complete: true },
    { key: 'enriched', label: 'Enriched', complete: !!prospect.enriched_at },
    { key: 'drafted', label: 'Drafted', complete: hasDraft },
    { key: 'contacted', label: 'Contacted', complete: ['in_progress', 'replied', 'interested', 'closed'].includes(prospect.outreach_status || '') },
    { key: 'replied', label: 'Replied', complete: ['replied', 'interested'].includes(prospect.outreach_status || '') },
  ]

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                stage.complete
                  ? 'bg-cyan-500 border-cyan-500'
                  : 'bg-transparent border-zinc-700'
              }`}
            />
            <span className={`font-mono text-[8px] uppercase tracking-wider mt-1 ${
              stage.complete ? 'text-zinc-400' : 'text-zinc-700'
            }`}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div className={`w-6 h-0.5 mx-1 -mt-3 ${
              stage.complete && stages[i + 1].complete ? 'bg-cyan-500' : 'bg-zinc-800'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
