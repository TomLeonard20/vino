/**
 * Wine bottle photo fetcher.
 *
 * Source priority:
 *  1. Bing Image Search   (BING_IMAGE_API_KEY   — Azure free tier, 1 000 calls/month)
 *  2. Brave Image Search  (BRAVE_SEARCH_API_KEY — api.search.brave.com, 2 000/month free)
 *  3. Serper.dev          (SERPER_API_KEY       — 2 500 free Google Image searches/month,
 *                           sign up at serper.dev with email only — no credit card, no OAuth)
 *  4. DuckDuckGo Images   (no key — works locally but blocked on Vercel, silently skipped)
 *  5. Open Food Facts     (no key — wine-category filtered fallback)
 *
 * All fetches use cache:'no-store' — we do our own caching by writing the
 * result back to wines.label_image_url, so Next.js must not cache failures.
 */

// ── 1. Bing Image Search ──────────────────────────────────────────────────────
async function fetchFromBing(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.BING_IMAGE_API_KEY
  if (!key) { console.log('[wine-photo] Bing: skipped (no key)'); return null }
  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${q}&count=5&imageType=Photo&aspect=Tall&safeSearch=Strict`
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      cache:   'no-store',
      signal:  AbortSignal.timeout(timeoutMs),
    })
    console.log('[wine-photo] Bing: status', res.status)
    if (!res.ok) return null
    const data = await res.json()
    for (const v of (data.value ?? []) as Array<{ contentUrl?: string; thumbnailUrl?: string }>) {
      const img = v.contentUrl ?? v.thumbnailUrl
      if (img && img.startsWith('http')) { console.log('[wine-photo] Bing: found', img); return img }
    }
    console.log('[wine-photo] Bing: no usable results')
  } catch (e) { console.log('[wine-photo] Bing: error', e) }
  return null
}

// ── 2. Brave Search Image API ─────────────────────────────────────────────────
async function fetchFromBrave(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) { console.log('[wine-photo] Brave: skipped (no key)'); return null }
  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://api.search.brave.com/res/v1/images/search?q=${q}&count=5&safesearch=strict`
    const res = await fetch(url, {
      headers: {
        'Accept':                'application/json',
        'Accept-Encoding':       'gzip',
        'X-Subscription-Token':  key,
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    console.log('[wine-photo] Brave: status', res.status)
    if (!res.ok) return null
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ properties?: { url?: string } }>) {
      const img = r.properties?.url
      if (img && img.startsWith('http')) { console.log('[wine-photo] Brave: found', img); return img }
    }
    console.log('[wine-photo] Brave: no usable results')
  } catch (e) { console.log('[wine-photo] Brave: error', e) }
  return null
}

// ── 3. Vivino (keyless) ───────────────────────────────────────────────────────
// Scrapes the first bottle photo from Vivino's server-rendered search page.
// No key required. Vivino has images for virtually every commercially available wine.
async function fetchFromVivino(query: string, timeoutMs: number): Promise<string | null> {
  try {
    const q   = encodeURIComponent(query)
    const res = await fetch(`https://www.vivino.com/en/search/wines?q=${q}`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    console.log('[wine-photo] Vivino: status', res.status)
    if (!res.ok) return null
    const html = await res.text()
    // Vivino embeds wine data server-side; bottle photos use the _pb_x960.png suffix
    const match = html.match(/\/\/images\.vivino\.com\/thumbs\/([A-Za-z0-9_-]+_pb_x960\.png)/)
    if (!match) { console.log('[wine-photo] Vivino: no bottle image found'); return null }
    const url = `https:${match[0]}`
    console.log('[wine-photo] Vivino: found', url)
    return url
  } catch (e) { console.log('[wine-photo] Vivino: error', e) }
  return null
}

// ── 4. Serper.dev Google Image Search ────────────────────────────────────────
// Free: 2 500 queries/month, email sign-up only (no credit card, no OAuth).
// Sign up at https://serper.dev → Dashboard → API Key → copy to SERPER_API_KEY
async function fetchFromSerper(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.SERPER_API_KEY
  if (!key) { console.log('[wine-photo] Serper: skipped (no key)'); return null }
  try {
    const res = await fetch('https://google.serper.dev/images', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY':    key,
      },
      body:   JSON.stringify({ q: `${query} wine bottle`, num: 5 }),
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    console.log('[wine-photo] Serper: status', res.status)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.log('[wine-photo] Serper: error body', text)
      return null
    }
    const data = await res.json()
    console.log('[wine-photo] Serper: images count', (data.images ?? []).length)
    for (const item of (data.images ?? []) as Array<{
      imageUrl?: string
    }>) {
      const img = item.imageUrl
      if (!img || !img.startsWith('http')) continue
      console.log('[wine-photo] Serper: found', img)
      return img
    }
    console.log('[wine-photo] Serper: no usable results')
  } catch (e) { console.log('[wine-photo] Serper: error', e) }
  return null
}

