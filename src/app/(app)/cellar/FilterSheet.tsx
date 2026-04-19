'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CellarBottle, WineType } from '@/types/database'
import {
  applyFilters,
  buildFilterUrl,
  type ActiveFilters,
  type AvailableOptions,
  type SortOption,
  EMPTY_FILTERS,
} from './filterUtils'

// ── Constants ─────────────────────────────────────────────────

const WINDOW_OPTIONS = ['Too young', 'Open soon', 'Drink now', 'At peak', 'Past peak']

type CategoryKey = 'window' | 'grapes' | 'vintage' | 'producer' | 'country' | 'region' | 'score'

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'window',   label: 'Drinking window' },
  { key: 'grapes',   label: 'Grape variety'   },
  { key: 'vintage',  label: 'Vintage'          },
  { key: 'producer', label: 'Producer'         },
  { key: 'country',  label: 'Country'          },
  { key: 'region',   label: 'Region'           },
  { key: 'score',    label: 'Score range'      },
]

// ── Props ─────────────────────────────────────────────────────

interface Props {
  isOpen:         boolean
  onClose:        () => void
  allBottles:     CellarBottle[]
  options:        AvailableOptions
  initialFilters: ActiveFilters
  activeSort:     SortOption
  cellarParam:    string | null
  typeParam:      string | null
  typeFilter:     WineType | null   // active wine-type tab, for live count
}

// ── Component ─────────────────────────────────────────────────

