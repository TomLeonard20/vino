import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { WINE_TYPE_COLOURS } from '@/types/database'
import type { CellarBottle, TastingNote, FlavourProfile } from '@/types/database'
import DrinkingWindowChart from '@/components/ui/DrinkingWindowChart'
import Link from 'next/link'

function flavourLabel(key: string, val: number): string {
  const map: Record<string, string[]> = {
    Body:      ['Very light', 'Light', 'Med–', 'Med', 'Med+', 'Full', 'Full'],
    Tannins:   ['None', 'Low', 'Med–', 'Med', 'Med+', 'High', 'Very high'],
    Acidity:   ['Flat', 'Low', 'Med–', 'Med', 'Med+', 'High', 'Very high'],
    Alcohol:   ['Low', 'Low', 'Med–', 'Med', 'Med+', 'High', 'Very high'],
    Sweetness: ['Dry', 'Dry', 'Off-dry', 'Medium', 'Medium', 'Sweet', 'V.Sweet'],
    Fruit:     ['Subtle', 'Light', 'Med', 'Med', 'Dark', 'Dark', 'Intense'],
    Oak:       ['None', 'Low', 'Low', 'Medium', 'Medium', 'High', 'Very high'],
    Finish:    ['Short', 'Short', 'Med–', 'Med', 'Med+', 'Long', 'Very long'],
  }
  const labels = map[key] ?? ['Low','','','','','','High']
  const idx = Math.min(Math.floor((val / 100) * labels.length), labels.length - 1)
  return labels[idx]
}

