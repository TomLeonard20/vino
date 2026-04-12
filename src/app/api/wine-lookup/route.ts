import { NextRequest, NextResponse } from 'next/server'

export interface WineLookupResult {
  name: string
  producer: string
  region: string
  vintage: number | null
  grapes: string[]
  criticScore: null   // not available from Open Food Facts
  source: string
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { next: { revalidate: 86400 } } // cache 24h
    )
    const data = await res.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false })
    }

    const p = data.product

    // Extract vintage from product name (e.g. "Grange 2018")
    const vintageMatch = (p.product_name ?? '').match(/\b(19|20)\d{2}\b/)
    const vintage = vintageMatch ? parseInt(vintageMatch[0]) : null

    // Best-effort extraction
    const result: WineLookupResult = {
      name: p.product_name ?? p.abbreviated_product_name ?? 'Unknown wine',
      producer: p.brands ?? '',
      region: p.origins ?? p.manufacturing_places ?? '',
      vintage,
      grapes: [],   // Open Food Facts rarely has grape data
      criticScore: null,
      source: 'Open Food Facts',
    }

    return NextResponse.json({ found: true, wine: result })
  } catch (err) {
    console.error('Wine lookup error:', err)
    return NextResponse.json({ found: false })
  }
}
