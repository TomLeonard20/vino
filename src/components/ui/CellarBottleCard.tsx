'use client'

import Link from 'next/link'
import type { CellarBottle, WineType } from '@/types/database'
import ScoreBadge       from './ScoreBadge'
import WineTypeBar      from './WineTypeBar'
import WineBottleImage  from './WineBottleImage'

const NOW = new Date().getFullYear()

/** Returns "Producer Name" if producer isn't already part of the name. */
function displayName(name?: string | null, producer?: string | null): string {
  if (!name) return 'Unknown wine'
  if (!producer) return name
  const n = name.toLowerCase()
  const p = producer.toLowerCase()
  if (n.includes(p) || p.includes(n)) return name
  return `${producer} ${name}`
}

function estimatedWindow(wineType: WineType, vintage: number | null) {
  switch (wineType) {
    case 'Champagne':
      if (!vintage) {
        // NV Champagne — anchored to now, not a vintage year.
        // Drink immediately; most NV is best within 3–5 years of release.
        return { drinkFrom: NOW, peak: NOW + 2, drinkTo: NOW + 5 }
      }
      // Vintage Champagne — significant ageing potential.
      return { drinkFrom: vintage + 5, peak: vintage + 12, drinkTo: vintage + 25 }
    case 'White':
      return { drinkFrom: (vintage ?? NOW) + 1, peak: (vintage ?? NOW) + 3,  drinkTo: (vintage ?? NOW) + 7  }
    case 'Rosé':
      return { drinkFrom: NOW, peak: NOW + 1, drinkTo: NOW + 3 }
    default: // Red
      if (!vintage) return { drinkFrom: NOW, peak: NOW + 5, drinkTo: NOW + 10 }
      return { drinkFrom: vintage + 2, peak: vintage + 7, drinkTo: vintage + 15 }
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
  if (NOW < peakYear)   return { label: `Peaks ${peakYear}`, color: '#2e7d32' }
  return { label: `Peaked ${peakYear}`, color: '#a07060' }
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(139,32,53,0.07)' }}>
      <p className="uppercase tracking-wide" style={{ color: '#b09080', fontSize: 8 }}>{label}</p>
      <p className="font-semibold leading-tight truncate max-w-24" style={{ color: '#3a1a20', fontSize: 11 }}>{value}</p>
    </div>
  )
}

export default function CellarBottleCard({
  bottle,
  currentUserId,
  photoUrl,
}: {
  bottle:         CellarBottle
  currentUserId?: string
  photoUrl?:      string | null
}) {
  const wine = bottle.wine as {
    name?:            string
    producer?:        string | null
    critic_score?:    number | null
    grapes?:          string[]
    appellation?:     string
    region?:          string
    vintage?:         number | null
    label_image_url?: string | null
  } | undefined

  const { label, color } = smartPeakLabel(bottle)
  const isPartnerBottle  = !!(bottle.added_by && currentUserId && bottle.added_by !== currentUserId)
  const resolvedPhoto    = photoUrl ?? wine?.label_image_url ?? null

  return (
    <Link
      href={`/cellar/${bottle.id}`}
      className="rounded-xl overflow-hidden flex items-stretch active:opacity-70 transition-opacity"
      style={{ background: '#ecddd4' }}
    >
      {/* Bottle photo or SVG illustration */}
      <div className="shrink-0 self-stretch" style={{ width: 52 }}>
        {resolvedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedPhoto}
            alt=""
            style={{ width: 52, height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <WineBottleImage type={bottle.wine_type} />
        )}
      </div>

      <WineTypeBar type={bottle.wine_type} />

      <div className="flex-1 px-3 py-2.5 min-w-0">
        {/* Row 1: score + name + qty */}
        <div className="flex items-center gap-2">
          <ScoreBadge score={wine?.critic_score ?? null} size="sm" />
          <p className="flex-1 font-semibold text-sm truncate min-w-0" style={{ color: '#3a1a20' }}>
            {displayName(wine?.name, wine?.producer)}
          </p>
          <span className="font-bold text-sm shrink-0" style={{ color: '#3a1a20' }}>
            ×{bottle.quantity}
          </span>
        </div>

        {/* Row 2: vintage + grape mini-cells + peak status + partner badge */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <MiniCell label="Vintage" value={wine?.vintage ? String(wine.vintage) : '—'} />
          {wine?.grapes?.[0] && <MiniCell label="Grape" value={wine.grapes[0]} />}
          {isPartnerBottle && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(139,32,53,0.12)', color: '#8b2035', fontSize: 9 }}
            >
              Partner
            </span>
          )}
          <span className="ml-auto text-xs font-medium shrink-0 whitespace-nowrap" style={{ color }}>
            {label}
          </span>
        </div>
      </div>
    </Link>
  )
}
