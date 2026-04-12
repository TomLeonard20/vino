import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

export interface LabelScanResult {
  name: string
  producer: string
  region: string
  vintage: number | null
  grapes: string[]
  wineType: 'Red' | 'White' | 'Rosé' | 'Champagne' | 'Sparkling' | 'Dessert'
  source: 'label_scan'
  criticScore: null
}

/** Strip markdown code fences that Claude sometimes adds despite instructions */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

export async function POST(request: Request) {
  const { image } = await request.json() as { image: string }

  if (!image) {
    return NextResponse.json({ found: false, error: 'No image provided' }, { status: 400 })
  }

  // Strip the data URL prefix to get raw base64
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    // Return a stub so the UI still works without the key configured
    return NextResponse.json({
      found: true,
      wine: {
        name: 'Wine (AI label scan — add API key to enable)',
        producer: '',
        region: '',
        vintage: null,
        grapes: [],
        wineType: 'Red',
        source: 'label_scan',
        criticScore: null,
      } satisfies LabelScanResult,
    })
  }

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `Look at this wine label image and extract the wine details.
Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "name": "full wine name",
  "producer": "winery or producer name",
  "region": "appellation or region",
  "vintage": 2019,
  "grapes": ["Cabernet Sauvignon"],
  "wineType": "Red",
  "unreadable": false
}

Rules:
- vintage must be a number (4-digit year) or null if not visible
- wineType must be exactly one of: Red, White, Rosé, Champagne, Sparkling, Dessert
- grapes must be an array of strings (empty array [] if not shown on label)
- If this is not a wine label or you genuinely cannot read it, set "unreadable": true and leave other fields as empty strings/null
- Do NOT wrap in markdown or code blocks — raw JSON only`,
            },
          ],
        },
      ],
    })

    const rawText = (message.content[0] as { type: string; text: string }).text
    const cleaned = extractJson(rawText)

    let parsed: LabelScanResult & { unreadable?: boolean }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('JSON parse failed. Raw response:', rawText)
      return NextResponse.json({ found: false, error: 'Could not parse label response' })
    }

    if (parsed.unreadable) {
      return NextResponse.json({ found: false, error: 'Could not read label' })
    }

    return NextResponse.json({
      found: true,
      wine: {
        name:        parsed.name     || 'Unknown wine',
        producer:    parsed.producer || '',
        region:      parsed.region   || '',
        vintage:     parsed.vintage  ?? null,
        grapes:      Array.isArray(parsed.grapes) ? parsed.grapes : [],
        wineType:    parsed.wineType || 'Red',
        source:      'label_scan' as const,
        criticScore: null,
      } satisfies LabelScanResult,
    })
  } catch (err) {
    console.error('Label scan error:', err)
    return NextResponse.json({ found: false, error: 'Failed to analyse label' }, { status: 500 })
  }
}
