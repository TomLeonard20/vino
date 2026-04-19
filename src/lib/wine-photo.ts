/**
 * Fetch a real bottle photo from Open Food Facts.
 * Results are cached by Next.js for 24 hours (server-side),
 * so the same wine won't hit the network more than once per day.
 */
export async function fetchWinePhoto(
  name: string,
  producer: string,
  timeoutMs = 4000,
): Promise<string | null> {
  try {
    const q   = encodeURIComponent(`${producer} ${name}`.trim())
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=5`
    const res = await fetch(url, {
      next:   { revalidate: 86400 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = await res.json()
    const products: { image_front_url?: string; image_url?: string }[] = data.products ?? []
    for (const p of products) {
      const img = p.image_front_url ?? p.image_url
      if (img && typeof img === 'string' && img.startsWith('http')) return img
    }
  } catch { /* timeout or network error — silently fall back to SVG */ }
  return null
}
