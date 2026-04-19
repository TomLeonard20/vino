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
