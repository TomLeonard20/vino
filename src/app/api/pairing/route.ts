import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BottleSnapshot {
  bottleId: string
  wineName: string
  producer: string
  vintage: number | null
  wineType: string
  criticScore: number | null
  flavourProfile: {
    body: number; tannins: number; acidity: number; alcohol: number
    sweetness: number; fruit: number; oak: number; finish: number
  } | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { meal, bottles }: { meal: string; bottles: BottleSnapshot[] } = await req.json()

  if (!meal?.trim()) {
    return NextResponse.json({ error: 'Meal description is required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    return NextResponse.json(stubResponse(bottles ?? []))
  }

  const systemPrompt = `You are a master sommelier AI. Given a meal description and (optionally) a list of wines from someone's cellar, do two things:

1. If cellar wines are provided, rank ALL of them by food-pairing suitability (score 0–100).
2. Always suggest 4–5 ideal wine styles or grapes that pair best, each with a pairing score (0–100).

Respond with ONLY valid JSON — no markdown, no prose:
{
  "cellarRankings": [
    { "bottleId": "<string>", "score": <0-100 int>, "reason": "<one sentence, max 120 chars>" }
  ],
  "idealStyles": [
    { "name": "<grape or style>", "score": <0-100 int>, "why": "<one sentence, max 120 chars>", "confidence": "Classic" | "Recommended" | "Adventurous" }
  ]
}

Rules:
- Include EVERY bottleId provided in cellarRankings (empty array if none provided).
- Score reflects flavour compatibility only — ignore drinking window readiness.
- Ideal styles must include a numeric score 0–100 (100 = perfect match).
- Return valid JSON only.`

  const cellarSection = bottles?.length
    ? `\n\nCellar wines:\n${JSON.stringify(bottles, null, 2)}`
    : '\n\nCellar wines: none provided — skip cellarRankings (return empty array).'

  const userMessage = `Meal: ${meal}${cellarSection}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Claude API error:', text)
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  const claude = await response.json()
  const text = claude.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''

  try {
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }
}

function stubResponse(bottles: BottleSnapshot[]) {
  return {
    cellarRankings: bottles.map((b, i) => ({
      bottleId: b.bottleId,
      score: Math.max(40, 95 - i * 12),
      reason: 'The full body and structure complement the richness of this dish beautifully.',
    })),
    idealStyles: [
      { name: 'Barossa Shiraz',      score: 92, why: 'Bold fruit and pepper notes are a classic match.',        confidence: 'Classic'     },
      { name: 'Côtes du Rhône',      score: 85, why: 'Herbal notes bridge the sauce elegantly.',                confidence: 'Recommended' },
      { name: 'Argentinian Malbec',  score: 78, why: 'Plummy fruit cuts through the fat.',                      confidence: 'Recommended' },
      { name: 'Napa Valley Cab Sav', score: 70, why: 'Firm tannins contrast beautifully with rich meat.',       confidence: 'Adventurous' },
    ],
    _stub: true,
  }
}
