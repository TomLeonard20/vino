'use client'

import type { CellarBottle, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'

const NOW        = new Date().getFullYear()
const AXIS_START = 2012
const TYPE_ORDER: WineType[] = ['Red', 'Champagne', 'White', 'Rosé']

// Critic score range used for normalising the quality line.
// Wine scores almost never go below 82 in published reviews.
const SCORE_MIN = 82
const SCORE_MAX = 97

function qualityColor(score: number): string {
  // Map score to a gold→green gradient: weak years dimmer, great years bright gold
  if (score >= 95) return '#e8c96e'   // gold — exceptional
  if (score >= 92) return '#c9a84c'   // amber — excellent
  if (score >= 89) return '#a07840'   // warm brown — good
  return '#7a5830'                    // muted — average / below average
}

function qualityLabel(score: number): string {
  if (score >= 95) return 'Exceptional'
  if (score >= 92) return 'Excellent'
  if (score >= 89) return 'Good'
  if (score >= 86) return 'Average'
  return 'Below avg'
}

export default function CellarBalanceChart({
  bottles,
  vintageQuality = {},
  isDraft = false,
  bottleCount = 0,
}: {
  bottles:         CellarBottle[]
  vintageQuality?: Record<number, number>
  isDraft?:        boolean
  bottleCount?:    number
}) {
  const years      = Array.from({ length: NOW - AXIS_START + 1 }, (_, i) => AXIS_START + i)
  const totalYears = NOW - AXIS_START

  const yearData = years.map(year => {
    const counts: Partial<Record<WineType, number>> = {}
    let total = 0
    for (const b of bottles) {
      const vintage = (b.wine as { vintage?: number | null } | undefined)?.vintage
      if (vintage === year) {
        counts[b.wine_type] = (counts[b.wine_type] ?? 0) + b.quantity
        total += b.quantity
      }
    }
    return { year, counts, total }
  })

  const maxTotal    = Math.max(...yearData.map(d => d.total), 1)
  const noVintage   = bottles.filter(b => !(b.wine as { vintage?: number | null } | undefined)?.vintage)
    .reduce((s, b) => s + b.quantity, 0)
  const typesPresent = TYPE_ORDER.filter(t => bottles.some(b => b.wine_type === t))

  const pct = (year: number) => `${((year - AXIS_START) / totalYears) * 100}%`

  // Normalise quality score to a 0–1 value for the SVG line
  const qualityNorm = (score: number) =>
    Math.max(0, Math.min(1, (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)))

  // Bar chart height
  const BAR_H = 80

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase"
                style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
            Cellar by Vintage
          </span>
          {isDraft && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(139,32,53,0.3)', color: '#c4a090', fontSize: 9 }}>
              PREVIEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {typesPresent.map(type => (
            <div key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block"
                    style={{ background: WINE_TYPE_COLOURS[type] }} />
              <span style={{ color: '#5a3040', fontSize: 10 }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked bar chart + quality line overlay */}
      <div className="relative mx-4" style={{ height: BAR_H }}>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end" style={{ gap: 3 }}>
          {yearData.map(({ year, counts, total }) => {
            const barPx = total > 0 ? Math.max((total / maxTotal) * (BAR_H - 4), 4) : 2
            return (
              <div key={year}
                   className="flex-1 flex flex-col-reverse rounded-t-sm overflow-hidden"
                   style={{
                     height: barPx,
                     minWidth: 6,
                     opacity: isDraft && total === 0 ? 0.4 : 1,
                   }}>
                {total === 0 ? (
                  <div style={{ flex: 1, background: '#2a1018', opacity: isDraft ? 0.6 : 0.25 }} />
                ) : (
                  TYPE_ORDER.map(type => {
                    const count = counts[type] ?? 0
                    if (!count) return null
                    return (
                      <div key={type}
                           style={{
                             height: `${(count / total) * 100}%`,
                             background: WINE_TYPE_COLOURS[type],
                             opacity: isDraft ? 0.65 : 1,
                           }} />
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {/* Vintage quality SVG overlay */}
        {Object.keys(vintageQuality).length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={BAR_H}
            preserveAspectRatio="none"
            viewBox={`0 0 ${years.length} ${BAR_H}`}
          >
            {/* Connecting line */}
            <polyline
              fill="none"
              stroke="rgba(232,201,110,0.3)"
              strokeWidth="0.8"
              points={years
                .filter(y => vintageQuality[y] != null)
                .map((y, _, arr) => {
                  const x = ((y - AXIS_START) / totalYears) * years.length
                  const norm = qualityNorm(vintageQuality[y])
                  const yPos = BAR_H - 6 - norm * (BAR_H - 12)
                  return `${x},${yPos}`
                })
                .join(' ')}
            />
            {/* Dots per year */}
            {years.map(y => {
              const score = vintageQuality[y]
              if (score == null) return null
              const x    = ((y - AXIS_START) / totalYears) * years.length
              const norm = qualityNorm(score)
              const yPos = BAR_H - 6 - norm * (BAR_H - 12)
              return (
                <circle
                  key={y}
                  cx={x}
                  cy={yPos}
                  r="1.4"
                  fill={qualityColor(score)}
                  opacity="0.9"
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Year axis */}
      <div className="relative mx-4 mt-2" style={{ height: 18 }}>
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'rgba(255,255,255,0.06)' }} />
        {years.filter(y => y % 2 === 0).map(y => (
          <div key={y} className="absolute text-center"
               style={{ left: pct(y), transform: 'translateX(-50%)', top: 3 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>{y}</p>
          </div>
        ))}
        <div className="absolute text-center"
             style={{ left: '100%', transform: 'translateX(-100%)', top: 3 }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 600 }}>{NOW}</p>
        </div>
      </div>

      {/* Vintage quality legend row */}
      {Object.keys(vintageQuality).length > 0 && (
        <div className="px-4 pt-2 pb-1 flex items-center gap-3">
          <span style={{ color: '#5a3040', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Vintage quality
          </span>
          {([
            { label: 'Exceptional', color: '#e8c96e' },
            { label: 'Excellent',   color: '#c9a84c' },
            { label: 'Good',        color: '#a07840' },
          ] as const).map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
              <span style={{ color: '#5a3040', fontSize: 9 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Best/worst vintage callout row */}
      {Object.keys(vintageQuality).length > 0 && (() => {
        const entries = Object.entries(vintageQuality)
          .map(([y, s]) => ({ year: parseInt(y), score: s }))
          .filter(e => e.year >= AXIS_START && e.year <= NOW)
          .sort((a, b) => b.score - a.score)
        const best  = entries[0]
        const worst = entries[entries.length - 1]
        if (!best || !worst || best.year === worst.year) return null
        return (
          <div className="mx-4 mb-3 mt-1 flex gap-2">
            <div className="flex-1 rounded-lg px-2.5 py-1.5"
                 style={{ background: 'rgba(232,201,110,0.1)', border: '1px solid rgba(232,201,110,0.2)' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Best vintage
              </p>
              <p className="font-bold" style={{ color: '#e8c96e', fontSize: 13 }}>
                {best.year}
                <span className="font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                  {best.score} pts · {qualityLabel(best.score)}
                </span>
              </p>
            </div>
            <div className="flex-1 rounded-lg px-2.5 py-1.5"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Weakest vintage
              </p>
              <p className="font-bold" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                {worst.year}
                <span className="font-normal ml-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                  {worst.score} pts · {qualityLabel(worst.score)}
                </span>
              </p>
            </div>
          </div>
        )
      })()}

      {/* Footer */}
      <div className="px-4 pb-4">
        {isDraft ? (
          <p className="text-xs" style={{ color: '#7a4a54' }}>
            Preview · Add {10 - bottleCount} more {10 - bottleCount === 1 ? 'bottle' : 'bottles'} to see your full breakdown
          </p>
        ) : (
          <p className="text-xs" style={{ color: '#9a6070' }}>
            {bottles.reduce((s, b) => s + b.quantity, 0)} bottles
            {noVintage > 0 ? ` · ${noVintage} without vintage` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
