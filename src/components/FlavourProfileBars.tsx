'use client'

import { useEffect, useState } from 'react'
import type { FlavourProfile } from '@/types/database'

const ATTRIBUTES: { key: keyof FlavourProfile; label: string }[] = [
  { key: 'body',      label: 'Body' },
  { key: 'tannins',   label: 'Tannins' },
  { key: 'acidity',   label: 'Acidity' },
  { key: 'alcohol',   label: 'Alcohol' },
  { key: 'sweetness', label: 'Sweetness' },
  { key: 'fruit',     label: 'Fruit character' },
  { key: 'oak',       label: 'Oak' },
  { key: 'finish',    label: 'Finish' },
]

function levelLabel(value: number): string {
  if (value < 0) return '—'
  if (value < 26) return 'Low'
  if (value < 51) return 'Medium–'
  if (value < 76) return 'Medium+'
  return 'High'
}

export default function FlavourProfileBars({ profile }: { profile: FlavourProfile }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setTimeout(() => setAnimated(true), 50) }, [])

  return (
    <div className="space-y-2">
      {ATTRIBUTES.map(({ key, label }) => {
        const value = profile[key] as number
        const pct = value >= 0 ? value : 0
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs w-28 shrink-0" style={{ color: '#a07060' }}>{label}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#d4b8aa', opacity: 0.5 }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: animated ? `${pct}%` : '0%',
                  background: '#8b2035',
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="text-xs w-16 shrink-0" style={{ color: '#a07060' }}>
              {levelLabel(value)}
            </span>
          </div>
        )
      })}
      <p className="text-xs pt-1" style={{ color: '#c4a090' }}>Source: Wine database</p>
    </div>
  )
}
