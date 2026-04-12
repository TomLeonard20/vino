import { NextRequest, NextResponse } from 'next/server'

export interface DrinkingWindowResult {
  drinkFrom: number
  peak: number
  drinkTo: number
  rationale: string
  isEstimate: true
}

const STUB: DrinkingWindowResult = {
  drinkFrom: new Date().getFullYear(),
  peak: new Date().getFullYear() + 5,
  drinkTo: new Date().getFullYear() + 12,
  rationale: 'Add your Anthropic API key to get AI-powered drinking window estimates.',
  isEstimate: true,
}

export async function POST(req: NextRequest) {
  const { name, producer, region, vintage, grapes, wineType } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('sk-ant-REPLACE')) {
    return NextResponse.json(STUB)
  }

  const currentYear = new Date().getFullYear()

  const prompt = `You are a master sommelier. Estimate the drinking window for this wine:

Name: ${name}
Producer: ${producer || 'Unknown'}
Region: ${region || 'Unknown'}
Vintage: ${vintage ?? 'Unknown'}
Grape varieties: ${grapes?.join(', ') || 'Unknown'}
Wine type: ${wineType || 'Unknown'}
Current year: ${currentYear}

Respond with ONLY valid JSON — no markdown, no prose:
{
  "drinkFrom": <year as integer>,
  "peak": <year as integer>,
  "drinkTo": <year as integer>,
  "rationale": "<one sentence explanation, max 100 characters>"
}

Rules:
- drinkFrom must be >= ${currentYear} if the wine is not yet ready, or the vintage year if already open
- peak must be between drinkFrom and drinkTo
- Base estimates on the wine's style, region, and vintage
- If vintage is unknown, assume ${currentYear - 2}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`)

    const data = await res.json()
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const parsed = JSON.parse(text)

    return NextResponse.json({
      drinkFrom: parsed.drinkFrom,
      peak: parsed.peak,
      drinkTo: parsed.drinkTo,
      rationale: parsed.rationale,
      isEstimate: true,
    } satisfies DrinkingWindowResult)
  } catch (err) {
    console.error('Drinking window estimation failed:', err)
    return NextResponse.json(STUB)
  }
}
