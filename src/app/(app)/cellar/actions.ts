'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WineType } from '@/types/database'

export interface WineUpdates {
  name?:         string
  producer?:     string
  region?:       string
  vintage?:      number | null
  grapes?:       string[]
  critic_score?: number | null
}

export async function updateWine(
  wineId: string,
  updates: WineUpdates,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('wines')
    .update(updates)
    .eq('id', wineId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/cellar')
  return {}
}

export async function deleteBottle(bottleId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('cellar_bottles')
    .delete()
    .eq('id', bottleId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/cellar')
}

export interface BottleUpdates {
  quantity?:       number
  wine_type?:      WineType
  purchase_price?: number | null
  purchase_date?:  string | null
  drink_from?:     number | null
  peak?:           number | null
  drink_to?:       number | null
}

export async function updateBottle(
  bottleId: string,
  updates: BottleUpdates,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('cellar_bottles')
    .update(updates)
    .eq('id', bottleId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/cellar/${bottleId}`)
  revalidatePath('/cellar')
  return {}
}
