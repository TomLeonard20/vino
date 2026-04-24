import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchWinePhoto } from '@/lib/wine-photo'

// GET /api/wine-photo?wineId=xxx&name=yyy&producer=zzz
// Fetches a bottle image for the given wine, saves it to the DB, returns { url }
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const wineId   = searchParams.get('wineId')
  const name     = searchParams.get('name')     ?? ''
  const producer = searchParams.get('producer') ?? ''

  if (!wineId) return NextResponse.json({ url: null }, { status: 400 })

  const supabase = await createClient()

  // Re-check DB first — another request may have just saved one
  const { data: wine } = await supabase
    .from('wines')
    .select('label_image_url')
    .eq('id', wineId)
    .single()

  if (wine?.label_image_url) {
    return NextResponse.json({ url: wine.label_image_url })
  }

  // Fetch from external sources
  const url = await fetchWinePhoto(name, producer)

  if (url) {
    await supabase.from('wines').update({ label_image_url: url }).eq('id', wineId)
  }

  return NextResponse.json({ url })
}
