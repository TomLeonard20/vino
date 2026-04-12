import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USD_TO_AUD = 1.58

export interface WineLookupResult {
  name:        string
  producer:    string
  region:      string
  country:     string
  vintage:     number | null
  grapes:      string[]
  criticScore: number | null
  price_aud:   number | null
  source:      string
}

function extractVintage(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/)
  return m ? parseInt(m[0]) : null
}

// ── Source 1: Open Food Facts ─────────────────────────────────
async function tryOpenFoodFacts(barcode: string): Promise<WineLookupResult | null> {
  try {
    const res  = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { next: { revalidate: 86400 } }
    )
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null

    const p    = data.product
    const name = p.product_name ?? p.abbreviated_product_name ?? ''
    if (!name) return null

    return {
      name,
      producer:    p.brands ?? '',
      region:      p.origins ?? p.manufacturing_places ?? '',
      country:     p.countries_tags?.[0]?.replace('en:', '') ?? '',
      vintage:     extractVintage(name),
      grapes:      [],
      criticScore: null,
      price_aud:   null,
      source:      'Open Food Facts',
    }
  } catch {
    return null
  }
}

// ── Source 2: UPC Item DB (free, 100 req/day) ─────────────────
async function tryUpcItemDb(barcode: string): Promise<WineLookupResult | null> {
  try {
    const res  = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]
    if (!item?.title) return null

    return {
      name:        item.title,
      producer:    item.brand ?? '',
      region:      '',
      country:     '',
      vintage:     extractVintage(item.title ?? ''),
      grapes:      [],
      criticScore: null,
      price_aud:   null,
      source:      'UPC Item DB',
    }
  } catch {
    return null
  }
}

// ── Source 3: Open Beauty Facts ───────────────────────────────
async function tryOpenBeautyFacts(barcode: string): Promise<WineLookupResult | null> {
  try {
    const res  = await fetch(
      `https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`,
      { next: { revalidate: 86400 } }
    )
    const data = await res.json()
    if (data.status !== 1 || !data.product?.product_name) return null

    const p = data.product
    return {
      name:        p.product_name,
      producer:    p.brands ?? '',
      region:      p.origins ?? '',
      country:     '',
      vintage:     extractVintage(p.product_name ?? ''),
      grapes:      [],
      criticScore: null,
      price_aud:   null,
      source:      'Open Product DB',
    }
  } catch {
    return null
  }
}

// ── Source 4: Catalogue enrichment ───────────────────────────
// Once we have a name from barcodes, look it up in our 130k wine catalogue
async function enrichFromCatalogue(name: string, producer: string, vintage: number | null): Promise<Partial<WineLookupResult> | null> {
  try {
    const supabase = await createClient()
    const q = [producer, name, vintage?.toString()].filter(Boolean).join(' ')

    const { data } = await supabase
      .from('wine_catalogue')
      .select('points,price_usd,variety,country,region,description')
      .textSearch('search_vector', q.split(/\s+/).filter(w => w.length > 1).map(w => `${w}:*`).join(' & '), { type: 'websearch' })
      .order('points', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    return {
      criticScore: data.points  ?? null,
      price_aud:   data.price_usd ? Math.round(data.price_usd * USD_TO_AUD) : null,
      grapes:      data.variety ? [data.variety] : [],
      region:      data.region  ?? '',
      country:     data.country ?? '',
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  // Try barcode sources in order
  const base =
    (await tryOpenFoodFacts(barcode)) ??
    (await tryUpcItemDb(barcode))     ??
    (await tryOpenBeautyFacts(barcode))

  if (!base) return NextResponse.json({ found: false })

  // Always try to enrich with catalogue data for price + score
  const enriched = await enrichFromCatalogue(base.name, base.producer, base.vintage)

  return NextResponse.json({
    found: true,
    wine: {
      ...base,
      grapes:      enriched?.grapes?.length ? enriched.grapes      : base.grapes,
      criticScore: enriched?.criticScore    ?? base.criticScore,
      price_aud:   enriched?.price_aud      ?? base.price_aud,
      region:      enriched?.region         || base.region,
      country:     enriched?.country        || base.country,
    },
  })
}
