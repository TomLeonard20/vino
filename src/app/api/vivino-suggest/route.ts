import { NextRequest, NextResponse } from 'next/server'
import { normalizeScore } from '@/lib/score-normalizer'

/**
 * Vivino typeahead — supplements the WE catalogue for wines not in the
 * Wine Enthusiast catalogue (AU/NZ/EU-heavy wines especially).
 *
 * Returns ONE entry per wine name with a `vintages` array so the UI
 * can show a vintage picker after the user selects the wine.
 */

const NOISE = new Set([
  'australian dollars','bottle (0.75l)','bottle (1.5l)','half bottle (0.375l)',
  'magnum (1.5l)','standard','aud','usd','gbp','eur',
])

function isNoise(n: string) { return NOISE.has(n.toLowerCase()) }

function splitVintage(raw: string): { name: string; vintage: number | null } {
  const now   = new Date().getFullYear()
  const match = raw.match(/\s+(\d{4})$/)
  if (match) {
    const yr = parseInt(match[1])
    if (yr >= 1970 && yr <= now) {
      return { name: raw.slice(0, -match[0].length).trim(), vintage: yr }
    }
  }
  return { name: raw, vintage: null }
}

export interface VivinoSuggestion {
  id:       number      // Vivino wine ID of the most-rated vintage
  title:    string      // wine name without vintage
  vintages: number[]    // available vintages, newest first
  points:   number      // normalised score (WE scale)
  source:   'Vivino'
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    const res = await fetch(
      `https://www.vivino.com/en/search/wines?q=${encodeURIComponent(q)}`,
      {
        headers: {
          'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return NextResponse.json({ results: [] })

    const text = (await res.text()).replace(/&quot;/g, '"').replace(/&amp;/g, '&')

    const raw = [
      ...text.matchAll(
        /"vintage":\{"id":(\d+),"seo_name":"([^"]+)","name":"([^"]+)","statistics":\{[^}]*"ratings_average":([\d.]+)/g,
      ),
    ]

    // Score relevance by query word overlap
    const qWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    function relevance(n: string) {
      const nl = n.toLowerCase()
      return qWords.filter(w => nl.includes(w)).length / Math.max(qWords.length, 1)
    }

    // Group by wine name (sans vintage), newest vintage first
    const groups = new Map<string, { id: number; vintages: number[]; rating: number; rel: number; pos: number }>()
    const seenExact = new Set<string>()

    raw.forEach((m, pos) => {
      const rating = parseFloat(m[4])
      if (rating < 3.0 || isNoise(m[3])) return
      if (seenExact.has(m[3])) return   // skip exact duplicates from Vivino
      seenExact.add(m[3])

      const { name, vintage } = splitVintage(m[3])
      const rel = relevance(name)

      if (!groups.has(name)) {
        groups.set(name, { id: parseInt(m[1]), vintages: [], rating, rel, pos })
      }
      const g = groups.get(name)!
      if (vintage) g.vintages.push(vintage)
      // keep the id + rating of the entry with the most ratings (proxy: highest rating)
      if (rating > g.rating) { g.rating = rating; g.id = parseInt(m[1]) }
    })

    // Sort groups by relevance then original position, take top 10 unique wines.
    // 10 gives the frontend enough headroom to dedup against catalogue results
    // and still surface niche wines (e.g. Gibson The Dirtman) that Vivino ranks
    // at position 8-10 for a broad query like "gibson".
    const results: VivinoSuggestion[] = [...groups.entries()]
      .sort(([, a], [, b]) => b.rel - a.rel || a.pos - b.pos)
      .slice(0, 10)
      .map(([name, g]) => ({
        id:       g.id,
        title:    name,
        vintages: g.vintages.sort((a, b) => b - a),  // newest first
        points:   normalizeScore(g.rating, 'Vivino'),
        source:   'Vivino' as const,
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
