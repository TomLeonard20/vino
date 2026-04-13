'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CellarBottle, WineType } from '@/types/database'
import ScoreBadge from './ScoreBadge'
import WineTypeBar from './WineTypeBar'

const NOW = new Date().getFullYear()

function estimatedWindow(wineType: WineType, vintage: number | null) {
  const base = vintage ?? NOW
  switch (wineType) {
    case 'Champagne': return { drinkFrom: base + 4, peak: base + 10, drinkTo: base + 20 }
    case 'White':     return { drinkFrom: base + 1, peak: base + 3,  drinkTo: base + 7  }
    case 'Rosé':      return { drinkFrom: base,     peak: base + 1,  drinkTo: base + 3  }
    default:          return { drinkFrom: base + 2, peak: base + 7,  drinkTo: base + 14 }
  }
}

function smartPeakLabel(b: CellarBottle): { label: string; color: string } {
  const wine = b.wine as { vintage?: number | null } | undefined
  let { drink_from, peak, drink_to } = b

  if (!drink_from || !drink_to) {
    const est = estimatedWindow(b.wine_type, wine?.vintage ?? null)
    drink_from = est.drinkFrom; peak = est.peak; drink_to = est.drinkTo
  }

  const peakYear = peak ?? Math.round((drink_from + drink_to) / 2)

  if (NOW < drink_from) return { label: `Opens ${drink_from}`, color: '#7a4e00' }
  if (NOW > drink_to) {
    const yrs = NOW - drink_to
    return { label: yrs === 1 ? 'Past window' : `${yrs}y past`, color: '#a07060' }
  }
  if (NOW === peakYear) return { label: 'Peaking now', color: '#8b2035' }
  if (NOW < peakYear) {
    const yrs = peakYear - NOW
    return { label: yrs === 1 ? 'Peaks next yr' : `Peaks ${peakYear}`, color: '#2e7d32' }
  }
  const yrs = NOW - peakYear
  return { label: yrs === 1 ? 'Just peaked' : `Peaked ${peakYear}`, color: '#a07060' }
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(139,32,53,0.07)' }}>
      <p className="uppercase tracking-wide" style={{ color: '#b09080', fontSize: 8 }}>{label}</p>
      <p className="font-semibold leading-tight truncate max-w-24" style={{ color: '#3a1a20', fontSize: 11 }}>{value}</p>
    </div>
  )
}

export default function CellarBottleCard({ bottle }: { bottle: CellarBottle }) {
  const [open, setOpen] = useState(false)
  const wine = bottle.wine as {
    name?: string
    critic_score?: number | null
    grapes?: string[]
    appellation?: string
    region?: string
    vintage?: number | null
  } | undefined
  const { label, color } = smartPeakLabel(bottle)
  const price = bottle.purchase_price ?? bottle.market_price

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ecddd4' }}>

      {/* ── Tap-to-expand button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-stretch text-left active:opacity-70 transition-opacity"
      >
        <WineTypeBar type={bottle.wine_type} />

        <div className="flex-1 px-3 py-2.5 min-w-0">
          {/* Row 1: score + name + qty */}
          <div className="flex items-center gap-2">
            <ScoreBadge score={wine?.critic_score ?? null} size="sm" />
            <p className="flex-1 font-semibold text-sm truncate min-w-0" style={{ color: '#3a1a20' }}>
              {wine?.name ?? 'Unknown wine'}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-sm" style={{ color: '#3a1a20' }}>×{bottle.quantity}</span>
              <span className="text-sm" style={{ color: '#c4a090', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
            </div>
          </div>

          {/* Row 2: vintage + grape mini-cells + status */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {wine?.vintage   && <MiniCell label="Vintage" value={String(wine.vintage)} />}
            {wine?.grapes?.[0] && <MiniCell label="Grape"   value={wine.grapes[0]} />}
            <span className="ml-auto text-xs font-medium shrink-0 whitespace-nowrap" style={{ color }}>
              {label}
            </span>
          </div>
        </div>
      </button>

      {/* ── Expanded details ── */}
      {open && (
        <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'rgba(180,130,110,0.2)', marginLeft: 6 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              {(wine?.appellation || wine?.region) && (
                <p className="text-xs" style={{ color: '#a07060' }}>
                  {wine?.appellation || wine?.region}
                </p>
              )}
              {price != null && (
                <p className="text-xs" style={{ color: '#c4a090' }}>A${price} ea.</p>
              )}
            </div>
            <Link
              href={`/cellar/${bottle.id}`}
              className="text-xs font-semibold shrink-0"
              style={{ color: '#8b2035' }}
              onClick={e => e.stopPropagation()}
            >
              View details →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
