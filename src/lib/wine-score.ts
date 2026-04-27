/**
 * Automatic wine score fetcher.
 *
 * Source priority:
 *  1. Wine Enthusiast catalogue (Supabase wine_catalogue table) — 130k wines,
 *     already on the WE reference scale, no normalisation needed.
 *  2. Vivino community rating (keyless HTML scrape) — normalised from 5-pt
 *     scale to WE reference scale via score-normalizer.ts.
 *
 * Returns { score, source, rawScore } or null if nothing found.
 */

import { normalizeScore } from './score-normalizer'

const NOISE_NAMES = new Set([
  'australian dollars', 'bottle (0.75l)', 'bottle (1.5l)', 'half bottle (0.375l)',
  'magnum (1.5l)', 'jeroboam (3l)', 'standard', 'aud', 'usd', 'gbp', 'eur',
])

// Common words that must not drive a match on their own
const STOP_WORDS = new Set([
  'the', 'and', 'les', 'des', 'del', 'los', 'las', 'von', 'van',
  'den', 'for', 'per', 'une', 'avec', 'our', 'its', 'all',
])

function isNoiseName(name: string): boolean {
  return NOISE_NAMES.has(name.toLowerCase())
}

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normStr(s: string) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Meaningful words: length > 3 AND not a stop word */
function meaningfulWords(s: string): string[] {
  return normStr(s).split(' ').filter(w => w.length > 3 && !STOP_WORDS.has(w))
}

function wordOverlap(a: string, b: string): number {
  const wa = meaningfulWords(a)
  const wb = new Set(meaningfulWords(b))
  if (!wa.length) return 0
  return wa.filter(w => wb.has(w)).length / wa.length
}

/**
 * Vivino-specific match scorer.
 * Wine-name-specific words (not in producer name) must have ≥1 hit
 * in the candidate — prevents Hentley Farm matching The Beast when
 * searching for The Quintessential.
 */
function vivinoMatchScore(wineName: string, producer: string, candidate: string): number {
  const wineWords  = new Set(meaningfulWords(wineName))
  const prodWords  = new Set(meaningfulWords(producer))
  const uniqueName = [...wineWords].filter(w => !prodWords.has(w))
  const candWords  = new Set(meaningfulWords(candidate))

  // Require at least one wine-specific word to match
  if (uniqueName.length > 0 && uniqueName.filter(w => candWords.has(w)).length === 0) return 0

  return wordOverlap(wineName, candidate) * 0.6 + wordOverlap(producer, candidate) * 0.4
}

// ── 1. Wine Enthusiast catalogue ──────────────────────────────────────────────
// Called server-side only; pass supabase client in.
export async function fetchFromCatalogue(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  name: string,
  producer: string,
  vintage: number | null,
): Promise<{ score: number; source: string; rawScore: number } | null> {
  const cleanName = name.replace(/\b(19|20)\d{2}\b/g, '').replace(/\([^)]*\)/g, '').trim()
  const searchQ   = `${producer} ${cleanName}`.replace(/\s+/g, ' ').trim()
  const norm      = stripAccents(searchQ)
  const tsQ       = norm.split(/\s+/).filter(w => w.length > 1).map(w => `${w}:*`).join(' & ')

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
    const words  = norm.split(/\s+/).filter(w => w.length > 3).slice(0, 3)
    const clause = words.map(w => `title.ilike.%${w}%`).join(',')
    if (clause) {
      const { data: ilike } = await supabase
        .from('wine_catalogue')
        .select('title, winery, vintage, points, price_usd')
        .or(clause)
        .not('points', 'is', null)
        .order('points', { ascending: false, nullsFirst: false })
        .limit(10)
      rows = ilike ?? []
    }
  }

  let best: typeof rows[0] | null = null
  let bestScore = 0

  for (const row of rows) {
    const nameOverlap   = wordOverlap(cleanName, row.title)
    const wineryOverlap = wordOverlap(producer, row.winery ?? '')
    let s = nameOverlap * 0.5 + wineryOverlap * 0.3
    if (vintage && row.vintage === vintage) s += 0.25
    else if (!vintage || !row.vintage) s += 0.05
    if (s > bestScore) { bestScore = s; best = row }
  }

  if (!best || bestScore < 0.4 || !best.points) return null

  return { score: best.points, source: 'Wine Enthusiast', rawScore: best.points }
}

// ── 2. Vivino community rating ────────────────────────────────────────────────
export async function fetchFromVivino(
  name: string,
  producer: string,
  timeoutMs = 9000,
): Promise<{ score: number; source: string; rawScore: number } | null> {
  try {
    const query = `${producer} ${name}`.trim()
    const q     = encodeURIComponent(query)
    const res   = await fetch(`https://www.vivino.com/en/search/wines?q=${q}`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null

    const decoded = (await res.text())
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')

    // Extract (wineName, rating) pairs from the HTML
    const candidates: Array<{ wineName: string; rating: number; count: number }> = []
    let pos = 0

    while (candidates.length < 8) {
      const idx = decoded.indexOf('ratings_average', pos)
      if (idx === -1) break

      const before  = decoded.slice(Math.max(0, idx - 600), idx)
      const rawVal  = decoded.slice(idx).match(/:([\d.]+)/)?.[1]
      const rawCnt  = decoded.slice(idx).match(/ratings_count[\":\s]+(\d+)/)?.[1]

      if (rawVal) {
        // Collect all "name" fields in the window; take last non-noise one
        const allNames = [...before.matchAll(/"name":"([^"]{3,80})"/g)].map(m => m[1])
        const wineName = [...allNames].reverse().find(n => !isNoiseName(n))

        if (wineName) {
          candidates.push({
            wineName,
            rating: parseFloat(rawVal),
            count:  parseInt(rawCnt ?? '0'),
          })
        }
      }
      pos = idx + 1
    }

    if (!candidates.length) return null

    // Pick the best name match — highest word overlap, then most ratings
    const cleanName = normStr(`${name}`)
    const cleanProd = normStr(`${producer}`)

    let best: typeof candidates[0] | null = null
    let bestMatch = -1

    for (const c of candidates) {
      const total = vivinoMatchScore(name, producer, c.wineName)
      if (total > bestMatch || (total === bestMatch && c.count > (best?.count ?? 0))) {
        bestMatch = total
        best = c
      }
    }

    if (!best || bestMatch < 0.25 || best.rating < 3.0) return null

    const normalised = normalizeScore(best.rating, 'Vivino')
    return { score: normalised, source: 'Vivino', rawScore: best.rating }
  } catch {
    return null
  }
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function fetchWineScore(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  name: string,
  producer: string,
  vintage: number | null,
  timeoutMs = 9000,
): Promise<{ score: number; source: string; rawScore: number } | null> {
  const catalogue = await fetchFromCatalogue(supabase, name, producer, vintage)
  if (catalogue) return catalogue

  const vivino = await fetchFromVivino(name, producer, timeoutMs)
  return vivino
}
