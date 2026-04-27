import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET /api/backfill-scores?offset=0&dry=false
// Processes one wine per call (Vercel 10s limit).
// Loops through wines missing critic_score, finds the best catalogue match
// by name+producer+vintage, and writes back points + price_aud.
//
// dry=true   → reports what would be written without touching the DB
// done=true  → all wines processed

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalize(s: string) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Score similarity of a catalogue row against the cellar wine (0–1) */
function matchScore(
  row: { title: string; winery: string; vintage: number | null; points: number | null },
  name: string,
  producer: string,
  vintage: number | null,
): number {
  const rowTitle   = normalize(row.title)
  const rowWinery  = normalize(row.winery ?? '')
  const cellarName = normalize(name)
  const cellarProd = normalize(producer)

  let score = 0

  // Title contains cellar name (or vice-versa)
  if (rowTitle.includes(cellarName) || cellarName.includes(rowTitle)) score += 0.4
  // Winery matches producer
  if (cellarProd && (rowWinery.includes(cellarProd) || cellarProd.includes(rowWinery))) score += 0.3
  // Vintage match
  if (vintage && row.vintage === vintage) score += 0.3
  else if (!vintage || !row.vintage) score += 0.1  // both unknown — partial credit

  return score
}

export async function GET(req: NextRequest) {
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)
  const dry    = req.nextUrl.searchParams.get('dry') === 'true'

  // Service-role client — bypasses RLS so we can read all user wines
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch ONE wine missing a critic_score (skip wines that already have one)
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, producer, vintage, critic_score')
    .is('critic_score', null)
    .order('id')
    .range(offset, offset)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!wines?.length) {
    return NextResponse.json({ done: true, offset, message: 'All wines processed.' })
  }

  const wine = wines[0]
  const label = `${wine.producer ?? ''} ${wine.name ?? ''}`.trim()

  // Build a search query: strip vintage-year tokens from name first
  const cleanName = (wine.name ?? '').replace(/\b(19|20)\d{2}\b/g, '').trim()
  const searchQ   = `${wine.producer ?? ''} ${cleanName}`.trim()

  // Search the catalogue — try FTS first, fall back to ILIKE
  const norm = stripAccents(searchQ)
  const tsQ  = norm.split(/\s+/).filter(w => w.length > 1).map(w => `${w}:*`).join(' & ')

  let rows: Array<{ title: string; winery: string; vintage: number | null; points: number | null; price_usd: number | null }> = []

  const { data: fts } = await supabase
    .from('wine_catalogue')
    .select('title, winery, vintage, points, price_usd')
    .textSearch('search_vector', tsQ, { type: 'websearch' })
    .not('points', 'is', null)
    .order('points', { ascending: false, nullsFirst: false })
    .limit(10)

  if (fts && fts.length > 0) {
    rows = fts
  } else {
    const { data: ilike } = await supabase
      .from('wine_catalogue')
      .select('title, winery, vintage, points, price_usd')
      .or(`title.ilike.%${norm}%,winery.ilike.%${norm}%`)
      .not('points', 'is', null)
      .order('points', { ascending: false, nullsFirst: false })
      .limit(10)
    rows = ilike ?? []
  }

  // Pick the best-matching row
  let best: typeof rows[0] | null = null
  let bestScore = 0

  for (const row of rows) {
    const s = matchScore(row, wine.name ?? '', wine.producer ?? '', wine.vintage)
    if (s > bestScore) { bestScore = s; best = row }
  }

  // Require at least a weak match (title overlap + winery or vintage)
  const MIN_SCORE = 0.4
  if (!best || bestScore < MIN_SCORE || !best.points) {
    return NextResponse.json({
      done:     false,
      offset,
      next:     offset + 1,
      wine:     label,
      result:   'no_match',
      searched: searchQ,
    })
  }

  const priceAud = best.price_usd ? Math.round(best.price_usd * 1.58) : null

  if (!dry) {
    await supabase
      .from('wines')
      .update({ critic_score: best.points })
      .eq('id', wine.id)

    // Also update market_price on any cellar_bottles row that is still null
    await supabase
      .from('cellar_bottles')
      .update({ market_price: priceAud, market_currency: 'AUD' })
      .eq('wine_id', wine.id)
      .is('market_price', null)
  }

  return NextResponse.json({
    done:      false,
    offset,
    next:      offset + 1,
    wine:      label,
    result:    'updated',
    score:     best.points,
    priceAud,
    matchedTo: `${best.winery} ${best.title} (${best.vintage ?? '?'})`,
    similarity: Math.round(bestScore * 100),
    dry,
  })
}
