import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { drinkingStatus, WINE_TYPE_COLOURS } from '@/types/database'
import type { CellarBottle, TastingNote, FlavourProfile } from '@/types/database'
import DrinkingWindowChart from '@/components/ui/DrinkingWindowChart'
import Link from 'next/link'

// ── Flavour label descriptors ─────────────────────────────────
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
  const idx    = Math.min(Math.floor((val / 100) * labels.length), labels.length - 1)
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

  const b      = bottle as CellarBottle
  const wine   = b.wine!
  const notes  = (wine.tasting_notes ?? []) as TastingNote[]
  const fp     = wine.flavour_profile as FlavourProfile | null
  const typeColor = WINE_TYPE_COLOURS[b.wine_type]
  const hasWindow = b.drink_from && b.drink_to && b.peak

  // Value change calc
  const purchaseTotal = (b.purchase_price ?? 0) * b.quantity
  const marketTotal   = (b.market_price   ?? 0) * b.quantity
  const valueChange   = purchaseTotal && marketTotal ? marketTotal - purchaseTotal : null
  const valuePct      = purchaseTotal && valueChange != null
    ? Math.round((valueChange / purchaseTotal) * 100)
    : null

  const addedDate = new Date(b.added_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  const purchaseDate = b.purchase_date
    ? new Date(b.purchase_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : addedDate

  return (
    <div className="pb-8" style={{ background: '#f0e6de', minHeight: '100vh' }}>

      {/* ── Back nav ── */}
      <div className="flex items-center justify-between px-1 pt-1 pb-3">
        <Link href="/cellar" className="flex items-center gap-1 text-sm font-medium"
              style={{ color: '#8b2035' }}>
          ‹ Cellar
        </Link>
      </div>

      {/* ── Hero card ── */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#8b2035' }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold leading-snug text-white flex-1">{wine.name}</h1>
          {wine.critic_score && (
            <div className="text-right shrink-0">
              <p className="text-4xl font-bold leading-none" style={{ color: '#e8c96e' }}>
                {wine.critic_score}
              </p>
              <p className="text-xs uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Critic<br />Score
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {[
            ...(wine.grapes ?? []),
            wine.region || null,
            wine.appellation || null,
            wine.vintage?.toString() || null,
          ].filter(Boolean).map(tag => (
            <span key={tag}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.85)' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Wine details grid ── */}
      <div className="mb-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-2 px-0.5"
           style={{ color: '#a07060', letterSpacing: '0.12em' }}>
          Wine Details
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Producer */}
          {wine.producer && (
            <DetailCell label="Producer" value={wine.producer} />
          )}
          {/* Appellation */}
          {wine.region && (
            <DetailCell label="Appellation" value={wine.region} />
          )}
          {/* Purchase price */}
          {b.purchase_price && (
            <DetailCell label="Purchase price" value={`A$${b.purchase_price}`} />
          )}
          {/* Market price */}
          {b.market_price && (
            <DetailCell label="Market price" value={`A$${b.market_price}`} />
          )}
          {/* Added */}
          <DetailCell label="Added" value={purchaseDate} large />
          {/* Value change */}
          {valueChange !== null && valuePct !== null && (
            <DetailCell
              label="Value change"
              value={`${valueChange >= 0 ? '+' : ''}A$${Math.abs(valueChange)} (${valuePct >= 0 ? '+' : ''}${valuePct}%)`}
              valueColor={valueChange >= 0 ? '#2e7d32' : '#c62828'}
              large
            />
          )}
        </div>
      </div>

      {/* ── Flavour profile ── */}
      {fp && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ecddd4' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold tracking-widest uppercase"
               style={{ color: '#a07060', letterSpacing: '0.12em' }}>
              Flavour Profile
            </p>
            <p className="text-xs" style={{ color: '#c4a090' }}>Source: Wine database</p>
          </div>

          <div className="space-y-2.5">
            {(
              [
                ['Body',      fp.body],
                ['Tannins',   fp.tannins],
                ['Acidity',   fp.acidity],
                ['Alcohol',   fp.alcohol],
                ['Sweetness', fp.sweetness],
                ['Fruit',     fp.fruit],
                ['Oak',       fp.oak],
                ['Finish',    fp.finish],
              ] as [string, number][]
            ).map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs w-16 shrink-0" style={{ color: '#7a4a38' }}>{label}</span>
                {/* Track */}
                <div className="flex-1 relative h-1.5 rounded-full"
                     style={{ background: '#d4b8aa' }}>
                  {/* Fill */}
                  <div className="absolute inset-y-0 left-0 rounded-full"
                       style={{ width: `${val}%`, background: '#8b2035' }} />
                  {/* Dot */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                       style={{ left: `calc(${val}% - 6px)`, background: '#8b2035' }} />
                </div>
                <span className="text-xs w-14 text-right shrink-0 font-medium"
                      style={{ color: '#7a4a38' }}>
                  {flavourLabel(label, val)}
                </span>
              </div>
            ))}
          </div>

          {/* Axis labels */}
          <div className="flex justify-between mt-3">
            {['Low', 'Medium', 'High'].map(l => (
              <span key={l} className="text-xs" style={{ color: '#c4a090' }}>{l}</span>
            ))}
          </div>

          <p className="text-xs mt-3 leading-relaxed" style={{ color: '#b09080' }}>
            Pre-filled from critic and producer data. Reflects the typical expression of this wine and vintage.
          </p>
        </div>
      )}

      {/* ── Drinking window ── */}
      {hasWindow ? (
        <div className="mb-4">
          <DrinkingWindowChart
            drinkFrom={b.drink_from!}
            peak={b.peak!}
            drinkTo={b.drink_to!}
          />
        </div>
      ) : (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: '#ecddd4' }}>
          <p className="text-sm" style={{ color: '#a07060' }}>No drinking window set</p>
          <p className="text-xs mt-1" style={{ color: '#c4a090' }}>
            Scan the label to get an AI drinking window estimate.
          </p>
        </div>
      )}

      {/* ── Cellar count + actions ── */}
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ background: '#ecddd4' }}>
        {/* Count badge */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white text-xl font-bold"
             style={{ background: '#8b2035' }}>
          {b.quantity}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
            {b.quantity} bottle{b.quantity !== 1 ? 's' : ''} in cellar
          </p>
          {(b.purchase_price || b.market_price) && (
            <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
              {purchaseDate} · A${b.purchase_price ?? b.market_price} ea.
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="px-4 py-2 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#3a1a20', color: '#3a1a20', background: 'transparent' }}>
            Drink ↗
          </button>
          <button className="px-4 py-2 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#3a1a20', color: '#3a1a20', background: 'transparent' }}>
            + Add
          </button>
        </div>
      </div>

      {/* ── Tasting notes ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <p className="text-xs font-bold tracking-widest uppercase"
             style={{ color: '#a07060', letterSpacing: '0.12em' }}>
            My Tasting Notes
          </p>
          {notes.length > 1 && (
            <button className="text-xs font-medium" style={{ color: '#8b2035' }}>
              See all
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <div className="rounded-2xl p-4 text-center" style={{ background: '#ecddd4' }}>
            <p className="text-sm" style={{ color: '#c4a090' }}>No tasting notes yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.slice(0, 2).map(note => (
              <TastingNoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>

      {/* Add tasting note input placeholder */}
      <div className="rounded-2xl h-12" style={{ background: '#ecddd4' }} />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function DetailCell({
  label, value, valueColor, large,
}: {
  label: string
  value: string
  valueColor?: string
  large?: boolean
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#ecddd4' }}>
      <p className="text-xs mb-1" style={{ color: '#a07060' }}>{label}</p>
      <p className={`font-semibold leading-tight ${large ? 'text-lg' : 'text-sm'}`}
         style={{ color: valueColor ?? '#3a1a20' }}>
        {value}
      </p>
    </div>
  )
}

function TastingNoteCard({ note }: { note: TastingNote }) {
  const date = new Date(note.tasted_at).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const tags = [...(note.nose_tags ?? []), ...(note.palate_tags ?? [])]

  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
      {/* Score + date */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold" style={{ color: '#3a1a20' }}>
            {note.score} pts ·
          </span>
          {/* Stars */}
          <span className="ml-1 text-sm" style={{ color: '#8b2035' }}>
            {'★'.repeat(note.stars)}{'☆'.repeat(5 - note.stars)}
          </span>
        </div>
        <span className="text-xs shrink-0" style={{ color: '#a07060' }}>{date}</span>
      </div>

      {/* Note text */}
      {note.free_text && (
        <p className="text-sm leading-relaxed" style={{ color: '#3a1a20' }}>{note.free_text}</p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map(tag => (
            <span key={tag}
                  className="text-xs px-2.5 py-1 rounded-full border"
                  style={{ borderColor: '#c4a090', color: '#7a4a38', background: 'transparent' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
