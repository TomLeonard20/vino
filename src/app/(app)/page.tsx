import { createClient } from '@/lib/supabase/server'
import { drinkingStatus } from '@/types/database'
import type { CellarBottle, TastingNote } from '@/types/database'
import HomeClient from './HomeClient'

/** Pull first name from display_name metadata, or null if not set */
function firstName(user: { user_metadata?: Record<string, string> } | null): string | null {
  if (!user) return null
  const full = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
  return full ? full.split(' ')[0] : null
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const NOW = new Date().getFullYear()

  const [{ data: bottles }, { data: notes }, { data: rawVintageScores }] = await Promise.all([
    supabase.from('cellar_bottles').select('*, wine:wines(*)'),
    supabase.from('tasting_notes').select('*, wine:wines(*)').order('tasted_at', { ascending: false }).limit(2),
    // Sample up to 8 000 rows across the chart's vintage range — enough for
    // statistically reliable per-year averages without over-fetching.
    supabase
      .from('wine_catalogue')
      .select('vintage, points')
      .gte('vintage', 2010)
      .lte('vintage', NOW)
      .not('points', 'is', null)
      .not('vintage', 'is', null)
      .limit(8000),
  ])

  // Aggregate average critic score per vintage year
  const yearMap: Record<number, { sum: number; count: number }> = {}
  for (const row of rawVintageScores ?? []) {
    const y = row.vintage as number
    const p = row.points  as number
    if (!yearMap[y]) yearMap[y] = { sum: 0, count: 0 }
    yearMap[y].sum   += p
    yearMap[y].count += 1
  }
  const vintageQuality: Record<number, number> = {}
  for (const [y, { sum, count }] of Object.entries(yearMap)) {
    vintageQuality[parseInt(y)] = Math.round(sum / count)
  }

  const allBottles  = (bottles ?? []) as CellarBottle[]
  const recentNotes = (notes   ?? []) as TastingNote[]

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon    = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length

  return (
    <HomeClient
      name={firstName(user as Parameters<typeof firstName>[0] | null)}
      totalBottles={totalBottles}
      drinkSoon={drinkSoon}
      noteCount={recentNotes.length}
      allBottles={allBottles}
      recentNotes={recentNotes}
      vintageQuality={vintageQuality}
    />
  )
}
