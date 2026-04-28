import { NextRequest, NextResponse } from 'next/server'
import { normalizeScore } from '@/lib/score-normalizer'

/**
 * Vivino typeahead — supplements the WE catalogue search for wines (especially
 * AU/NZ/EU) that don't appear in the Wine Enthusiast catalogue.
 *
 * Returns results in the same shape as /api/wine-search so the frontend
 * can merge them seamlessly.
 */

const NOISE = new Set([
  'australian dollars','bottle (0.75l)','bottle (1.5l)','half bottle (0.375l)',
  'magnum (1.5l)','standard','aud','usd','gbp','eur',
])

function isNoise(n: string) { return NOISE.has(n.toLowerCase()) }

/** Pull vintage year from the end of a Vivino wine name. */
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

    // Extract structured vintage entries from Vivino's embedded JSON
    const raw = [
      ...text.matchAll(
        /"vintage":\{"id":(\d+),"seo_name":"([^"]+)","name":"([^"]+)","statistics":\{[^}]*"ratings_average":([\d.]+)/g,
      ),
    ]

    const seen = new Set<string>()
    const results = raw
      .filter(m => {
        const rating = parseFloat(m[4])
        if (rating < 3.0) return false            // too low / unrated
        if (isNoise(m[3])) return false
        if (seen.has(m[3])) return false          // deduplicate by exact name
        seen.add(m[3])
        return true
      })
      .slice(0, 6)
      .map(m => {
        const { name, vintage } = splitVintage(m[3])
        const rawRating         = parseFloat(m[4])
        const normScore         = normalizeScore(rawRating, 'Vivino')

        return {
          // Match CatalogueWine shape so the frontend handles it uniformly
          id:          parseInt(m[1]),
          title:       name,
          winery:      '',   // not available in search results
          variety:     '',
          country:     '',
          province:    '',
          region:      '',
          vintage,
          points:      normScore,
          price_usd:   null,
          price_aud:   null,
          description: '',
          source:      'Vivino' as const,
        }
      })

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
