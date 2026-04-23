/**
 * Wine bottle photo fetcher.
 *
 * Source priority:
 *  1. Bing Image Search        (BING_IMAGE_API_KEY   — Azure free tier, 1 000 calls/month)
 *  2. Brave Image Search       (BRAVE_SEARCH_API_KEY — api.search.brave.com, 2 000/month free)
 *  3. Google Custom Search     (GOOGLE_API_KEY + GOOGLE_CSE_ID — 100 free/day, no credit card)
 *                                Setup (5 min):
 *                                  a) console.cloud.google.com → New project → Enable
 *                                     "Custom Search JSON API" → Create API key → copy to GOOGLE_API_KEY
 *                                  b) cse.google.com → New search engine → "Search the entire web"
 *                                     → turn on "Image search" → copy the CX ID to GOOGLE_CSE_ID
 *  4. DuckDuckGo Images        (no key — works locally but blocked on Vercel, silently skipped)
 *  5. Open Food Facts          (no key — wine-category filtered fallback)
 *
 * Once a URL is fetched it is written back to wines.label_image_url in the DB,
 * so each wine is only ever fetched once.
 */

// ── 1. Bing Image Search ──────────────────────────────────────────────────────
async function fetchFromBing(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.BING_IMAGE_API_KEY
  if (!key) return null
  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${q}&count=5&imageType=Photo&aspect=Tall&safeSearch=Strict`
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      next:    { revalidate: 86400 },
      signal:  AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const v of (data.value ?? []) as Array<{ contentUrl?: string; thumbnailUrl?: string }>) {
      const img = v.contentUrl ?? v.thumbnailUrl
      if (img && img.startsWith('http')) return img
    }
  } catch { }
  return null
}

// ── 2. Brave Search Image API ─────────────────────────────────────────────────
async function fetchFromBrave(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) return null
  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://api.search.brave.com/res/v1/images/search?q=${q}&count=5&safesearch=strict`
    const res = await fetch(url, {
      headers: {
        'Accept':                'application/json',
        'Accept-Encoding':       'gzip',
        'X-Subscription-Token':  key,
      },
      next:   { revalidate: 86400 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ properties?: { url?: string } }>) {
      const img = r.properties?.url
      if (img && img.startsWith('http')) return img
    }
  } catch { }
  return null
}

// ── 3. Google Custom Search Images ───────────────────────────────────────────
// Free: 100 queries/day, no credit card.
// Setup:
//   a) console.cloud.google.com → New project → Enable "Custom Search JSON API"
//      → Credentials → Create API key → add as GOOGLE_API_KEY
//   b) cse.google.com → New search engine → "Search the entire web"
//      → enable "Image search" → copy CX ID → add as GOOGLE_CSE_ID
async function fetchFromGoogle(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY
  const cx  = process.env.GOOGLE_CSE_ID
  if (!key || !cx) return null
  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${q}&searchType=image&num=5&imgType=photo&imgSize=large&safe=active`
    const res = await fetch(url, {
      next:   { revalidate: 86400 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const item of (data.items ?? []) as Array<{ link?: string }>) {
      const img = item.link
      if (img && img.startsWith('http')) return img
    }
  } catch { }
  return null
}

// ── 4. DuckDuckGo Image Search ────────────────────────────────────────────────
// No API key needed. Works locally; the image-results step (/i.js) returns 403
// on Vercel / server environments — silently falls through.
async function fetchFromDuckDuckGo(query: string, timeoutMs: number): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${query} wine bottle`)

    // Step 1 — fetch the search page to obtain the VQD token DDG requires
    const pageRes = await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs / 2),
    })
    const html = await pageRes.text()

    const vqd =
      html.match(/vqd=['"]([^'"]+)['"]/)?.[1] ??
      html.match(/vqd=([A-Za-z0-9-]+)/)?.[1]
    if (!vqd) return null

    // Step 2 — fetch image results JSON (blocked on Vercel, works locally)
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${q}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&s=0&l=us-en&f=,,,`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Referer':    'https://duckduckgo.com/',
        },
        signal: AbortSignal.timeout(timeoutMs / 2),
      },
    )
    if (!imgRes.ok) return null
    const imgData = await imgRes.json()

    // Filter for plausible bottle photos: skip logos, icons, and tiny images
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
      return url
    }
  } catch { /* network or parse error — silently fall through */ }
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
      next:   { revalidate: 86400 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const p of (data.products ?? []) as Array<{ image_front_url?: string; image_url?: string }>) {
      let img = p.image_front_url ?? p.image_url
      if (!img || !img.startsWith('http')) continue
      img = img.replace(/(\.[a-z]+)$/, '.full$1')  // request full-size image
      return img
    }
  } catch { }
  return null
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function fetchWinePhoto(
  name: string,
  producer: string,
  timeoutMs = 6000,
): Promise<string | null> {
  const query = `${producer} ${name}`.trim()

  // Keyed sources first (best quality, reliable from server)
  const bing = await fetchFromBing(query, timeoutMs)
  if (bing) return bing

  const brave = await fetchFromBrave(query, timeoutMs)
  if (brave) return brave

  const google = await fetchFromGoogle(query, timeoutMs)
  if (google) return google

  // Zero-credential sources (DDG is blocked on Vercel but harmless to try)
  const ddg = await fetchFromDuckDuckGo(query, timeoutMs)
  if (ddg) return ddg

  return fetchFromOpenFoodFacts(name, producer, timeoutMs)
}
