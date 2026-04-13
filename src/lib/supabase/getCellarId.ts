import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

/**
 * Returns the cellar_id for the currently authenticated user.
 * Cached per-request via React cache() so it's only fetched once per render.
 */
export const getCellarId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('cellar_members')
    .select('cellar_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  return data?.cellar_id ?? null
})
