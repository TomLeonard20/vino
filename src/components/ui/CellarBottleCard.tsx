'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { CellarBottle, WineType } from '@/types/database'
import ScoreBadge            from './ScoreBadge'
import WineTypeBar           from './WineTypeBar'
import WineBottleImage       from './WineBottleImage'
import DrinkingWindowBadge   from './DrinkingWindowBadge'

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
        return { drinkFrom: NOW, peak: NOW + 2, drinkTo: NOW + 5 }
      }
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

function smartPeakLabel(b: CellarBottle): {
  label: string; color: string
  drinkFrom: number; peak: number; drinkTo: number
} {
  const wine = b.wine as { vintage?: number | null } | undefined
  let { drink_from, peak, drink_to } = b

  if (!drink_from || !drink_to) {
    const est = estimatedWindow(b.wine_type, wine?.vintage ?? null)
    drink_from = est.drinkFrom; peak = est.peak; drink_to = est.drinkTo
  }

  const peakYear = peak ?? Math.round((drink_from + drink_to) / 2)

  const window = { drinkFrom: drink_from, peak: peakYear, drinkTo: drink_to }

  if (NOW < drink_from) return { label: `Opens ${drink_from}`, color: '#7a4e00', ...window }
  if (NOW > drink_to) {
    const yrs = NOW - drink_to
    return { label: yrs === 1 ? 'Past window' : `${yrs}y past`, color: '#a07060', ...window }
  }
  if (NOW === peakYear) return { label: 'Peaking now', color: '#8b2035', ...window }
  if (NOW < peakYear)   return { label: `Peaks ${peakYear}`, color: '#2e7d32', ...window }
  return { label: `Peaked ${peakYear}`, color: '#a07060', ...window }
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
    id?:              string
    name?:            string
    producer?:        string | null
    critic_score?:    number | null
    grapes?:          string[]
    appellation?:     string
    region?:          string
    vintage?:         number | null
    label_image_url?: string | null
  } | undefined

  const { label, color, drinkFrom, peak: peakYear, drinkTo } = smartPeakLabel(bottle)
  const isPartnerBottle = !!(bottle.added_by && currentUserId && bottle.added_by !== currentUserId)

  // Initialise from whatever the server already has in the DB
  const storedPhoto = photoUrl ?? wine?.label_image_url ?? null
  const [photo, setPhoto] = useState<string | null>(storedPhoto)

  // If no image in DB yet, call the API route to fetch + save one
  useEffect(() => {
    if (photo) return                          // already have one
    const wineId   = wine?.id
    const name     = wine?.name     ?? ''
    const producer = wine?.producer ?? ''
    if (!wineId || (!name && !producer)) return

    let cancelled = false
    fetch(`/api/wine-photo?wineId=${wineId}&name=${encodeURIComponent(name)}&producer=${encodeURIComponent(producer)}`)
      .then(r => r.json())
      .then(({ url }: { url: string | null }) => {
        if (!cancelled && url) setPhoto(url)
      })
      .catch(() => { /* silently ignore — SVG fallback stays */ })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // run once per mount; deps intentionally omitted (values are stable)

  return (
    <Link
      href={`/cellar/${bottle.id}`}
      className="rounded-xl overflow-hidden flex items-stretch active:opacity-70 transition-opacity"
      style={{ background: '#ecddd4' }}
    >
      {/* Bottle photo or SVG illustration */}
      <div
        className="shrink-0 self-stretch flex items-end justify-center"
        style={{ width: 58, background: '#f8f4f0', paddingBottom: 4, paddingTop: 6 }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            style={{
              width: 46,
              height: '90%',
              maxHeight: 96,
              objectFit: 'contain',
              objectPosition: 'center bottom',
              display: 'block',
            }}
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
          <span className="ml-auto shrink-0">
            <DrinkingWindowBadge
              label={label} color={color}
              drinkFrom={drinkFrom} peak={peakYear} drinkTo={drinkTo}
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
