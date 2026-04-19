import { createClient } from '@/lib/supabase/server'
import { WINE_TYPE_COLOURS, drinkingStatus } from '@/types/database'
import type { CellarBottle, WineType } from '@/types/database'
import SwipeToDeleteCard from '@/components/ui/SwipeToDeleteCard'
import CellarSwitcher   from './CellarSwitcher'
import FilterSortBar    from './FilterSortBar'
import AddBottleButtons from './AddBottleButtons'
import Link from 'next/link'
import { fetchWinePhoto } from '@/lib/wine-photo'
import {
  parseFiltersFromSearchParams,
  parseSortFromSearchParams,
  activeFilterCount,
  applyFilters,
  applySort,
  computeOptions,
  buildFilterUrl,
  type ActiveFilters,
  type SortOption,
} from './filterUtils'

const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

function groupLabel(type: WineType | string): string {
  if (type === 'Champagne') return 'Champagne & sparkling'
  return `${type} wines`
}

// ── Active filter chip URL helpers ────────────────────────────

function removeArrayValue(
  filters: ActiveFilters, key: keyof ActiveFilters, value: string,
): ActiveFilters {
  return { ...filters, [key]: (filters[key] as string[]).filter(v => v !== value) }
}

function removeScore(filters: ActiveFilters): ActiveFilters {
  return { ...filters, scoreMin: null, scoreMax: null }
}

function scoreChipLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min}–${max} pts`
  if (min !== null) return `${min}+ pts`
  if (max !== null) return `Up to ${max} pts`
  return ''
}

// ── Page ──────────────────────────────────────────────────────

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const str = (k: string) => typeof params[k] === 'string' ? params[k] as string : undefined

  const filterType    = str('type')
  const cellarParam   = str('cellar') ?? null
  const activeFilters = parseFiltersFromSearchParams(params)
  const activeSort    = parseSortFromSearchParams(params)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currency = (user?.user_metadata?.currency as string | undefined) ?? 'A$'

  // ── Fetch cellars ─────────────────────────────────────────────
  const { data: memberships } = await supabase
    .from('cellar_members')
    .select('cellar_id, role, cellar:cellars(id, name)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: true })

  const cellarIds = (memberships ?? []).map(m => m.cellar_id)

  const { data: allMembers } = await supabase
    .from('cellar_members')
    .select('cellar_id, user_id')
    .in('cellar_id', cellarIds.length > 0 ? cellarIds : ['none'])

  const memberCountMap = (allMembers ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.cellar_id] = (acc[m.cellar_id] ?? 0) + 1
    return acc
  }, {})

  const cellars = (memberships ?? []).map(m => {
    const c = m.cellar as unknown as { id: string; name: string } | null
    return {
      id:          c?.id ?? m.cellar_id,
      name:        c?.name ?? 'My Cellar',
      memberCount: memberCountMap[m.cellar_id] ?? 1,
      isShared:    (memberCountMap[m.cellar_id] ?? 1) > 1,
    }
  })

  // ── Active cellar ─────────────────────────────────────────────
  const activeCellarId = (cellarParam && cellarIds.includes(cellarParam))
    ? cellarParam
    : (cellarIds[0] ?? null)

  // ── Fetch bottles ─────────────────────────────────────────────
  const query = supabase
    .from('cellar_bottles')
    .select('*, wine:wines(*, flavour_profile:flavour_profiles(*))')
    .order('added_at', { ascending: false })

  if (activeCellarId) query.eq('cellar_id', activeCellarId)

  const { data } = await query
  const allBottles = (data ?? []) as CellarBottle[]

  // ── Batch-fetch real bottle photos (2 s timeout, cached 24 h per wine) ─
  // Deduplicate by wine_id so we don't call Open Food Facts N times for N
  // bottles of the same wine.
  const uniqueWineIds = [...new Set(allBottles.map(b => b.wine_id).filter(Boolean))]
  const photoEntries  = await Promise.all(
    uniqueWineIds.map(async wineId => {
      const b    = allBottles.find(x => x.wine_id === wineId)!
      const wine = b.wine as any
      const url  = wine?.label_image_url
        ?? await fetchWinePhoto(wine?.name ?? '', wine?.producer ?? '', 2000)
      return [wineId, url] as const
    })
  )
  const winePhotoMap = Object.fromEntries(photoEntries)

  // ── Compute available filter options ──────────────────────────
  const options = computeOptions(allBottles)

  // ── Stats (always from full cellar) ──────────────────────────
  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)

  const DRINK_SOON_STATUSES = ['Drink now', 'At peak', 'Open soon']
  const drinkSoon = allBottles.filter(b =>
    DRINK_SOON_STATUSES.includes(drinkingStatus(b))
  ).length

  const estValue = allBottles.reduce((s, b) =>
    s + ((b.purchase_price ?? b.market_price ?? 0) * b.quantity), 0)

  // ── Apply wine-type tab filter ────────────────────────────────
  const typeFilter = (filterType && WINE_TYPES.includes(filterType as WineType))
    ? filterType as WineType
    : null

  const bottlesByType = typeFilter
    ? allBottles.filter(b => b.wine_type === typeFilter)
    : allBottles

  // ── Apply advanced filters ────────────────────────────────────
  const afterFilters = applyFilters(bottlesByType, activeFilters)

  // ── Group & sort ──────────────────────────────────────────────
  const grouped = WINE_TYPES.map(type => ({
    type,
    bottles: applySort(
      afterFilters.filter(b => b.wine_type === type),
      activeSort,
    ),
  })).filter(g => g.bottles.length > 0)

  const activeFilter = filterType ?? 'All'
  const filterBadge  = activeFilterCount(activeFilters)

  // ── Drink-soon banner link (use window param) ─────────────────
  const drinkSoonHref = (() => {
    const p = new URLSearchParams()
    if (activeCellarId) p.set('cellar', activeCellarId)
    p.set('window', 'Drink now,At peak,Open soon')
    return `/cellar?${p.toString()}`
  })()

  // ── Helper: build URL preserving all current filters ─────────
  function hrefWithType(type: string) {
    const p = new URLSearchParams()
    if (type !== 'All') p.set('type', type)
    if (activeCellarId) p.set('cellar', activeCellarId)
    if (activeSort !== 'score_desc') p.set('sort', activeSort)
    if (activeFilters.window.length)   p.set('window',   activeFilters.window.join(','))
    if (activeFilters.grapes.length)   p.set('grapes',   activeFilters.grapes.join(','))
    if (activeFilters.vintage.length)  p.set('vintage',  activeFilters.vintage.join(','))
    if (activeFilters.producer.length) p.set('producer', activeFilters.producer.join(','))
    if (activeFilters.country.length)  p.set('country',  activeFilters.country.join(','))
    if (activeFilters.region.length)   p.set('region',   activeFilters.region.join(','))
    if (activeFilters.scoreMin !== null) p.set('score_min', String(activeFilters.scoreMin))
    if (activeFilters.scoreMax !== null) p.set('score_max', String(activeFilters.scoreMax))
    const qs = p.toString()
    return `/cellar${qs ? `?${qs}` : ''}`
  }

  // ── Chip removal URLs ─────────────────────────────────────────
  type ChipItem = { label: string; href: string }

  const chips: ChipItem[] = []
  const base = { cellar: activeCellarId, type: filterType, sort: activeSort }

  for (const v of activeFilters.window) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'window', v)) })
  }
  for (const v of activeFilters.grapes) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'grapes', v)) })
  }
  for (const v of activeFilters.vintage) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'vintage', v)) })
  }
  for (const v of activeFilters.producer) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'producer', v)) })
  }
  for (const v of activeFilters.country) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'country', v)) })
  }
  for (const v of activeFilters.region) {
    chips.push({ label: v, href: buildFilterUrl(base, removeArrayValue(activeFilters, 'region', v)) })
  }
  if (activeFilters.scoreMin !== null || activeFilters.scoreMax !== null) {
    chips.push({
      label: scoreChipLabel(activeFilters.scoreMin, activeFilters.scoreMax),
      href:  buildFilterUrl(base, removeScore(activeFilters)),
    })
  }

  return (
    <div className="space-y-4 pb-28">

      {/* ── Cellar switcher header ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Cellar</h2>
        {activeCellarId && (
          <CellarSwitcher cellars={cellars} activeCellarId={activeCellarId} />
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Bottles',    value: totalBottles },
          { label: 'Drink soon', value: drinkSoon,    highlight: drinkSoon > 0 },
          { label: 'Est. value', value: estValue > 0 ? `${currency}${Math.round(estValue)}` : '—' },
        ].map(s => (
          <div key={s.label} className="text-center py-4 px-2 rounded-xl" style={{ background: '#ecddd4' }}>
            <div
              className="text-xl font-bold"
              style={{ color: 'highlight' in s && s.highlight ? '#8b2035' : '#3a1a20' }}
            >
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Drink-soon banner ── */}
      {drinkSoon > 0 && (
        <Link
          href={drinkSoonHref}
          className="rounded-xl px-4 py-3 flex items-center gap-3 active:opacity-80 transition-opacity"
          style={{ background: '#8b2035' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              {drinkSoon} {drinkSoon === 1 ? 'bottle is' : 'bottles are'} ready to drink
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#f5c6cc' }}>Tap to see them →</p>
          </div>
        </Link>
      )}

      {/* ── Type filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['All', ...WINE_TYPES] as const).map(type => {
          const count = type === 'All'
            ? allBottles.reduce((s, b) => s + b.quantity, 0)
            : allBottles.filter(b => b.wine_type === type).reduce((s, b) => s + b.quantity, 0)
          const active = activeFilter === type
          return (
            <Link
              key={type}
              href={hrefWithType(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors"
              style={{
                background:  active ? '#8b2035' : '#ecddd4',
                color:       active ? 'white'   : '#a07060',
                borderColor: active ? '#8b2035' : '#d4b8aa',
              }}
            >
              {type !== 'All' && (
                <span className="w-2 h-2 rounded-full"
                      style={{ background: WINE_TYPE_COLOURS[type as WineType] }} />
              )}
              {type}
              <span className="text-xs opacity-70">({count})</span>
            </Link>
          )
        })}
      </div>

      {/* ── Filter & Sort buttons row ── */}
      <FilterSortBar
        allBottles={allBottles}
        options={options}
        activeFilters={activeFilters}
        activeSort={activeSort}
        cellarParam={activeCellarId}
        typeParam={filterType ?? null}
        typeFilter={typeFilter}
      />

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(chip => (
            <Link
              key={chip.href + chip.label}
              href={chip.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{ background: '#ecddd4', color: '#3a1a20', borderColor: '#d4b8aa' }}
            >
              {chip.label}
              <span style={{ color: '#8b2035', fontSize: 11 }}>✕</span>
            </Link>
          ))}
          {chips.length > 1 && (
            <Link
              href={buildFilterUrl(base, { window: [], grapes: [], vintage: [], producer: [], country: [], region: [], scoreMin: null, scoreMax: null })}
              className="flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ color: '#8b2035' }}
            >
              Clear all
            </Link>
          )}
        </div>
      )}

      {/* ── Bottle groups / empty state ── */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm" style={{ color: '#c4a090' }}>
            {filterBadge > 0 || typeFilter
              ? 'No bottles match your current filters.'
              : 'Your cellar is empty. Add your first wine!'}
          </p>
          {filterBadge > 0 && (
            <Link
              href={buildFilterUrl(base, { window: [], grapes: [], vintage: [], producer: [], country: [], region: [], scoreMin: null, scoreMax: null })}
              className="inline-block text-sm font-medium"
              style={{ color: '#8b2035' }}
            >
              Clear all filters
            </Link>
          )}
          {!filterBadge && <AddBottleButtons />}
        </div>
      ) : (
        <>
          {grouped.map(group => (
            <div key={group.type} className="space-y-2">
              <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
                {groupLabel(group.type)}
              </h3>
              {group.bottles.map(bottle => (
                <SwipeToDeleteCard key={bottle.id} bottle={bottle} currentUserId={user?.id} photoUrl={winePhotoMap[bottle.wine_id] ?? null} />
              ))}
            </div>
          ))}

          <AddBottleButtons />
        </>
      )}
    </div>
  )
}
