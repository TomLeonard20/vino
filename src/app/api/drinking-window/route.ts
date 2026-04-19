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
Vintage: ${vintage ?? 'NV (non-vintage)'}
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
- drinkFrom may be in the past if the wine is already in its drinking window
- peak must be between drinkFrom and drinkTo
- drinkTo must reflect the wine's true ageing potential — do not cut it short
- Base estimates on the specific wine's style, region, vintage, and producer reputation
- Champagne guidance (important — do not underestimate):
  * NV Champagne (no vintage): drink now, peak in 2–3 years, window closes in 5–7 years from ${currentYear}
  * Vintage Champagne from a top house: drinkTo should be vintage + 20 to 30 years
  * Prestige cuvée (Dom Pérignon, Cristal, Belle Époque etc): drinkTo can be vintage + 30 to 40 years
- If vintage is unknown for a non-Champagne wine, use ${currentYear - 3} as a conservative assumption`

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
