'use client'

const NOW = new Date().getFullYear()

interface Props {
  drinkFrom:  number
  peak:       number
  drinkTo:    number
  estimated?: boolean
}

/** Bell-curve height 0–1 for a bar at `year` */
function barHeight(year: number, drinkFrom: number, peak: number, drinkTo: number): number {
  if (year < drinkFrom || year > drinkTo) return 0
  if (year <= peak) {
    const t = (year - drinkFrom) / Math.max(peak - drinkFrom, 1)
    return Math.pow(t, 0.7)   // concave up on the rise
  } else {
    const t = (year - peak) / Math.max(drinkTo - peak, 1)
    return 1 - Math.pow(t, 0.9)
  }
}

function statusInfo(drinkFrom: number, peak: number, drinkTo: number) {
  const yearsToPeak    = peak - NOW
  const yearsPastPeak  = NOW - peak
  const yearsToOpen    = drinkFrom - NOW
  const yearsPastClose = NOW - drinkTo

  if (NOW < drinkFrom) return {
    label:    yearsToOpen === 1 ? 'Opens next year' : `Opens in ${yearsToOpen} years`,
    pill:     'Too young',
    pillBg:   '#5c3317', pillText: '#f5ede6', dot: '#a07060',
  }
  if (NOW > drinkTo) return {
    label:    yearsPastClose === 1 ? '1 year past drinking window' : `${yearsPastClose} years past drinking window`,
    pill:     'Past peak',
    pillBg:   '#4a2010', pillText: '#c4a090', dot: '#a07060',
  }
  if (NOW === peak) return {
    label:    'At peak right now',
    pill:     'At peak',
    pillBg:   '#8b2035', pillText: 'white', dot: '#8b2035',
  }
  if (NOW < peak) return {
    label:    yearsToPeak === 1 ? 'Drink window · peaks next year' : `Drink window · ${yearsToPeak} years to peak`,
    pill:     'Drink now',
    pillBg:   '#1a4d1e', pillText: '#a8e6ab', dot: '#4caf50',
  }
  return {
    label:    yearsPastPeak === 1 ? 'Drink window · 1 year past peak' : `Drink window · ${yearsPastPeak} years past peak`,
    pill:     'Drink now',
    pillBg:   '#1a4d1e', pillText: '#a8e6ab', dot: '#4caf50',
  }
}

export default function DrinkingWindowChart({ drinkFrom, peak, drinkTo, estimated }: Props) {
  // Always span from NOW (or earlier if drinkFrom is sooner) to 2040
  const axisStart  = Math.min(NOW, drinkFrom - 1)
  const axisEnd    = 2040
  const totalYears = axisEnd - axisStart
  const years      = Array.from({ length: totalYears + 1 }, (_, i) => axisStart + i)

  // Year tick marks every 5 years along the bottom
  const tickYears  = years.filter(y => y % 5 === 0)

  const status = statusInfo(drinkFrom, peak, drinkTo)

  // Simple percentage position within the bar area (left edge = axisStart, right = axisEnd)
  const pct = (year: number) =>
    `${((year - axisStart) / totalYears) * 100}%`

  const nowClamped = Math.min(Math.max(NOW, axisStart), axisEnd)
  const nowPct     = pct(nowClamped)

  // Decide which year labels to show — suppress Opens/Closes if they'd collide with each other
  const minGap      = totalYears * 0.12   // 12% of chart width minimum gap
  const showOpens   = (peak - drinkFrom) >= minGap
  const showCloses  = (drinkTo - peak)   >= minGap

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase"
                style={{ color: '#7a4a54', letterSpacing: '0.12em' }}>
            Drinking Window
          </span>
          {estimated && (
            <span className="text-xs" style={{ color: '#5a3040' }}>· estimated</span>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: status.pillBg, color: status.pillText }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: status.dot }} />
          {status.pill}
        </span>
      </div>

      {/* ── Bars + NOW line — all positioned in one relative container ── */}
      <div className="relative mx-4" style={{ height: 100 }}>

        {/* Bars: full-width flex row */}
        <div className="absolute inset-0 flex items-end" style={{ gap: 2 }}>
          {years.map(year => {
            const h        = barHeight(year, drinkFrom, peak, drinkTo)
            const inWindow = year >= drinkFrom && year <= drinkTo
            const isPeak   = year === peak

            let bg = '#2a1018'
            if (inWindow) {
              if (isPeak) {
                bg = '#c4405a'
              } else {
                const intensity = 0.35 + h * 0.65
                const r = Math.round(90  + intensity * 106)
                const g = Math.round(16  + intensity * 28)
                const b = Math.round(32  + intensity * 42)
                bg = `rgb(${r},${g},${b})`
              }
            }

            return (
              <div
                key={year}
                className="flex-1 rounded-t-sm"
                style={{
                  height:     `${Math.max(h * 100, inWindow ? 6 : 2)}%`,
                  background: bg,
                  opacity:    inWindow ? 1 : 0.35,
                  minWidth:   2,
                }}
              />
            )
          })}
        </div>

        {/* NOW line — positioned with simple left% inside the same container */}
        {NOW >= axisStart && NOW <= axisEnd && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-10"
            style={{ left: nowPct, transform: 'translateX(-50%)' }}
          >
            <span className="font-semibold leading-none mb-1.5"
                  style={{ color: 'white', fontSize: 10 }}>
              Now
            </span>
            <div className="flex-1 w-px" style={{ background: 'rgba(255,255,255,0.65)' }} />
          </div>
        )}
      </div>

      {/* ── Opens / Peak / Closes labels — float above the axis ── */}
      <div className="relative mx-4 mt-1" style={{ height: 28 }}>
        {showOpens && (
          <div className="absolute text-center" style={{ left: pct(drinkFrom), transform: 'translateX(-50%)' }}>
            <p className="font-semibold leading-none" style={{ color: 'white', fontSize: 11 }}>{drinkFrom}</p>
            <p className="leading-tight" style={{ color: '#7a4a54', fontSize: 10 }}>Opens</p>
          </div>
        )}
        <div className="absolute text-center" style={{ left: pct(peak), transform: 'translateX(-50%)' }}>
          <p className="font-semibold leading-none" style={{ color: 'white', fontSize: 11 }}>{peak}</p>
          <p className="leading-tight" style={{ color: '#7a4a54', fontSize: 10 }}>Peak</p>
        </div>
        {showCloses && (
          <div className="absolute text-center" style={{ left: pct(drinkTo), transform: 'translateX(-50%)' }}>
            <p className="font-semibold leading-none" style={{ color: 'white', fontSize: 11 }}>{drinkTo}</p>
            <p className="leading-tight" style={{ color: '#7a4a54', fontSize: 10 }}>Closes</p>
          </div>
        )}
      </div>

      {/* ── Year tick marks along full axis ── */}
      <div className="relative mx-4 mb-1" style={{ height: 20 }}>
        {/* tick line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {tickYears.map(y => (
          <div
            key={y}
            className="absolute text-center"
            style={{ left: pct(y), transform: 'translateX(-50%)', top: 4 }}
          >
            <p style={{ color: '#4a2a34', fontSize: 9 }}>{y}</p>
          </div>
        ))}
      </div>

      {/* ── Status copy ── */}
      <div className="px-4 pb-4">
        <p className="text-xs" style={{ color: '#9a6070' }}>{status.label}</p>
      </div>

    </div>
  )
}
