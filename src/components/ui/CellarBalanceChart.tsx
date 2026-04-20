'use client'

import { useState } from 'react'
import type { CellarBottle, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'

const NOW         = new Date().getFullYear()
const AXIS_START  = 2012          // vintage chart start year
const WINDOW_END  = NOW + 18      // drink-window chart end year
const TYPE_ORDER: WineType[] = ['Red', 'Champagne', 'White', 'Rosé']

// SVG canvas dimensions
const SVG_W    = 300
const BAR_H    = 90
const X_AXIS_H = 16
const Y_AXIS_W = 22
const SVG_H    = BAR_H + X_AXIS_H

// Drinking window estimation — mirrors CellarBottleCard logic
function estimateWindow(wineType: WineType, vintage: number | null) {
  switch (wineType) {
    case 'Champagne':
      if (!vintage) return { drinkFrom: NOW, drinkTo: NOW + 5 }
      return { drinkFrom: vintage + 5, drinkTo: vintage + 25 }
    case 'White':
      return { drinkFrom: (vintage ?? NOW) + 1, drinkTo: (vintage ?? NOW) + 7 }
    case 'Rosé':
      return { drinkFrom: NOW, drinkTo: NOW + 3 }
    default: // Red
      if (!vintage) return { drinkFrom: NOW, drinkTo: NOW + 10 }
      return { drinkFrom: vintage + 2, drinkTo: vintage + 15 }
  }
}

type ViewMode = 'vintage' | 'window'

export default function CellarBalanceChart({
  bottles,
  isDraft = false,
  bottleCount = 0,
}: {
  bottles:      CellarBottle[]
  isDraft?:     boolean
  bottleCount?: number
}) {
  const [view, setView] = useState<ViewMode>('vintage')

  const typesPresent = TYPE_ORDER.filter(t => bottles.some(b => b.wine_type === t))
  const totalQty     = bottles.reduce((s, b) => s + b.quantity, 0)
  const noVintage    = bottles
    .filter(b => !(b.wine as { vintage?: number | null } | undefined)?.vintage)
    .reduce((s, b) => s + b.quantity, 0)

  // ── Vintage view ──────────────────────────────────────────────
  const vintageYears     = Array.from({ length: NOW - AXIS_START + 1 }, (_, i) => AXIS_START + i)
  const totalVintageSpan = NOW - AXIS_START

  const vintageData = vintageYears.map(year => {
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

  // ── Drink-window view ─────────────────────────────────────────
  const windowYears     = Array.from({ length: WINDOW_END - NOW + 1 }, (_, i) => NOW + i)
  const totalWindowSpan = WINDOW_END - NOW

  const windowData = windowYears.map(year => {
    const counts: Partial<Record<WineType, number>> = {}
    let total = 0
    for (const b of bottles) {
      const wine    = b.wine as { vintage?: number | null } | undefined
      const w = (b.drink_from && b.drink_to)
        ? { drinkFrom: b.drink_from, drinkTo: b.drink_to }
        : estimateWindow(b.wine_type, wine?.vintage ?? null)
      if (year >= w.drinkFrom && year <= w.drinkTo) {
        counts[b.wine_type] = (counts[b.wine_type] ?? 0) + b.quantity
        total += b.quantity
      }
    }
    return { year, counts, total }
  })

  // ── Active chart config ───────────────────────────────────────
  const isVintage  = view === 'vintage'
  const activeData = isVintage ? vintageData : windowData
  const activeYears= isVintage ? vintageYears : windowYears
  const span       = isVintage ? totalVintageSpan : totalWindowSpan
  const axisStart  = isVintage ? AXIS_START : NOW
  const maxTotal   = Math.max(...activeData.map(d => d.total), 1)

  const chartW = SVG_W - Y_AXIS_W
  const xFor   = (year: number) => Y_AXIS_W + ((year - axisStart) / span) * chartW
  const slotW  = chartW / activeYears.length
  const barW   = Math.max(slotW - 2, 2)
  const yFor   = (n: number) => BAR_H - (n / maxTotal) * BAR_H
  const yTicks = [0, Math.round(maxTotal / 2), maxTotal].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase"
                style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
            Cellar
          </span>
          {isDraft && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(139,32,53,0.3)', color: '#c4a090', fontSize: 9 }}>
              PREVIEW
            </span>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden"
             style={{ border: '1px solid rgba(122,74,84,0.35)' }}>
          {(['vintage', 'window'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: view === v ? 'rgba(139,32,53,0.55)' : 'transparent',
                color:      view === v ? '#f0c0c0'              : '#7a4a54',
              }}
            >
              {v === 'vintage' ? 'By vintage' : 'By window'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 px-4 pb-2">
        {typesPresent.map(type => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block"
                  style={{ background: WINE_TYPE_COLOURS[type] }} />
            <span style={{ color: '#5a3040', fontSize: 10 }}>{type}</span>
          </div>
        ))}
      </div>

      {/* ── SVG chart ── */}
      <div className="px-4 pb-1">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Y-axis grid + labels */}
          {yTicks.map(val => {
            const y = yFor(val)
            return (
              <g key={val}>
                <line x1={Y_AXIS_W} y1={y} x2={SVG_W} y2={y}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <text x={Y_AXIS_W - 3} y={y + 3} textAnchor="end"
                      fontSize="7" fill="rgba(255,255,255,0.3)">
                  {val}
                </text>
              </g>
            )
          })}

          {/* "Now" marker for drink-window view */}
          {!isVintage && (
            <line
              x1={xFor(NOW)} y1={0} x2={xFor(NOW)} y2={BAR_H}
              stroke="rgba(255,255,255,0.18)" strokeWidth="0.75" strokeDasharray="2 2"
            />
          )}

          {/* Stacked bars */}
          {activeData.map(({ year, counts, total }) => {
            const x    = xFor(year) - barW / 2
            let   yTop = BAR_H
            return (
              <g key={year} opacity={isDraft && total === 0 ? 0.3 : 1}>
                {total === 0 ? (
                  <rect x={x} y={BAR_H - 2} width={barW} height={2}
                        fill="#2a1018" opacity="0.5" rx="0.5" />
                ) : (
                  TYPE_ORDER.map(type => {
                    const count = counts[type] ?? 0
                    if (!count) return null
                    const segH = (count / maxTotal) * BAR_H
                    yTop -= segH
                    return (
                      <rect key={type}
                            x={x} y={yTop} width={barW} height={segH}
                            fill={WINE_TYPE_COLOURS[type]}
                            opacity={isDraft ? 0.65 : 1}
                            rx="0.5" />
                    )
                  })
                )}
              </g>
            )
          })}

          {/* X-axis labels */}
          {isVintage ? (
            <>
              {vintageYears.filter(y => y % 2 === 0 && y !== NOW).map(y => (
                <text key={y} x={xFor(y)} y={BAR_H + X_AXIS_H - 2}
                      textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.4)">
                  {y}
                </text>
              ))}
              <text x={xFor(NOW)} y={BAR_H + X_AXIS_H - 2}
                    textAnchor="middle" fontSize="7" fontWeight="600"
                    fill="rgba(255,255,255,0.7)">
                {NOW}
              </text>
            </>
          ) : (
            windowYears.filter((_, i) => i % 3 === 0).map(y => (
              <text key={y} x={xFor(y)} y={BAR_H + X_AXIS_H - 2}
                    textAnchor="middle" fontSize="7"
                    fontWeight={y === NOW ? '600' : 'normal'}
                    fill={y === NOW ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'}>
                {y}
              </text>
            ))
          )}
        </svg>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 pb-4 pt-1">
        {isDraft ? (
          <p className="text-xs" style={{ color: '#7a4a54' }}>
            Preview · Add {10 - bottleCount} more {10 - bottleCount === 1 ? 'bottle' : 'bottles'} to see your full breakdown
          </p>
        ) : isVintage ? (
          <p className="text-xs" style={{ color: '#9a6070' }}>
            {totalQty} bottles{noVintage > 0 ? ` · ${noVintage} without vintage` : ''}
          </p>
        ) : (
          <p className="text-xs" style={{ color: '#9a6070' }}>
            Bottles open to drink each year · dashed line = now
          </p>
        )}
      </div>
    </div>
  )
}
