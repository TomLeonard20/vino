'use client'

import { useState, useEffect, useRef } from 'react'
import type { WineFindResult, WineFindStyle } from '@/app/api/wine-find/route'

const CONFIDENCE_STYLES = {
  'Perfect match':   { background: 'rgba(139,32,53,0.12)',  color: '#8b2035' },
  'Great choice':    { background: 'rgba(46,92,48,0.12)',   color: '#2e5c30' },
  'Worth exploring': { background: 'rgba(122,78,0,0.12)',   color: '#7a4e00' },
}

function scoreColor(s: number) {
  if (s >= 85) return '#8b2035'
  if (s >= 70) return '#2e5c30'
  return '#a07060'
}

export default function FindClient({ initialQuery }: { initialQuery: string }) {
  const [query,   setQuery]   = useState(initialQuery)
  const [result,  setResult]  = useState<WineFindResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const autoFired = useRef(false)

  useEffect(() => {
    if (!initialQuery.trim() || autoFired.current) return
    const t = setTimeout(() => {
      if (!autoFired.current) { autoFired.current = true; run(initialQuery) }
    }, 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  async function run(q: string) {
    if (!q.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/wine-find', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    autoFired.current = true
    run(query)
  }

  const styles = result?.styles ?? []

  return (
    <div className="space-y-5 pb-4">

      {/* ── Input ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <h2 className="font-semibold" style={{ color: '#3a1a20' }}>Find a wine</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          {result ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                 style={{ background: '#f5ede6', border: '1px solid #d4b8aa' }}>
              <span className="flex-1 truncate" style={{ color: '#3a1a20' }}>{query}</span>
              <button type="button" onClick={() => { setQuery(''); setResult(null) }}
                      style={{ color: '#c4a090' }}>✕</button>
            </div>
          ) : (
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              type="text"
              placeholder="e.g. something bold and oaky for a cold night"
              className="flex-1 px-3 py-2 rounded-lg text-sm border"
              style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
              autoFocus={!!initialQuery}
            />
          )}
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: '#8b2035', opacity: (!query.trim() || loading) ? 0.5 : 1 }}
          >
            {loading ? '…' : 'Find'}
          </button>
        </form>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fce4ec', color: '#8b0000' }}>
          {error}
        </p>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
               style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
          <p className="text-sm" style={{ color: '#a07060' }}>Consulting the sommelier…</p>
        </div>
      )}

      {/* ── Sommelier note ── */}
      {result?.sommelierNote && !result._stub && (
        <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background: '#ecddd4' }}>
          <span className="text-lg shrink-0">🍷</span>
          <p className="text-sm leading-relaxed" style={{ color: '#3a1a20' }}>
            {result.sommelierNote}
          </p>
        </div>
      )}

      {/* ── Stub notice ── */}
      {result?._stub && (
        <p className="text-xs px-3 py-2 rounded-lg text-center"
           style={{ background: '#fff3e0', color: '#7a4e00' }}>
          ✨ Add your Anthropic API key to Vercel to enable real AI recommendations.
        </p>
      )}

      {/* ── Style cards ── */}
      {styles.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold" style={{ color: '#3a1a20' }}>
            Recommended styles
          </h3>
          {[...styles].sort((a, b) => b.score - a.score).map((style, i) => (
            <StyleCard key={i} style={style} />
          ))}
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && !result && (
        <p className="text-sm text-center py-8" style={{ color: '#c4a090' }}>
          Describe what you&apos;re looking for and tap Find — bold, light, fruity, earthy, anything.
        </p>
      )}
    </div>
  )
}

function StyleCard({ style }: { style: WineFindStyle }) {
  const cs    = CONFIDENCE_STYLES[style.confidence]
  const color = scoreColor(style.score)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ecddd4' }}>
      {/* Top colour stripe */}
      <div className="h-1" style={{ background: color }} />
      <div className="p-4 space-y-2">
        {/* Name + confidence + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{style.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
              {style.grapes.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={cs}>
              {style.confidence}
            </span>
            <span className="text-sm font-bold" style={{ color }}>{style.score}%</span>
          </div>
        </div>

        {/* Why */}
        <p className="text-xs" style={{ color: '#7a4530' }}>{style.why}</p>

        {/* Score bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${style.score}%`, background: color }} />
        </div>

        {/* Regions + price */}
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-xs" style={{ color: '#a07060' }}>
            {style.regions.slice(0, 2).join(' · ')}
          </p>
          {style.priceRange && (
            <p className="text-xs font-medium" style={{ color: '#7a4530' }}>
              {style.priceRange}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
