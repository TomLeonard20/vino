'use client'

import { BarChart, Bar, XAxis, ReferenceLine, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  opens: number
  peak: number
  closes: number
  bottlingYear?: number | null
}

function bellScore(year: number, peak: number, opens: number, closes: number): number {
  const sigma = (closes - opens) / 2.5
  if (sigma <= 0) return 10
  const floor = 10
  return floor + (100 - floor) * Math.exp(-0.5 * Math.pow((year - peak) / sigma, 2))
}

export default function DrinkingWindowChart({ opens, peak, closes, bottlingYear }: Props) {
  const currentYear = new Date().getFullYear()
  const start = (bottlingYear ?? opens) - 1
  const end = closes + 2

  const data = Array.from({ length: end - start + 1 }, (_, i) => {
    const year = start + i
    return { year, score: bellScore(year, peak, opens, closes) }
  })

  return (
    <div className="rounded-xl p-4" style={{ background: '#3a1a20' }}>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} barCategoryGap="5%">
          <XAxis
            dataKey="year"
            ticks={[opens, peak, closes]}
            tick={{ fill: '#c4a090', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine
            x={currentYear}
            stroke="#8b2035"
            strokeWidth={2}
            strokeDasharray="4 3"
            label={{ value: 'now', fill: '#8b2035', fontSize: 10, position: 'top' }}
          />
          <Bar dataKey="score" radius={[2, 2, 0, 0]}>
            {data.map(entry => {
              const alpha = Math.max(0.15, entry.score / 100)
              return (
                <Cell
                  key={entry.year}
                  fill={`rgba(139,32,53,${alpha})`}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Anchor labels */}
      <div className="flex justify-between mt-1 px-1">
        {[{ label: 'Opens', year: opens }, { label: 'Peak', year: peak }, { label: 'Closes', year: closes }].map(a => (
          <div key={a.label} className="text-center">
            <div className="text-xs" style={{ color: '#c4a090' }}>{a.label}</div>
            <div className="text-sm font-semibold text-white">{a.year}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
