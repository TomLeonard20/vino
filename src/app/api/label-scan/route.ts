import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USD_TO_AUD  = 1.58
const CURRENT_YEAR = new Date().getFullYear()

export interface LabelScanResult {
  name:          string
  producer:      string
  region:        string
  country:       string   // stored in wines.appellation
  vintage:       number | null
  grapes:        string[]
  wineType:      'Red' | 'White' | 'Rosé' | 'Champagne' | 'Sparkling' | 'Dessert'
  source:        'label_scan' | 'catalogue'
  criticScore:   number | null
  price_aud:     number | null
  description:   string
  // Drinking window — returned inline so we avoid a second API call
  drinkFrom?:    number
  peak?:         number
  drinkTo?:      number
  drinkRationale?: string
}

/** Strip markdown code fences that Claude sometimes adds despite instructions */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

/** After reading the label, search the catalogue for price/score enrichment */
async function enrichFromCatalogue(name: string, producer: string, vintage: number | null) {
  try {
    const supabase = await createClient()
    const q = [producer, name, vintage?.toString()].filter(Boolean).join(' ')

    const { data } = await supabase
      .from('wine_catalogue')
      .select('points,price_usd,variety,country,region,description')
      .textSearch('search_vector', q.split(/\s+/).filter(w => w.length > 1).map(w => `${w}:*`).join(' & '), { type: 'websearch' })
      .order('points', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    return {
      criticScore: data.points    ?? null,
      price_aud:   data.price_usd ? Math.round(data.price_usd * USD_TO_AUD) : null,
      grapes:      data.variety   ? [data.variety] : [],
      region:      data.region    ?? '',
      country:     data.country   ?? '',
      description: data.description ?? '',
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { image } = await request.json() as { image: string }

  if (!image) {
    return NextResponse.json({ found: false, error: 'No image provided' }, { status: 400 })
  }

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    return NextResponse.json({ found: false, noApiKey: true })
  }

  const client = new Anthropic({ apiKey })

  try {
    // Single Haiku call: read label + estimate drinking window in one shot
    // Haiku is ~4× faster than Sonnet for structured extraction tasks
    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
            },
            {
              type: 'text',
              text: `Wine label → raw JSON only, no markdown:
{"name":"","producer":"","region":"","vintage":2020,"grapes":[],"wineType":"Red","drinkFrom":${CURRENT_YEAR},"peak":${CURRENT_YEAR + 3},"drinkTo":${CURRENT_YEAR + 8},"drinkRationale":"<80 chars","unreadable":false}
wineType: Red|White|Rosé|Champagne|Sparkling|Dessert. vintage: int or null. Set unreadable:true if not a wine label.`,
            },
          ],
        },
      ],
    })

    const rawText = (message.content[0] as { type: string; text: string }).text
    const cleaned = extractJson(rawText)

    let parsed: LabelScanResult & { unreadable?: boolean; drinkFrom?: number; peak?: number; drinkTo?: number; drinkRationale?: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('JSON parse failed. Raw response:', rawText)
      return NextResponse.json({ found: false, error: 'Could not parse label response' })
    }

    if (parsed.unreadable) {
      return NextResponse.json({ found: false, error: 'Could not read label' })
    }

    const name     = parsed.name     || 'Unknown wine'
    const producer = parsed.producer || ''
    const vintage  = parsed.vintage  ?? null

    // Catalogue enrichment runs in parallel (no API call — just Supabase)
    const enriched = await enrichFromCatalogue(name, producer, vintage)

    return NextResponse.json({
      found: true,
      wine: {
        name,
        producer,
        region:         enriched?.region      || parsed.region   || '',
        country:        enriched?.country     || '',
        vintage,
        grapes:         enriched?.grapes?.length ? enriched.grapes : (Array.isArray(parsed.grapes) ? parsed.grapes : []),
        wineType:       parsed.wineType || 'Red',
        source:         'label_scan' as const,
        criticScore:    enriched?.criticScore ?? null,
        price_aud:      enriched?.price_aud   ?? null,
        description:    enriched?.description ?? '',
        // Drinking window inline — client skips second API call
        drinkFrom:      parsed.drinkFrom,
        peak:           parsed.peak,
        drinkTo:        parsed.drinkTo,
        drinkRationale: parsed.drinkRationale,
      } satisfies LabelScanResult,
    })
  } catch (err) {
    console.error('Label scan error:', err)
    return NextResponse.json({ found: false, error: 'Failed to analyse label' }, { status: 500 })
  }
}
