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

const NOW   = new Date().getFullYear()
const YEARS = Array.from({ length: NOW - 1969 }, (_, i) => NOW - i)

function cleanWineName(title: string): string {
  return title.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
}

const KNOWN_GRAPES = ['Shiraz','Cabernet Sauvignon','Pinot Noir','Chardonnay',
  'Sauvignon Blanc','Riesling','Merlot','Grenache','Nebbiolo','Sangiovese',
  'Tempranillo','Zinfandel','Pinot Gris','Pinot Grigio','Viognier','Malbec',
  'Cabernet Franc','Syrah','Gewürztraminer','Moscato','Prosecco']

/** Summary of the wine selected from the dropdown — drives Phase 2 UI */
type PickedWine = {
  title:    string
  winery:   string
  region:   string
  variety:  string
  wineType: WineType
  points:   number | null
  /** Known vintages from Vivino (newest first). Empty = show all years. */
  vintages: number[]
}

const TYPE_BADGE: Record<WineType, { bg: string; text: string }> = {
  'Red':       { bg: '#8b2035', text: 'white'  },
  'White':     { bg: '#8a7440', text: 'white'  },
  'Rosé':      { bg: '#c06070', text: 'white'  },
  'Champagne': { bg: '#9a8050', text: 'white'  },
}

