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

export async function POST(request: Request) {
  const { image } = await request.json() as { image: string }

  if (!image) {
    return NextResponse.json({ found: false, error: 'No image provided' }, { status: 400 })
  }

  // Strip the data URL prefix to get raw base64
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

  if (!process.env.ANTHROPIC_API_KEY) {
    // Return a stub so the UI still works without the key
    return NextResponse.json({
      found: true,
      wine: {
        name: 'Wine (label scan unavailable)',
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
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
Return ONLY a JSON object with these fields (no markdown, no explanation):
{
  "name": "full wine name",
  "producer": "winery or producer name",
  "region": "appellation or region",
  "vintage": 2019,
  "grapes": ["Cabernet Sauvignon"],
  "wineType": "Red"
}

Rules:
- vintage must be a number (4-digit year) or null if not shown
- wineType must be one of: Red, White, Rosé, Champagne, Sparkling, Dessert
- grapes must be an array of strings (empty array if not shown)
- If you cannot read the label at all, return { "error": "unreadable" }`,
            },
          ],
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    if (raw.includes('"error"')) {
      return NextResponse.json({ found: false, error: 'Could not read label' })
    }

    const parsed = JSON.parse(raw) as LabelScanResult
    return NextResponse.json({
      found: true,
      wine: { ...parsed, source: 'label_scan' as const, criticScore: null },
    })
  } catch (err) {
    console.error('Label scan error:', err)
    return NextResponse.json({ found: false, error: 'Failed to analyse label' }, { status: 500 })
  }
}
