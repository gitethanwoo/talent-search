const colors: Record<string, string> = {
  Bash: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  WebFetch: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  WebSearch: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Read: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Edit: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  Grep: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  TodoWrite: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
}

export function ToolBadge({ tool }: { tool: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${colors[tool] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
      {tool}
    </span>
  )
}
