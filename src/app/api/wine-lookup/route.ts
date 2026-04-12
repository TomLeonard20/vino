import { NextRequest, NextResponse } from 'next/server'

export interface WineLookupResult {
  name: string
  producer: string
  region: string
  vintage: number | null
  grapes: string[]
  criticScore: null
  source: string
}

// Extract a 4-digit vintage year from a string
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

    const p = data.product
    const name = p.product_name ?? p.abbreviated_product_name ?? ''
    if (!name) return null

    return {
      name,
      producer: p.brands ?? '',
      region:   p.origins ?? p.manufacturing_places ?? '',
      vintage:  extractVintage(name),
      grapes:   [],
      criticScore: null,
      source: 'Open Food Facts',
    }
  } catch {
    return null
  }
}

// ── Source 2: UPC Item DB (free, 100 req/day, no key) ─────────
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
      name:     item.title,
      producer: item.brand ?? '',
      region:   '',
      vintage:  extractVintage(item.title ?? ''),
      grapes:   [],
      criticScore: null,
      source: 'UPC Item DB',
    }
  } catch {
    return null
  }
}

// ── Source 3: Open Beauty Facts (sometimes has wine) ─────────
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
      name:     p.product_name,
      producer: p.brands ?? '',
      region:   p.origins ?? '',
      vintage:  extractVintage(p.product_name ?? ''),
      grapes:   [],
      criticScore: null,
      source: 'Open Product DB',
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  // Try each source in order, return first hit
  const result =
    (await tryOpenFoodFacts(barcode)) ??
    (await tryUpcItemDb(barcode)) ??
    (await tryOpenBeautyFacts(barcode))

  if (result) {
    return NextResponse.json({ found: true, wine: result })
  }

  return NextResponse.json({ found: false })
}
