import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWinePhoto } from '@/lib/wine-photo'

// GET /api/refresh-photos
// One-shot: re-fetches a fresh image for every wine and saves it to the DB.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch all wines
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, producer')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!wines?.length) return NextResponse.json({ message: 'No wines found', updated: 0 })

  // Process in batches of 5 to avoid hammering Serper
  const BATCH = 5
  let updated = 0
  const failed: string[] = []

  for (let i = 0; i < wines.length; i += BATCH) {
    const batch = wines.slice(i, i + BATCH)
    await Promise.all(batch.map(async (wine) => {
      try {
        const url = await fetchWinePhoto(wine.name ?? '', wine.producer ?? '')
        if (url) {
          await supabase.from('wines').update({ label_image_url: url }).eq('id', wine.id)
          updated++
        } else {
          failed.push(`${wine.producer ?? ''} ${wine.name ?? ''}`.trim())
        }
      } catch {
        failed.push(`${wine.producer ?? ''} ${wine.name ?? ''}`.trim())
      }
    }))
  }

  return NextResponse.json({
    total:   wines.length,
    updated,
    noImage: failed,
  })
}
