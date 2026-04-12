import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { drinkingStatus, WINE_TYPE_COLOURS, CURRENCY_SYMBOLS } from '@/types/database'
import type { CellarBottle, TastingNote } from '@/types/database'
import ScoreBadge from '@/components/ui/ScoreBadge'
import WindowStatusPill from '@/components/ui/WindowStatusPill'
import WineTypeBar from '@/components/ui/WineTypeBar'
import DrinkingWindowChart from '@/components/ui/DrinkingWindowChart'
import Link from 'next/link'

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

  const b    = bottle as CellarBottle
  const wine = b.wine!
  const notes = (wine.tasting_notes ?? []) as TastingNote[]
  const status = drinkingStatus(b)
  const typeColor = WINE_TYPE_COLOURS[b.wine_type]
  const hasWindow = b.drink_from && b.drink_to && b.peak

  return (
    <div className="space-y-4 pb-6">

      {/* ── Back link ── */}
      <Link href="/cellar" className="flex items-center gap-1 text-sm"
            style={{ color: '#8b2035' }}>
        ← Back to cellar
      </Link>

      {/* ── Hero card ── */}
      <div className="rounded-2xl overflow-hidden">
        {/* Colour bar top */}
        <div className="h-2" style={{ background: typeColor }} />
        <div className="p-4 space-y-3" style={{ background: '#ecddd4' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg leading-tight" style={{ color: '#3a1a20' }}>
                {wine.name}
              </h1>
              {wine.producer && (
                <p className="text-sm mt-0.5" style={{ color: '#a07060' }}>{wine.producer}</p>
              )}
            </div>
            <ScoreBadge score={wine.critic_score ?? null} />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {[
              b.wine_type,
              wine.vintage?.toString(),
              wine.region,
              wine.grapes?.[0],
            ].filter(Boolean).map(tag => (
              <span key={tag}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: '#f5ede6', color: '#7a4530' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Quantity + status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: '#3a1a20' }}>×{b.quantity}</span>
              <span className="text-sm" style={{ color: '#a07060' }}>
                bottle{b.quantity !== 1 ? 's' : ''} in cellar
              </span>
            </div>
            <WindowStatusPill status={status} />
          </div>

          {/* Purchase info */}
          {b.purchase_price && (
            <p className="text-xs" style={{ color: '#c4a090' }}>
              Purchased {b.purchase_date ? new Date(b.purchase_date).getFullYear() : ''} ·{' '}
              {CURRENCY_SYMBOLS[b.purchase_currency]}{b.purchase_price} per bottle
            </p>
          )}
        </div>
      </div>

      {/* ── Drinking window ── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <h2 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>Drinking window</h2>
        {hasWindow ? (
          <>
            <DrinkingWindowChart
              drinkFrom={b.drink_from!}
              peak={b.peak!}
              drinkTo={b.drink_to!}
            />
            <div className="flex gap-3 pt-1">
              {[
                { label: 'Opens',  value: b.drink_from },
                { label: 'Peak',   value: b.peak       },
                { label: 'Closes', value: b.drink_to   },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 text-center rounded-xl py-2.5"
                     style={{ background: '#f5ede6' }}>
                  <p className="text-xs" style={{ color: '#a07060' }}>{label}</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#3a1a20' }}>{value}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm" style={{ color: '#a07060' }}>No drinking window set for this bottle.</p>
            <p className="text-xs" style={{ color: '#c4a090' }}>
              Add a bottle via the scanner to get an AI drinking window estimate.
            </p>
          </div>
        )}
      </div>

      {/* ── Flavour profile ── */}
      {wine.flavour_profile && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>Flavour profile</h2>
          <div className="space-y-2">
            {(
              [
                ['Body',     wine.flavour_profile.body],
                ['Tannins',  wine.flavour_profile.tannins],
                ['Acidity',  wine.flavour_profile.acidity],
                ['Fruit',    wine.flavour_profile.fruit],
                ['Oak',      wine.flavour_profile.oak],
                ['Finish',   wine.flavour_profile.finish],
              ] as [string, number][]
            ).map(([label, val]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs w-14 shrink-0" style={{ color: '#a07060' }}>{label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                     style={{ background: 'rgba(0,0,0,0.08)' }}>
                  <div className="h-full rounded-full"
                       style={{ width: `${val}%`, background: typeColor }} />
                </div>
                <span className="text-xs w-6 text-right" style={{ color: '#a07060' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tasting notes ── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>
            Tasting notes
            {notes.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: '#a07060' }}>
                {notes.length}
              </span>
            )}
          </h2>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: '#c4a090' }}>
            No tasting notes yet.
          </p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="rounded-xl p-3 space-y-1"
                 style={{ background: '#f5ede6' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: '#a07060' }}>
                  {new Date(note.tasted_at).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
                {note.score && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: '#8b2035' }}>
                    {note.score}
                  </span>
                )}
              </div>
              {note.free_text && (
                <p className="text-sm" style={{ color: '#3a1a20' }}>{note.free_text}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Source ── */}
      {wine.db_source && (
        <p className="text-xs text-center" style={{ color: '#d4b8aa' }}>
          Data source: {wine.db_source}
        </p>
      )}
    </div>
  )
}
