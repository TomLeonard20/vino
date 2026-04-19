import type { CellarBottle } from '@/types/database'
import { drinkingStatus } from '@/types/database'

// ── Sort ─────────────────────────────────────────────────────

export type SortOption =
  | 'score_desc'
  | 'score_asc'
  | 'vintage_desc'
  | 'vintage_asc'
  | 'price_desc'
  | 'window_asc'
  | 'added_desc'

export const SORT_LABELS: Record<SortOption, string> = {
  score_desc:   'Critic score — high to low',
  score_asc:    'Critic score — low to high',
  vintage_desc: 'Vintage — newest first',
  vintage_asc:  'Vintage — oldest first',
  price_desc:   'Purchase price — high to low',
  window_asc:   'Drinking window — soonest first',
  added_desc:   'Recently added',
}

export const SORT_OPTIONS = Object.keys(SORT_LABELS) as SortOption[]
export const DEFAULT_SORT: SortOption = 'score_desc'

// ── Filters ───────────────────────────────────────────────────

export interface ActiveFilters {
  window:   string[]
  grapes:   string[]
  vintage:  string[]
  producer: string[]
  country:  string[]
  region:   string[]
  scoreMin: number | null
  scoreMax: number | null
}

export const EMPTY_FILTERS: ActiveFilters = {
  window: [], grapes: [], vintage: [], producer: [],
  country: [], region: [], scoreMin: null, scoreMax: null,
}

export function parseFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): ActiveFilters {
  const str = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined
  const arr = (key: string) => {
    const v = str(key)
    return v ? v.split(',').filter(Boolean) : []
  }
  const num = (key: string) => {
    const v = str(key)
    return v !== undefined && v !== '' ? Number(v) : null
  }
  return {
    window:   arr('window'),
    grapes:   arr('grapes'),
    vintage:  arr('vintage'),
    producer: arr('producer'),
    country:  arr('country'),
    region:   arr('region'),
    scoreMin: num('score_min'),
    scoreMax: num('score_max'),
  }
}

export function parseSortFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): SortOption {
  const v = typeof params['sort'] === 'string' ? params['sort'] : undefined
  if (v && v in SORT_LABELS) return v as SortOption
  // backward compat
  if (v === 'asc') return 'score_asc'
  return DEFAULT_SORT
}

export function activeFilterCount(f: ActiveFilters): number {
  return [
    f.window.length > 0,
    f.grapes.length > 0,
    f.vintage.length > 0,
    f.producer.length > 0,
    f.country.length > 0,
    f.region.length > 0,
    f.scoreMin !== null || f.scoreMax !== null,
  ].filter(Boolean).length
}

// ── Apply filters ─────────────────────────────────────────────

export function applyFilters(bottles: CellarBottle[], f: ActiveFilters): CellarBottle[] {
  return bottles.filter(b => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wine = b.wine as any

    if (f.window.length > 0) {
      if (!f.window.includes(drinkingStatus(b))) return false
    }
    if (f.grapes.length > 0) {
      const grapes: string[] = wine?.grapes ?? []
      if (!f.grapes.some(g => grapes.includes(g))) return false
    }
    if (f.vintage.length > 0) {
      const v = wine?.vintage != null ? String(wine.vintage) : null
      if (!v || !f.vintage.includes(v)) return false
    }
    if (f.producer.length > 0) {
      if (!f.producer.includes(wine?.producer ?? '')) return false
    }
    if (f.country.length > 0) {
      if (!f.country.includes(wine?.country ?? '')) return false
    }
    if (f.region.length > 0) {
      if (!f.region.includes(wine?.region ?? '')) return false
    }
    if (f.scoreMin !== null || f.scoreMax !== null) {
      const score: number | null = wine?.critic_score ?? null
      if (score === null) return false
      if (f.scoreMin !== null && score < f.scoreMin) return false
      if (f.scoreMax !== null && score > f.scoreMax) return false
    }
    return true
  })
}

// ── Apply sort ────────────────────────────────────────────────

export function applySort(bottles: CellarBottle[], sort: SortOption): CellarBottle[] {
  const NOW = new Date().getFullYear()
  return [...bottles].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wa = a.wine as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wb = b.wine as any
    switch (sort) {
      case 'score_asc':    return (wa?.critic_score ?? 0) - (wb?.critic_score ?? 0)
      case 'score_desc':   return (wb?.critic_score ?? 0) - (wa?.critic_score ?? 0)
      case 'vintage_desc': return (wb?.vintage ?? 0) - (wa?.vintage ?? 0)
      case 'vintage_asc':  return (wa?.vintage ?? 0) - (wb?.vintage ?? 0)
      case 'price_desc':   return (b.purchase_price ?? 0) - (a.purchase_price ?? 0)
      case 'window_asc': {
        const dfA = a.drink_from ?? (wa?.vintage ? wa.vintage + 2 : NOW + 2)
        const dfB = b.drink_from ?? (wb?.vintage ? wb.vintage + 2 : NOW + 2)
        return dfA - dfB
      }
      case 'added_desc':
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
      default: return 0
    }
  })
}

// ── Available options (for filter sub-lists) ─────────────────

export interface AvailableOptions {
  grapes:    string[]
  vintages:  string[]
  producers: string[]
  countries: string[]
  regions:   string[]
}

export function computeOptions(bottles: CellarBottle[]): AvailableOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wines = bottles.map(b => b.wine as any).filter(Boolean)

  const grapeSet = new Set<string>()
  wines.forEach((w: any) => (w.grapes ?? []).forEach((g: string) => g && grapeSet.add(g)))

  function unique<T>(vals: (T | null | undefined)[]): T[] {
    return [...new Set(vals.filter((v): v is T => v != null && String(v).trim() !== ''))]
  }

  return {
    grapes:    [...grapeSet].sort(),
    vintages:  unique(wines.map((w: any) => w.vintage != null ? String(w.vintage) : null))
                 .sort().reverse(),
    producers: unique<string>(wines.map((w: any) => w.producer)).sort(),
    countries: unique<string>(wines.map((w: any) => w.country)).sort(),
    regions:   unique<string>(wines.map((w: any) => w.region)).sort(),
  }
}

// ── URL builder ───────────────────────────────────────────────

export function buildFilterUrl(
  base: { cellar?: string | null; type?: string | null; sort?: SortOption | null },
  filters: ActiveFilters,
): string {
  const p = new URLSearchParams()
  if (base.cellar)                         p.set('cellar', base.cellar)
  if (base.type && base.type !== 'All')    p.set('type', base.type)
  if (base.sort && base.sort !== DEFAULT_SORT) p.set('sort', base.sort)
  if (filters.window.length)               p.set('window', filters.window.join(','))
  if (filters.grapes.length)               p.set('grapes', filters.grapes.join(','))
  if (filters.vintage.length)              p.set('vintage', filters.vintage.join(','))
  if (filters.producer.length)             p.set('producer', filters.producer.join(','))
  if (filters.country.length)              p.set('country', filters.country.join(','))
  if (filters.region.length)               p.set('region', filters.region.join(','))
  if (filters.scoreMin !== null)           p.set('score_min', String(filters.scoreMin))
  if (filters.scoreMax !== null)           p.set('score_max', String(filters.scoreMax))
  const qs = p.toString()
  return `/cellar${qs ? `?${qs}` : ''}`
}
