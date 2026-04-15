'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { createClient } from '@/lib/supabase/client'
import type { WineType } from '@/types/database'
import type { DrinkingWindowResult } from '@/app/api/drinking-window/route'

const LabelScanner   = dynamic(() => import('@/components/LabelScanner'),   { ssr: false })
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
  wineType?: WineType
  drinkFrom?: number
  peak?: number
  drinkTo?: number
  drinkRationale?: string
}

// Currency symbol → ISO code mapping
const CURRENCY_CODES: Record<string, string> = {
  'A$': 'AUD', '$': 'USD', '£': 'GBP', '€': 'EUR',
  '¥': 'JPY', 'NZ$': 'NZD', 'CA$': 'CAD', 'CHF': 'CHF',
}

function detectWineType(grapes: string[], name: string, region: string): WineType {
  const text = `${name} ${region}`.toLowerCase()
  if (
    text.includes('champagne') || text.includes('prosecco') || text.includes('cava') ||
    text.includes('sparkling') || text.includes('crémant') || text.includes('cremant') ||
    text.includes('pétillant') || text.includes('pet nat') ||
    grapes.some(g => g.toLowerCase().includes('champagne'))
  ) return 'Champagne'
  if (text.includes('rosé') || text.includes('rose') || text.includes('rosado') || text.includes('rosato')) return 'Rosé'
  const WHITE = ['chardonnay','sauvignon blanc','riesling','pinot grigio','pinot gris',
    'gewürztraminer','viognier','chenin blanc','muscat','albariño','torrontés',
    'grüner veltliner','verdejo','falanghina','greco','fiano','vermentino','assyrtiko',
    'arneis','cortese','trebbiano','marsanne','roussanne','sémillon','semillon',
    'melon de bourgogne','white burgundy']
  if (grapes.some(g => WHITE.some(w => g.toLowerCase().includes(w)))) return 'White'
  if (text.includes(' blanc') || text.includes('bianco') || text.includes('white')) return 'White'
  return 'Red'
}