export default function FilterSheet({
  isOpen, onClose, allBottles, options, initialFilters,
  activeSort, cellarParam, typeParam, typeFilter,
}: Props) {
  const router = useRouter()
  const [view,    setView]    = useState<'main' | CategoryKey>('main')
  const [pending, setPending] = useState<ActiveFilters>(initialFilters)

  // Reset local state each time the sheet opens
  useEffect(() => {
    if (isOpen) {
      setPending(initialFilters)
      setView('main')
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live count: filter allBottles by wine type tab + pending filters, sum quantities
  const scopedBottles = typeFilter
    ? allBottles.filter(b => b.wine_type === typeFilter)
    : allBottles
  const liveCount = applyFilters(scopedBottles, pending)
    .reduce((s, b) => s + b.quantity, 0)

  // Toggle a string value in an array filter
  function toggle(key: 'window' | 'grapes' | 'vintage' | 'producer' | 'country' | 'region', value: string) {
    setPending(prev => {
      const arr = prev[key] as string[]
      const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      return { ...prev, [key]: next }
    })
  }

  function applyAndClose() {
    router.push(buildFilterUrl({ cellar: cellarParam, type: typeParam, sort: activeSort }, pending))
    onClose()
  }

  function clearAll() {
    setPending(EMPTY_FILTERS)
  }

  // Category pending counts
  function catCount(key: CategoryKey): number {
    if (key === 'score') return pending.scoreMin !== null || pending.scoreMax !== null ? 1 : 0
    return (pending[key] as string[]).length
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-in"
        style={{ background: 'rgba(58,26,32,0.45)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col sheet-slide-up"
        style={{ background: '#f5ede6', maxHeight: '88vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#d4b8aa' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid #e4cfc5' }}
        >
          {view !== 'main' && (
            <button
              onClick={() => setView('main')}
              className="mr-3 p-1 -ml-1 rounded-lg active:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="#3a1a20" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <h2 className="flex-1 font-semibold text-base" style={{ color: '#3a1a20' }}>
            {view === 'main' ? 'Filter' : CATEGORIES.find(c => c.key === view)?.label}
          </h2>
          <button onClick={onClose} className="p-1 -mr-1 rounded-lg active:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#a07060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Main category list ── */}
          {view === 'main' && (
            <div>
              {CATEGORIES.map(cat => {
                const count = catCount(cat.key)
                return (
                  <button
                    key={cat.key}
                    onClick={() => setView(cat.key)}
                    className="w-full flex items-center px-5 py-4 text-left active:opacity-60 transition-opacity"
                    style={{ borderBottom: '1px solid #e4cfc5' }}
                  >
                    <span className="flex-1 text-sm font-medium" style={{ color: '#3a1a20' }}>
                      {cat.label}
                    </span>
                    {count > 0 && (
                      <span
                        className="mr-2 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: '#8b2035', color: 'white', minWidth: 20, textAlign: 'center' }}
                      >
                        {count}
                      </span>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="#a07060" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Drinking window chips ── */}
          {view === 'window' && (
            <div className="p-5 flex flex-wrap gap-2.5">
              {WINDOW_OPTIONS.map(opt => {
                const active = pending.window.includes(opt)
                return (
                  <button
                    key={opt}
                    onClick={() => toggle('window', opt)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-colors"
                    style={{
                      background:  active ? '#8b2035' : 'transparent',
                      color:       active ? 'white'   : '#3a1a20',
                      borderColor: active ? '#8b2035' : '#d4b8aa',
                    }}
                  >
                    {opt}
                    {active && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                           stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Multi-select option lists ── */}
          {(view === 'grapes' || view === 'vintage' || view === 'producer' || view === 'country' || view === 'region') && (
            <OptionList
              options={
                view === 'grapes'   ? options.grapes    :
                view === 'vintage'  ? options.vintages  :
                view === 'producer' ? options.producers :
                view === 'country'  ? options.countries :
                                      options.regions
              }
              selected={pending[view]}
              onToggle={v => toggle(view, v)}
            />
          )}

          {/* ── Score range ── */}
          {view === 'score' && (
            <ScoreRangePanel
              scoreMin={pending.scoreMin}
              scoreMax={pending.scoreMax}
              onChange={(min, max) => setPending(prev => ({ ...prev, scoreMin: min, scoreMax: max }))}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderTop: '1px solid #e4cfc5' }}
        >
          <button
            onClick={clearAll}
            className="text-sm font-medium active:opacity-60"
            style={{ color: '#8b2035' }}
          >
            Clear all
          </button>
          <button
            onClick={applyAndClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold active:opacity-80 transition-opacity"
            style={{ background: '#8b2035', color: 'white' }}
          >
            See {liveCount} {liveCount === 1 ? 'bottle' : 'bottles'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Option list (multi-select with checkmarks) ────────────────

function OptionList({
  options, selected, onToggle,
}: {
  options:  string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  if (options.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm" style={{ color: '#a07060' }}>
        No options available
      </div>
    )
  }
  return (
    <div>
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="w-full flex items-center px-5 py-3.5 text-left active:opacity-60 transition-opacity"
            style={{ borderBottom: '1px solid #e4cfc5' }}
          >
            <span className="flex-1 text-sm" style={{ color: '#3a1a20' }}>{opt}</span>
            {active && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="#8b2035" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Score range panel ─────────────────────────────────────────

function ScoreRangePanel({
  scoreMin, scoreMax, onChange,
}: {
  scoreMin: number | null
  scoreMax: number | null
  onChange: (min: number | null, max: number | null) => void
}) {
  const MIN = 80
  const MAX = 100

  const lo = scoreMin ?? MIN
  const hi = scoreMax ?? MAX

  const label =
    lo === MIN && hi === MAX ? 'All scores' :
    lo === MIN               ? `Up to ${hi} pts` :
    hi === MAX               ? `${lo}+ pts` :
                               `${lo}–${hi} pts`

  function handleMin(v: number) {
    const clamped = Math.min(v, hi - 1)
    onChange(clamped === MIN ? null : clamped, scoreMax)
  }
  function handleMax(v: number) {
    const clamped = Math.max(v, lo + 1)
    onChange(scoreMin, clamped === MAX ? null : clamped)
  }

  const leftPct  = ((lo - MIN) / (MAX - MIN)) * 100
  const rightPct = ((hi - MIN) / (MAX - MIN)) * 100

  return (
    <div className="px-6 py-8 space-y-7">
      <div className="text-center">
        <span className="text-3xl font-bold" style={{ color: '#3a1a20' }}>{label}</span>
      </div>

      {/* Dual range slider */}
      <div className="relative h-6 flex items-center select-none">
        {/* Track background */}
        <div
          className="absolute left-0 right-0 h-1.5 rounded-full"
          style={{ background: '#d4b8aa' }}
        />
        {/* Track fill */}
        <div
          className="absolute h-1.5 rounded-full pointer-events-none"
          style={{
            left:       `${leftPct}%`,
            right:      `${100 - rightPct}%`,
            background: '#8b2035',
          }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={MIN} max={MAX} step={1}
          value={lo}
          onChange={e => handleMin(Number(e.target.value))}
          className="cellar-range-thumb absolute w-full"
          style={{ zIndex: lo > MAX - 5 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={MIN} max={MAX} step={1}
          value={hi}
          onChange={e => handleMax(Number(e.target.value))}
          className="cellar-range-thumb absolute w-full"
          style={{ zIndex: 4 }}
        />
      </div>

      <div className="flex justify-between text-xs font-medium" style={{ color: '#a07060' }}>
        <span>80 pts</span>
        <span>100 pts</span>
      </div>
    </div>
  )
}
