import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWinePhoto } from '@/lib/wine-photo'

// GET /api/wine-photo?wineId=xxx&name=yyy&producer=zzz
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const wineId   = searchParams.get('wineId')
  const name     = searchParams.get('name')     ?? ''
  const producer = searchParams.get('producer') ?? ''

  if (!wineId) return NextResponse.json({ url: null }, { status: 400 })

  const force = searchParams.get('force') === 'true'

  // Service-role client created inside handler so env vars are available at runtime
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Re-check DB — another request may have already saved one (skip if force-refresh)
  if (!force) {
    const { data: wine } = await supabase
      .from('wines')
      .select('label_image_url')
      .eq('id', wineId)
      .single()

    if (wine?.label_image_url) {
      return NextResponse.json({ url: wine.label_image_url })
    }
  }

  // Fetch from Serper / fallback sources
  const url = await fetchWinePhoto(name, producer)

  if (url) {
    await supabase.from('wines').update({ label_image_url: url }).eq('id', wineId)
  }

  return NextResponse.json({ url })
}
