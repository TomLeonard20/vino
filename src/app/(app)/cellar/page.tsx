import { createClient } from '@/lib/supabase/server'
import { drinkingStatus, WINE_TYPE_COLOURS } from '@/types/database'
import type { CellarBottle, WineType } from '@/types/database'
import CellarBottleCard from '@/components/ui/CellarBottleCard'
import CellarSwitcher from './CellarSwitcher'
import Link from 'next/link'

const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

function groupLabel(type: WineType | string): string {
  if (type === 'Champagne') return 'Champagne & sparkling'
  return `${type} wines`
}

const ScanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="7" y2="12"/>
    <line x1="12" y1="12" x2="17" y2="12"/>
  </svg>
)

const PenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; cellar?: string; sort?: string }>
}) {
  const { type: filterType, cellar: cellarParam, sort } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Currency preference from user metadata (default A$)
  const currency = (user?.user_metadata?.currency as string | undefined) ?? 'A$'

  // ── Fetch all cellars the user belongs to ─────────────────────
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

  // ── Fetch bottles for active cellar ──────────────────────────
  const query = supabase
    .from('cellar_bottles')
    .select('*, wine:wines(*, flavour_profile:flavour_profiles(*))')
    .order('added_at', { ascending: false })

  if (activeCellarId) {
    query.eq('cellar_id', activeCellarId)
  }

  const { data } = await query
  const allBottles = (data ?? []) as CellarBottle[]

  const filtered = filterType && filterType !== 'All'
    ? allBottles.filter(b => b.wine_type === filterType)
    : allBottles

  // Sort: default desc (highest score first); ?sort=asc flips it
  const sortAsc = sort === 'asc'

  const grouped = WINE_TYPES.map(type => ({
    type,
    bottles: filtered
      .filter(b => b.wine_type === type)
      .sort((a, b) => {
        const diff = (a.wine?.critic_score ?? 0) - (b.wine?.critic_score ?? 0)
        return sortAsc ? diff : -diff
      }),
  })).filter(g => g.bottles.length > 0)

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon    = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length
  const estValue = allBottles.reduce((s, b) =>
    s + ((b.purchase_price ?? b.market_price ?? 0) * b.quantity), 0)

  const activeFilter = filterType ?? 'All'

  // Build a sort-toggle href, preserving other params
  function sortHref(dir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (filterType && filterType !== 'All') p.set('type', filterType)
    if (activeCellarId) p.set('cellar', activeCellarId)
    p.set('sort', dir)
    return `/cellar?${p.toString()}`
  }

  return (
    <div className="space-y-5 pb-28">

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
            <div className="text-xl font-bold"
                 style={{ color: 'highlight' in s && s.highlight ? '#8b2035' : '#3a1a20' }}>
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Drink-soon banner ── */}
      {drinkSoon > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: '#8b2035' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-white">
              {drinkSoon} {drinkSoon === 1 ? 'bottle is' : 'bottles are'} ready to drink
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#f5c6cc' }}>
              Open now before the window passes
            </p>
          </div>
        </div>
      )}

      {/* ── Type filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['All', ...WINE_TYPES] as const).map(type => {
          const count  = type === 'All'
            ? allBottles.reduce((s, b) => s + b.quantity, 0)
            : allBottles.filter(b => b.wine_type === type).reduce((s, b) => s + b.quantity, 0)
          const active = activeFilter === type
          const p = new URLSearchParams()
          if (type !== 'All') p.set('type', type)
          if (activeCellarId) p.set('cellar', activeCellarId)
          if (sort) p.set('sort', sort)
          const href = `/cellar${p.toString() ? `?${p.toString()}` : ''}`
          return (
            <a key={type} href={href}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors"
               style={{
                 background:  active ? '#8b2035' : '#ecddd4',
                 color:       active ? 'white'   : '#a07060',
                 borderColor: active ? '#8b2035' : '#d4b8aa',
               }}>
              {type !== 'All' && (
                <span className="w-2 h-2 rounded-full"
                      style={{ background: WINE_TYPE_COLOURS[type as WineType] }} />
              )}
              {type}
              <span className="text-xs opacity-70">({count})</span>
            </a>
          )
        })}
      </div>

      {/* ── Bottle groups / empty state ── */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm" style={{ color: '#c4a090' }}>
            {filterType && filterType !== 'All'
              ? `No ${groupLabel(filterType)} in your cellar yet.`
              : 'Your cellar is empty. Add your first wine!'}
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/scan"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
              <ScanIcon /> Scan label
            </Link>
            <Link href="/add"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
              <PenIcon /> Add manually
            </Link>
          </div>
        </div>
      ) : (
        <>
          {grouped.map(group => {
            const nextDir = sortAsc ? 'desc' : 'asc'
            return (
              <div key={group.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
                    {groupLabel(group.type)}
                  </h3>
                  <a href={sortHref(nextDir)}
                     className="flex items-center gap-0.5 text-xs font-medium"
                     style={{ color: '#8b2035' }}>
                    {sortAsc ? '↑' : '↓'} Score
                  </a>
                </div>
                {group.bottles.map(bottle => (
                  <CellarBottleCard key={bottle.id} bottle={bottle} currentUserId={user?.id} />
                ))}
              </div>
            )
          })}

          {/* Add bottle buttons */}
          <div className="flex gap-2 pt-1">
            <Link href="/scan"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
              <ScanIcon /> Scan label
            </Link>
            <Link href="/add"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
              <PenIcon /> Add manually
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
