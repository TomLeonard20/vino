'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildFilterUrl,
  SORT_OPTIONS,
  SORT_LABELS,
  DEFAULT_SORT,
  type SortOption,
  type ActiveFilters,
} from './filterUtils'

interface Props {
  isOpen:         boolean
  onClose:        () => void
  initialSort:    SortOption
  activeFilters:  ActiveFilters
  cellarParam:    string | null
  typeParam:      string | null
}

export default function SortSheet({
  isOpen, onClose, initialSort, activeFilters, cellarParam, typeParam,
}: Props) {
  const router  = useRouter()
  const [pending, setPending] = useState<SortOption>(initialSort)

  useEffect(() => {
    if (isOpen) setPending(initialSort)
  }, [isOpen, initialSort])

  function applyAndClose() {
    router.push(buildFilterUrl({ cellar: cellarParam, type: typeParam, sort: pending }, activeFilters))
    onClose()
  }

  function resetAndClose() {
    router.push(buildFilterUrl({ cellar: cellarParam, type: typeParam, sort: DEFAULT_SORT }, activeFilters))
    onClose()
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
        style={{ background: '#f5ede6', maxHeight: '80vh' }}
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
          <h2 className="flex-1 font-semibold text-base" style={{ color: '#3a1a20' }}>Sort by</h2>
          <button onClick={onClose} className="p-1 -mr-1 rounded-lg active:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#a07060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Option list */}
        <div className="flex-1 overflow-y-auto">
          {SORT_OPTIONS.map(opt => {
            const active = pending === opt
            return (
              <button
                key={opt}
                onClick={() => setPending(opt)}
                className="w-full flex items-center justify-between px-5 py-4 text-left active:opacity-60 transition-opacity"
                style={{ borderBottom: '1px solid #e4cfc5' }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ color: active ? '#8b2035' : '#3a1a20' }}
                >
                  {SORT_LABELS[opt]}
                </span>
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

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderTop: '1px solid #e4cfc5' }}
        >
          <button
            onClick={resetAndClose}
            className="text-sm font-medium active:opacity-60"
            style={{ color: '#8b2035' }}
          >
            Reset
          </button>
          <button
            onClick={applyAndClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold active:opacity-80 transition-opacity"
            style={{ background: '#8b2035', color: 'white' }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}
