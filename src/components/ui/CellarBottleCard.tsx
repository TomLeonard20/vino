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

  if (NOW < drink_from) {
    const yrs = drink_from - NOW
    return {
      label: yrs <= 2 ? `Opens ${drink_from}` : `Opens ${drink_from}`,
      color: '#7a4e00',
    }
  }
  if (NOW > drink_to) {
    const yrs = NOW - drink_to
    return {
      label: yrs === 1 ? 'Past window' : `${yrs}y past window`,
      color: '#a07060',
    }
  }
  if (NOW === peakYear) return { label: 'Peaking now', color: '#8b2035' }
  if (NOW < peakYear) {
    const yrs = peakYear - NOW
    return {
      label: yrs === 1 ? 'Peaks next year' : `Peaks in ${yrs}y`,
      color: '#2e7d32',
    }
  }
  const yrs = NOW - peakYear
  return {
    label: yrs === 1 ? '1y past peak' : `${yrs}y past peak`,
    color: '#a07060',
  }
}

export default function CellarBottleCard({ bottle }: { bottle: CellarBottle }) {
  const [open, setOpen] = useState(false)
  const wine  = bottle.wine as { name?: string; critic_score?: number | null; grapes?: string[]; appellation?: string; region?: string; vintage?: number | null } | undefined
  const { label, color } = smartPeakLabel(bottle)

  const subtitle = [
    wine?.grapes?.[0],
    wine?.appellation || wine?.region,
    wine?.vintage,
  ].filter(Boolean).join(' · ')

  const price = bottle.purchase_price ?? bottle.market_price

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ecddd4' }}>
      {/* ── Collapsed row (always visible) ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-stretch text-left active:opacity-70 transition-opacity"
      >
        <WineTypeBar type={bottle.wine_type} />
        <div className="flex-1 px-3 py-3 flex items-center gap-3">
          <ScoreBadge score={wine?.critic_score ?? null} size="sm" />
          <p className="flex-1 font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
            {wine?.name ?? 'Unknown wine'}
          </p>
          <div className="text-right shrink-0">
            <p className="font-bold text-sm leading-none mb-1" style={{ color: '#3a1a20' }}>
              ×{bottle.quantity}
            </p>
            <p className="text-xs font-medium" style={{ color }}>{label}</p>
          </div>
          <span className="text-sm transition-transform duration-200 shrink-0"
                style={{ color: '#c4a090', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>
            ›
          </span>
        </div>
      </button>

      {/* ── Expanded details ── */}
      {open && (
        <div className="px-4 pb-3 pt-0 border-t" style={{ borderColor: 'rgba(180,130,110,0.25)', marginLeft: 6 }}>
          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="space-y-0.5">
              {subtitle && (
                <p className="text-xs" style={{ color: '#a07060' }}>{subtitle}</p>
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
