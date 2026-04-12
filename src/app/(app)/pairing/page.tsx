'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CellarBottle } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'
import WineTypeBar from '@/components/ui/WineTypeBar'
import { useEffect } from 'react'

interface BottleRanking {
  bottleId: string
  score: number
  reason: string
}
interface IdealStyle {
  name: string
  why: string
  confidence: 'Classic' | 'Recommended' | 'Adventurous'
}
interface PairingResult {
  cellarRankings: BottleRanking[]
  idealStyles: IdealStyle[]
  _stub?: boolean
}

const CONFIDENCE_STYLES = {
  Classic:     { background: 'rgba(245,230,176,0.6)', color: '#7a5c00' },
  Recommended: { background: 'rgba(200,230,201,0.6)', color: '#2e5c30' },
  Adventurous: { background: 'rgba(139,32,53,0.1)',   color: '#8b2035' },
}

export default function PairingPage() {
  const [meal, setMeal] = useState('')
  const [bottles, setBottles] = useState<CellarBottle[]>([])
  const [result, setResult] = useState<PairingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('cellar_bottles')
      .select('*, wine:wines(*, flavour_profile:flavour_profiles(*))')
      .then(({ data }) => setBottles((data ?? []) as CellarBottle[]))
  }, [])

  async function handleMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!meal.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    const snapshots = bottles.map(b => ({
      bottleId: b.id,
      wineName: b.wine?.name ?? '',
      producer: b.wine?.producer ?? '',
      vintage: b.wine?.vintage ?? null,
      wineType: b.wine_type,
      criticScore: b.wine?.critic_score ?? null,
      flavourProfile: b.wine?.flavour_profile ?? null,
    }))

    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal, bottles: snapshots }),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const ranked = result
    ? [...result.cellarRankings]
        .sort((a, b) => b.score - a.score)
        .map(r => ({ ranking: r, bottle: bottles.find(b => b.id === r.bottleId) }))
        .filter(r => r.bottle)
    : []

  const displayed = showAll ? ranked : ranked.slice(0, 5)

  return (
    <div className="space-y-5 pb-4">
      {/* Input card */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <h2 className="font-semibold" style={{ color: '#3a1a20' }}>What are you eating tonight?</h2>
        <form onSubmit={handleMatch} className="flex gap-2">
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

      {/* Error */}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fce4ec', color: '#8b0000' }}>
          {error}
        </p>
      )}

      {/* Stub notice */}
      {result?._stub && (
        <p className="text-xs px-3 py-2 rounded-lg text-center"
           style={{ background: '#fff3e0', color: '#7a4e00' }}>
          Add your Anthropic API key to <code>.env.local</code> to enable real AI pairing.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-sm" style={{ color: '#a07060' }}>
          Matching your cellar…
        </div>
      )}

      {/* Cellar rankings */}
      {ranked.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold" style={{ color: '#3a1a20' }}>Your cellar</h3>
          {displayed.map(({ ranking, bottle }, idx) => {
            const pct = ranking!.score
            const color = pct >= 75 ? '#2e5c30' : pct >= 50 ? '#7a4e00' : '#c4a090'
            return (
              <div key={ranking!.bottleId} className="rounded-xl overflow-hidden flex"
                   style={{ background: '#ecddd4' }}>
                <WineTypeBar type={bottle!.wine_type} />
                <div className="flex-1 px-3 py-3 flex items-start gap-3">
                  <span className="text-xs font-bold mt-0.5 w-5 shrink-0"
                        style={{ color: '#c4a090' }}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
                      {bottle!.wine?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#a07060' }}>
                      {ranking!.reason}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                         style={{ background: '#d4b8aa', opacity: 0.5 }}>
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color }}>{pct}%</span>
                </div>
              </div>
            )
          })}
          {ranked.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-sm py-2"
              style={{ color: '#8b2035' }}
            >
              {showAll ? 'Show less' : `See all (${ranked.length})`}
            </button>
          )}
        </div>
      )}

      {/* Ideal styles */}
      {result && result.idealStyles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold" style={{ color: '#3a1a20' }}>Ideal styles</h3>
          {result.idealStyles.map(style => {
            const cs = CONFIDENCE_STYLES[style.confidence]
            return (
              <div key={style.name} className="rounded-xl p-3" style={{ background: '#ecddd4' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{style.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={cs}>
                    {style.confidence}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#a07060' }}>{style.why}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty cellar state */}
      {!loading && !result && bottles.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: '#c4a090' }}>
          Add bottles to your cellar to get pairing recommendations.
        </p>
      )}
    </div>
  )
}
