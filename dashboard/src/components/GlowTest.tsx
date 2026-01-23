import { useState } from 'react'

export function GlowTest() {
  const [activeTaskType, setActiveTaskType] = useState<'enrich' | 'draft' | null>('enrich')

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-12 p-8">
      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTaskType(null)}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all ${
            activeTaskType === null
              ? 'bg-zinc-700 border-zinc-500 text-white'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
          }`}
        >
          Off
        </button>
        <button
          onClick={() => setActiveTaskType('enrich')}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all ${
            activeTaskType === 'enrich'
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
              : 'border-zinc-700 text-zinc-500 hover:border-cyan-500/50'
          }`}
        >
          Enrich
        </button>
        <button
          onClick={() => setActiveTaskType('draft')}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all ${
            activeTaskType === 'draft'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'border-zinc-700 text-zinc-500 hover:border-emerald-500/50'
          }`}
        >
          Draft
        </button>
      </div>

      {/* Avatar with glow - double pendulum via nested epicycles */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {activeTaskType && (
          <>
            {/* Soft ambient base - stays centered */}
            <div
              className={`absolute inset-0 rounded-full blur-lg ${
                activeTaskType === 'enrich' ? 'bg-cyan-500/30' : 'bg-emerald-500/30'
              }`}
              style={{ animation: 'glowBreathe 5s ease-in-out infinite' }}
            />
            {/* Double pendulum glow source - nested epicycles */}
            {/* Orbit 1: 7s period */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: 'orbit1 7s linear infinite' }}
            >
              {/* Orbit 2: 11s period, reverse */}
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ animation: 'orbit2 11s linear infinite' }}
              >
                {/* Orbit 3: 13s period */}
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ animation: 'orbit3 13s linear infinite' }}
                >
                  {/* The wandering glow */}
                  <div
                    className={`w-16 h-16 rounded-full blur-md ${
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
          src="https://github.com/octocat.png?size=80"
          alt=""
          className="relative w-20 h-20 rounded-full bg-zinc-800"
        />
      </div>

      {/* Larger version */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {activeTaskType && (
          <>
            {/* Soft ambient base */}
            <div
              className={`absolute inset-0 rounded-full blur-xl ${
                activeTaskType === 'enrich' ? 'bg-cyan-500/25' : 'bg-emerald-500/25'
              }`}
              style={{ animation: 'glowBreathe 5s ease-in-out infinite' }}
            />
            {/* Double pendulum epicycles - larger radii for bigger avatar */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: 'orbit1 7s linear infinite' }}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ animation: 'orbit2 11s linear infinite' }}
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ animation: 'orbit3 13s linear infinite' }}
                >
                  <div
                    className={`w-24 h-24 rounded-full blur-lg ${
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
          src="https://github.com/octocat.png?size=160"
          alt=""
          className="relative w-32 h-32 rounded-full bg-zinc-800"
        />
      </div>

      <div className="text-zinc-600 font-mono text-xs">
        /glow - test page for avatar glow animation
      </div>
    </div>
  )
}
