'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBottle, updateWine } from '../actions'
import type { WineType } from '@/types/database'

const WINE_TYPES: WineType[] = ['Red', 'White', 'Rosé', 'Champagne']
const NOW   = new Date().getFullYear()
const YEARS = Array.from({ length: NOW - 1969 }, (_, i) => NOW - i)

interface Props {
  bottleId:      string
  wineId:        string
  // Bottle fields
  quantity:      number
  wineType:      WineType
  purchasePrice: number | null
  purchaseDate:  string | null
  drinkFrom:     number | null
  peak:          number | null
  drinkTo:       number | null
  estimatedFrom: number
  estimatedPeak: number
  estimatedTo:   number
  // Wine fields
  wineName:     string
  producer:     string
  region:       string
  vintage:      number | null
  grapes:       string[]
  criticScore:  number | null
}

type Tab = 'bottle' | 'wine'

export default function EditBottleSheet(props: Props) {
  const {
    bottleId, wineId,
    quantity: initQty, wineType: initWineType,
    purchasePrice: initPrice, purchaseDate: initDate,
    drinkFrom: initFrom, peak: initPeak, drinkTo: initTo,
    estimatedFrom, estimatedPeak, estimatedTo,
    wineName: initName, producer: initProducer,
    region: initRegion, vintage: initVintage,
    grapes: initGrapes, criticScore: initScore,
  } = props

  const router = useRouter()
  const [open, setOpen]              = useState(false)
  const [tab,  setTab]               = useState<Tab>('bottle')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState('')

  // ── Bottle state ──────────────────────────────────────────────
  const [qty,      setQty]      = useState(String(initQty))
  const [wineType, setWineType] = useState<WineType>(initWineType)
  const [price,    setPrice]    = useState(initPrice != null ? String(initPrice) : '')
  const [date,     setDate]     = useState(initDate ?? '')

  const hasManual = initFrom != null
  const [manualWindow, setManualWindow] = useState(hasManual)
  const [wFrom, setWFrom] = useState(String(initFrom ?? estimatedFrom))
  const [wPeak, setWPeak] = useState(String(initPeak ?? estimatedPeak))
  const [wTo,   setWTo]   = useState(String(initTo   ?? estimatedTo))

  // ── Wine state ────────────────────────────────────────────────
  const [name,     setName]     = useState(initName)
  const [producer, setProducer] = useState(initProducer)
  const [region,   setRegion]   = useState(initRegion)
  const [vintage,  setVintage]  = useState<number | ''>(initVintage ?? '')
  const [grapeStr, setGrapeStr] = useState(initGrapes.join(', '))
  const [score,    setScore]    = useState(initScore != null ? String(initScore) : '')

  function resetToAuto() {
    setManualWindow(false)
    setWFrom(String(estimatedFrom))
    setWPeak(String(estimatedPeak))
    setWTo(String(estimatedTo))
  }

  // ── Save bottle tab ───────────────────────────────────────────
  async function saveBottle() {
    setError('')
    const qtyNum = parseInt(qty)
    if (!qtyNum || qtyNum < 1) { setError('Quantity must be at least 1'); return }

    startTransition(async () => {
      const res = await updateBottle(bottleId, {
        quantity:       qtyNum,
        wine_type:      wineType,
        purchase_price: price !== '' ? parseFloat(price) : null,
        purchase_date:  date || null,
        drink_from:     manualWindow ? (parseInt(wFrom) || null) : null,
        peak:           manualWindow ? (parseInt(wPeak) || null) : null,
        drink_to:       manualWindow ? (parseInt(wTo)   || null) : null,
      })
      if (res.error) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  // ── Save wine tab ─────────────────────────────────────────────
  async function saveWine() {
    setError('')
    if (!name.trim()) { setError('Wine name is required'); return }

    const grapeList = grapeStr
      .split(',')
      .map(g => g.trim())
      .filter(Boolean)

    startTransition(async () => {
      const res = await updateWine(wineId, {
        name:         name.trim(),
        producer:     producer.trim(),
        region:       region.trim(),
        vintage:      vintage || null,
        grapes:       grapeList,
        critic_score: score !== '' ? parseInt(score) : null,
      })
      if (res.error) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  const inputCls   = 'w-full px-3 py-2 rounded-xl border text-sm outline-none'
  const inputStyle = { background: 'white', borderColor: '#d4b8aa', color: '#3a1a20' }
  const labelCls   = 'block text-xs font-semibold uppercase tracking-wider mb-1.5'
  const labelStyle = { color: '#a07060', letterSpacing: '0.1em' }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70"
        style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Edit
      </button>

      {/* ── Sheet backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full rounded-t-2xl overflow-y-auto"
               style={{ background: '#f5ede6', maxHeight: '92dvh' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: '#d4b8aa' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3"
                 style={{ borderBottom: '1px solid #e0cdc4' }}>
              <h2 className="font-semibold text-base" style={{ color: '#3a1a20' }}>Edit</h2>
              <button onClick={() => setOpen(false)} className="text-lg leading-none" style={{ color: '#a07060' }}>✕</button>
            </div>

            {/* Tabs */}
            <div className="flex mx-5 mt-4 rounded-xl overflow-hidden border"
                 style={{ borderColor: '#d4b8aa' }}>
              {(['bottle', 'wine'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError('') }}
                  className="flex-1 py-2 text-sm font-semibold capitalize"
                  style={{
                    background: tab === t ? '#8b2035' : '#ecddd4',
                    color:      tab === t ? 'white'   : '#a07060',
                  }}
                >
                  {t === 'bottle' ? 'Cellar details' : 'Wine details'}
                </button>
              ))}
            </div>

            <div className="px-5 pb-8 pt-5 space-y-5">

              {/* ══════════════ BOTTLE TAB ══════════════ */}
              {tab === 'bottle' && (
                <>
                  {/* Wine type */}
                  <section>
                    <p className={labelCls} style={labelStyle}>Wine type</p>
                    <div className="flex gap-2">
                      {WINE_TYPES.map(t => (
                        <button key={t} onClick={() => setWineType(t)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            background: wineType === t ? '#8b2035' : '#ecddd4',
                            color:      wineType === t ? 'white'   : '#a07060',
                            border:     '1px solid #d4b8aa',
                          }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Quantity */}
                  <section>
                    <p className={labelCls} style={labelStyle}>Quantity</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQty(q => String(Math.max(1, parseInt(q || '1') - 1)))}
                        className="w-10 h-10 rounded-full text-lg font-semibold flex items-center justify-center"
                        style={{ background: '#ecddd4', color: '#3a1a20' }}
                      >−</button>
                      <input
                        type="number" min="1" max="500"
                        value={qty}
                        onChange={e => setQty(e.target.value)}
                        className="w-16 text-center text-lg font-bold rounded-xl py-2 border"
                        style={inputStyle}
                      />
                      <button
                        onClick={() => setQty(q => String(parseInt(q || '0') + 1))}
                        className="w-10 h-10 rounded-full text-lg font-semibold flex items-center justify-center"
                        style={{ background: '#8b2035', color: 'white' }}
                      >+</button>
                    </div>
                  </section>

                  {/* Purchase details */}
                  <section>
                    <p className={labelCls} style={labelStyle}>Purchase details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#a07060' }}>Price per bottle (A$)</label>
                        <input type="number" min="0" step="0.01" placeholder="e.g. 45"
                          value={price} onChange={e => setPrice(e.target.value)}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#a07060' }}>Date purchased</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                          className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                  </section>

                  {/* Drinking window */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <p className={labelCls} style={labelStyle}>Drinking window</p>
                      {manualWindow && (
                        <button onClick={resetToAuto} className="text-xs" style={{ color: '#8b2035' }}>
                          Reset to auto
                        </button>
                      )}
                    </div>
                    {!manualWindow ? (
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                           style={{ background: '#ecddd4' }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#3a1a20' }}>
                            Auto · {estimatedFrom}–{estimatedTo}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
                            Peak around {estimatedPeak} · estimated from vintage
                          </p>
                        </div>
                        <button onClick={() => setManualWindow(true)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: 'rgba(139,32,53,0.1)', color: '#8b2035' }}>
                          Override
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Opens', value: wFrom, set: setWFrom },
                          { label: 'Peak',  value: wPeak, set: setWPeak },
                          { label: 'Closes', value: wTo,  set: setWTo  },
                        ].map(({ label, value, set }) => (
                          <div key={label}>
                            <label className="block text-xs mb-1 text-center" style={{ color: '#a07060' }}>{label}</label>
                            <input type="number" min="1990" max="2080" placeholder="Year"
                              value={value} onChange={e => set(e.target.value)}
                              className={`${inputCls} text-center font-semibold`} style={inputStyle} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {error && <p className="text-sm" style={{ color: '#8b2035' }}>{error}</p>}

                  <button onClick={saveBottle} disabled={isPending}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white"
                    style={{ background: '#8b2035', opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? 'Saving…' : 'Save cellar details'}
                  </button>
                </>
              )}

              {/* ══════════════ WINE TAB ══════════════ */}
              {tab === 'wine' && (
                <>
                  {/* Name */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Wine name</label>
                    <input value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. The Quintessential"
                      className={inputCls} style={inputStyle} />
                  </div>

                  {/* Producer */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Producer</label>
                    <input value={producer} onChange={e => setProducer(e.target.value)}
                      placeholder="e.g. Hentley Farm"
                      className={inputCls} style={inputStyle} />
                  </div>

                  {/* Region */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Region</label>
                    <input value={region} onChange={e => setRegion(e.target.value)}
                      placeholder="e.g. Barossa Valley"
                      className={inputCls} style={inputStyle} />
                  </div>

                  {/* Vintage */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Vintage</label>
                    <select value={vintage}
                      onChange={e => setVintage(e.target.value ? parseInt(e.target.value) : '')}
                      className={inputCls} style={inputStyle}>
                      <option value="">Unknown</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  {/* Grape varieties */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Grape varieties</label>
                    <input value={grapeStr} onChange={e => setGrapeStr(e.target.value)}
                      placeholder="e.g. Shiraz, Cabernet Sauvignon"
                      className={inputCls} style={inputStyle} />
                    <p className="text-xs mt-1" style={{ color: '#c4a090' }}>Separate multiple grapes with commas</p>
                  </div>

                  {/* Critic score */}
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Critic score <span style={{ color: '#c4a090', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                    </label>
                    <input type="number" min="50" max="100" placeholder="e.g. 93"
                      value={score} onChange={e => setScore(e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </div>

                  {error && <p className="text-sm" style={{ color: '#8b2035' }}>{error}</p>}

                  <button onClick={saveWine} disabled={isPending}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white"
                    style={{ background: '#8b2035', opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? 'Saving…' : 'Save wine details'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
