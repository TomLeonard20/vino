import { NextResponse } from 'next/server'

// GET /api/debug-photo — tests Serper directly and returns the raw response
export async function GET() {
  const key = process.env.SERPER_API_KEY

  if (!key) return NextResponse.json({ error: 'SERPER_API_KEY not set' }, { status: 500 })

  const query = 'Hentley Farm The Quintessential wine bottle'

  try {
    const res = await fetch('https://google.serper.dev/images', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body:    JSON.stringify({ q: query, num: 3 }),
      cache:   'no-store',
    })

    const status = res.status
    const body   = await res.text()

    return NextResponse.json({ status, keyPrefix: key.slice(0, 8) + '...', body: JSON.parse(body) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
