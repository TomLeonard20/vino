'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