export default function ScanPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [mode,     setMode]     = useState<ScanMode>('label')
  const [state,    setState]    = useState<ScanState>('scanning')
  const [wine,     setWine]     = useState<ScannedWine | null>(null)
  const [currency, setCurrency] = useState('A$')

  // Load currency preference from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const c = user?.user_metadata?.currency as string | undefined
      if (c) setCurrency(c)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Label flow ──────────────────────────────────────────────
  async function handleCapture(base64Jpeg: string) {
    setState('processing')
    const res  = await fetch('/api/label-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Jpeg }),
    })
    const data = await res.json()
    if (!data.found) { setState(data.noApiKey ? 'no_api_key' : 'not_found'); return }
    await fetchDrinkingWindow(data.wine)
  }

  // ── Barcode flow ────────────────────────────────────────────
  async function handleDetected(barcode: string) {
    setState('processing')
    const res  = await fetch(`/api/wine-lookup?barcode=${encodeURIComponent(barcode)}`)
    const data = await res.json()
    if (!data.found) { setState('not_found'); return }
    await fetchDrinkingWindow(data.wine)
  }

  function handleNoBarcode() { setState('no_barcode') }

  // ── Shared: get drinking window ──────────────────────────────
  async function fetchDrinkingWindow(found: ScannedWine) {
    const detectedType = detectWineType(found.grapes, found.name, found.region)
    if (found.drinkFrom && found.peak && found.drinkTo) {
      setWine({ ...found, wineType: detectedType })
      setState('found')
      return
    }
    setState('estimating')
    const windowRes = await fetch('/api/drinking-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: found.name, producer: found.producer, region: found.region,
        vintage: found.vintage, grapes: found.grapes, wineType: detectedType,
      }),
    })
    const windowData: DrinkingWindowResult = await windowRes.json()
    setWine({
      ...found,
      wineType:       detectedType,
      drinkFrom:      windowData.drinkFrom,
      peak:           windowData.peak,
      drinkTo:        windowData.drinkTo,
      drinkRationale: windowData.rationale,
    })
    setState('found')
  }

  function rescan() { setWine(null); setState('scanning') }
  function switchMode(next: ScanMode) { setMode(next); rescan() }

  const busy = state === 'processing' || state === 'estimating'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Header bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          aria-label="Close"
        >✕</button>

        <div className="flex rounded-full p-1 gap-1" style={{ background: 'rgba(0,0,0,0.6)' }}>
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

        <div className="w-10" />
      </div>

      {/* ── Camera area ── */}
      <div className="flex-1 relative">
        {mode === 'label' ? (
          <LabelScanner onCapture={handleCapture} active={state === 'scanning'} />
        ) : (
          <BarcodeScanner onDetected={handleDetected} onNoBarcode={handleNoBarcode} active={state === 'scanning'} />
        )}

        {/* ── Bottom overlays ── */}
        <div className="absolute bottom-6 left-4 right-4 z-20 flex flex-col items-center gap-3">

          {/* Processing / estimating spinner */}
          {busy && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">
                {state === 'processing'
                  ? (mode === 'label' ? 'Reading label…' : 'Looking up wine…')
                  : 'Estimating drinking window…'}
              </p>
            </div>
          )}

          {/* Barcode scanning hint */}
          {state === 'scanning' && mode === 'barcode' && (
            <p className="text-white text-sm text-center px-4 py-2 rounded-full"
               style={{ background: 'rgba(0,0,0,0.6)' }}>
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
              <button onClick={rescan} className="w-full py-2 text-sm"
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
                <button onClick={() => { setMode('label'); rescan() }}
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
              <button onClick={rescan} className="w-full py-2 text-sm"
                      style={{ color: 'rgba(255,255,255,0.6)' }}>
                Try again
              </button>
            </div>
          )}

          {/* No API key */}
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
                <button onClick={rescan} className="w-full py-2 text-xs"
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
              currency={currency}
              onRescan={rescan}
              onManual={() => setState('manual')}
              onDone={() => router.push('/cellar')}
            />
          )}

          {/* Manual entry */}
          {state === 'manual' && (
            <ManualEntrySheet onDone={() => router.push('/cellar')} onCancel={rescan} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm sheet ────────────────────────────────────────────

function WineConfirmSheet({
  wine,
  currency,
  onRescan,
  onManual,
  onDone,
}: {
  wine: ScannedWine
  currency: string
  onRescan: () => void
  onManual: () => void
  onDone: () => void
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [status,          setStatus]          = useState<'idle' | 'saving' | 'done'>('idle')
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [wineType,        setWineType]        = useState<WineType>(wine.wineType ?? 'Red')
  const [vintage,         setVintage]         = useState<string>(wine.vintage?.toString() ?? '')
  const [purchasePrice,   setPurchasePrice]   = useState('')
  const [purchaseDate,    setPurchaseDate]    = useState('')
  const [showRationale,   setShowRationale]   = useState(false)
  const [existingCount,   setExistingCount]   = useState(0)

  const NOW        = new Date().getFullYear()
  const YEARS      = Array.from({ length: NOW - 1969 }, (_, i) => NOW - i)
  const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']
  const currencyCode = CURRENCY_CODES[currency] ?? 'AUD'

  // Check if this wine is already in the cellar
  useEffect(() => {
    async function checkExisting() {
      const { data: wineMatches } = await supabase
        .from('wines')
        .select('id')
        .ilike('name', wine.name)
      if (!wineMatches?.length) return
      const wineIds = wineMatches.map(w => w.id)
      const { data: bottles } = await supabase
        .from('cellar_bottles')
        .select('quantity')
        .in('wine_id', wineIds)
      const total = (bottles ?? []).reduce((s, b) => s + (b.quantity ?? 0), 0)
      setExistingCount(total)
    }
    checkExisting()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wine.name])

  async function save(action: 'cellar' | 'note' | 'both') {
    setStatus('saving')
    setSaveError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('idle'); return }

    // Use RPC to bypass RLS — same approach as /add page
    const { data: cellarId, error: rpcErr } = await supabase.rpc('get_or_create_cellar')
    if (rpcErr || !cellarId) {
      setSaveError('Could not access your cellar. Please try again.')
      setStatus('idle')
      return
    }

    const { data: wineRow, error: wineErr } = await supabase
      .from('wines')
      .insert({
        user_id:      user.id,
        cellar_id:    cellarId,
        name:         wine.name,
        producer:     wine.producer,
        region:       wine.region,
        appellation:  wine.country,
        vintage:      vintage ? parseInt(vintage) : wine.vintage,
        grapes:       wine.grapes,
        critic_score: wine.criticScore,
        db_source:    wine.source,
      })
      .select()
      .single()

    if (wineErr || !wineRow) {
      setSaveError(wineErr?.message ?? 'Failed to save wine.')
      setStatus('idle')
      return
    }

    if (action === 'cellar' || action === 'both') {
      await supabase.from('cellar_bottles').insert({
        user_id:           user.id,
        cellar_id:         cellarId,
        added_by:          user.id,
        wine_id:           wineRow.id,
        wine_type:         wineType,
        quantity:          1,
        drink_from:        wine.drinkFrom,
        peak:              wine.peak,
        drink_to:          wine.drinkTo,
        market_price:      wine.price_aud,
        market_currency:   currencyCode,
        purchase_price:    purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_currency: currencyCode,
        purchase_date:     purchaseDate || null,
      })
    }

    // 'note' and 'both' → navigate to the note-entry page with the new wine pre-selected
    if (action === 'note' || action === 'both') {
      router.push(`/notes/new?wine_id=${wineRow.id}`)
      return
    }

    setStatus('done')
    setTimeout(onDone, 600)
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#3a1a20' }}>

      {/* ── Hero ── */}
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
          {[wine.grapes[0], wine.region, wine.vintage?.toString()].filter(Boolean).map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {wine.price_aud && (
            <span className="text-white font-bold text-sm">{currency}{wine.price_aud}</span>
          )}
          {wine.drinkFrom && (
            <div className="text-xs text-white/80 flex items-center gap-1 flex-wrap">
              <span>🍷</span>
              <span>Drink {wine.drinkFrom}–{wine.drinkTo} · Peak {wine.peak}</span>
              {/* Collapsible rationale */}
              <button
                onClick={() => setShowRationale(s => !s)}
                className="px-1.5 py-0.5 rounded font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontSize: 10 }}
              >
                {showRationale ? 'hide' : 'why?'}
              </button>
            </div>
          )}
        </div>

        {showRationale && wine.drinkRationale && (
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {wine.drinkRationale}
          </p>
        )}
      </div>

      {/* ── Existing cellar banner ── */}
      {existingCount > 0 && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
             style={{ background: 'rgba(200,168,75,0.18)', border: '1px solid rgba(200,168,75,0.4)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a84b"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs font-medium" style={{ color: '#c8a84b' }}>
            You already have {existingCount} {existingCount === 1 ? 'bottle' : 'bottles'} of this wine
          </p>
        </div>
      )}

      {/* ── Vintage + wine type ── */}
      <div className="px-3 pt-3 flex gap-3">
        <div className="flex-1">
          <p className="text-xs mb-1.5" style={{ color: '#c4a090' }}>Vintage</p>
          <select
            value={vintage}
            onChange={e => setVintage(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: vintage ? 'white' : '#c4a090', border: 'none' }}
          >
            <option value="">Unknown</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <p className="text-xs mb-1.5" style={{ color: '#c4a090' }}>Wine type</p>
          <select
            value={wineType}
            onChange={e => setWineType(e.target.value as WineType)}
            className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none' }}
          >
            {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Purchase details ── */}
      <div className="px-3 pt-3">
        <p className="text-xs mb-1.5" style={{ color: '#c4a090' }}>
          Purchase details <span style={{ color: '#7a4a54' }}>(optional)</span>
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-lg overflow-hidden"
               style={{ background: 'rgba(255,255,255,0.08)' }}>
            <span className="pl-2.5 text-xs" style={{ color: '#c4a090' }}>{currency}</span>
            <input
              type="number"
              placeholder="Price"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
              className="flex-1 px-2 py-2 text-sm bg-transparent outline-none"
              style={{ color: 'white' }}
            />
          </div>
          <input
            type="date"
            value={purchaseDate}
            onChange={e => setPurchaseDate(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: purchaseDate ? 'white' : '#7a4a54' }}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="p-3 space-y-2">
        {saveError && (
          <p className="text-xs px-3 py-2 rounded-lg text-center"
             style={{ background: 'rgba(255,100,100,0.15)', color: '#ffaaaa' }}>
            {saveError}
          </p>
        )}
        {status === 'done' ? (
          <p className="text-center text-white py-2">✓ Saved!</p>
        ) : (
          <>
            {/* Primary: Add to cellar */}
            <button
              onClick={() => save('cellar')}
              disabled={status === 'saving'}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#8b2035', opacity: status === 'saving' ? 0.6 : 1 }}
            >
              {status === 'saving' ? '…' : 'Add to cellar'}
            </button>

            {/* Secondary: Log a tasting note */}
            <button
              onClick={() => save('note')}
              disabled={status === 'saving'}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'white',
                opacity: status === 'saving' ? 0.6 : 1,
              }}
            >
              {status === 'saving' ? '…' : 'Log a tasting note'}
            </button>

            {/* Tertiary: Both */}
            <button
              onClick={() => save('both')}
              disabled={status === 'saving'}
              className="w-full py-2 rounded-xl text-sm"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.45)',
                opacity: status === 'saving' ? 0.6 : 1,
              }}
            >
              {status === 'saving' ? '…' : 'Add to cellar & log a note'}
            </button>
          </>
        )}

        {/* Scan again + Enter manually — two distinct buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onRescan}
            className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
          >
            Scan again
          </button>
          <button
            onClick={onManual}
            className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
          >
            Enter manually
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Manual entry sheet ───────────────────────────────────────

function ManualEntrySheet({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name,        setName]        = useState('')
  const [producer,    setProducer]    = useState('')
  const [region,      setRegion]      = useState('')
  const [vintage,     setVintage]     = useState('')
  const [wineType,    setWineType]    = useState<WineType>('Red')
  const [status,      setStatus]      = useState<'idle' | 'estimating' | 'saving' | 'done'>('idle')
  const [drinkWindow, setDrinkWindow] = useState<DrinkingWindowResult | null>(null)
  const supabase = createClient()

  async function estimate() {
    if (!name.trim()) return
    setStatus('estimating')
    const res = await fetch('/api/drinking-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, producer, region, vintage: vintage ? parseInt(vintage) : null, wineType }),
    })
    setDrinkWindow(await res.json())
    setStatus('idle')
  }

  async function save() {
    if (!name.trim()) return
    setStatus('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberRow } = await supabase
      .from('cellar_members')
      .select('cellar_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    const cellarId = memberRow?.cellar_id ?? null

    const { data: wineRow } = await supabase.from('wines').insert({
      user_id:   user.id,
      cellar_id: cellarId,
      name:      name.trim(),
      producer:  producer.trim(),
      region:    region.trim(),
      vintage:   vintage ? parseInt(vintage) : null,
      grapes:    [],
      db_source: 'Manual entry',
    }).select().single()

    if (wineRow) {
      await supabase.from('cellar_bottles').insert({
        user_id:    user.id,
        cellar_id:  cellarId,
        added_by:   user.id,
        wine_id:    wineRow.id,
        wine_type:  wineType,
        quantity:   1,
        drink_from: drinkWindow?.drinkFrom,
        peak:       drinkWindow?.peak,
        drink_to:   drinkWindow?.drinkTo,
      })
    }

    setStatus('done')
    setTimeout(onDone, 800)
  }

  const NOW        = new Date().getFullYear()
  const YEARS      = Array.from({ length: NOW - 1969 }, (_, i) => NOW - i)
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

        {drinkWindow ? (
          <div className="text-xs rounded-lg px-3 py-2"
               style={{ background: 'rgba(139,32,53,0.3)', color: '#f5ede6' }}>
            🍷 Drink {drinkWindow.drinkFrom}–{drinkWindow.drinkTo} · Peak {drinkWindow.peak}
            <span className="block mt-0.5 italic opacity-70">{drinkWindow.rationale}</span>
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
