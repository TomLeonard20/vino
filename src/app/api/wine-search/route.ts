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

/** Strip accents: "Moët" → "Moet", "Château" → "Chateau" */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Common English stop words — PostgreSQL's English tsvector/tsquery strips these,
// so including them in a to_tsquery() call causes parse errors.
const STOP_WORDS = new Set([
  'the','a','an','of','in','at','to','for','is','are','by','with','from',
  'and','or','de','du','le','la','les','von','van','del','di','da',
])

/**
 * Build a prefix-match tsquery string (for use with to_tsquery, NOT websearch_to_tsquery).
 * Filters stop words so they don't cause parse errors.
 * Returns null when the query collapses to nothing (all stop words).
 */
function buildTsQuery(raw: string): string | null {
  const terms = raw
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()))
    .map(w => `${w}:*`)
  return terms.length > 0 ? terms.join(' & ') : null
}

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q')?.trim()
  const variety  = req.nextUrl.searchParams.get('variety')?.trim()
  const country  = req.nextUrl.searchParams.get('country')?.trim()
  const producer = req.nextUrl.searchParams.get('producer')?.trim()
  const vintageP = req.nextUrl.searchParams.get('vintage')?.trim()
  const vintage  = vintageP ? parseInt(vintageP) : null
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '10')
  const limit   = Math.min(limitParam, 50)

  if (!q && !variety && !country && !producer && !vintage) {
    return NextResponse.json({ error: 'Provide q, variety, country, producer, or vintage' }, { status: 400 })
  }

  const supabase = await createClient()
  let data: CatalogueWine[] | null = null

  // ── Full-text search on q ────────────────────────────────────
  if (q) {
    // Try both the original query and an accent-stripped version so that
    // "Moët" matches "Moet" in the catalogue (and vice versa).
    const qNorm = stripAccents(q)

    const tsQuery = buildTsQuery(qNorm)

    if (tsQuery) {
      // Supabase-JS's .textSearch() doesn't URL-encode the '&' operator in tsquery strings,
      // causing the filter to split at '&' and silently return 0 results.
      // We bypass it with a direct fetch so URLSearchParams properly encodes '&' → '%26'.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const params = new URLSearchParams({
        select: 'id,title,winery,variety,country,province,region,vintage,points,price_usd,description',
        search_vector: `fts(english).${tsQuery}`,
        order: 'points.desc.nullslast',
        limit: String(limit),
      })
      const ftsRes = await fetch(`${supabaseUrl}/rest/v1/wine_catalogue?${params}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      if (ftsRes.ok) {
        const fts: CatalogueWine[] = await ftsRes.json()
        if (Array.isArray(fts) && fts.length > 0) data = fts
      }
    }

    if (!data) {
      // Fallback 1: ILIKE on title + winery using both accented and stripped form
      const ilikeQ = qNorm !== q ? qNorm : q
      const { data: ilike } = await supabase
        .from('wine_catalogue')
        .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
        .or(`title.ilike.%${ilikeQ}%,winery.ilike.%${ilikeQ}%,title.ilike.%${q}%,winery.ilike.%${q}%`)
        .order('points', { ascending: false, nullsFirst: false })
        .limit(limit)

      if (ilike && ilike.length > 0) {
        data = ilike as CatalogueWine[]
      } else {
        // Fallback 2: try each word independently (OR), catches partial matches
        const words = qNorm.split(/\s+/).filter(w => w.length > 2)
        if (words.length > 1) {
          const orClauses = words.flatMap(w => [
            `title.ilike.%${w}%`,
            `winery.ilike.%${w}%`,
          ]).join(',')
          const { data: wordMatch } = await supabase
            .from('wine_catalogue')
            .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
            .or(orClauses)
            .order('points', { ascending: false, nullsFirst: false })
            .limit(limit)
          data = (wordMatch ?? []) as CatalogueWine[]
        } else {
          data = []
        }
      }
    }
  }

  // ── Filter by producer / variety / vintage / country ─────────
  if (!data) {
    let query = supabase
      .from('wine_catalogue')
      .select('id,title,winery,variety,country,province,region,vintage,points,price_usd,description')
      .order('points', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (producer) query = query.ilike('winery',   `%${stripAccents(producer)}%`)
    if (variety)  query = query.ilike('variety',  `%${variety}%`)
    if (country)  query = query.ilike('country',  `%${country}%`)
    if (vintage)  query = query.eq('vintage', vintage)
    const { data: filtered } = await query
    data = (filtered ?? []) as CatalogueWine[]
  }

  // ── Re-rank by producer relevance before returning ───────────
  // Sorting purely by points lets wines from OTHER producers that mention
  // the query word in their title (e.g. "Marietta Cellars Gibson Block")
  // outrank actual producer matches (e.g. "Gibson's BarossaVale").
  // We score each result: winery match to query words is worth 2×,
  // title match worth 1×, then break ties with points.
  const qWords = q
    ? stripAccents(q).toLowerCase().split(/\s+/).filter(w => w.length > 2)
    : []

  function relevanceScore(w: { title: string; winery: string; points: number | null }): number {
    if (!qWords.length) return w.points ?? 0
    const wn = stripAccents(w.winery ?? '').toLowerCase()
    const tn = stripAccents(w.title  ?? '').toLowerCase()
    const wineryHits = qWords.filter(qw => wn.includes(qw)).length
    const titleHits  = qWords.filter(qw => tn.includes(qw)).length
    // Scale: winery match = 200 per word, title-only = 100 per word, + raw points
    return wineryHits * 200 + titleHits * 100 + (w.points ?? 0)
  }

  const results = (data ?? [])
    .map(w => ({ ...w, price_aud: w.price_usd ? Math.round(w.price_usd * USD_TO_AUD) : null }))
    .sort((a, b) => relevanceScore(b) - relevanceScore(a))

  return NextResponse.json({ results, count: results.length })
}
