import { NextRequest, NextResponse } from 'next/server'

export interface WineFindStyle {
  name: string          // e.g. "Barossa Valley Shiraz"
  grapes: string[]      // e.g. ["Shiraz"]
  regions: string[]     // e.g. ["Barossa Valley", "McLaren Vale"]
  why: string           // one-sentence explanation
  score: number         // 0-100 match score
  priceRange: string    // e.g. "£15–£30"
  confidence: 'Perfect match' | 'Great choice' | 'Worth exploring'
}

export interface WineFindResult {
  query:       string
  styles:      WineFindStyle[]
  sommelierNote: string  // 1-2 sentence overall advice
  _stub?: boolean
}

export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query: string }

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    return NextResponse.json(stubResponse(query))
  }

  const system = `You are a master sommelier. Given a free-text wine description or request, recommend 3–4 wine styles that best match.

Return ONLY valid JSON — no markdown, no prose:
{
  "sommelierNote": "<1-2 sentences of overall advice>",
  "styles": [
    {
      "name": "<style name, e.g. 'Barossa Valley Shiraz'>",
      "grapes": ["<grape 1>"],
      "regions": ["<region 1>", "<region 2>"],
      "why": "<one sentence, max 120 chars>",
      "score": <0-100>,
      "priceRange": "<e.g. £15–£30>",
      "confidence": "Perfect match" | "Great choice" | "Worth exploring"
    }
  ]
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: `Wine request: ${query}` }],
    }),
  })

  if (!response.ok) {
    console.error('Claude API error:', await response.text())
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  const claude = await response.json()
  const text   = claude.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json({ query, ...parsed })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }
}

function stubResponse(query: string): WineFindResult {
  return {
    query,
    sommelierNote: 'Add your Anthropic API key to Vercel to enable real AI recommendations.',
    styles: [
      {
        name:       'Burgundy Pinot Noir',
        grapes:     ['Pinot Noir'],
        regions:    ['Côte de Nuits', 'Côte de Beaune'],
        why:        'Elegant and complex with silky tannins — a classic choice.',
        score:      90,
        priceRange: '£25–£60',
        confidence: 'Perfect match',
      },
      {
        name:       'Marlborough Sauvignon Blanc',
        grapes:     ['Sauvignon Blanc'],
        regions:    ['Marlborough'],
        why:        'Vibrant and fresh with tropical fruit notes.',
        score:      78,
        priceRange: '£12–£20',
        confidence: 'Great choice',
      },
    ],
    _stub: true,
  }
}
