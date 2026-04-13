import { createClient } from '@/lib/supabase/server'
import { drinkingStatus } from '@/types/database'
import type { CellarBottle, TastingNote } from '@/types/database'
import HomeClient from './HomeClient'

/** Pull first name from display_name metadata or email prefix */
function firstName(user: { email?: string; user_metadata?: Record<string, string> } | null): string {
  if (!user) return 'there'
  const full = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
  if (full) return full.split(' ')[0]
  const prefix = user.email?.split('@')[0] ?? ''
  return prefix.replace(/\d+/g, '').replace(/^./, c => c.toUpperCase()) || 'there'
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: bottles }, { data: notes }] = await Promise.all([
    supabase.from('cellar_bottles').select('*, wine:wines(*)'),
    supabase.from('tasting_notes').select('*, wine:wines(*)').order('tasted_at', { ascending: false }).limit(2),
  ])

  const allBottles  = (bottles ?? []) as CellarBottle[]
  const recentNotes = (notes   ?? []) as TastingNote[]

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon    = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length

  return (
    <HomeClient
      name={firstName(user as Parameters<typeof firstName>[0])}
      totalBottles={totalBottles}
      drinkSoon={drinkSoon}
      noteCount={recentNotes.length}
      allBottles={allBottles}
      recentNotes={recentNotes}
    />
  )
}
