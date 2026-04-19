'use client'

import { useState } from 'react'
import type { CellarBottle, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'

const NOW        = new Date().getFullYear()
const AXIS_START = 2012
const TYPE_ORDER: WineType[] = ['Red', 'Champagne', 'White', 'Rosé']

// SVG canvas dimensions (in px-equivalent units — 1:1 with rendered pixels
// since we use width/height attributes, not a scaled viewBox)
const SVG_W    = 300   // normalised width; we use viewBox="0 0 300 H"
const BAR_H    = 90    // chart area height
const X_AXIS_H = 16    // space below bars for year labels
const Y_AXIS_W = 22    // space left of bars for bottle-count labels
const SVG_H    = BAR_H + X_AXIS_H

// Critic score range for normalising the quality line
const SCORE_MIN = 82
const SCORE_MAX = 97

function qualityColor(score: number): string {
  if (score >= 95) return '#e8c96e'
  if (score >= 92) return '#c9a84c'
  if (score >= 89) return '#a07840'
  return '#7a5830'
}

function qualityNorm(score: number): number {
  return Math.max(0, Math.min(1, (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)))
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
  const [expanded, setExpanded] = useState(false)

  const years      = Array.from({ length: NOW - AXIS_START + 1 }, (_, i) => AXIS_START + i)
  const totalYears = NOW - AXIS_START  // span between first and last year

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

  const maxTotal     = Math.max(...yearData.map(d => d.total), 1)
  const noVintage    = bottles.filter(b => !(b.wine as { vintage?: number | null } | undefined)?.vintage)
    .reduce((s, b) => s + b.quantity, 0)
  const typesPresent = TYPE_ORDER.filter(t => bottles.some(b => b.wine_type === t))
  const totalQty     = bottles.reduce((s, b) => s + b.quantity, 0)

  // Map a year → SVG x coordinate (within the chart area, i.e. after Y_AXIS_W)
  // Chart area runs from x=0 to x=(SVG_W - Y_AXIS_W)
  const chartW = SVG_W - Y_AXIS_W
  const xFor   = (year: number) => Y_AXIS_W + ((year - AXIS_START) / totalYears) * chartW

  // Bar slot width (leave 2px gap between bars)
  const slotW  = chartW / years.length
  const barW   = Math.max(slotW - 2, 2)

  // Y-axis ticks: 0, half, max
  const yTicks = [0, Math.round(maxTotal / 2), maxTotal].filter((v, i, a) => a.indexOf(v) === i)

  const yFor = (bottles: number) => BAR_H - (bottles / maxTotal) * BAR_H

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* ── Header — always visible, tappable to expand ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 pt-4 pb-3"
      >
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
        <div className="flex items-center gap-3">
          {!expanded && (
            <div className="flex items-center gap-2">
              {typesPresent.map(type => (
                <div key={type} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm inline-block"
                        style={{ background: WINE_TYPE_COLOURS[type] }} />
                </div>
              ))}
            </div>
          )}
          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {expanded
              ? <polyline points="18 15 12 9 6 15" />
              : <polyline points="6 9 12 15 18 9" />}
          </svg>
        </div>
      </button>

      {/* ── Collapsed summary ── */}
      {!expanded && (
        <div className="px-4 pb-4">
          <p className="text-xs" style={{ color: '#5a3040' }}>
            {totalQty} bottle{totalQty !== 1 ? 's' : ''}
            {noVintage > 0 ? ` · ${noVintage} without vintage` : ''}
            {isDraft ? ` · ${10 - bottleCount} more to unlock full chart` : ''}
            {' '}· Tap to expand
          </p>
        </div>
      )}

      {/* ── Expanded chart ── */}
      {expanded && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 px-4 pb-3">
            {typesPresent.map(type => (
              <div key={type} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block"
                      style={{ background: WINE_TYPE_COLOURS[type] }} />
                <span style={{ color: '#5a3040', fontSize: 10 }}>{type}</span>
              </div>
            ))}
            {Object.keys(vintageQuality).length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#e8c96e' }} />
                <span style={{ color: '#5a3040', fontSize: 10 }}>Vintage quality</span>
              </div>
            )}
          </div>

          {/* SVG chart */}
          <div className="px-4 pb-1">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width="100%"
              style={{ display: 'block', overflow: 'visible' }}
            >
              {/* ── Y-axis grid lines + labels ── */}
              {yTicks.map(val => {
                const y = yFor(val)
                return (
                  <g key={val}>
                    <line
                      x1={Y_AXIS_W} y1={y} x2={SVG_W} y2={y}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
                    />
                    <text
                      x={Y_AXIS_W - 3} y={y + 3}
                      textAnchor="end"
                      fontSize="7"
                      fill="rgba(255,255,255,0.3)"
                    >
                      {val}
                    </text>
                  </g>
                )
              })}

              {/* ── Stacked bars ── */}
              {yearData.map(({ year, counts, total }) => {
                const x    = xFor(year) - barW / 2
                let   yTop = BAR_H  // start from bottom
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

              {/* ── Vintage quality line + dots ── */}
              {Object.keys(vintageQuality).length > 0 && (() => {
                const pts = years
                  .filter(y => vintageQuality[y] != null)
                  .map(y => ({
                    x: xFor(y),
                    y: BAR_H - 4 - qualityNorm(vintageQuality[y]) * (BAR_H - 8),
                    score: vintageQuality[y],
                  }))
                return (
                  <g>
                    <polyline
                      fill="none"
                      stroke="rgba(232,201,110,0.25)"
                      strokeWidth="1"
                      points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                    />
                    {pts.map(({ x, y, score }, i) => (
                      <circle key={i} cx={x} cy={y} r="2"
                              fill={qualityColor(score)} opacity="0.85" />
                    ))}
                  </g>
                )
              })()}

              {/* ── X-axis year labels ── */}
              {years.filter(y => y % 2 === 0).map(y => (
                <text key={y}
                      x={xFor(y)} y={BAR_H + X_AXIS_H - 2}
                      textAnchor="middle"
                      fontSize="7" fill="rgba(255,255,255,0.4)">
                  {y}
                </text>
              ))}
              <text
                x={xFor(NOW)} y={BAR_H + X_AXIS_H - 2}
                textAnchor="middle"
                fontSize="7" fontWeight="600" fill="rgba(255,255,255,0.7)">
                {NOW}
              </text>
            </svg>
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 pt-1">
            {isDraft ? (
              <p className="text-xs" style={{ color: '#7a4a54' }}>
                Preview · Add {10 - bottleCount} more {10 - bottleCount === 1 ? 'bottle' : 'bottles'} to see your full breakdown
              </p>
            ) : (
              <p className="text-xs" style={{ color: '#9a6070' }}>
                {totalQty} bottles{noVintage > 0 ? ` · ${noVintage} without vintage` : ''}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
