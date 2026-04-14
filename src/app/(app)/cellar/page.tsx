import { createClient } from '@/lib/supabase/server'
import { drinkingStatus, WINE_TYPE_COLOURS } from '@/types/database'
import type { CellarBottle, WineType } from '@/types/database'
import CellarBottleCard from '@/components/ui/CellarBottleCard'
import CellarSwitcher from './CellarSwitcher'
import Link from 'next/link'

const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; cellar?: string }>
}) {
  const { type: filterType, cellar: cellarParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch all cellars the user belongs to ─────────────────────
  const { data: memberships } = await supabase
    .from('cellar_members')
    .select('cellar_id, role, cellar:cellars(id, name)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: true })

  // Count members per cellar
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

  const grouped = WINE_TYPES.map(type => ({
    type,
    bottles: filtered
      .filter(b => b.wine_type === type)
      .sort((a, b) => (b.wine?.critic_score ?? 0) - (a.wine?.critic_score ?? 0)),
  })).filter(g => g.bottles.length > 0)

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon    = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length
  const estValue = allBottles.reduce((s, b) =>
    s + ((b.purchase_price ?? b.market_price ?? 0) * b.quantity), 0)

  const activeFilter = filterType ?? 'All'

  return (
    <div className="space-y-5 pb-4">

      {/* ── Cellar switcher header ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Cellar</h2>
        {activeCellarId && (
          <CellarSwitcher cellars={cellars} activeCellarId={activeCellarId} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Bottles',    value: totalBottles },
          { label: 'Drink soon', value: drinkSoon, highlight: drinkSoon > 0 },
          { label: 'Est. value', value: estValue > 0 ? `A$${Math.round(estValue)}` : '—' },
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

      {/* Type filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['All', ...WINE_TYPES].map(type => {
          const count  = type === 'All'
            ? allBottles.length
            : allBottles.filter(b => b.wine_type === type).length
          const active = activeFilter === type
          const href   = type === 'All'
            ? `/cellar${activeCellarId ? `?cellar=${activeCellarId}` : ''}`
            : `/cellar?type=${encodeURIComponent(type)}${activeCellarId ? `&cellar=${activeCellarId}` : ''}`
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
              {count > 0 && <span className="text-xs opacity-70">({count})</span>}
            </a>
          )
        })}
      </div>

      {/* Bottle groups */}
      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#c4a090' }}>No bottles yet. Add your first wine!</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{group.type} wines</h3>
              <span className="text-xs" style={{ color: '#c4a090' }}>↓ Score</span>
            </div>
            {group.bottles.map(bottle => (
              <CellarBottleCard key={bottle.id} bottle={bottle} currentUserId={user?.id} />
            ))}
          </div>
        ))
      )}

      {/* Add bottle */}
      <div className="flex gap-2">
        <Link href="/scan"
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-center border"
              style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
          📷 Scan label
        </Link>
        <Link href="/add"
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-center border"
              style={{ borderColor: '#8b2035', color: '#8b2035', background: 'transparent' }}>
          ✏️ Add manually
        </Link>
      </div>
    </div>
  )
}
