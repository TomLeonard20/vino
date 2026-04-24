import { NextResponse } from 'next/server'

// GET /api/debug-photo — tests Vivino directly and returns the result
export async function GET() {
  const query = 'Hentley Farm The Quintessential'

  try {
    const q   = encodeURIComponent(query)
    const res = await fetch(`https://www.vivino.com/en/search/wines?q=${q}`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(9000),
    })

    const status = res.status

    if (!res.ok) {
      return NextResponse.json({ status, error: 'Non-OK response from Vivino' })
    }

    const html  = await res.text()
    const match = html.match(/\/\/images\.vivino\.com\/thumbs\/([A-Za-z0-9_-]+_pb_x960\.png)/)
    const url   = match ? `https:${match[0]}` : null

    return NextResponse.json({
      status,
      htmlLength: html.length,
      imageFound: !!url,
      url,
      serperKey: process.env.SERPER_API_KEY ? 'SET' : 'NOT SET',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
