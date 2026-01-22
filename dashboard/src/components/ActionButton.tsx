import { useState } from 'react'

interface ActionButtonProps {
  label: string
  color: 'cyan' | 'emerald' | 'red'
  action: object
}

const colorStyles = {
  cyan: 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 active:bg-cyan-500/40',
  emerald: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/40',
  red: 'border-red-500/30 text-red-400 hover:bg-red-500/20 active:bg-red-500/40'
}

export function ActionButton({ label, color, action }: ActionButtonProps) {
  const [clicked, setClicked] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    })
    setClicked(true)
    setTimeout(() => setClicked(false), 1500)
  }

  return (
    <button
      onClick={handleClick}
      className={`font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-all duration-150 active:scale-95 ${colorStyles[color]} ${clicked ? 'bg-white/10' : ''}`}
    >
      {clicked ? '✓ Sent' : label}
    </button>
  )
}
