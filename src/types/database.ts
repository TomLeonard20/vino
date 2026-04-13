// Auto-generated shape matching the Supabase schema.
// Run `supabase gen types typescript` to regenerate after schema changes.

export type WineType = 'Red' | 'White' | 'Rosé' | 'Champagne'
export type Currency = 'AUD' | 'USD' | 'GBP' | 'EUR' | 'JPY'
export type TastingMode = 'quick' | 'wset'
export type WSETQuality = 'Faulty' | 'Poor' | 'Acceptable' | 'Good' | 'Very good' | 'Outstanding'
export type WSETReadiness = 'Too young' | 'Drink now' | 'At peak' | 'Fading'

export interface Wine {
  id: string
  user_id: string
  cellar_id: string | null
  name: string
  producer: string
  region: string
  appellation: string
  vintage: number | null
  grapes: string[]
  critic_score: number | null
  db_source: string | null
  created_at: string
  flavour_profile?: FlavourProfile
  cellar_bottles?: CellarBottle[]
  tasting_notes?: TastingNote[]
}

export interface FlavourProfile {
  id: string
  wine_id: string
  body: number
  tannins: number
  acidity: number
  alcohol: number
  sweetness: number
  fruit: number
  oak: number
  finish: number
}

export interface CellarBottle {
  id: string
  user_id: string
  cellar_id: string | null
  added_by: string | null
  wine_id: string
  wine_type: WineType
  quantity: number
  purchase_price: number | null
  purchase_currency: Currency
  purchase_date: string | null
  drink_from: number | null
  peak: number | null
  drink_to: number | null
  market_price: number | null
  market_currency: Currency
  added_at: string
  wine?: Wine
}

export interface TastingNote {
  id: string
  user_id: string
  wine_id: string
  tasted_at: string
  mode: TastingMode
  score: number
  stars: number
  free_text: string
  nose_tags: string[]
  palate_tags: string[]
  appearance_clarity: string | null
  appearance_intensity: string | null
  appearance_colour: string | null
  nose_condition: string | null
  nose_intensity: string | null
  nose_development: string | null
  palate_sweetness: string | null
  palate_acidity: number | null
  palate_tannin: number | null
  palate_alcohol: number | null
  palate_body: number | null
  palate_finish: number | null
  quality: WSETQuality | null
  readiness: WSETReadiness | null
  wine?: Wine
}

// ─── Derived helpers ─────────────────────────────────────────

export type ScoreTier = 'gold' | 'silver' | 'bronze' | 'none'

export function scoreTier(score: number | null): ScoreTier {
  if (!score) return 'none'
  if (score >= 95) return 'gold'
  if (score >= 90) return 'silver'
  if (score >= 85) return 'bronze'
  return 'none'
}

export function starsForScore(score: number): number {
  if (score >= 95) return 5
  if (score >= 90) return 4
  if (score >= 85) return 3
  if (score >= 82) return 2
  return 1
}

export type DrinkingStatus = 'Too young' | 'Open soon' | 'Drink now' | 'At peak' | 'Past peak'

export function drinkingStatus(bottle: Pick<CellarBottle, 'drink_from' | 'peak' | 'drink_to'>): DrinkingStatus {
  const now = new Date().getFullYear()
  const { drink_from, peak, drink_to } = bottle
  if (!drink_from || !drink_to) return 'Drink now'
  const peakYear = peak ?? Math.round((drink_from + drink_to) / 2)
  if (now < drink_from) return (drink_from - now) <= 2 ? 'Open soon' : 'Too young'
  if (now === peakYear) return 'At peak'
  if (now > drink_to) return 'Past peak'
  return 'Drink now'
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  AUD: 'A$', USD: '$', GBP: '£', EUR: '€', JPY: '¥',
}

export const WINE_TYPE_COLOURS: Record<WineType, string> = {
  Red:       '#8b2035',
  White:     '#c9a84c',
  Rosé:      '#d4748a',
  Champagne: '#c9b86c',
}
