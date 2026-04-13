'use client'

import type { CellarBottle, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'

const NOW = new Date().getFullYear()
const AXIS_END = 2050
const TYPE_ORDER: WineType[] = ['Red', 'Champagne', 'White', 'Rosé']

function getWindow(b: CellarBottle): { from: number; to: number } {
  if (b.drink_from && b.drink_to) return { from: b.drink_from, to: b.drink_to }
  const base = (b.wine as { vintage?: number | null } | undefined)?.vintage ?? NOW
  switch (b.wine_type) {
    case 'Champagne': return { from: base + 4, to: base + 20 }
    case 'White':     return { from: base + 1, to: base + 7  }
    case 'Rosé':      return { from: base,     to: base + 3  }
    default:          return { from: base + 2, to: base + 14 }
  }
}

export default function CellarBalanceChart({ bottles }: { bottles: CellarBottle[] }) {
  if (bottles.length === 0) return null

  const axisStart  = NOW
  const totalYears = AXIS_END - axisStart
  const years      = Array.from({ length: totalYears + 1 }, (_, i) => axisStart + i)
  const tickYears  = years.filter(y => y % 5 === 0)

  // For each year, count bottles by wine type
  const yearData = years.map(year => {
    const counts: Partial<Record<WineType, number>> = {}
    let total = 0
    for (const b of bottles) {
      const { from, to } = getWindow(b)
      if (year >= from && year <= to) {
        counts[b.wine_type] = (counts[b.wine_type] ?? 0) + b.quantity
        total += b.quantity
      }
    }
    return { year, counts, total }
  })

  const maxTotal = Math.max(...yearData.map(d => d.total), 1)

  const pct = (year: number) => `${((year - axisStart) / totalYears) * 100}%`

  // Count bottles by type for legend
  const typeCounts = TYPE_ORDER.map(t => ({
    type: t,
    count: bottles.filter(b => b.wine_type === t).length,
  })).filter(x => x.count > 0)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="text-xs font-bold tracking-widest uppercase"
              style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
          Cellar Balance
        </span>
        <div className="flex items-center gap-3">
          {typeCounts.map(({ type }) => (
            <div key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block"
                    style={{ background: WINE_TYPE_COLOURS[type] }} />
              <span style={{ color: '#5a3040', fontSize: 10 }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative mx-4" style={{ height: 80 }}>

        {/* Stacked bars */}
        <div className="absolute inset-0 flex items-end" style={{ gap: 1 }}>
          {yearData.map(({ year, counts, total }) => {
            const isNow = year === NOW
            const barH  = (total / maxTotal) * 76 // px, max 76

            return (
              <div key={year}
                   className="flex-1 flex flex-col-reverse"
                   style={{ height: barH || 2, minWidth: 1 }}>
                {total === 0 ? (
                  <div style={{ flex: 1, background: '#2a1018', opacity: 0.3 }} />
                ) : (
                  TYPE_ORDER.map(type => {
                    const count = counts[type] ?? 0
                    if (!count) return null
                    const segH = `${(count / total) * 100}%`
                    return (
                      <div key={type}
                           style={{
                             height: segH,
                             background: WINE_TYPE_COLOURS[type],
                             opacity: isNow ? 1 : 0.8,
                           }} />
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {/* NOW line */}
        <div className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-10"
             style={{ left: pct(NOW), transform: 'translateX(-50%)' }}>
          <span className="font-semibold leading-none mb-1"
                style={{ color: 'white', fontSize: 10 }}>
            Now
          </span>
          <div className="flex-1 w-px" style={{ background: 'rgba(255,255,255,0.65)' }} />
        </div>
      </div>

      {/* Year ticks */}
      <div className="relative mx-4 mt-2 mb-3" style={{ height: 16 }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        {tickYears.map(y => (
          <div key={y} className="absolute text-center"
               style={{ left: pct(y), transform: 'translateX(-50%)', top: 4 }}>
            <p style={{ color: '#4a2a34', fontSize: 9 }}>{y}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="px-4 pb-4">
        <p className="text-xs" style={{ color: '#9a6070' }}>
          Showing when each of your {bottles.reduce((s, b) => s + b.quantity, 0)} bottles will be at their best
        </p>
      </div>

    </div>
  )
}
