import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWinePhoto } from '@/lib/wine-photo'

export const dynamic = 'force-dynamic'

// GET /api/refresh-photos?offset=0
// Processes one wine at a time to stay within Vercel's 10s function limit.
// Call repeatedly with increasing offset until done=true.
export async function GET(req: NextRequest) {
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch one wine at a time
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, producer')
    .order('id')
    .range(offset, offset)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!wines?.length) return NextResponse.json({ done: true, offset })

  const wine = wines[0]
  const url  = await fetchWinePhoto(wine.name ?? '', wine.producer ?? '')

  if (url) {
    await supabase.from('wines').update({ label_image_url: url }).eq('id', wine.id)
  }

  return NextResponse.json({
    done:     false,
    offset,
    next:     offset + 1,
    wine:     `${wine.producer ?? ''} ${wine.name ?? ''}`.trim(),
    imageUrl: url ?? null,
  })
}
