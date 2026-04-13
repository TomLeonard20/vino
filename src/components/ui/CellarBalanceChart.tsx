'use client'

import type { CellarBottle, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'

const NOW       = new Date().getFullYear()
const AXIS_START = 2015
const TYPE_ORDER: WineType[] = ['Red', 'Champagne', 'White', 'Rosé']

export default function CellarBalanceChart({ bottles }: { bottles: CellarBottle[] }) {
  if (bottles.length === 0) return null

  const years     = Array.from({ length: NOW - AXIS_START + 1 }, (_, i) => AXIS_START + i)
  const totalYears = NOW - AXIS_START

  // For each vintage year, count bottles by wine type
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

  const maxTotal   = Math.max(...yearData.map(d => d.total), 1)
  const noVintage  = bottles.filter(b => !(b.wine as { vintage?: number | null } | undefined)?.vintage)
    .reduce((s, b) => s + b.quantity, 0)

  const pct = (year: number) => `${((year - AXIS_START) / totalYears) * 100}%`

  // Legend: types actually present
  const typesPresent = TYPE_ORDER.filter(t => bottles.some(b => b.wine_type === t))

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="text-xs font-bold tracking-widest uppercase"
              style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
          Cellar by Vintage
        </span>
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

      {/* Stacked bar chart */}
      <div className="relative mx-4" style={{ height: 80 }}>
        <div className="absolute inset-0 flex items-end" style={{ gap: 3 }}>
          {yearData.map(({ year, counts, total }) => {
            const barPx = total > 0 ? Math.max((total / maxTotal) * 76, 4) : 2
            return (
              <div key={year}
                   className="flex-1 flex flex-col-reverse rounded-t-sm overflow-hidden"
                   style={{ height: barPx, minWidth: 6 }}>
                {total === 0 ? (
                  <div style={{ flex: 1, background: '#2a1018', opacity: 0.25 }} />
                ) : (
                  TYPE_ORDER.map(type => {
                    const count = counts[type] ?? 0
                    if (!count) return null
                    return (
                      <div key={type}
                           style={{
                             height: `${(count / total) * 100}%`,
                             background: WINE_TYPE_COLOURS[type],
                           }} />
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Year labels */}
      <div className="relative mx-4 mt-2 mb-1" style={{ height: 20 }}>
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'rgba(255,255,255,0.06)' }} />
        {years.filter(y => y % 2 === 0).map(y => (
          <div key={y} className="absolute text-center"
               style={{ left: pct(y), transform: 'translateX(-50%)', top: 4 }}>
            <p style={{ color: '#4a2a34', fontSize: 9 }}>{y}</p>
          </div>
        ))}
        {/* Current year label */}
        <div className="absolute text-center"
             style={{ left: '100%', transform: 'translateX(-100%)', top: 4 }}>
          <p style={{ color: '#7a4a54', fontSize: 9, fontWeight: 600 }}>{NOW}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <p className="text-xs" style={{ color: '#9a6070' }}>
          {bottles.reduce((s, b) => s + b.quantity, 0)} bottles
          {noVintage > 0 ? ` · ${noVintage} without vintage` : ''}
        </p>
      </div>

    </div>
  )
}