export default function AddWinePage() {
  const router   = useRouter()
  const supabase = createClient()

  // ── Form state (populated by autofill or manual entry) ───────
  const [name,          setName]          = useState('')
  const [producer,      setProducer]      = useState('')
  const [region,        setRegion]        = useState('')
  const [vintage,       setVintage]       = useState<number | ''>('')
  const [grapes,        setGrapes]        = useState('')
  const [wineType,      setWineType]      = useState<WineType>('Red')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate,  setPurchaseDate]  = useState('')
  const [quantity,      setQuantity]      = useState('1')

  // Catalogue metadata (for save)
  const [fromCat,     setFromCat]     = useState(false)
  const [catPoints,   setCatPoints]   = useState<number | null>(null)
  const [catPriceAud, setCatPriceAud] = useState<number | null>(null)

  // Picked wine — drives Phase 2 (detail) UI
  const [picked, setPicked] = useState<PickedWine | null>(null)

  // ── Typeahead ────────────────────────────────────────────────
  const [query,        setQuery]        = useState('')
  const [suggestions,  setSuggestions]  = useState<CatalogueWine[]>([])
  const [vivinoSugs,   setVivinoSugs]   = useState<VivinoSuggestion[]>([])
  const [catSearching, setCatSearching] = useState(false)
  const [vivSearching, setVivSearching] = useState(false)
  const [showDrop,     setShowDrop]     = useState(false)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestCatRef   = useRef<CatalogueWine[]>([])
  const activeQueryRef = useRef<string>('')

  // ── Drinking window ──────────────────────────────────────────
  const [drinkWindow, setDrinkWindow] = useState<DrinkingWindowResult | null>(null)
  const [estimating,  setEstimating]  = useState(false)

  // ── Save ─────────────────────────────────────────────────────
  const [status,    setStatus]    = useState<'idle' | 'saving' | 'done'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Typeahead search ─────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setSuggestions([]); setVivinoSugs([])
      setShowDrop(false); setCatSearching(false); setVivSearching(false)
      return
    }

    setSuggestions([])
    setVivinoSugs([])
    setCatSearching(true)
    setVivSearching(true)
    setShowDrop(true)
    activeQueryRef.current = query

    debounceRef.current = setTimeout(() => {
      const q     = encodeURIComponent(query)
      const thisQ = query

      fetch(`/api/wine-search?q=${q}&limit=8`)
        .then(r => r.json())
        .then(data => {
          if (activeQueryRef.current !== thisQ) return
          const results: CatalogueWine[] = data.results ?? []
          latestCatRef.current = results
          setSuggestions(results)
          setCatSearching(false)
        })
        .catch(() => { if (activeQueryRef.current === thisQ) setCatSearching(false) })

      fetch(`/api/vivino-suggest?q=${q}`)
        .then(r => r.json())
        .then(data => {
          if (activeQueryRef.current !== thisQ) return
          const vivinoResults: VivinoSuggestion[] = data.results ?? []
          const VARIETIES = new Set(['shiraz','cabernet','sauvignon','pinot','blanc','noir',
            'chardonnay','riesling','merlot','grenache','tempranillo','zinfandel',
            'viognier','malbec','syrah','muscat','prosecco','champagne','chablis',
            'bordeaux','burgundy','reserve','estate','block','single','classic'])
          const catTitles = latestCatRef.current.map(w => w.title.toLowerCase())
          const deduped = vivinoResults.filter(v => {
            const vWords = v.title.toLowerCase().split(/\s+/)
              .filter(w => w.length > 4 && !VARIETIES.has(w))
            if (vWords.length === 0) return true
            const matchCount = catTitles.reduce((n, t) =>
              n + vWords.filter(w => t.includes(w)).length, 0)
            return matchCount < 2
          })
          setVivinoSugs(deduped)
          setVivSearching(false)
        })
        .catch(() => { if (activeQueryRef.current === thisQ) setVivSearching(false) })
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // ── Pick handlers ────────────────────────────────────────────

  function pickSuggestion(w: CatalogueWine) {
    const grapeList = w.variety ? [w.variety] : []
    const detected  = detectWineType(grapeList, w.title, w.region ?? '')
    const cleanName = cleanWineName(w.title)
    setName(cleanName); setProducer(w.winery ?? ''); setRegion(w.region ?? w.province ?? '')
    setGrapes(w.variety ?? ''); setVintage(w.vintage ?? ''); setWineType(detected)
    setCatPoints(w.points ?? null); setCatPriceAud(w.price_aud ?? null)
    setFromCat(true); setDrinkWindow(null); setShowDrop(false)
    setPicked({
      title: cleanName, winery: w.winery ?? '', region: w.region ?? w.province ?? '',
      variety: w.variety ?? '', wineType: detected, points: w.points ?? null,
      vintages: [],  // catalogue wines can have any vintage
    })
  }

  function pickVivinoWine(v: VivinoSuggestion) {
    const grape    = KNOWN_GRAPES.find(g => v.title.toLowerCase().includes(g.toLowerCase())) ?? ''
    const detected = detectWineType([grape], v.title, '')
    setName(v.title); setProducer(''); setRegion(''); setGrapes(grape)
    setVintage(''); setWineType(detected)
    setCatPoints(v.points); setCatPriceAud(null)
    setFromCat(true); setDrinkWindow(null); setShowDrop(false)
    setPicked({
      title: v.title, winery: '', region: '', variety: grape,
      wineType: detected, points: v.points, vintages: v.vintages,
    })
  }

  /** Reset back to Phase 1 (search) */
  function clearSelection() {
    setPicked(null)
    setQuery(''); setName(''); setProducer(''); setRegion('')
    setGrapes(''); setVintage(''); setWineType('Red')
    setFromCat(false); setCatPoints(null); setCatPriceAud(null)
    setDrinkWindow(null); setSuggestions([]); setVivinoSugs([])
  }

  // ── Estimate drinking window ─────────────────────────────────
  async function estimate() {
    if (!name.trim()) return
    setEstimating(true)
    const res = await fetch('/api/drinking-window', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, producer, region, vintage: vintage || null, grapes: grapes ? [grapes] : [], wineType }),
    })
    setDrinkWindow(await res.json())
    setEstimating(false)
  }

  // ── Save to cellar ───────────────────────────────────────────
  async function save() {
    if (!name.trim()) return
    setStatus('saving'); setSaveError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('idle'); return }
    const { data: cellarId, error: rpcErr } = await supabase.rpc('get_or_create_cellar')
    if (rpcErr || !cellarId) { setSaveError('Could not get your cellar. Please try again.'); setStatus('idle'); return }
    const { data: wineRow, error: wineErr } = await supabase
      .from('wines')
      .insert({
        user_id: user.id, cellar_id: cellarId,
        name: cleanWineName(name.trim()), producer: producer.trim(),
        region: region.trim(), vintage: vintage || null,
        grapes: grapes ? [grapes] : [],
        critic_score: catPoints, db_source: fromCat ? 'Wine catalogue' : 'Manual entry',
      })
      .select().single()
    if (wineErr || !wineRow) { setSaveError(wineErr?.message ?? 'Failed to save wine.'); setStatus('idle'); return }
    const { error: bottleErr } = await supabase.from('cellar_bottles').insert({
      user_id: user.id, cellar_id: cellarId, added_by: user.id, wine_id: wineRow.id,
      wine_type: wineType, quantity: parseInt(quantity) || 1,
      drink_from: drinkWindow?.drinkFrom ?? null, peak: drinkWindow?.peak ?? null,
      drink_to: drinkWindow?.drinkTo ?? null,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null, purchase_currency: 'AUD',
      purchase_date: purchaseDate || null, market_price: catPriceAud, market_currency: 'AUD',
    })
    if (bottleErr) { setSaveError(bottleErr.message); setStatus('idle'); return }
    setStatus('done')
    setTimeout(() => router.push('/cellar'), 800)
  }

  // ── Shared styles ────────────────────────────────────────────
  const inputCls   = "w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
  const inputStyle = { background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }
  const labelStyle = { color: '#a07060', fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  // Vintage options for the picker — limited to known vintages for Vivino wines
  const vintageOptions = picked?.vintages.length ? picked.vintages : YEARS
  const typeBadge      = picked ? TYPE_BADGE[picked.wineType] : TYPE_BADGE['Red']

  // ── Bottom actions (shared between Phase 2 and manual entry) ─
  const BottomActions = (
    <>
      {/* Quantity */}
      <div>
        <p className="mb-1.5" style={labelStyle}>Quantity</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setQuantity(q => String(Math.max(1, parseInt(q) - 1)))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: '#ecddd4', color: '#3a1a20', border: '1px solid #d4b8aa' }}>−</button>
          <span className="text-2xl font-bold w-8 text-center" style={{ color: '#3a1a20' }}>{quantity}</span>
          <button onClick={() => setQuantity(q => String(parseInt(q) + 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: '#ecddd4', color: '#3a1a20', border: '1px solid #d4b8aa' }}>+</button>
        </div>
      </div>

      {/* Drinking window */}
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
          <button onClick={() => setDrinkWindow(null)} className="text-xs" style={{ color: '#c4a090' }}>Reset</button>
        </div>
      ) : (
        <button onClick={estimate} disabled={!name.trim() || estimating}
          className="w-full py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#8b2035', color: '#8b2035', opacity: !name.trim() || estimating ? 0.5 : 1 }}>
          {estimating ? '✨ Estimating…' : '✨ Estimate drinking window with AI'}
        </button>
      )}

      {/* Error */}
      {saveError && (
        <p className="text-sm rounded-xl px-4 py-3" style={{ background: '#fce4ec', color: '#8b0000' }}>
          ⚠ {saveError}
        </p>
      )}

      {/* Save button */}
      {status === 'done' ? (
        <div className="py-4 text-center font-semibold" style={{ color: '#2e7d32' }}>✓ Added to cellar!</div>
      ) : (
        <button onClick={save} disabled={!name.trim() || status === 'saving'}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#8b2035', opacity: !name.trim() || status === 'saving' ? 0.5 : 1 }}>
          {status === 'saving' ? 'Saving…' : `Add ${quantity} bottle${parseInt(quantity) !== 1 ? 's' : ''} to cellar`}
        </button>
      )}
    </>
  )

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-semibold text-lg" style={{ color: '#3a1a20' }}>Add a wine</h1>

      {picked ? (
        /* ── Phase 2: wine picked — streamlined card + details ── */
        <>
          {/* Wine summary card */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
               style={{ background: '#ecddd4', border: '1px solid #d4b8aa' }}>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-snug" style={{ color: '#3a1a20' }}>{picked.title}</p>
              {(picked.winery || picked.region) && (
                <p className="text-sm mt-0.5 truncate" style={{ color: '#a07060' }}>
                  {[picked.winery, picked.region].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: typeBadge.bg, color: typeBadge.text }}>
                  {picked.wineType}
                </span>
                {picked.variety && (
                  <span className="text-xs" style={{ color: '#a07060' }}>{picked.variety}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {picked.points && (
                <span className="text-sm font-bold px-2 py-1 rounded-lg"
                      style={{ background: '#8b2035', color: 'white' }}>
                  {picked.points}
                </span>
              )}
              <button onClick={clearSelection} className="text-xs font-medium"
                      style={{ color: '#8b2035' }}>
                Change
              </button>
            </div>
          </div>

          {/* Vintage — the only decision left for a catalogue wine */}
          <div>
            <p className="mb-1.5" style={labelStyle}>Vintage</p>
            <select className={inputCls} style={inputStyle}
              value={vintage}
              onChange={e => setVintage(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">Unknown / NV</option>
              {vintageOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Purchase details */}
          <div>
            <p className="mb-1.5" style={labelStyle}>
              Purchase details <span style={{ color: '#c4a090', fontWeight: 400 }}>(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Price</p>
                <div className="flex items-center rounded-xl overflow-hidden border"
                     style={{ background: '#ecddd4', borderColor: '#d4b8aa' }}>
                  <span className="pl-3 text-sm" style={{ color: '#a07060' }}>A$</span>
                  <input type="number" placeholder="0.00" value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                    style={{ color: '#3a1a20' }} />
                </div>
              </div>
              <div>
                <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Purchase date</p>
                <input type="date" value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
                  style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }} />
              </div>
            </div>
          </div>

          {BottomActions}
        </>
      ) : (
        /* ── Phase 1: search input + manual entry fields ── */
        <>
          <div>
            <p className="mb-1.5" style={labelStyle}>Wine name</p>
            <div className="relative">
              <input
                className={inputCls} style={inputStyle}
                placeholder="Search by name, producer or style…"
                value={query}
                onChange={e => { setQuery(e.target.value); setName(e.target.value); setFromCat(false) }}
                onFocus={() => query.length >= 2 && setShowDrop(true)}
                autoComplete="off"
              />
              {(catSearching || vivSearching) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                       style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
                </div>
              )}
              {showDrop && query.length >= 2 && (catSearching || vivSearching || suggestions.length > 0 || vivinoSugs.length > 0) && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDrop(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-lg"
                       style={{ border: '1px solid #d4b8aa' }}>
                    <div className="overflow-y-auto" style={{ maxHeight: '55vh', background: '#f5ede6' }}>

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

                      {vivSearching && (
                        <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ background: '#ecddd4', borderColor: '#e8d8cc' }}>
                          <div className="w-3 h-3 border-2 rounded-full animate-spin shrink-0"
                               style={{ borderColor: '#d4b8aa', borderTopColor: '#8b2035' }} />
                          <span className="text-xs" style={{ color: '#a07060' }}>Searching more sources…</span>
                        </div>
                      )}

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
                                  {v.vintages.slice(0, 4).join(', ')}{v.vintages.length > 4 ? '…' : ''}
                                </p>
                              </div>
                              {v.points && <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: '#8b2035', color: 'white' }}>{v.points}</span>}
                            </button>
                          ))}
                        </>
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
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Manual entry fields — shown once user commits a name without picking from catalogue */}
          {name && !fromCat && (
            <>
              {/* Producer */}
              <div>
                <p className="mb-1.5" style={labelStyle}>Producer</p>
                <input className={inputCls} style={inputStyle}
                  placeholder="e.g. Charles Heidsieck"
                  value={producer} onChange={e => setProducer(e.target.value)} />
              </div>

              {/* Vintage */}
              <div>
                <p className="mb-1.5" style={labelStyle}>Vintage</p>
                <select className={inputCls} style={inputStyle}
                  value={vintage}
                  onChange={e => setVintage(e.target.value ? parseInt(e.target.value) : '')}>
                  <option value="">Unknown</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Region */}
              <div>
                <p className="mb-1.5" style={labelStyle}>Region</p>
                <input className={inputCls} style={inputStyle}
                  placeholder="e.g. Champagne, Barossa Valley"
                  value={region} onChange={e => setRegion(e.target.value)} />
              </div>

              {/* Grape */}
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

              {/* Wine type */}
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

              {/* Purchase details */}
              <div>
                <p className="mb-1.5" style={labelStyle}>
                  Purchase details <span style={{ color: '#c4a090', fontWeight: 400 }}>(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Price</p>
                    <div className="flex items-center rounded-xl overflow-hidden border"
                         style={{ background: '#ecddd4', borderColor: '#d4b8aa' }}>
                      <span className="pl-3 text-sm" style={{ color: '#a07060' }}>A$</span>
                      <input type="number" placeholder="0.00" value={purchasePrice}
                        onChange={e => setPurchasePrice(e.target.value)}
                        className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                        style={{ color: '#3a1a20' }} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1" style={{ ...labelStyle, fontSize: 11 }}>Purchase date</p>
                    <input type="date" value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
                      style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }} />
                  </div>
                </div>
              </div>

              {BottomActions}
            </>
          )}
        </>
      )}
    </div>
  )
}
