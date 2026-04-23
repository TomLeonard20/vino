import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { CellarBottle, TastingNote, FlavourProfile, WineType } from '@/types/database'
import DrinkingWindowChart from '@/components/ui/DrinkingWindowChart'
import WineBottleImage     from '@/components/ui/WineBottleImage'
import Link from 'next/link'
import { fetchWinePhoto } from '@/lib/wine-photo'
import EditBottleSheet from './EditBottleSheet'

// ── Async photo slot — streams in without blocking the page ───
// Shows SVG immediately via Suspense fallback; replaces with real
// photo when the Open Food Facts fetch completes.
async function WinePhotoAsync({
  wineId,
  name,
  producer,
  wineType,
  storedUrl,
}: {
  wineId:     string
  name:       string
  producer:   string
  wineType:   WineType
  storedUrl:  string | null
}) {
  let url = storedUrl
  if (!url) {
    const fetched = await fetchWinePhoto(name, producer)
    if (fetched) {
      url = fetched
      const supabase = await createClient()
      await supabase.from('wines').update({ label_image_url: fetched }).eq('id', wineId)
    }
  }

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center bottom',
          display: 'block',
          padding: '8px 6px 4px',
        }}
      />
    )
  }
  return (
    <div className="w-full h-full flex items-end justify-center pb-1">
      <WineBottleImage type={wineType} transparent width={68} height={128} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

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
  const labels = map[key] ?? ['Low', '', '', '', '', '', 'High']
  const idx    = Math.min(Math.floor((val / 100) * labels.length), labels.length - 1)
  return labels[idx]
}