export default async function WineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: bottle } = await supabase
    .from('cellar_bottles')
    .select('*, wine:wines(*, flavour_profile:flavour_profiles(*), tasting_notes:tasting_notes(*))')
    .eq('id', id)
    .single()

  if (!bottle) notFound()

  const b     = bottle as CellarBottle
  const wine  = b.wine!
  const notes = (wine.tasting_notes ?? []) as TastingNote[]
  const fp    = wine.flavour_profile as FlavourProfile | null

  const hasWindow = !!(b.drink_from && b.drink_to && b.peak)

  // Estimate a drinking window from vintage + wine type when none is set
  function estimateWindow(vintage: number | null, wineType: string) {
    const base = vintage ?? new Date().getFullYear()
    switch (wineType) {
      case 'Champagne': return { drinkFrom: base + 4, peak: base + 10, drinkTo: base + 20 }
      case 'White':     return { drinkFrom: base + 1, peak: base + 3,  drinkTo: base + 7  }
      case 'Rosé':      return { drinkFrom: base,     peak: base + 1,  drinkTo: base + 3  }
      default:          return { drinkFrom: base + 2, peak: base + 7,  drinkTo: base + 14 }
    }
  }

  const drinkWindow = hasWindow
    ? { drinkFrom: b.drink_from!, peak: b.peak!, drinkTo: b.drink_to! }
    : estimateWindow(wine.vintage, b.wine_type)

  // Estimated flavour profile by wine type when no real data exists
  const DEFAULT_FP: Record<string, Omit<FlavourProfile, 'id' | 'wine_id'>> = {
    Red:       { body: 62, tannins: 58, acidity: 52, alcohol: 62, sweetness: 12, fruit: 65, oak: 48, finish: 58 },
    White:     { body: 38, tannins:  5, acidity: 68, alcohol: 48, sweetness: 30, fruit: 52, oak: 15, finish: 45 },
    Rosé:      { body: 35, tannins: 10, acidity: 60, alcohol: 45, sweetness: 35, fruit: 55, oak:  5, finish: 40 },
    Champagne: { body: 40, tannins:  5, acidity: 72, alcohol: 50, sweetness: 20, fruit: 50, oak: 12, finish: 62 },
    Sparkling: { body: 38, tannins:  5, acidity: 70, alcohol: 48, sweetness: 22, fruit: 48, oak: 10, finish: 55 },
    Dessert:   { body: 55, tannins: 12, acidity: 45, alcohol: 40, sweetness: 90, fruit: 75, oak: 20, finish: 65 },
  }
  const fpData   = fp ?? { id: '', wine_id: '', ...DEFAULT_FP[b.wine_type] ?? DEFAULT_FP['Red'] }
  const fpIsReal = !!fp

  const purchaseTotal = (b.purchase_price ?? 0) * b.quantity
  const marketTotal   = (b.market_price   ?? 0) * b.quantity
  const valueChange   = purchaseTotal && marketTotal ? marketTotal - purchaseTotal : null
  const valuePct      = purchaseTotal && valueChange != null
    ? Math.round((valueChange / purchaseTotal) * 100) : null

  const addedDate    = new Date(b.added_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  const purchaseDate = b.purchase_date
    ? new Date(b.purchase_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : addedDate

  return (
    // -mx-4 -mt-6 breaks out of the layout's px-4 py-6 so the hero goes edge-to-edge
    <div className="-mx-4 -mt-6">

      {/* ── Back nav (sits above hero, inside page padding) ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3"
           style={{ background: '#f5ede6' }}>
        <Link href="/cellar" className="text-sm font-medium flex items-center gap-1"
              style={{ color: '#8b2035' }}>
          ‹ Cellar
        </Link>
      </div>

      {/* ── Hero card — full bleed ── */}
      <div className="px-4 pb-5 pt-4" style={{ background: '#8b2035' }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <h1 className="text-2xl font-bold text-white leading-tight flex-1">
            {wine.name}
          </h1>
          {wine.critic_score && (
            <div className="text-right shrink-0 ml-2">
              <div className="text-5xl font-bold leading-none" style={{ color: '#e8c96e' }}>
                {wine.critic_score}
              </div>
              <div className="text-xs uppercase tracking-widest mt-1"
                   style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em' }}>
                Critic<br/>Score
              </div>
            </div>
          )}
        </div>
        {/* Tags with labels */}
        <div className="flex flex-wrap gap-2">
          {[
            ...(wine.grapes ?? []).map((g: string) => ({ label: 'Grape', value: g })),
            wine.region      ? { label: 'Region',  value: wine.region }          : null,
            wine.appellation ? { label: 'Country', value: wine.appellation }     : null,
            wine.vintage     ? { label: 'Vintage', value: String(wine.vintage) } : null,
          ].filter(Boolean).map(tag => (
            <span
              key={`${tag!.label}:${tag!.value}`}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.9)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>{tag!.label}: </span>
              <span className="font-medium">{tag!.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Rest of page content ── */}
      <div className="px-4 pt-5 pb-8 space-y-5" style={{ background: '#f5ede6' }}>

        {/* WINE DETAILS */}
        <section>
          <p className="text-xs font-bold tracking-widest uppercase mb-3"
             style={{ color: '#b09080', letterSpacing: '0.15em' }}>
            Wine Details
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Cell label="Producer"       value={wine.producer || '—'} />
            <Cell label="Region"         value={wine.region   || wine.appellation || '—'} />
            <Cell label="Purchase price" value={b.purchase_price != null ? `A$${b.purchase_price}` : '—'} />
            <Cell label="Market price"   value={b.market_price   != null ? `A$${b.market_price}`   : '—'} />
            <Cell label="Added"          value={purchaseDate} />
            {valueChange !== null && valuePct !== null ? (
              <Cell
                label="Value change"
                value={`${valueChange >= 0 ? '+' : ''}A$${Math.abs(valueChange)} (${valuePct >= 0 ? '+' : ''}${valuePct}%)`}
                valueColor={valueChange >= 0 ? '#2e7d32' : '#c62828'}
              />
            ) : (
              <Cell label="Value change" value="—" />
            )}
          </div>
        </section>

        {/* FLAVOUR PROFILE */}
        <section className="rounded-2xl p-4" style={{ background: '#ecddd4' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold tracking-widest uppercase"
               style={{ color: '#b09080', letterSpacing: '0.15em' }}>
              Flavour Profile
            </p>
            <p className="text-xs" style={{ color: '#c4a090' }}>
              {fpIsReal ? 'Source: Wine database' : `Typical ${b.wine_type}`}
            </p>
          </div>

            <div className="space-y-3">
              {([
                ['Body',      fpData.body],
                ['Tannins',   fpData.tannins],
                ['Acidity',   fpData.acidity],
                ['Alcohol',   fpData.alcohol],
                ['Sweetness', fpData.sweetness],
                ['Fruit',     fpData.fruit],
                ['Oak',       fpData.oak],
                ['Finish',    fpData.finish],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs" style={{ color: '#7a4a38' }}>{label}</span>
                  <div className="relative flex-1 h-2 rounded-full" style={{ background: '#c4a090' }}>
                    <div className="absolute inset-y-0 left-0 rounded-full"
                         style={{ width: `${val}%`, background: '#8b2035' }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                         style={{ left: `calc(${val}% - 7px)`, background: '#8b2035' }} />
                  </div>
                  <span className="w-16 text-right shrink-0 text-xs font-semibold"
                        style={{ color: '#7a4a38' }}>
                    {flavourLabel(label, val)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-3 px-16">
              {['Low', 'Medium', 'High'].map(l => (
                <span key={l} className="text-xs" style={{ color: '#c4a090' }}>{l}</span>
              ))}
            </div>

            <p className="text-xs mt-4 leading-relaxed" style={{ color: '#b09080' }}>
              {fpIsReal
                ? 'Pre-filled from critic and producer data. Reflects the typical expression of this wine and vintage.'
                : `Estimated typical profile for a ${b.wine_type} wine. Scan the label to get personalised data.`}
            </p>
          </section>

        {/* DRINKING WINDOW */}
        <DrinkingWindowChart
          drinkFrom={drinkWindow.drinkFrom}
          peak={drinkWindow.peak}
          drinkTo={drinkWindow.drinkTo}
          estimated={!hasWindow}
        />

        {/* CELLAR COUNT */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#ecddd4' }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: '#8b2035' }}>
            <span className="text-2xl font-bold text-white">{b.quantity}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
              {b.quantity} bottle{b.quantity !== 1 ? 's' : ''} in cellar
            </p>
            {(b.purchase_price ?? b.market_price) != null && (
              <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
                {purchaseDate} · A${b.purchase_price ?? b.market_price} ea.
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="px-3 py-2 rounded-xl text-sm font-semibold border-2"
                    style={{ borderColor: '#3a1a20', color: '#3a1a20' }}>
              Drink ↗
            </button>
            <button className="px-3 py-2 rounded-xl text-sm font-semibold border-2"
                    style={{ borderColor: '#3a1a20', color: '#3a1a20' }}>
              + Add
            </button>
          </div>
        </div>

        {/* MY TASTING NOTES */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold tracking-widest uppercase"
               style={{ color: '#b09080', letterSpacing: '0.15em' }}>
              My Tasting Notes
            </p>
            {notes.length > 1 && (
              <span className="text-xs font-medium" style={{ color: '#8b2035' }}>See all</span>
            )}
          </div>

          {notes.length === 0 ? (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#ecddd4' }}>
              <p className="text-sm" style={{ color: '#c4a090' }}>No tasting notes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.slice(0, 2).map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </section>

        {/* Add note bar */}
        <div className="rounded-2xl h-12" style={{ background: '#ecddd4' }} />
      </div>
    </div>
  )
}

function Cell({
  label, value, valueColor, valueLarge,
}: {
  label: string
  value: string
  valueColor?: string
  valueLarge?: boolean
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#ecddd4' }}>
      <p className="text-xs mb-1.5" style={{ color: '#b09080' }}>{label}</p>
      <p className={`font-semibold leading-tight ${valueLarge ? 'text-base' : 'text-sm'}`}
         style={{ color: valueColor ?? '#3a1a20' }}>
        {value}
      </p>
    </div>
  )
}

function NoteCard({ note }: { note: TastingNote }) {
  const date = new Date(note.tasted_at).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const tags = [...(note.nose_tags ?? []), ...(note.palate_tags ?? [])]

  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold" style={{ color: '#3a1a20' }}>{note.score} pts · </span>
          <span style={{ color: '#8b2035' }}>
            {'★'.repeat(note.stars)}{'☆'.repeat(Math.max(0, 5 - note.stars))}
          </span>
        </div>
        <span className="text-xs shrink-0" style={{ color: '#a07060' }}>{date}</span>
      </div>
      {note.free_text && (
        <p className="text-sm leading-relaxed" style={{ color: '#3a1a20' }}>{note.free_text}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full border"
                  style={{ borderColor: '#c4a090', color: '#7a4a38' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
