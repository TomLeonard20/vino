'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CellarBottle } from '@/types/database'
import WineTypeBar from '@/components/ui/WineTypeBar'

interface BottleRanking {
  bottleId: string
  score: number
  reason: string
}
interface IdealStyle {
  name: string
  score: number
  why: string
  confidence: 'Classic' | 'Recommended' | 'Adventurous'
}
interface PairingResult {
  cellarRankings: BottleRanking[]
  idealStyles:    IdealStyle[]
  _stub?: boolean
}

const CONFIDENCE_STYLES = {
  Classic:     { background: 'rgba(245,230,176,0.6)', color: '#7a5c00' },
  Recommended: { background: 'rgba(200,230,201,0.6)', color: '#2e5c30' },
  Adventurous: { background: 'rgba(139,32,53,0.1)',   color: '#8b2035' },
}

// Score → colour
function scoreColor(pct: number) {
  if (pct >= 80) return '#2e5c30'
  if (pct >= 60) return '#7a4e00'
  return '#c4a090'
}

export default function PairingClient({ initialMeal }: { initialMeal: string }) {
  const [meal,       setMeal]       = useState(initialMeal)
  const [bottles,    setBottles]    = useState<CellarBottle[]>([])
  const [result,     setResult]     = useState<PairingResult | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [showAll,    setShowAll]    = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history,    setHistory]    = useState<Array<{ meal: string; result: PairingResult; ts: number }>>([])

  const supabase = createClient()
  // Track whether we've auto-triggered from the URL param
  const autoFired = useRef(false)

  // Load cellar bottles + pairing history
  useEffect(() => {
    supabase
      .from('cellar_bottles')
      .select('*, wine:wines(*, flavour_profile:flavour_profiles(*))')
      .then(({ data }) => setBottles((data ?? []) as CellarBottle[]))
    try {
      const raw = localStorage.getItem('vino-pairing-history')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-run when arriving from the home page with ?meal=...
  // Fires once bottles have loaded (or after a short grace period)
  useEffect(() => {
    if (!initialMeal.trim() || autoFired.current) return
    // Small delay so bottles have time to load, then fire regardless
    const timer = setTimeout(() => {
      if (!autoFired.current) {
        autoFired.current = true
        runMatch(initialMeal, bottles)
      }
    }, 600)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMeal, bottles])

  async function runMatch(mealText: string, currentBottles: CellarBottle[]) {
    if (!mealText.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setShowAll(false)

    const snapshots = currentBottles.map(b => ({
      bottleId:      b.id,
      wineName:      b.wine?.name ?? '',
      producer:      b.wine?.producer ?? '',
      vintage:       b.wine?.vintage ?? null,
      wineType:      b.wine_type,
      criticScore:   b.wine?.critic_score ?? null,
      flavourProfile: b.wine?.flavour_profile ?? null,
    }))

    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal: mealText, bottles: snapshots }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: PairingResult = await res.json()
      setResult(data)
      // Save to history (deduped by meal text, max 5)
      setHistory(prev => {
        const updated = [
          { meal: mealText, result: data, ts: Date.now() },
          ...prev.filter(h => h.meal.toLowerCase() !== mealText.toLowerCase()),
        ].slice(0, 5)
        try { localStorage.setItem('vino-pairing-history', JSON.stringify(updated)) } catch {}
        return updated
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    autoFired.current = true
    await runMatch(meal, bottles)
  }

  const ranked = result
    ? [...result.cellarRankings]
        .sort((a, b) => b.score - a.score)
        .map(r => ({ ranking: r, bottle: bottles.find(b => b.id === r.bottleId) }))
        .filter(r => r.bottle)
    : []

  const displayed = showAll ? ranked : ranked.slice(0, 5)
  const styles    = result?.idealStyles ?? []

  return (
    <div className="space-y-5 pb-4">

      {/* ── Input card ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <h2 className="font-semibold" style={{ color: '#3a1a20' }}>What are you eating tonight?</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          {result ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                 style={{ background: '#f5ede6', border: '1px solid #d4b8aa' }}>
              <span className="flex-1 truncate" style={{ color: '#3a1a20' }}>{meal}</span>
              <button type="button" onClick={() => { setMeal(''); setResult(null) }}
                      style={{ color: '#c4a090' }}>✕</button>
            </div>
          ) : (
            <input
              value={meal}
              onChange={e => setMeal(e.target.value)}
              type="text"
              placeholder="e.g. Roast lamb with rosemary"
              className="flex-1 px-3 py-2 rounded-lg text-sm border"
              style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
              autoFocus={!!initialMeal}
            />
          )}
          <button
            type="submit"
            disabled={!meal.trim() || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: '#8b2035', opacity: (!meal.trim() || loading) ? 0.5 : 1 }}
          >
            {loading ? '…' : 'Match'}
          </button>
        </form>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fce4ec', color: '#8b0000' }}>
          {error}
        </p>
      )}

      {/* ── Stub notice ── */}
      {result?._stub && (
        <p className="text-xs px-3 py-2 rounded-lg text-center"
           style={{ background: '#fff3e0', color: '#7a4e00' }}>
          ✨ Add your Anthropic API key to Vercel to enable real AI pairing.
        </p>
      )}

      {/* ── Pairing history ── */}
      {!result && !loading && history.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest uppercase"
             style={{ color: '#b09080', letterSpacing: '0.15em' }}>
            Recent pairings
          </p>
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => { setMeal(h.meal); setResult(h.result); setExpandedId(null) }}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-left active:opacity-70 transition-opacity"
              style={{ background: '#ecddd4' }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>{h.meal}</p>
                <p className="text-xs" style={{ color: '#a07060' }}>
                  {new Date(h.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  {' · '}{h.result.cellarRankings.length} wines ranked
                </p>
              </div>
              <span className="text-sm shrink-0" style={{ color: '#c4a090' }}>›</span>
            </button>
          ))}
        </section>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
               style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
          <p className="text-sm" style={{ color: '#a07060' }}>Pairing your cellar…</p>
        </div>
      )}

      {/* ── Your cellar matches ── */}
      {ranked.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold" style={{ color: '#3a1a20' }}>
            Your cellar
            <span className="ml-2 text-xs font-normal" style={{ color: '#a07060' }}>
              {ranked.length} bottle{ranked.length !== 1 ? 's' : ''} ranked
            </span>
          </h3>

          {displayed.map(({ ranking, bottle }, idx) => {
            const pct     = ranking!.score
            const color   = scoreColor(pct)
            const isOpen  = expandedId === ranking!.bottleId
            const wine    = bottle!.wine as { name?: string; grapes?: string[]; vintage?: number | null } | undefined
            const subtitle = [wine?.grapes?.[0], wine?.vintage, `×${bottle!.quantity}`].filter(Boolean).join(' · ')
            return (
              <div
                key={ranking!.bottleId}
                className="rounded-xl overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                style={{ background: '#ecddd4' }}
                onClick={() => setExpandedId(id => id === ranking!.bottleId ? null : ranking!.bottleId)}
              >
                <div className="flex">
                  <WineTypeBar type={bottle!.wine_type} />
                  <div className="flex-1 px-3 py-3 flex items-start gap-3">
                    <span className="text-xs font-bold mt-0.5 w-5 shrink-0" style={{ color: '#c4a090' }}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
                        {wine?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs" style={{ color: '#a07060' }}>{subtitle}</p>
                      {/* Reason — only when expanded */}
                      {isOpen && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#7a4a38' }}>
                          {ranking!.reason}
                        </p>
                      )}
                      {/* Score bar */}
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                             style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                      <span className="text-xs" style={{ color: '#c4a090' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {ranked.length > 5 && (
            <button onClick={() => setShowAll(!showAll)}
                    className="w-full text-sm py-2 font-medium"
                    style={{ color: '#8b2035' }}>
              {showAll ? 'Show fewer' : `See all ${ranked.length} wines`}
            </button>
          )}
        </section>
      )}

      {/* ── No cellar bottles (but we have results) ── */}
      {result && ranked.length === 0 && (
        <div className="rounded-xl p-4 text-center space-y-1" style={{ background: '#ecddd4' }}>
          <p className="text-sm font-medium" style={{ color: '#3a1a20' }}>Your cellar is empty</p>
          <p className="text-xs" style={{ color: '#a07060' }}>
            Add bottles to get personalised rankings from your collection.
          </p>
        </div>
      )}

      {/* ── Ideal styles ── */}
      {styles.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold" style={{ color: '#3a1a20' }}>Best wine styles</h3>
          {[...styles].sort((a, b) => b.score - a.score).map(style => {
            const cs    = CONFIDENCE_STYLES[style.confidence]
            const color = scoreColor(style.score)
            return (
              <div key={style.name} className="rounded-xl overflow-hidden"
                   style={{ background: '#ecddd4' }}>
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
                      {style.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={cs}>
                        {style.confidence}
                      </span>
                      <span className="text-sm font-bold" style={{ color }}>
                        {style.score}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: '#a07060' }}>{style.why}</p>
                  {/* Score bar */}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                       style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${style.score}%`, background: color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && !result && (
        <p className="text-sm text-center py-8" style={{ color: '#c4a090' }}>
          Enter what you&apos;re eating and tap Match to get pairing suggestions.
        </p>
      )}
    </div>
  )
}