// ── Page ──────────────────────────────────────────────────────

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

  const { data: { user } } = await supabase.auth.getUser()

  const b    = bottle as CellarBottle
  const wine = b.wine! as any   // typed loosely to access optional DB columns

  const notes        = (wine.tasting_notes ?? []) as TastingNote[]
  const fp           = wine.flavour_profile as FlavourProfile | null
  const myNotes      = notes.filter((n: TastingNote) => n.user_id === user?.id)
  const partnerNotes = notes.filter((n: TastingNote) => n.user_id !== user?.id)

  // ── Drinking window ───────────────────────────────────────────
  const hasWindow = !!(b.drink_from && b.drink_to && b.peak)

  function estimateWindow(vintage: number | null, wineType: string) {
    const now = new Date().getFullYear()
    switch (wineType) {
      case 'Champagne':
        if (!vintage) return { drinkFrom: now, peak: now + 2, drinkTo: now + 5 }
        return { drinkFrom: vintage + 5, peak: vintage + 12, drinkTo: vintage + 25 }
      case 'White':
        return { drinkFrom: (vintage ?? now) + 1, peak: (vintage ?? now) + 3, drinkTo: (vintage ?? now) + 7 }
      case 'Rosé':
        return { drinkFrom: now, peak: now + 1, drinkTo: now + 3 }
      default: // Red
        if (!vintage) return { drinkFrom: now, peak: now + 5, drinkTo: now + 10 }
        return { drinkFrom: vintage + 2, peak: vintage + 7, drinkTo: vintage + 15 }
    }
  }

  const drinkWindow = hasWindow
    ? { drinkFrom: b.drink_from!, peak: b.peak!, drinkTo: b.drink_to! }
    : estimateWindow(wine.vintage, b.wine_type)

  // ── Flavour profile ───────────────────────────────────────────
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

  // ── Value change ──────────────────────────────────────────────
  const purchaseTotal = (b.purchase_price ?? 0) * b.quantity
  const marketTotal   = (b.market_price   ?? 0) * b.quantity
  const valueChange   = purchaseTotal && marketTotal ? marketTotal - purchaseTotal : null
  const valuePct      = purchaseTotal && valueChange != null
    ? Math.round((valueChange / purchaseTotal) * 100) : null

  const purchaseDate = b.purchase_date
    ? new Date(b.purchase_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : new Date(b.added_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })

  return (
    <div className="-mx-4 -mt-6">

      {/* ── Back nav ── */}
      <div
        className="flex items-center justify-between px-4 pt-5 pb-3"
        style={{ background: '#f5ede6' }}
      >
        <Link
          href="/cellar"
          className="text-sm font-medium flex items-center gap-1 active:opacity-60"
          style={{ color: '#8b2035' }}
        >
          ‹ Cellar
        </Link>
        <EditBottleSheet
          bottleId={b.id}
          quantity={b.quantity}
          purchasePrice={b.purchase_price}
          purchaseDate={b.purchase_date}
          drinkFrom={b.drink_from}
          peak={b.peak}
          drinkTo={b.drink_to}
          estimatedFrom={drinkWindow.drinkFrom}
          estimatedPeak={drinkWindow.peak}
          estimatedTo={drinkWindow.drinkTo}
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          HERO — full-bleed burgundy
          Layout: [photo column] [info column]
          ════════════════════════════════════════════════════════ */}
      <div className="px-4 pt-5 pb-6" style={{ background: '#8b2035' }}>
        <div className="flex gap-4 items-start">

          {/* ── Left: bottle photo (streams in, SVG shown immediately) ── */}
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              width: 110,
              height: 180,
              background: 'white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            }}
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-end justify-center pb-1">
                <WineBottleImage type={b.wine_type as WineType} transparent width={68} height={128} />
              </div>
            }>
              <WinePhotoAsync
                wineId={wine.id}
                name={wine.name ?? ''}
                producer={wine.producer ?? ''}
                wineType={b.wine_type as WineType}
                storedUrl={wine.label_image_url ?? null}
              />
            </Suspense>
          </div>

          {/* ── Right: name + key details ── */}
          <div className="flex-1 min-w-0">

            <h1 className="text-xl font-bold text-white leading-tight">
              {(() => {
                const n = wine.name ?? ''
                const p = wine.producer ?? ''
                if (!p || n.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(n.toLowerCase())) return n
                return `${p} ${n}`
              })()}
            </h1>

            {/* Key details — compact rows */}
            <div className="mt-2 space-y-1.5">
              {wine.producer && (
                <HeroRow label="Producer" value={wine.producer} />
              )}
              {(wine.region || wine.appellation) && (
                <HeroRow label="Region" value={wine.region || wine.appellation} />
              )}
              {wine.vintage && (
                <HeroRow label="Vintage" value={String(wine.vintage)} />
              )}
            </div>

            {/* Grape variety tags */}
            {(wine.grapes ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(wine.grapes as string[]).map((g: string) => (
                  <span
                    key={g}
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.85)' }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Stat strip: score · paid · est. value · gain ── */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <StatChip
            label="Score"
            value={wine.critic_score ? `${wine.critic_score}` : '—'}
            unit={wine.critic_score ? 'pts' : undefined}
            highlight={!!wine.critic_score}
          />
          <StatChip
            label="Paid"
            value={b.purchase_price != null ? `A$${b.purchase_price}` : '—'}
            sub={b.purchase_price != null ? purchaseDate : undefined}
          />
          <StatChip
            label="Est. value"
            value={b.market_price != null ? `A$${b.market_price}` : '—'}
          />
          <StatChip
            label="Gain"
            value={
              valuePct !== null
                ? `${valuePct >= 0 ? '+' : ''}${valuePct}%`
                : '—'
            }
            valueColor={
              valuePct === null ? undefined
              : valuePct >= 0   ? '#86efac'
              : '#fca5a5'
            }
            sub={
              valueChange !== null
                ? `${valueChange >= 0 ? '+' : '−'}A$${Math.abs(Math.round(valueChange))}`
                : undefined
            }
          />
        </div>
      </div>

      {/* ── Rest of page ── */}
      <div className="px-4 pt-5 pb-8 space-y-5" style={{ background: '#f5ede6' }}>

        {/* DRINKING WINDOW */}
        <DrinkingWindowChart
          drinkFrom={drinkWindow.drinkFrom}
          peak={drinkWindow.peak}
          drinkTo={drinkWindow.drinkTo}
          estimated={!hasWindow}
        />

        {/* FLAVOUR PROFILE */}
        <section className="rounded-2xl p-4" style={{ background: '#ecddd4' }}>
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: '#b09080', letterSpacing: '0.15em' }}
            >
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
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${val}%`, background: '#8b2035' }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                    style={{ left: `calc(${val}% - 7px)`, background: '#8b2035' }}
                  />
                </div>
                <span
                  className="w-16 text-right shrink-0 text-xs font-semibold"
                  style={{ color: '#7a4a38' }}
                >
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
              ? 'Pre-filled from critic and producer data.'
              : `Estimated typical profile for a ${b.wine_type} wine.`}
          </p>
        </section>

        {/* CELLAR COUNT */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#ecddd4' }}>
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#8b2035' }}
          >
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
            <button
              className="px-3 py-2 rounded-xl text-sm font-semibold border-2 active:opacity-60"
              style={{ borderColor: '#3a1a20', color: '#3a1a20' }}
            >
              Drink ↗
            </button>
            <button
              className="px-3 py-2 rounded-xl text-sm font-semibold border-2 active:opacity-60"
              style={{ borderColor: '#3a1a20', color: '#3a1a20' }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* MY TASTING NOTES */}
        <section>
          <p
            className="text-xs font-bold tracking-widest uppercase mb-3"
            style={{ color: '#b09080', letterSpacing: '0.15em' }}
          >
            My Tasting Notes
          </p>
          {myNotes.length === 0 ? (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#ecddd4' }}>
              <p className="text-sm" style={{ color: '#c4a090' }}>No tasting notes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myNotes.slice(0, 2).map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </section>

        {/* PARTNER TASTING NOTES */}
        {partnerNotes.length > 0 && (
          <section>
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: '#b09080', letterSpacing: '0.15em' }}
            >
              Partner's Tasting Notes
            </p>
            <div className="space-y-3">
              {partnerNotes.slice(0, 2).map(note => (
                <NoteCard key={note.id} note={note} isPartner />
              ))}
            </div>
          </section>
        )}

        {/* Add note placeholder */}
        <div className="rounded-2xl h-12" style={{ background: '#ecddd4' }} />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StatChip({
  label,
  value,
  unit,
  sub,
  valueColor,
  highlight,
}: {
  label:       string
  value:       string
  unit?:       string
  sub?:        string
  valueColor?: string
  highlight?:  boolean
}) {
  return (
    <div
      className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
      style={{ background: 'rgba(0,0,0,0.22)' }}
    >
      <span className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span
        className="font-bold leading-none"
        style={{
          fontSize: 15,
          color: valueColor ?? (highlight ? '#e8c96e' : 'white'),
        }}
      >
        {value}
        {unit && (
          <span className="text-xs font-normal ml-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {unit}
          </span>
        )}
      </span>
      {sub && (
        <span className="text-xs mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function HeroRow({
  label,
  value,
  valueColor,
}: {
  label:       string
  value:       string
  valueColor?: string
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-xs shrink-0 w-16"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {label}
      </span>
      <span
        className="text-xs font-medium leading-snug"
        style={{ color: valueColor ?? 'rgba(255,255,255,0.88)' }}
      >
        {value}
      </span>
    </div>
  )
}

function NoteCard({ note, isPartner }: { note: TastingNote; isPartner?: boolean }) {
  const date = new Date(note.tasted_at).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const tags = [...(note.nose_tags ?? []), ...(note.palate_tags ?? [])]

  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{
        background: isPartner ? '#e8dcd4' : '#ecddd4',
        border:     isPartner ? '1px solid #d4b8aa' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: '#3a1a20' }}>{note.score} pts · </span>
          <span style={{ color: '#8b2035' }}>
            {'★'.repeat(note.stars)}{'☆'.repeat(Math.max(0, 5 - note.stars))}
          </span>
          {isPartner && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#8b2035', color: 'white' }}
            >
              Partner
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: '#a07060' }}>{date}</span>
      </div>
      {note.free_text && (
        <p className="text-sm leading-relaxed" style={{ color: '#3a1a20' }}>{note.free_text}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full border"
              style={{ borderColor: '#c4a090', color: '#7a4a38' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
