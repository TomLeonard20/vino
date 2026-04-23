'use client'

import { useState, useEffect } from 'react'

interface Props {
  label:     string
  color:     string
  drinkFrom: number
  peak:      number
  drinkTo:   number
}

function explain(label: string, drinkFrom: number, peak: number, drinkTo: number): string {
  if (label.startsWith('Opens'))
    return `Not ready yet — best to cellar until around ${drinkFrom}. It will peak around ${peak} and be drinkable through ${drinkTo}.`
  if (label === 'Peaking now')
    return `At its absolute best right now — the ideal time to open it. Drinkable through ${drinkTo}.`
  if (label.startsWith('Peaks'))
    return `In its drinking window and still improving. Will be at its very best around ${peak}. Enjoy any time through ${drinkTo}.`
  if (label.startsWith('Peaked'))
    return `Passed its peak (${peak}) but still enjoyable. Drink soon — window closes around ${drinkTo}.`
  // past window
  return `Has gone beyond its drinking window, which closed around ${drinkTo}. May still be drinkable but past its prime.`
}

export default function DrinkingWindowBadge({ label, color, drinkFrom, peak, drinkTo }: Props) {
  const [open, setOpen] = useState(false)

  // Auto-dismiss after 4 s
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setOpen(false), 4000)
    return () => clearTimeout(t)
  }, [open])

  return (
    <>
      {/* ── Label + ⓘ trigger ── */}
      <span
        role="button"
        tabIndex={0}
        className="inline-flex items-center gap-1 cursor-pointer select-none"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), e.stopPropagation(), setOpen(o => !o))}
      >
        <span className="text-xs font-medium whitespace-nowrap" style={{ color }}>
          {label}
        </span>
        {/* ⓘ icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             style={{ opacity: 0.5, flexShrink: 0 }} aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="8.5"/>
          <path d="M12 12v4"/>
        </svg>
      </span>

      {/* ── Fixed bottom banner — escapes overflow:hidden on the card ── */}
      {open && (
        <div
          className="fixed inset-x-4 z-50 rounded-2xl px-4 py-4 shadow-2xl"
          style={{
            bottom: 96,           // sits above the tab bar
            background: '#1c0a10',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onClick={() => setOpen(false)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                 style={{ background: 'rgba(139,32,53,0.4)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="#f0c0b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 12v4"/><line x1="12" y1="8" x2="12" y2="8.5"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1" style={{ color: '#f0c0b0' }}>
                {label}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#c4a090' }}>
                {explain(label, drinkFrom, peak, drinkTo)}
              </p>
            </div>
            <span className="text-xs mt-0.5 shrink-0" style={{ color: '#7a4a54' }}>Tap to close</span>
          </div>
        </div>
      )}
    </>
  )
}
