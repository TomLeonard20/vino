import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 1 USD → AUD conversion rate (update periodically or wire up a free FX API)
// Current approximate rate as of mid-2025
const USD_TO_AUD = 1.58

export interface CatalogueWine {
  id:          number
  title:       string
  winery:      string
  variety:     string
  country:     string
  province:    string
  region:      string
  vintage:     number | null
  points:      number | null
  price_usd:   number | null
  price_aud:   number | null   // derived
  description: string
}

export async function GET(req: NextRequest) {
  const q       = req.nextUrl.searchParams.get('q')?.trim()
  const variety = req.nextUrl.searchParams.get('variety')?.trim()
  const country = req.nextUrl.searchParams.get('country')?.trim()
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '10')
  const limit   = Math.min(limitParam, 50)

  if (!q && !variety && !country) {
    return NextResponse.json({ error: 'Provide q, variety, or country' }, { status: 400 })
  }

  const supabase = await createClient()
  let data: CatalogueWine[] | null = null

  // ── Full-text search on q ────────────────────────────────────
  if (q) {
    // Convert the query into a tsquery (AND of all words)
    const tsQuery = q
      .split(/\s+/)
      .filter(w => w.length > 1)
      .map(w => `${w}:*`)   // prefix matching
      .join(' & ')

    const { data: fts } = await supabase
      .from('wine_catalogue')
      .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
      .textSearch('search_vector', tsQuery, { type: 'websearch' })
      .order('points', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (fts && fts.length > 0) {
      data = fts as CatalogueWine[]
    } else {
      // Fallback: ILIKE on title + winery
      const { data: ilike } = await supabase
        .from('wine_catalogue')
        .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
        .or(`title.ilike.%${q}%,winery.ilike.%${q}%`)
        .order('points', { ascending: false, nullsFirst: false })
        .limit(limit)
      data = (ilike ?? []) as CatalogueWine[]
    }
  }

  // ── Filter by variety / country if provided ──────────────────
  if (!data) {
    let query = supabase
      .from('wine_catalogue')
      .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
      .order('points', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (variety) query = query.ilike('variety', `%${variety}%`)
    if (country) query = query.ilike('country', `%${country}%`)
    const { data: filtered } = await query
    data = (filtered ?? []) as CatalogueWine[]
  }

  // ── Attach AUD price ──────────────────────────────────────────
  const results = (data ?? []).map(w => ({
    ...w,
    price_aud: w.price_usd ? Math.round(w.price_usd * USD_TO_AUD) : null,
  }))

  return NextResponse.json({ results, count: results.length })
}
