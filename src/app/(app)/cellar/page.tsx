import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CellarSwitcher from './CellarSwitcher'
import CellarContent  from './CellarContent'

// ── Skeleton shown while CellarContent streams in ─────────────
function CellarBodySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="py-4 px-2 rounded-xl" style={{ background: '#ecddd4' }}>
            <div className="h-6 w-10 rounded mx-auto mb-1.5" style={{ background: '#d4b8aa' }} />
            <div className="h-2.5 w-14 rounded mx-auto" style={{ background: '#d4b8aa' }} />
          </div>
        ))}
      </div>
      {/* Type tabs */}
      <div className="flex gap-2">
        {[80, 56, 64, 56, 80].map((w, i) => (
          <div key={i} className="h-8 rounded-full shrink-0"
               style={{ width: w, background: '#ecddd4' }} />
        ))}
      </div>
      {/* Bottle cards */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-20 rounded-xl" style={{ background: '#ecddd4' }} />
      ))}
    </div>
  )
}

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const str    = (k: string) => typeof params[k] === 'string' ? params[k] as string : undefined

  const cellarParam = str('cellar') ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currency = (user?.user_metadata?.currency as string | undefined) ?? 'A$'

  // ── Only fetch memberships here — fast, small query ───────────
  // CellarContent streams in the bottles (slow) separately.
  const { data: memberships } = await supabase
    .from('cellar_members')
    .select('cellar_id, role, cellar:cellars(id, name)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: true })

  const cellarIds     = (memberships ?? []).map(m => m.cellar_id)
  const activeCellarId = (cellarParam && cellarIds.includes(cellarParam))
    ? cellarParam
    : (cellarIds[0] ?? null)

  // Build cellars list from memberships — isShared defaults to false here;
  // the dot indicator only appears after shared-cellar features are used.
  const cellars = (memberships ?? []).map(m => {
    const c = m.cellar as unknown as { id: string; name: string } | null
    return { id: c?.id ?? m.cellar_id, name: c?.name ?? 'My Cellar', memberCount: 1, isShared: false }
  })

  return (
    <div className="space-y-4 pb-28">

      {/* ── Header — renders immediately after memberships ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Cellar</h2>
        {activeCellarId && (
          <CellarSwitcher cellars={cellars} activeCellarId={activeCellarId} />
        )}
      </div>

      {/* ── Bottle list streams in — 1 fast query instead of 3 sequential ── */}
      <Suspense fallback={<CellarBodySkeleton />}>
        <CellarContent
          activeCellarId={activeCellarId}
          cellarParam={cellarParam}
          userId={user!.id}
          currency={currency}
          params={params}
        />
      </Suspense>
    </div>
  )
}
