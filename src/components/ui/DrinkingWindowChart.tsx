'use client'

// Current year is injected at render time so the chart always shows the right "NOW" position
const NOW = new Date().getFullYear()

interface Props {
  drinkFrom: number
  peak:      number
  drinkTo:   number
}

export default function DrinkingWindowChart({ drinkFrom, peak, drinkTo }: Props) {
  // Axis runs from 2 years before open → 3 years past close
  const axisStart = drinkFrom - 2
  const axisEnd   = drinkTo   + 3
  const span      = axisEnd - axisStart

  /** Convert a year to a 0–100 percentage along the axis */
  function pct(year: number) {
    return ((year - axisStart) / span) * 100
  }

  const nowPct    = Math.min(Math.max(pct(NOW), 0), 100)
  const nowInside = NOW >= axisStart && NOW <= axisEnd

  // Status copy
  const yearsUntilOpen = drinkFrom - NOW
  const yearsPastClose = NOW - drinkTo
  let statusLabel = ''
  let statusColor = '#a07060'
  if (NOW < drinkFrom) {
    statusLabel = yearsUntilOpen === 1 ? 'Ready next year' : `Too young · opens in ${yearsUntilOpen} yr${yearsUntilOpen > 1 ? 's' : ''}`
    statusColor = '#a07060'
  } else if (NOW === peak) {
    statusLabel = '★ At peak right now'
    statusColor = '#8b2035'
  } else if (NOW > drinkTo) {
    statusLabel = `Past peak · ${yearsPastClose} yr${yearsPastClose > 1 ? 's' : ''} past best`
    statusColor = '#a07060'
  } else if (NOW >= drinkFrom && NOW < peak) {
    statusLabel = `Drinking window open · peak in ${peak - NOW} yr${(peak - NOW) > 1 ? 's' : ''}`
    statusColor = '#2e7d32'
  } else {
    statusLabel = `Drinking now · best before ${drinkTo}`
    statusColor = '#c07000'
  }

  // Section widths as percentages
  const preWidth     = pct(drinkFrom) - 0                          // before open
  const risingWidth  = pct(peak)      - pct(drinkFrom)             // open → peak
  const declWidth    = pct(drinkTo)   - pct(peak)                  // peak → close
  const postWidth    = 100            - pct(drinkTo)               // after close

  // Year tick marks to show below bar
  const ticks = Array.from(
    new Set([drinkFrom, peak, drinkTo, NOW].filter(y => y >= axisStart && y <= axisEnd))
  ).sort((a, b) => a - b)

  return (
    <div className="space-y-3">
      {/* Status line */}
      <p className="text-xs font-semibold" style={{ color: statusColor }}>{statusLabel}</p>

      {/* Bar */}
      <div className="relative" style={{ height: 44 }}>
        {/* Track */}
        <div className="absolute inset-y-3 left-0 right-0 rounded-full overflow-hidden flex">
          {/* Pre-window */}
          <div style={{ width: `${preWidth}%`, background: '#e2cfc4', flexShrink: 0 }} />
          {/* Rising: open → peak */}
          <div style={{
            width:      `${risingWidth}%`,
            background: 'linear-gradient(to right, #7fb069, #2e7d32)',
            flexShrink: 0,
          }} />
          {/* Declining: peak → close */}
          <div style={{
            width:      `${declWidth}%`,
            background: 'linear-gradient(to right, #2e7d32, #c07000)',
            flexShrink: 0,
          }} />
          {/* Post-window */}
          <div style={{ width: `${postWidth}%`, background: '#e2cfc4', flexShrink: 0 }} />
        </div>

        {/* Peak marker — diamond on top of bar */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${pct(peak)}%`, transform: 'translateX(-50%)' }}
        >
          <div
            className="w-3.5 h-3.5 rotate-45 border-2 border-white"
            style={{ background: '#8b2035', marginBottom: 2 }}
          />
        </div>

        {/* NOW line */}
        {nowInside && (
          <div
            className="absolute inset-y-0 flex flex-col items-center z-10"
            style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
          >
            <div className="flex-1 w-0.5 bg-white/90" style={{ marginTop: 2, marginBottom: 2 }} />
          </div>
        )}
      </div>

      {/* Year labels */}
      <div className="relative h-8">
        {ticks.map(year => {
          const p   = pct(year)
          const isNow  = year === NOW
          const isPeak = year === peak
          // Clamp label so it doesn't overflow edges
          const clampedLeft = Math.min(Math.max(p, 4), 96)
          return (
            <div
              key={year}
              className="absolute flex flex-col items-center"
              style={{ left: `${clampedLeft}%`, transform: 'translateX(-50%)' }}
            >
              {/* Tick mark */}
              <div className="w-px h-1.5 mb-0.5"
                   style={{ background: isNow ? '#3a1a20' : '#c4a090' }} />
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={{ color: isNow ? '#3a1a20' : isPeak ? '#8b2035' : '#a07060' }}
              >
                {isNow && !isPeak ? `${year} ▲` : year}
              </span>
              {isPeak && (
                <span className="text-xs font-bold" style={{ color: '#8b2035', lineHeight: 1 }}>
                  PEAK
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {[
          { color: '#7fb069', label: 'Drinking window' },
          { color: '#8b2035', label: 'Peak'            },
          { color: '#e2cfc4', label: 'Outside window'  },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-xs" style={{ color: '#a07060' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-gray-700 rounded" />
          <span className="text-xs" style={{ color: '#a07060' }}>Now ({NOW})</span>
        </div>
      </div>
    </div>
  )
}
