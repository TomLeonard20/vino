'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ScoreBadge from '@/components/ui/ScoreBadge'

// Load scanner client-side only (needs browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

interface WineRecord {
  name: string
  producer: string
  region: string
  vintage: number | null
  grapes: string[]
  criticScore: number | null
  drinkFrom: number | null
  peak: number | null
  drinkTo: number | null
}

type ScanState = 'scanning' | 'no_barcode' | 'looking_up' | 'found' | 'not_found' | 'error'

// Stub wine lookup — replace with real Wine Searcher API in Phase 2
async function lookupBarcode(barcode: string): Promise<WineRecord | null> {
  await new Promise(r => setTimeout(r, 800))
  // Demo: return a result for any scan so users can see the full flow
  return {
    name: 'Penfolds Grange',
    producer: 'Penfolds',
    region: 'South Australia',
    vintage: 2018,
    grapes: ['Shiraz'],
    criticScore: 98,
    drinkFrom: 2024,
    peak: 2032,
    drinkTo: 2048,
  }
}

export default function ScanPage() {
  const router = useRouter()
  const [state, setState] = useState<ScanState>('scanning')
  const [wine, setWine] = useState<WineRecord | null>(null)
  const [barcode, setBarcode] = useState('')

  async function handleDetected(code: string) {
    setBarcode(code)
    setState('looking_up')
    const result = await lookupBarcode(code)
    if (result) {
      setWine(result)
      setState('found')
    } else {
      setState('not_found')
    }
  }

  function handleNoBarcode() {
    setState('no_barcode')
  }

  function rescan() {
    setWine(null)
    setBarcode('')
    setState('scanning')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Close button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        aria-label="Close scanner"
      >
        ✕
      </button>

      {/* Camera — full screen */}
      <div className="flex-1 relative">
        <BarcodeScanner
          onDetected={handleDetected}
          onNoBarcode={handleNoBarcode}
          active={state === 'scanning'}
        />

        {/* Status overlay */}
        <div className="absolute bottom-6 left-4 right-4 z-20 flex flex-col items-center gap-3">
          {state === 'scanning' && (
            <p className="text-white text-sm text-center px-4 py-2 rounded-full"
               style={{ background: 'rgba(0,0,0,0.6)' }}>
              Point at the barcode on the bottle
            </p>
          )}

          {state === 'looking_up' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                 style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">Looking up wine…</p>
            </div>
          )}

          {state === 'no_barcode' && (
            <div className="w-full space-y-2">
              <p className="text-white text-sm text-center px-4 py-2 rounded-full"
                 style={{ background: 'rgba(0,0,0,0.6)' }}>
                No barcode detected
              </p>
              <button
                onClick={rescan}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: '#8b2035' }}
              >
                Try again
              </button>
            </div>
          )}

          {state === 'not_found' && (
            <div className="w-full space-y-2">
              <p className="text-white text-sm text-center">Wine not recognised</p>
              <button onClick={rescan}
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                      style={{ background: '#8b2035' }}>
                Try again
              </button>
            </div>
          )}

          {state === 'found' && wine && (
            <WineConfirmSheet wine={wine} onRescan={rescan} onDone={() => router.push('/cellar')} />
          )}
        </div>
      </div>
    </div>
  )
}

function WineConfirmSheet({
  wine,
  onRescan,
  onDone,
}: {
  wine: WineRecord
  onRescan: () => void
  onDone: () => void
}) {
  const [action, setAction] = useState<'idle' | 'saving' | 'done'>('idle')
  const [selected, setSelected] = useState<'cellar' | 'note' | 'both' | null>(null)

  async function handleAction(choice: 'cellar' | 'note' | 'both') {
    setSelected(choice)
    setAction('saving')
    // Phase 2: actually insert into Supabase here
    await new Promise(r => setTimeout(r, 700))
    setAction('done')
    setTimeout(onDone, 800)
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#3a1a20' }}>
      {/* Wine hero */}
      <div className="p-4 space-y-2" style={{ background: '#8b2035' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight">{wine.name}</p>
            <p className="text-white/70 text-xs mt-0.5">{wine.producer}</p>
          </div>
          <ScoreBadge score={wine.criticScore} size="md" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[wine.grapes[0], wine.region, wine.vintage?.toString()]
            .filter(Boolean)
            .map(tag => (
              <span key={tag}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {tag}
              </span>
            ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        {action === 'done' ? (
          <p className="text-center text-white text-sm py-2">✓ Done!</p>
        ) : (
          <>
            {(['cellar', 'note', 'both'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => handleAction(opt)}
                disabled={action === 'saving'}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{
                  background: selected === opt && action === 'saving' ? '#c4a090' : '#f5ede6',
                  color: '#3a1a20',
                  opacity: action === 'saving' && selected !== opt ? 0.4 : 1,
                }}
              >
                {opt === 'cellar' && 'Add to cellar'}
                {opt === 'note'   && 'Log a tasting note'}
                {opt === 'both'   && 'Both'}
              </button>
            ))}
          </>
        )}
        <button onClick={onRescan}
                className="w-full text-xs py-1.5 rounded-xl"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
          Rescan · Search manually
        </button>
      </div>
    </div>
  )
}
