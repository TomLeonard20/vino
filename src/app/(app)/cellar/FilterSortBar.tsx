'use client'

import { useState } from 'react'
import type { CellarBottle, WineType } from '@/types/database'
import FilterSheet from './FilterSheet'
import SortSheet   from './SortSheet'
import {
  activeFilterCount,
  SORT_LABELS,
  DEFAULT_SORT,
  type ActiveFilters,
  type AvailableOptions,
  type SortOption,
} from './filterUtils'

interface Props {
  allBottles:     CellarBottle[]
  options:        AvailableOptions
  activeFilters:  ActiveFilters
  activeSort:     SortOption
  cellarParam:    string | null
  typeParam:      string | null
  typeFilter:     WineType | null
}

export default function FilterSortBar({
  allBottles, options, activeFilters, activeSort,
  cellarParam, typeParam, typeFilter,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen,   setSortOpen]   = useState(false)

  const filterBadge = activeFilterCount(activeFilters)
  const sortActive  = activeSort !== DEFAULT_SORT

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors active:opacity-70"
          style={{
            borderColor: '#8b2035',
            color:       '#8b2035',
            background:  filterBadge > 0 ? 'rgba(139,32,53,0.06)' : 'transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6"  x2="20" y2="6"/>
            <line x1="7" y1="12" x2="17" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filter{filterBadge > 0 && (
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-bold leading-none"
              style={{ background: '#8b2035', color: 'white', minWidth: 18, height: 18, padding: '0 5px' }}
            >
              {filterBadge}
            </span>
          )}
        </button>

        {/* Sort button */}
        <button
          onClick={() => setSortOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors active:opacity-70"
          style={{
            borderColor: '#8b2035',
            color:       '#8b2035',
            background:  sortActive ? 'rgba(139,32,53,0.06)' : 'transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M6 12h12M9 18h6"/>
          </svg>
          Sort
          {sortActive && <span className="opacity-60 text-xs">·</span>}
          {sortActive && (
            <span className="text-xs opacity-70 max-w-24 truncate">
              {SORT_LABELS[activeSort].split('—')[0].trim()}
            </span>
          )}
        </button>
      </div>

      <FilterSheet
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        allBottles={allBottles}
        options={options}
        initialFilters={activeFilters}
        activeSort={activeSort}
        cellarParam={cellarParam}
        typeParam={typeParam}
        typeFilter={typeFilter}
      />

      <SortSheet
        isOpen={sortOpen}
        onClose={() => setSortOpen(false)}
        initialSort={activeSort}
        activeFilters={activeFilters}
        cellarParam={cellarParam}
        typeParam={typeParam}
      />
    </>
  )
}
