'use client'

const NOW = new Date().getFullYear()

interface Props {
  drinkFrom:  number
  peak:       number
  drinkTo:    number
  estimated?: boolean
}

/** Bell-curve height for a bar at `year`, peaking at 1.0 at `peak` */
function barHeight(year: number, drinkFrom: number, peak: number, drinkTo: number): number {
  if (year < drinkFrom || year > drinkTo) return 0
  // Asymmetric bell: steeper rise, longer decline
  if (year <= peak) {
    const t = (year - drinkFrom) / Math.max(peak - drinkFrom, 1)
    return Math.pow(t, 0.7)   // concave up on the rise
  } else {
    const t = (year - peak) / Math.max(drinkTo - peak, 1)
    return 1 - Math.pow(t, 0.9)
  }
}

/** Human-readable status based on NOW vs window */
function statusInfo(drinkFrom: number, peak: number, drinkTo: number) {
  const yearsToPeak  = peak - NOW
  const yearsPastPeak = NOW - peak
  const yearsToOpen  = drinkFrom - NOW
  const yearsPastClose = NOW - drinkTo

  if (NOW < drinkFrom) {
    return {
      label: yearsToOpen === 1
        ? 'Opens next year'
        : `Opens in ${yearsToOpen} years`,
      pill:  'Too young',
      pillBg: '#5c3317',
      pillText: '#f5ede6',
      dot:   '#a07060',
    }
  }
  if (NOW > drinkTo) {
    return {
      label: yearsPastClose === 1
        ? '1 year past drinking window'
        : `${yearsPastClose} years past drinking window`,
      pill:  'Past peak',
      pillBg: '#4a2010',
      pillText: '#c4a090',
      dot:   '#a07060',
    }
  }
  if (NOW === peak) {
    return {
      label: 'At peak right now',
      pill:  'At peak',
      pillBg: '#8b2035',
      pillText: 'white',
      dot:   '#8b2035',
    }
  }
  if (NOW < peak) {
    return {
      label: yearsToPeak === 1
        ? 'Drink window · peaks next year'
        : `Drink window · ${yearsToPeak} years to peak`,
      pill:  'Drink now',
      pillBg: '#1a4d1e',
      pillText: '#a8e6ab',
      dot:   '#4caf50',
    }
  }
  // Past peak but still in window
  return {
    label: yearsPastPeak === 1
      ? 'Drink window · 1 year past peak'
      : `Drink window · ${yearsPastPeak} years past peak`,
    pill:  'Drink now',
    pillBg: '#1a4d1e',
    pillText: '#a8e6ab',
    dot:   '#4caf50',
  }
}

export default function DrinkingWindowChart({ drinkFrom, peak, drinkTo, estimated }: Props) {
  const axisStart = drinkFrom - 1
  // Always show at least 10 years on the axis
  const axisEnd   = Math.max(drinkTo + 2, axisStart + 10)
  const years     = Array.from({ length: axisEnd - axisStart + 1 }, (_, i) => axisStart + i)

  const status = statusInfo(drinkFrom, peak, drinkTo)

  // Clamp NOW marker within visible range
  const nowClamped = Math.min(Math.max(NOW, axisStart), axisEnd)
  const nowPct     = ((nowClamped - axisStart) / (axisEnd - axisStart)) * 100

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <span className="text-xs font-bold tracking-widest uppercase"
                style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
            Drinking Window
          </span>
          {estimated && (
            <span className="ml-2 text-xs" style={{ color: '#5a3040' }}>· estimated</span>
          )}
        </div>
        {/* Status pill */}
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: status.pillBg, color: status.pillText }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
          {status.pill}
        </span>
      </div>

      {/* ── Bar chart ── */}
      <div className="relative px-4 pb-0" style={{ height: 110 }}>
        {/* Bars */}
        <div className="absolute bottom-0 left-4 right-4 flex items-end gap-px" style={{ height: 90 }}>
          {years.map(year => {
            const h       = barHeight(year, drinkFrom, peak, drinkTo)
            const inWindow = year >= drinkFrom && year <= drinkTo
            const isPeak   = year === peak

            // Colour: dark burgundy outside window, brighter inside, brightest at peak
            let bg = '#2a1018'
            if (inWindow) {
              const intensity = 0.4 + h * 0.6
              if (isPeak) {
                bg = '#c4405a'
              } else {
                // Interpolate from dim rose to bright rose
                const r = Math.round(100 + intensity * 96)
                const g = Math.round(20  + intensity * 24)
                const b = Math.round(40  + intensity * 40)
                bg = `rgb(${r},${g},${b})`
              }
            }

            return (
              <div
                key={year}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height:     `${Math.max(h * 100, inWindow ? 8 : 3)}%`,
                  background: bg,
                  minWidth:   2,
                  opacity:    inWindow ? 1 : 0.4,
                }}
              />
            )
          })}
        </div>

        {/* NOW line */}
        {NOW >= axisStart && NOW <= axisEnd && (
          <div
            className="absolute bottom-0 z-10 flex flex-col items-center"
            style={{
              left:      `calc(1rem + ${nowPct}% * (100% - 2rem) / 100)`,
              transform: 'translateX(-50%)',
              height:    100,
            }}
          >
            <span className="text-white text-xs font-semibold mb-1"
                  style={{ fontSize: 10, letterSpacing: '0.02em' }}>
              Now
            </span>
            <div className="flex-1 w-px" style={{ background: 'rgba(255,255,255,0.7)' }} />
          </div>
        )}
      </div>

      {/* ── Footer labels ── */}
      <div className="relative px-4 pt-2 pb-4" style={{ height: 48 }}>
        {/* Opens */}
        <div className="absolute" style={{ left: `calc(1rem + ${((drinkFrom - axisStart) / (axisEnd - axisStart)) * 100}% * (100% - 2rem) / 100)`, transform: 'translateX(-50%)' }}>
          <p className="text-base font-bold" style={{ color: 'white' }}>{drinkFrom}</p>
          <p className="text-xs" style={{ color: '#7a4a54' }}>Opens</p>
        </div>

        {/* Peak */}
        <div className="absolute" style={{ left: `calc(1rem + ${((peak - axisStart) / (axisEnd - axisStart)) * 100}% * (100% - 2rem) / 100)`, transform: 'translateX(-50%)' }}>
          <p className="text-base font-bold" style={{ color: 'white' }}>{peak}</p>
          <p className="text-xs" style={{ color: '#7a4a54' }}>Peak</p>
        </div>

        {/* Closes */}
        <div className="absolute" style={{ left: `calc(1rem + ${((drinkTo - axisStart) / (axisEnd - axisStart)) * 100}% * (100% - 2rem) / 100)`, transform: 'translateX(-50%)' }}>
          <p className="text-base font-bold" style={{ color: 'white' }}>{drinkTo}</p>
          <p className="text-xs" style={{ color: '#7a4a54' }}>Closes</p>
        </div>
      </div>

      {/* ── Status line ── */}
      <div className="px-4 pb-4">
        <p className="text-xs" style={{ color: '#9a6070' }}>{status.label}</p>
      </div>
    </div>
  )
}