// ── 4. DuckDuckGo Image Search ────────────────────────────────────────────────
// No API key needed. Works locally; /i.js returns 403 on Vercel server envs.
async function fetchFromDuckDuckGo(query: string, timeoutMs: number): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${query} wine bottle`)

    const pageRes = await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs / 2),
    })
    const html = await pageRes.text()

    const vqd =
      html.match(/vqd=['"]([^'"]+)['"]/)?.[1] ??
      html.match(/vqd=([A-Za-z0-9-]+)/)?.[1]
    if (!vqd) { console.log('[wine-photo] DDG: no VQD token'); return null }

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${q}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&s=0&l=us-en&f=,,,`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Referer':    'https://duckduckgo.com/',
        },
        cache:  'no-store',
        signal: AbortSignal.timeout(timeoutMs / 2),
      },
    )
    console.log('[wine-photo] DDG: images status', imgRes.status)
    if (!imgRes.ok) return null
    const imgData = await imgRes.json()

    const SKIP = /logo|icon|avatar|favicon|thumbnail|placeholder/i
    for (const r of (imgData.results ?? []) as Array<{
      image?:  string
      width?:  number
      height?: number
    }>) {
      const url = r.image
      if (!url || !url.startsWith('http')) continue
      if (SKIP.test(url)) continue
      if (r.width && r.height && r.width > r.height * 1.5) continue
      console.log('[wine-photo] DDG: found', url)
      return url
    }
  } catch (e) { console.log('[wine-photo] DDG: error', e) }
  return null
}

// ── 5. Open Food Facts ────────────────────────────────────────────────────────
async function fetchFromOpenFoodFacts(name: string, producer: string, timeoutMs: number): Promise<string | null> {
  try {
    const q   = encodeURIComponent(`${producer} ${name}`.trim())
    const url = [
      'https://world.openfoodfacts.org/cgi/search.pl',
      `?search_terms=${q}`,
      '&search_simple=1&action=process&json=1&page_size=8',
      '&tagtype_0=categories&tag_contains_0=contains&tag_0=wine',
    ].join('')
    const res = await fetch(url, {
      cache:  'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    console.log('[wine-photo] OFFood: products found', (data.products ?? []).length)
    for (const p of (data.products ?? []) as Array<{ image_front_url?: string; image_url?: string }>) {
      let img = p.image_front_url ?? p.image_url
      if (!img || !img.startsWith('http')) continue
      img = img.replace(/(\.[a-z]+)$/, '.full$1')
      console.log('[wine-photo] OFFood: found', img)
      return img
    }
  } catch (e) { console.log('[wine-photo] OFFood: error', e) }
  return null
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function fetchWinePhoto(
  name: string,
  producer: string,
  timeoutMs = 10000,
): Promise<string | null> {
  const query = `${producer} ${name}`.trim()
  console.log('[wine-photo] fetching for:', query)

  const bing = await fetchFromBing(query, timeoutMs)
  if (bing) return bing

  const brave = await fetchFromBrave(query, timeoutMs)
  if (brave) return brave

  const vivino = await fetchFromVivino(query, timeoutMs)
  if (vivino) return vivino

  const serper = await fetchFromSerper(query, timeoutMs)
  if (serper) return serper

  const ddg = await fetchFromDuckDuckGo(query, timeoutMs)
  if (ddg) return ddg

  const off = await fetchFromOpenFoodFacts(name, producer, timeoutMs)
  console.log('[wine-photo] all sources exhausted, result:', off ?? 'null')
  return off
}
