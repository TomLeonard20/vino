'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { createClient } from '@/lib/supabase/client'
import type { WineType } from '@/types/database'
import type { DrinkingWindowResult } from '@/app/api/drinking-window/route'

const LabelScanner  = dynamic(() => import('@/components/LabelScanner'),  { ssr: false })
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

type ScanMode  = 'label' | 'barcode'
type ScanState = 'scanning' | 'processing' | 'estimating' | 'found' | 'not_found' | 'no_barcode' | 'no_api_key' | 'manual'

interface ScannedWine {
  name: string
  producer: string
  region: string
  country: string
  vintage: number | null
  grapes: string[]
  criticScore: number | null
  price_aud: number | null
  source: string
  drinkFrom?: number
  peak?: number
  drinkTo?: number
  drinkRationale?: string
}

export default function ScanPage() {
  const router = useRouter()
  const [mode,  setMode]  = useState<ScanMode>('label')
  const [state, setState] = useState<ScanState>('scanning')
  const [wine,  setWine]  = useState<ScannedWine | null>(null)

  // ── Label flow ──────────────────────────────────────────────
  async function handleCapture(base64Jpeg: string) {
    setState('processing')

    const res  = await fetch('/api/label-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Jpeg }),
    })
    const data = await res.json()

    if (!data.found) {
      setState(data.noApiKey ? 'no_api_key' : 'not_found')
      return
    }

    await fetchDrinkingWindow(data.wine)
  }

  // ── Barcode flow ────────────────────────────────────────────
  async function handleDetected(barcode: string) {
    setState('processing')

    const res  = await fetch(`/api/wine-lookup?barcode=${encodeURIComponent(barcode)}`)
    const data = await res.json()

    if (!data.found) {
      // Barcode not in Open Food Facts — switch to label scan so user can
      // photo the label and let Claude read it
      setState('not_found')
      return
    }

    await fetchDrinkingWindow(data.wine)
  }

  function handleNoBarcode() {
    setState('no_barcode')
  }

  // ── Shared: estimate drinking window ───────────────────────
  async function fetchDrinkingWindow(found: ScannedWine) {
    setState('estimating')

    const windowRes = await fetch('/api/drinking-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     found.name,
        producer: found.producer,
        region:   found.region,
        vintage:  found.vintage,
        grapes:   found.grapes,
        wineType: 'Red',
      }),
    })
    const window: DrinkingWindowResult = await windowRes.json()

    setWine({
      ...found,
      drinkFrom:     window.drinkFrom,
      peak:          window.peak,
      drinkTo:       window.drinkTo,
      drinkRationale: window.rationale,
    })
    setState('found')
  }

  function rescan() {
    setWine(null)
    setState('scanning')
  }

  function switchMode(next: ScanMode) {
    setMode(next)
    rescan()
  }

  const busy = state === 'processing' || state === 'estimating'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Header bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-4 pb-2">
        {/* Close */}
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Mode tabs */}
        <div
          className="flex rounded-full p-1 gap-1"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          {(['label', 'barcode'] as ScanMode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: mode === m ? 'white' : 'transparent',
                color:      mode === m ? '#3a1a20' : 'rgba(255,255,255,0.6)',
              }}
            >
              {m === 'label' ? '📷 Scan label' : '▦ Scan barcode'}
            </button>
          ))}
        </div>

        {/* Spacer to balance close button */}
        <div className="w-10" />
      </div>

      {/* ── Camera area ── */}
      <div className="flex-1 relative">
        {mode === 'label' ? (
          <LabelScanner
            onCapture={handleCapture}
            active={state === 'scanning'}
          />
        ) : (
          <BarcodeScanner
            onDetected={handleDetected}
            onNoBarcode={handleNoBarcode}
            active={state === 'scanning'}
          />
        )}

        {/* ── Bottom overlays ── */}
        <div className="absolute bottom-6 left-4 right-4 z-20 flex flex-col items-center gap-3">

          {/* Processing / estimating spinner */}
          {busy && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.75)' }}
            >
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">
                {state === 'processing'
                  ? (mode === 'label' ? 'Reading label…' : 'Looking up wine…')
                  : 'Estimating drinking window…'}
              </p>
            </div>
          )}

          {/* Barcode mode: scanning hint */}
          {state === 'scanning' && mode === 'barcode' && (
            <p
              className="text-white text-sm text-center px-4 py-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            >
              Point at the barcode on the bottle
            </p>
          )}

          {/* No barcode detected */}
          {state === 'no_barcode' && (
            <div className="w-full space-y-2">
              <p className="text-white text-sm text-center px-4 py-2 rounded-full"
                 style={{ background: 'rgba(0,0,0,0.6)' }}>
                No barcode detected
              </p>
              <button onClick={() => setState('manual')}
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                      style={{ background: '#8b2035' }}>
                Enter wine manually
              </button>
              <button onClick={rescan}
                      className="w-full py-2 text-sm"
                      style={{ color: 'rgba(255,255,255,0.6)' }}>
                Try scanning again
              </button>
            </div>
          )}

          {/* Not found */}
          {state === 'not_found' && (
            <div className="w-full space-y-2">
              <p className="text-white text-sm text-center px-4 py-2 rounded-full"
                 style={{ background: 'rgba(0,0,0,0.6)' }}>
                {mode === 'label' ? "Couldn't read the label — try again" : "Barcode not in database"}
              </p>
              {mode === 'barcode' && (
                <button
                  onClick={() => { setMode('label'); rescan() }}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                  style={{ background: '#8b2035' }}>
                  📷 Scan the label instead
                </button>
              )}
              <button onClick={() => setState('manual')}
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                      style={{ background: mode === 'label' ? '#8b2035' : 'rgba(255,255,255,0.15)' }}>
                Enter wine manually
              </button>
              <button onClick={rescan}
                      className="w-full py-2 text-sm"
                      style={{ color: 'rgba(255,255,255,0.6)' }}>
                Try again
              </button>
            </div>
          )}

          {/* No API key configured */}
          {state === 'no_api_key' && (
            <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#3a1a20' }}>
              <div className="p-4 space-y-3">
                <p className="font-semibold text-white text-sm">AI label scan not configured</p>
                <p className="text-xs leading-relaxed" style={{ color: '#c4a090' }}>
                  Label scanning uses Claude AI to read your bottle. To enable it, add your{' '}
                  <span className="text-white font-medium">ANTHROPIC_API_KEY</span>{' '}
                  to Vercel → Project Settings → Environment Variables, then redeploy.
                </p>
                <button onClick={() => setState('manual')}
                        className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                        style={{ background: '#8b2035' }}>
                  Enter wine manually instead
                </button>
                <button onClick={rescan}
                        className="w-full py-2 text-xs"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Found → confirm sheet */}
          {state === 'found' && wine && (
            <WineConfirmSheet
              wine={wine}
              onRescan={rescan}
              onDone={() => router.push('/cellar')}
            />
          )}

          {/* Manual entry */}
          {state === 'manual' && (
            <ManualEntrySheet
              onDone={() => router.push('/cellar')}
              onCancel={rescan}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm sheet ────────────────────────────────────────────

function WineConfirmSheet({
  wine,
  onRescan,
  onDone,
}: {
  wine: ScannedWine
  onRescan: () => void
  onDone: () => void
}) {
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'done'>('idle')
  const [wineType, setWineType] = useState<WineType>('Red')
  const supabase = createClient()

  async function save(action: 'cellar' | 'note' | 'both') {
    setStatus('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: wineRow, error: wineErr } = await supabase
      .from('wines')
      .insert({
        user_id:      user.id,
        name:         wine.name,
        producer:     wine.producer,
        region:       wine.region,
        appellation:  wine.country,
        vintage:      wine.vintage,
        grapes:       wine.grapes,
        critic_score: wine.criticScore,
        db_source:    wine.source,
      })
      .select()
      .single()

    if (wineErr || !wineRow) {
      console.error(wineErr)
      setStatus('idle')
      return
    }

    if (action === 'cellar' || action === 'both') {
      await supabase.from('cellar_bottles').insert({
        user_id:        user.id,
        wine_id:        wineRow.id,
        wine_type:      wineType,
        quantity:       1,
        drink_from:     wine.drinkFrom,
        peak:           wine.peak,
        drink_to:       wine.drinkTo,
        market_price:   wine.price_aud,
        market_currency: 'AUD',
      })
    }

    if (action === 'note' || action === 'both') {
      await supabase.from('tasting_notes').insert({
        user_id:   user.id,
        wine_id:   wineRow.id,
        mode:      'quick',
        score:     88,
        stars:     3,
        free_text: '',
      })
    }

    setStatus('done')
    setTimeout(onDone, 800)
  }

  const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#3a1a20' }}>
      {/* Hero */}
      <div className="p-4 space-y-2" style={{ background: '#8b2035' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight">{wine.name}</p>
            {wine.producer && (
              <p className="text-white/70 text-xs mt-0.5">{wine.producer}</p>
            )}
          </div>
          <ScoreBadge score={wine.criticScore} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[wine.grapes[0], wine.region, wine.vintage?.toString()]
            .filter(Boolean)
            .map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {tag}
              </span>
            ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {wine.price_aud && (
            <span className="text-white font-bold text-sm">
              A${wine.price_aud}
            </span>
          )}
          {wine.drinkFrom && (
            <div className="text-xs text-white/80 flex items-center gap-1">
              <span>🍷</span>
              <span>Drink {wine.drinkFrom}–{wine.drinkTo} · Peak {wine.peak}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded text-white/60"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                AI estimate
              </span>
            </div>
          )}
        </div>
        {wine.drinkRationale && (
          <p className="text-xs text-white/60 italic">{wine.drinkRationale}</p>
        )}
      </div>

      {/* Wine type selector */}
      <div className="px-3 pt-3">
        <p className="text-xs mb-1.5" style={{ color: '#c4a090' }}>Wine type</p>
        <div className="flex gap-1.5">
          {WINE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setWineType(t)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: wineType === t ? '#8b2035' : 'rgba(255,255,255,0.08)',
                color:      wineType === t ? 'white'   : '#c4a090',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        {status === 'done' ? (
          <p className="text-center text-white py-2">✓ Saved!</p>
        ) : (
          <>
            {(['cellar', 'note', 'both'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => save(opt)}
                disabled={status === 'saving'}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: '#f5ede6',
                  color: '#3a1a20',
                  opacity: status === 'saving' ? 0.6 : 1,
                }}
              >
                {status === 'saving' ? '…' : (
                  opt === 'cellar' ? 'Add to cellar' :
                  opt === 'note'   ? 'Log a tasting note' :
                                     'Both'
                )}
              </button>
            ))}
          </>
        )}
        <button
          onClick={onRescan}
          className="w-full text-xs py-1.5"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Scan again · Enter manually
        </button>
      </div>
    </div>
  )
}

// ─── Manual entry sheet ───────────────────────────────────────

function ManualEntrySheet({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name,     setName]     = useState('')
  const [producer, setProducer] = useState('')
  const [region,   setRegion]   = useState('')
  const [vintage,  setVintage]  = useState('')
  const [wineType, setWineType] = useState<WineType>('Red')
  const [status,   setStatus]   = useState<'idle' | 'estimating' | 'saving' | 'done'>('idle')
  const [window,   setWindow]   = useState<DrinkingWindowResult | null>(null)
  const supabase = createClient()

  async function estimate() {
    if (!name.trim()) return
    setStatus('estimating')
    const res = await fetch('/api/drinking-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, producer, region, vintage: vintage ? parseInt(vintage) : null, wineType }),
    })
    setWindow(await res.json())
    setStatus('idle')
  }

  async function save() {
    if (!name.trim()) return
    setStatus('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: wineRow } = await supabase
      .from('wines')
      .insert({
        user_id:  user.id,
        name:     name.trim(),
        producer: producer.trim(),
        region:   region.trim(),
        vintage:  vintage ? parseInt(vintage) : null,
        grapes:   [],
        db_source: 'Manual entry',
      })
      .select()
      .single()

    if (wineRow) {
      await supabase.from('cellar_bottles').insert({
        user_id:    user.id,
        wine_id:    wineRow.id,
        wine_type:  wineType,
        quantity:   1,
        drink_from: window?.drinkFrom,
        peak:       window?.peak,
        drink_to:   window?.drinkTo,
      })
    }

    setStatus('done')
    setTimeout(onDone, 800)
  }

  const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

  const inputStyle = {
    background:  'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    color:       'white',
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#3a1a20' }}>
      <div className="p-4 space-y-3">
        <p className="font-semibold text-white text-sm">Enter wine details</p>

        <input value={name} onChange={e => setName(e.target.value)}
               placeholder="Wine name *" className="w-full px-3 py-2 rounded-lg text-sm border"
               style={inputStyle} />
        <div className="grid grid-cols-2 gap-2">
          <input value={producer} onChange={e => setProducer(e.target.value)}
                 placeholder="Producer" className="px-3 py-2 rounded-lg text-sm border"
                 style={inputStyle} />
          <input value={vintage} onChange={e => setVintage(e.target.value)}
                 placeholder="Vintage" type="number" min="1900" max="2099"
                 className="px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
        </div>
        <input value={region} onChange={e => setRegion(e.target.value)}
               placeholder="Region" className="w-full px-3 py-2 rounded-lg text-sm border"
               style={inputStyle} />

        <div className="flex gap-1.5">
          {WINE_TYPES.map(t => (
            <button key={t} onClick={() => setWineType(t)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: wineType === t ? '#8b2035' : 'rgba(255,255,255,0.08)',
                      color:      wineType === t ? 'white'   : '#c4a090',
                    }}>
              {t}
            </button>
          ))}
        </div>

        {window ? (
          <div className="text-xs rounded-lg px-3 py-2"
               style={{ background: 'rgba(139,32,53,0.3)', color: '#f5ede6' }}>
            🍷 Drink {window.drinkFrom}–{window.drinkTo} · Peak {window.peak}
            <span className="block mt-0.5 italic opacity-70">{window.rationale}</span>
          </div>
        ) : (
          <button onClick={estimate} disabled={!name.trim() || status === 'estimating'}
                  className="w-full py-2 rounded-lg text-xs font-medium border"
                  style={{
                    borderColor: '#8b2035',
                    color:       '#f5ede6',
                    opacity:     !name.trim() || status === 'estimating' ? 0.5 : 1,
                  }}>
            {status === 'estimating' ? '✨ Estimating…' : '✨ Estimate drinking window with AI'}
          </button>
        )}

        {status === 'done' ? (
          <p className="text-center text-white py-1">✓ Saved!</p>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#c4a090' }}>
              Cancel
            </button>
            <button onClick={save} disabled={!name.trim() || status === 'saving'}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{
                      background: '#8b2035',
                      opacity: !name.trim() || status === 'saving' ? 0.5 : 1,
                    }}>
              {status === 'saving' ? 'Saving…' : 'Add to cellar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
