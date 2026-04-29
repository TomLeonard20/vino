'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { WineType } from '@/types/database'
import type { CatalogueWine } from '@/app/api/wine-search/route'
import type { VivinoSuggestion } from '@/app/api/vivino-suggest/route'
import type { DrinkingWindowResult } from '@/app/api/drinking-window/route'

const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']

const WHITE_GRAPES = ['chardonnay','sauvignon blanc','riesling','pinot grigio','pinot gris',
  'gewürztraminer','viognier','chenin blanc','muscat','albariño','torrontés',
  'grüner veltliner','verdejo','falanghina','greco','fiano','vermentino','assyrtiko',
  'arneis','cortese','trebbiano','marsanne','roussanne','sémillon','semillon',
  'melon de bourgogne']

function detectWineType(grapes: string[], name: string, region: string): WineType {
  const text = `${name} ${region}`.toLowerCase()
  if (
    text.includes('champagne') || text.includes('prosecco') || text.includes('cava') ||
    text.includes('sparkling') || text.includes('crémant') || text.includes('cremant') ||
    text.includes('pétillant') || text.includes('pet nat') ||
    grapes.some(g => g.toLowerCase().includes('champagne'))
  ) return 'Champagne'
  if (text.includes('rosé') || text.includes('rose') || text.includes('rosado') || text.includes('rosato')) return 'Rosé'
  if (grapes.some(g => WHITE_GRAPES.some(w => g.toLowerCase().includes(w)))) return 'White'
  if (text.includes(' blanc') || text.includes('bianco') || text.includes('white')) return 'White'
  return 'Red'
}

const NOW = new Date().getFullYear()
const YEARS = Array.from({ length: NOW - 1969 }, (_, i) => NOW - i)

/** Strip embedded vintage years from a wine name — vintage is stored separately */
function cleanWineName(title: string): string {
  return title.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
}

