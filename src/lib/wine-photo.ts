/**
 * Wine bottle photo fetcher.
 *
 * Source priority:
 *  1. Bing Image Search  (BING_IMAGE_API_KEY env var — free Azure tier: 1 000 calls/month)
 *  2. Open Food Facts    (no key needed, wine-category filtered)
 *
 * Results are cached by Next.js for 24 hours so the same wine never hits
 * the network more than once per day.
 */

// ── Bing Image Search ─────────────────────────────────────────────────────────
async function fetchFromBing(query: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.BING_IMAGE_API_KEY
  if (!key) return null

  try {
    const q   = encodeURIComponent(`${query} wine bottle`)
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${q}&count=5&imageType=Photo&aspect=Tall&safeSearch=Strict&freshness=Month`
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      next:    { revalidate: 86400 },
      signal:  AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null

    const data = await res.json()
    const values: Array<{ contentUrl?: string; thumbnailUrl?: string }> = data.value ?? []

    // Prefer contentUrl (high-res), fall back to thumbnailUrl (Bing CDN copy)
    for (const v of values) {
      const img = v.contentUrl ?? v.thumbnailUrl
      if (img && img.startsWith('http')) return img
    }
  } catch { /* timeout or API error */ }

  return null
}

// ── Open Food Facts ───────────────────────────────────────────────────────────
async function fetchFromOpenFoodFacts(name: string, producer: string, timeoutMs: number): Promise<string | null> {
  try {
    const q   = encodeURIComponent(`${producer} ${name}`.trim())
    // Filter to wine category so we skip unrelated food products
    const url = [
      'https://world.openfoodfacts.org/cgi/search.pl',
      `?search_terms=${q}`,
      '&search_simple=1',
      '&action=process',
      '&json=1',
      '&page_size=8',
      '&tagtype_0=categories',
      '&tag_contains_0=contains',
      '&tag_0=wine',
    ].join('')

    const res = await fetch(url, {
      next:   { revalidate: 86400 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null

    const data = await res.json()
    const products: {
      image_front_url?: string
      image_url?: string
      product_name?: string
    }[] = data.products ?? []

    for (const p of products) {
      let img = p.image_front_url ?? p.image_url
      if (!img || !img.startsWith('http')) continue

      // Request the "full" size image instead of the default thumbnail.
      // OPF image URLs end in /<hash>.jpg — insert ".full" before the extension.
      img = img.replace(/(\.[a-z]+)$/, '.full$1')

      return img
    }
  } catch { /* timeout or network error */ }

  return null
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function fetchWinePhoto(
  name: string,
  producer: string,
  timeoutMs = 5000,
): Promise<string | null> {
  const query = `${producer} ${name}`.trim()

  // 1. Try Bing first — higher-quality professional bottle shots
  const bing = await fetchFromBing(query, timeoutMs)
  if (bing) return bing

  // 2. Fallback to Open Food Facts
  return fetchFromOpenFoodFacts(name, producer, timeoutMs)
}
