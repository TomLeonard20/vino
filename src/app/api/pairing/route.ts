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
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { meal, bottles }: { meal: string; bottles: BottleSnapshot[] } = await req.json()

  if (!meal?.trim()) {
    return NextResponse.json({ error: 'Meal description is required' }, { status: 400 })
  }
  if (!bottles?.length) {
    return NextResponse.json({ error: 'No bottles in cellar' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    // Return stub data when API key is not configured
    return NextResponse.json(stubResponse(bottles))
  }

  const systemPrompt = `You are a master sommelier AI. Given a meal description and a list of wines with flavour profiles, rank the wines by food pairing suitability and suggest ideal styles.

Respond with ONLY valid JSON matching this schema:
{
  "cellarRankings": [
    { "bottleId": "<string>", "score": <0-100 int>, "reason": "<one sentence max 120 chars>" }
  ],
  "idealStyles": [
    { "name": "<grape or style>", "why": "<one sentence max 120 chars>", "confidence": "Classic" | "Recommended" | "Adventurous" }
  ]
}

Rules:
- Rank ALL wines provided; include every bottleId.
- Ranking is purely flavour-based — ignore drinking window.
- Provide 3–5 ideal styles.
- Return valid JSON only; no markdown, no prose.`

  const userMessage = `Meal: ${meal}\n\nCellar wines:\n${JSON.stringify(bottles, null, 2)}`

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
      { name: 'Barossa Shiraz', why: 'Classic pairing with grilled red meat.', confidence: 'Classic' },
      { name: 'Côtes du Rhône', why: 'Herbal notes bridge the sauce elegantly.', confidence: 'Recommended' },
      { name: 'Argentinian Malbec', why: 'Plummy fruit cuts through the fat.', confidence: 'Adventurous' },
    ],
    _stub: true,
  }
}
