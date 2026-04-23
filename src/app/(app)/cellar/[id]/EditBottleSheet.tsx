'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBottle } from '../actions'

interface Props {
  bottleId:      string
  quantity:      number
  purchasePrice: number | null
  purchaseDate:  string | null
  drinkFrom:     number | null
  peak:          number | null
  drinkTo:       number | null
  /** Estimated window used if no manual override exists */
  estimatedFrom: number
  estimatedPeak: number
  estimatedTo:   number
}

export default function EditBottleSheet({
  bottleId,
  quantity:      initQty,
  purchasePrice: initPrice,
  purchaseDate:  initDate,
  drinkFrom:     initFrom,
  peak:          initPeak,
  drinkTo:       initTo,
  estimatedFrom,
  estimatedPeak,
  estimatedTo,
}: Props) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState('')

  // form state
  const [qty,   setQty]   = useState(String(initQty))
  const [price, setPrice] = useState(initPrice != null ? String(initPrice) : '')
  const [date,  setDate]  = useState(initDate ?? '')

  // Drinking window: null = auto, number = manual
  const hasManual = initFrom != null
  const [manualWindow, setManualWindow] = useState(hasManual)
  const [wFrom, setWFrom] = useState(String(initFrom ?? estimatedFrom))
  const [wPeak, setWPeak] = useState(String(initPeak ?? estimatedPeak))
  const [wTo,   setWTo]   = useState(String(initTo   ?? estimatedTo))

  function resetToAuto() {
    setManualWindow(false)
    setWFrom(String(estimatedFrom))
    setWPeak(String(estimatedPeak))
    setWTo(String(estimatedTo))
  }

  async function save() {
    setError('')
    const qtyNum = parseInt(qty)
    if (!qtyNum || qtyNum < 1) { setError('Quantity must be at least 1'); return }

    const updates = {
      quantity:       qtyNum,
      purchase_price: price !== '' ? parseFloat(price) : null,
      purchase_date:  date || null,
      drink_from:     manualWindow ? (parseInt(wFrom) || null) : null,
      peak:           manualWindow ? (parseInt(wPeak) || null) : null,
      drink_to:       manualWindow ? (parseInt(wTo)   || null) : null,
    }

    startTransition(async () => {
      const res = await updateBottle(bottleId, updates)
      if (res.error) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

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
          {/* ── Sheet panel ── */}
          <div className="w-full rounded-t-2xl overflow-y-auto"
               style={{ background: '#f5ede6', maxHeight: '90dvh' }}>

            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3"
                 style={{ borderBottom: '1px solid #e0cdc4' }}>
              <div className="w-8 h-1 rounded-full mx-auto" style={{ background: '#d4b8aa' }} />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="font-semibold text-base" style={{ color: '#3a1a20' }}>Edit bottle</h2>
              <button onClick={() => setOpen(false)} style={{ color: '#a07060' }}>✕</button>
            </div>

            <div className="px-5 pb-8 space-y-6">

              {/* ── Quantity ── */}
              <section>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                       style={{ color: '#a07060', letterSpacing: '0.1em' }}>
                  Quantity
                </label>
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
                    style={{ background: 'white', borderColor: '#d4b8aa', color: '#3a1a20' }}
                  />
                  <button
                    onClick={() => setQty(q => String(parseInt(q || '0') + 1))}
                    className="w-10 h-10 rounded-full text-lg font-semibold flex items-center justify-center"
                    style={{ background: '#8b2035', color: 'white' }}
                  >+</button>
                </div>
              </section>

              {/* ── Purchase details ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider"
                   style={{ color: '#a07060', letterSpacing: '0.1em' }}>
                  Purchase details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#a07060' }}>Price per bottle (A$)</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="e.g. 45"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-sm"
                      style={{ background: 'white', borderColor: '#d4b8aa', color: '#3a1a20' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#a07060' }}>Date purchased</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-sm"
                      style={{ background: 'white', borderColor: '#d4b8aa', color: '#3a1a20' }}
                    />
                  </div>
                </div>
              </section>

              {/* ── Drinking window ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: '#a07060', letterSpacing: '0.1em' }}>
                    Drinking window
                  </p>
                  {manualWindow && (
                    <button onClick={resetToAuto} className="text-xs"
                            style={{ color: '#8b2035' }}>
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
                    <button
                      onClick={() => setManualWindow(true)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(139,32,53,0.1)', color: '#8b2035' }}
                    >
                      Override
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: '#a07060' }}>
                      Enter the years for this bottle's drinking window.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Opens', value: wFrom, set: setWFrom },
                        { label: 'Peak',  value: wPeak, set: setWPeak },
                        { label: 'Closes', value: wTo,  set: setWTo  },
                      ].map(({ label, value, set }) => (
                        <div key={label}>
                          <label className="block text-xs mb-1 text-center" style={{ color: '#a07060' }}>{label}</label>
                          <input
                            type="number" min="1990" max="2080" placeholder="Year"
                            value={value}
                            onChange={e => set(e.target.value)}
                            className="w-full px-2 py-2 rounded-xl border text-sm text-center font-semibold"
                            style={{ background: 'white', borderColor: '#d4b8aa', color: '#3a1a20' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ── Error ── */}
              {error && (
                <p className="text-sm" style={{ color: '#8b2035' }}>{error}</p>
              )}

              {/* ── Save ── */}
              <button
                onClick={save}
                disabled={isPending}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white"
                style={{ background: '#8b2035', opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
