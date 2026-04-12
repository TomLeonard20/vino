// Reusable Supabase query helpers (server-side)
import { createClient } from '@/lib/supabase/server'
import type { CellarBottle, TastingNote, Wine } from '@/types/database'

export async function getCellarBottles(): Promise<CellarBottle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cellar_bottles')
    .select(`
      *,
      wine:wines (
        *,
        flavour_profile:flavour_profiles (*)
      )
    `)
    .order('added_at', { ascending: false })

  if (error) throw error
  return data as CellarBottle[]
}

export async function getTastingNotes(): Promise<TastingNote[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasting_notes')
    .select(`*, wine:wines (*)`)
    .order('score', { ascending: false })

  if (error) throw error
  return data as TastingNote[]
}

export async function getBottleById(id: string): Promise<CellarBottle | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cellar_bottles')
    .select(`
      *,
      wine:wines (
        *,
        flavour_profile:flavour_profiles (*),
        tasting_notes (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as CellarBottle
}

export async function getCellarStats() {
  const bottles = await getCellarBottles()
  const notes = await getTastingNotes()

  const totalBottles = bottles.reduce((sum, b) => sum + b.quantity, 0)
  const drinkSoon = bottles.filter(b => {
    const { drinkingStatus } = require('@/types/database')
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length

  return { totalBottles, drinkSoon, noteCount: notes.length }
}
