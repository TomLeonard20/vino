'use client'

import { useState } from 'react'

interface StepResult {
  done?:      boolean
  wine?:      string
  result?:    'updated' | 'no_match'
  score?:     number
  priceAud?:  number | null
  matchedTo?: string
  next?:      number
  error?:     string
  message?:   string
}

export default function BackfillPage() {
  const [running,  setRunning]  = useState(false)
  const [log,      setLog]      = useState<StepResult[]>([])
  const [finished, setFinished] = useState(false)

  async function run() {
    setRunning(true)
    setLog([])
    setFinished(false)
    let offset = 0

    while (true) {
      let result: StepResult
      try {
        const res = await fetch(`/api/backfill-scores?offset=${offset}`)
        result = await res.json()
      } catch (e) {
        setLog(l => [...l, { error: String(e) }])
        break
      }

      setLog(l => [...l, result])

      if (result.done || result.error) {
        setFinished(true)
        break
      }

      offset = result.next ?? offset + 1
      // Small pause to avoid hammering Supabase
      await new Promise(r => setTimeout(r, 200))
    }

    setRunning(false)
  }

  const updated   = log.filter(r => r.result === 'updated').length
  const noMatch   = log.filter(r => r.result === 'no_match').length

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Backfill scores & prices</h1>
        <p className="text-sm mt-1" style={{ color: '#a07060' }}>
          Matches every wine in your cellar against the catalogue to fill in missing critic scores and market prices.
        </p>
      </div>

      <button
        onClick={run}
        disabled={running}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white"
        style={{ background: '#8b2035', opacity: running ? 0.6 : 1 }}
      >
        {running ? 'Running…' : 'Start backfill'}
      </button>

      {log.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #d4b8aa' }}>
          {/* Summary bar */}
          <div className="px-4 py-3 flex gap-4 text-sm font-semibold"
               style={{ background: '#ecddd4', color: '#3a1a20' }}>
            <span>✓ Updated: {updated}</span>
            <span style={{ color: '#a07060' }}>— No match: {noMatch}</span>
            <span style={{ color: '#a07060' }}>Total: {log.length}</span>
          </div>

          {/* Log rows */}
          <div className="divide-y max-h-96 overflow-y-auto" style={{ divideColor: '#e8d8cc' } as React.CSSProperties}>
            {[...log].reverse().map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3"
                   style={{ background: '#f5ede6' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#3a1a20' }}>
                    {r.wine ?? r.message ?? r.error ?? 'Done'}
                  </p>
                  {r.matchedTo && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#a07060' }}>
                      → {r.matchedTo}
                    </p>
                  )}
                  {r.result === 'no_match' && (
                    <p className="text-xs mt-0.5" style={{ color: '#c4a090' }}>No catalogue match found</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {r.result === 'updated' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: '#8b2035', color: 'white' }}>
                      {r.score} pts{r.priceAud ? ` · A$${r.priceAud}` : ''}
                    </span>
                  )}
                  {r.done && (
                    <span className="text-xs font-semibold" style={{ color: '#2e7d32' }}>✓ Complete</span>
                  )}
                  {r.error && (
                    <span className="text-xs" style={{ color: '#8b0000' }}>Error</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {finished && (
        <p className="text-center text-sm font-semibold" style={{ color: '#2e7d32' }}>
          ✓ Backfill complete — {updated} wines updated, {noMatch} had no catalogue match.
        </p>
      )}
    </div>
  )
}