export default function AddWinePage() {
  const router   = useRouter()
  const supabase = createClient()

  // Form fields
  const [name,          setName]          = useState('')
  const [producer,      setProducer]      = useState('')
  const [region,        setRegion]        = useState('')
  const [vintage,       setVintage]       = useState<number | ''>('')
  const [grapes,        setGrapes]        = useState('')
  const [wineType,      setWineType]      = useState<WineType>('Red')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate,  setPurchaseDate]  = useState('')
  const [quantity,      setQuantity]      = useState('1')

  // Typeahead
  const [query,         setQuery]         = useState('')
  const [suggestions,   setSuggestions]   = useState<CatalogueWine[]>([])
  const [vivinoSugs,    setVivinoSugs]    = useState<VivinoSuggestion[]>([])
  const [pendingVivino, setPendingVivino] = useState<VivinoSuggestion | null>(null)
  const [catSearching,  setCatSearching]  = useState(false)
  const [vivSearching,  setVivSearching]  = useState(false)
  const [showDrop,      setShowDrop]      = useState(false)
  const [fromCat,       setFromCat]       = useState(false)
  const [catPoints,     setCatPoints]     = useState<number | null>(null)
  const [catPriceAud,   setCatPriceAud]   = useState<number | null>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestCatRef   = useRef<CatalogueWine[]>([])   // for Vivino dedup

  // Drinking window
  const [drinkWindow, setDrinkWindow] = useState<DrinkingWindowResult | null>(null)
  const [estimating,  setEstimating]  = useState(false)

  // Save
  const [status,    setStatus]    = useState<'idle' | 'saving' | 'done'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Typeahead search ───────────────────────────────────────────
  // Catalogue and Vivino fire independently so catalogue results appear
  // immediately (~100 ms) while Vivino appends when it arrives (~1-2 s).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setSuggestions([]); setVivinoSugs([])
      setShowDrop(false); setCatSearching(false); setVivSearching(false)
      return
    }

    setCatSearching(true)
    setVivSearching(true)

    debounceRef.current = setTimeout(() => {
      const q = encodeURIComponent(query)

      // ── Catalogue (fast) ──────────────────────────────────────
      fetch(`/api/wine-search?q=${q}&limit=8`)
        .then(r => r.json())
        .then(data => {
          const results: CatalogueWine[] = data.results ?? []
          latestCatRef.current = results
          setSuggestions(results)
          setShowDrop(true)
          setCatSearching(false)
        })
        .catch(() => setCatSearching(false))

      // ── Vivino (slower, appends to open dropdown) ─────────────
      fetch(`/api/vivino-suggest?q=${q}`)
        .then(r => r.json())
        .then(data => {
          const vivinoResults: VivinoSuggestion[] = data.results ?? []
          // Dedup against whatever catalogue results arrived
          const catTitles = latestCatRef.current.map(w => w.title.toLowerCase())
          const deduped = vivinoResults.filter(v => {
            const vWords = v.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            return !catTitles.some(t => vWords.filter(w => t.includes(w)).length >= 2)
          })
          setVivinoSugs(deduped)
          setShowDrop(true)
          setVivSearching(false)
        })
        .catch(() => setVivSearching(false))
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const KNOWN_GRAPES = ['Shiraz','Cabernet Sauvignon','Pinot Noir','Chardonnay',
    'Sauvignon Blanc','Riesling','Merlot','Grenache','Nebbiolo','Sangiovese',
    'Tempranillo','Zinfandel','Pinot Gris','Pinot Grigio','Viognier','Malbec',
    'Cabernet Franc','Syrah','Gewürztraminer','Moscato','Prosecco']

  /** Pick a catalogue result — fills all fields immediately */
  function pickSuggestion(w: CatalogueWine) {
    const grapeList = w.variety ? [w.variety] : []
    const detected  = detectWineType(grapeList, w.title, w.region ?? '')
    const cleanName = cleanWineName(w.title)
    setName(cleanName)
    setProducer(w.winery ?? '')
    setRegion(w.region ?? w.province ?? '')
    setGrapes(w.variety ?? '')
    setVintage(w.vintage ?? '')
    setWineType(detected)
    setQuery(cleanName)
    setShowDrop(false)
    setFromCat(true)
    setCatPoints(w.points ?? null)
    setCatPriceAud(w.price_aud ?? null)
    setDrinkWindow(null)
  }

  /** Pick a Vivino grouped result — fills name then shows vintage picker */
  function pickVivinoWine(v: VivinoSuggestion) {
    setQuery(v.title)
    setName(v.title)
    setProducer('')
    setRegion('')
    setGrapes(KNOWN_GRAPES.find(g => v.title.toLowerCase().includes(g.toLowerCase())) ?? '')
    setVintage('')
    setWineType(detectWineType(
      [KNOWN_GRAPES.find(g => v.title.toLowerCase().includes(g.toLowerCase())) ?? ''],
      v.title, '',
    ))
    setCatPoints(v.points)
    setCatPriceAud(null)
    setShowDrop(false)
    setFromCat(true)
    setDrinkWindow(null)
    // If only one vintage known, set it directly; otherwise show picker
    if (v.vintages.length === 1) {
      setVintage(v.vintages[0])
      setPendingVivino(null)
    } else {
      setPendingVivino(v)
    }
  }

  /** Confirm vintage selection from the Vivino picker */
  function pickVivinoVintage(yr: number | '') {
    setVintage(yr)
    setPendingVivino(null)
  }

  // ── Estimate drinking window ───────────────────────────────────
  async function estimate() {
    if (!name.trim()) return
    setEstimating(true)
    const res = await fetch('/api/drinking-window', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, producer, region,
        vintage: vintage || null,
        grapes:  grapes ? [grapes] : [],
        wineType,
      }),
    })
    setDrinkWindow(await res.json())
    setEstimating(false)
  }

  // ── Save to cellar ────────────────────────────────────────────
  async function save() {
    if (!name.trim()) return
    setStatus('saving')
    setSaveError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('idle'); return }

    // Get or create cellar via stored procedure (bypasses RLS)
    const { data: cellarId, error: rpcErr } = await supabase.rpc('get_or_create_cellar')
    if (rpcErr || !cellarId) {
      setSaveError('Could not get your cellar. Please try again.')
      setStatus('idle')
      return
    }

    const { data: wineRow, error: wineErr } = await supabase
      .from('wines')
      .insert({
        user_id:   user.id,
        cellar_id: cellarId,
        name:         cleanWineName(name.trim()),
        producer:     producer.trim(),
        region:       region.trim(),
        vintage:      vintage || null,
        grapes:       grapes ? [grapes] : [],
        critic_score: catPoints,
        db_source:    fromCat ? 'Wine catalogue' : 'Manual entry',
      })
      .select()
      .single()

    if (wineErr || !wineRow) {
      setSaveError(wineErr?.message ?? 'Failed to save wine.')
      setStatus('idle')
      return
    }

    const { error: bottleErr } = await supabase.from('cellar_bottles').insert({
      user_id:           user.id,
      cellar_id:         cellarId,
      added_by:          user.id,
      wine_id:           wineRow.id,
      wine_type:         wineType,
      quantity:          parseInt(quantity) || 1,
      drink_from:        drinkWindow?.drinkFrom ?? null,
      peak:              drinkWindow?.peak      ?? null,
      drink_to:          drinkWindow?.drinkTo   ?? null,
      purchase_price:    purchasePrice ? parseFloat(purchasePrice) : null,
      purchase_currency: 'AUD',
      purchase_date:     purchaseDate || null,
      market_price:      catPriceAud,
      market_currency:   'AUD',
    })

    if (bottleErr) {
      setSaveError(bottleErr.message)
      setStatus('idle')
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/cellar'), 800)
  }

  const inputCls   = "w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
  const inputStyle = { background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }
  const labelStyle = { color: '#a07060', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Add a wine</h1>

      {/* ── Wine name search ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Wine name</p>
        <div className="relative">
          <input
            className={inputCls}
            style={inputStyle}
            placeholder="Search by name, producer or style…"
            value={query}
            onChange={e => { setQuery(e.target.value); setName(e.target.value); setFromCat(false) }}
            onFocus={() => (suggestions.length > 0 || vivinoSugs.length > 0) && setShowDrop(true)}
            autoComplete="off"
          />
          {(catSearching || vivSearching) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                   style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
            </div>
          )}
          {showDrop && (suggestions.length > 0 || vivinoSugs.length > 0 || (!(catSearching || vivSearching) && query.length >= 2)) && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDrop(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-lg"
                   style={{ background: '#f5ede6', border: '1px solid #d4b8aa' }}>

                {/* Catalogue results appear first (fast) */}
                {suggestions.map(w => (
                  <button key={`cat-${w.id}`} onMouseDown={() => pickSuggestion(w)}
                    className="w-full text-left px-4 py-3 border-b flex items-start gap-3"
                    style={{ borderColor: '#e8d8cc' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>{w.title}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#a07060' }}>
                        {[w.winery, w.region, w.vintage].filter(Boolean).join(' · ')}
                        {w.price_aud ? ` · A$${w.price_aud}` : ''}
                      </p>
                    </div>
                    {w.points && <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: '#8b2035', color: 'white' }}>{w.points}</span>}
                  </button>
                ))}

                {/* Vivino results append when they arrive */}
                {vivinoSugs.length > 0 && (
                  <>
                    {suggestions.length > 0 && (
                      <div className="px-4 py-1.5" style={{ background: '#ecddd4' }}>
                        <span className="text-xs font-semibold tracking-wide" style={{ color: '#a07060' }}>Also on Vivino</span>
                      </div>
                    )}
                    {vivinoSugs.map(v => (
                      <button key={`viv-${v.id}`} onMouseDown={() => pickVivinoWine(v)}
                        className="w-full text-left px-4 py-3 border-b flex items-start gap-3"
                        style={{ borderColor: '#e8d8cc' }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>{v.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
                            {v.vintages.slice(0, 3).join(', ')}{v.vintages.length > 3 ? '…' : ''}
                          </p>
                        </div>
                        {v.points && <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: '#8b2035', color: 'white' }}>{v.points}</span>}
                      </button>
                    ))}
                  </>
                )}

                {/* Vivino still loading indicator inside dropdown */}
                {vivSearching && suggestions.length > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#ecddd4' }}>
                    <div className="w-3 h-3 border-2 rounded-full animate-spin shrink-0"
                         style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
                    <span className="text-xs" style={{ color: '#a07060' }}>Searching more sources…</span>
                  </div>
                )}

                {/* Manual entry fallback */}
                <button onMouseDown={() => { setName(query.trim()); setQuery(query.trim()); setShowDrop(false); setFromCat(false) }}
                  className="w-full text-left px-4 py-3 flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: '#ecddd4', color: '#8b2035' }}>+ Use</span>
                  <p className="text-sm font-medium truncate" style={{ color: '#3a1a20' }}>"{query.trim()}"</p>
                  {suggestions.length === 0 && vivinoSugs.length === 0 && !vivSearching && (
                    <p className="text-xs shrink-0" style={{ color: '#a07060' }}>fill details below</p>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
        {fromCat && !pendingVivino && (
          <p className="text-xs mt-1" style={{ color: '#2e7d32' }}>✓ Auto-filled from wine catalogue</p>
        )}
      </div>

      {/* ── Vintage picker (appears after selecting a Vivino wine) ── */}
      {pendingVivino && (
        <div className="rounded-xl px-4 py-3"
             style={{ background: '#ecddd4', border: '1px solid #d4b8aa' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#a07060' }}>
            SELECT VINTAGE FOR {pendingVivino.title.toUpperCase()}
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingVivino.vintages.map(yr => (
              <button key={yr} onClick={() => pickVivinoVintage(yr)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: '#8b2035', color: 'white' }}>
                {yr}
              </button>
            ))}
            <button onClick={() => pickVivinoVintage('')}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: '#f5ede6', color: '#a07060', border: '1px solid #d4b8aa' }}>
              Unknown
            </button>
          </div>
        </div>
      )}

      {/* ── Producer ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Producer</p>
        <input className={inputCls} style={inputStyle}
          placeholder="e.g. Charles Heidsieck"
          value={producer} onChange={e => setProducer(e.target.value)} />
      </div>

      {/* ── Vintage ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Vintage</p>
        <select className={inputCls} style={inputStyle}
          value={vintage}
          onChange={e => setVintage(e.target.value ? parseInt(e.target.value) : '')}>
          <option value="">Unknown</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── Region ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Region</p>
        <input className={inputCls} style={inputStyle}
          placeholder="e.g. Champagne, Barossa Valley"
          value={region} onChange={e => setRegion(e.target.value)} />
      </div>

      {/* ── Grape ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Grape variety</p>
        <input className={inputCls} style={inputStyle}
          placeholder="e.g. Shiraz, Pinot Noir"
          value={grapes} onChange={e => setGrapes(e.target.value)} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {['Shiraz','Cabernet Sauvignon','Pinot Noir','Chardonnay','Sauvignon Blanc','Riesling','Merlot','Grenache','Nebbiolo','Sangiovese'].map(g => (
            <button key={g} onClick={() => setGrapes(g)}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: grapes === g ? '#8b2035' : '#ecddd4',
                color:      grapes === g ? 'white'   : '#a07060',
                border:     '1px solid #d4b8aa',
              }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Wine type ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Wine type</p>
        <div className="flex gap-2">
          {WINE_TYPES.map(t => (
            <button key={t} onClick={() => setWineType(t)}
              className="flex-1 py-2 rounded-xl text-sm font-medium"
              style={{
                background: wineType === t ? '#8b2035' : '#ecddd4',
                color:      wineType === t ? 'white'   : '#a07060',
                border:     '1px solid #d4b8aa',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Price + date ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>
          Purchase details <span style={{ color: '#c4a090', fontWeight: 400 }}>(optional)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Price */}
          <div>
            <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Price</p>
            <div className="flex items-center rounded-xl overflow-hidden border"
                 style={{ background: '#ecddd4', borderColor: '#d4b8aa' }}>
              <span className="pl-3 text-sm" style={{ color: '#a07060' }}>A$</span>
              <input
                type="number"
                placeholder="0.00"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                style={{ color: '#3a1a20' }}
              />
            </div>
          </div>
          {/* Purchase date */}
          <div>
            <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Purchase date</p>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
              style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }}
            />
          </div>
        </div>
      </div>

      {/* ── Quantity ── */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Quantity</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(q => String(Math.max(1, parseInt(q) - 1)))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: '#ecddd4', color: '#3a1a20', border: '1px solid #d4b8aa' }}>
            −
          </button>
          <span className="text-2xl font-bold w-8 text-center" style={{ color: '#3a1a20' }}>{quantity}</span>
          <button
            onClick={() => setQuantity(q => String(parseInt(q) + 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: '#ecddd4', color: '#3a1a20', border: '1px solid #d4b8aa' }}>
            +
          </button>
        </div>
      </div>

      {/* ── Drinking window ── */}
      {drinkWindow ? (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
             style={{ background: '#ecddd4', border: '1px solid #d4b8aa' }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#a07060' }}>Drinking window</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#3a1a20' }}>
              {drinkWindow.drinkFrom}–{drinkWindow.drinkTo} · Peak {drinkWindow.peak}
            </p>
            {drinkWindow.rationale && (
              <p className="text-xs mt-0.5 italic" style={{ color: '#a07060' }}>{drinkWindow.rationale}</p>
            )}
          </div>
          <button onClick={() => setDrinkWindow(null)} className="text-xs" style={{ color: '#c4a090' }}>
            Reset
          </button>
        </div>
      ) : (
        <button
          onClick={estimate}
          disabled={!name.trim() || estimating}
          className="w-full py-3 rounded-xl text-sm font-semibold border"
          style={{
            borderColor: '#8b2035', color: '#8b2035',
            opacity: !name.trim() || estimating ? 0.5 : 1,
          }}>
          {estimating ? '✨ Estimating…' : '✨ Estimate drinking window with AI'}
        </button>
      )}

      {/* ── Error ── */}
      {saveError && (
        <p className="text-sm rounded-xl px-4 py-3" style={{ background: '#fce4ec', color: '#8b0000' }}>
          ⚠ {saveError}
        </p>
      )}

      {/* ── Save ── */}
      {status === 'done' ? (
        <div className="py-4 text-center font-semibold" style={{ color: '#2e7d32' }}>
          ✓ Added to cellar!
        </div>
      ) : (
        <button
          onClick={save}
          disabled={!name.trim() || status === 'saving'}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white"
          style={{
            background: '#8b2035',
            opacity: !name.trim() || status === 'saving' ? 0.5 : 1,
          }}>
          {status === 'saving' ? 'Saving…' : `Add ${quantity} bottle${parseInt(quantity) !== 1 ? 's' : ''} to cellar`}
        </button>
      )}
    </div>
  )
}
