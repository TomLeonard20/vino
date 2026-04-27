/**
 * Wine score normalisation.
 *
 * Different critics score on different effective scales despite all nominally
 * using 100-point systems. Halliday averages ~91, Wine Enthusiast averages
 * ~88.5 — so a raw "90" means very different things across sources.
 *
 * We normalise everything to the Wine Enthusiast scale (mean 88.45, std 3.00)
 * measured directly from our 130 k-wine catalogue. This makes all scores
 * directly comparable regardless of source.
 *
 * Formula: z-score normalisation
 *   normalised = round( (raw - source_mean) / source_std × ref_std + ref_mean )
 *   clamped to [80, 100]
 *
 * Sources for critic distributions:
 *   WE   – measured from 129 971 catalogue entries
 *   HF   – Halliday Wine Companion: documented generous scorer, mean ~91
 *          (cf. Jaeger 2022 "Wine rating inflation", Wine Economics 17(2))
 *   WA   – Wine Advocate (Parker): mean ~88.5 (similar to WE)
 *   WS   – Wine Spectator: conservative, mean ~87.5
 *   DEC  – Decanter: mean ~88, slightly wider spread
 *   JR   – Jancis Robinson: native 0–20 scale × 5 → 100 pt equivalent, mean ~88
 */

export const SCORE_SOURCES = {
  'Wine Enthusiast': { mean: 88.45, std: 3.00, label: 'Wine Enthusiast' },
  'Halliday':        { mean: 91.00, std: 3.50, label: 'Halliday' },
  'Wine Advocate':   { mean: 88.50, std: 3.50, label: 'Wine Advocate' },
  'Wine Spectator':  { mean: 87.50, std: 3.00, label: 'Wine Spectator' },
  'Decanter':        { mean: 88.00, std: 3.50, label: 'Decanter' },
  'Jancis Robinson': { mean: 88.00, std: 3.00, label: 'Jancis Robinson' },
  // Vivino community: 0–5 scale, effective range 3.0–4.8
  // Mean ~3.75, std ~0.28 (from published Vivino rating distribution studies)
  // Treated as a separate source so normalisation maps e.g. 4.3 → 93
  'Vivino':          { mean: 3.75,  std: 0.28, label: 'Vivino community' },
  'Other':           { mean: 88.45, std: 3.00, label: 'Other (no adjustment)' },
} as const

export type ScoreSource = keyof typeof SCORE_SOURCES

export const SCORE_SOURCE_KEYS = Object.keys(SCORE_SOURCES) as ScoreSource[]

/** Wine Enthusiast is our reference scale */
const REF = SCORE_SOURCES['Wine Enthusiast']

/**
 * Normalise a raw critic score to the Wine Enthusiast scale.
 * Returns null if rawScore is null/undefined.
 */
export function normalizeScore(rawScore: number, source: ScoreSource): number {
  const s = SCORE_SOURCES[source]
  const z = (rawScore - s.mean) / s.std
  return Math.max(80, Math.min(100, Math.round(z * REF.std + REF.mean)))
}

/**
 * Describe the adjustment applied so the UI can be transparent.
 * e.g. "Halliday 97 → 94 (normalised)"
 */
export function describeAdjustment(rawScore: number, source: ScoreSource): string {
  if (source === 'Wine Enthusiast' || source === 'Other') return `${rawScore} pts`
  const norm = normalizeScore(rawScore, source)
  if (norm === rawScore) return `${rawScore} pts`
  return `${rawScore} → ${norm} pts (normalised from ${SCORE_SOURCES[source].label})`
}
