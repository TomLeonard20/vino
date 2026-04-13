import { createClient } from '@/lib/supabase/server'
import { drinkingStatus, starsForScore, CURRENCY_SYMBOLS } from '@/types/database'
import type { CellarBottle, TastingNote } from '@/types/database'
import ScoreBadge from '@/components/ui/ScoreBadge'
import StarRating from '@/components/ui/StarRating'
import CellarBalanceChart from '@/components/ui/CellarBalanceChart'
import Link from 'next/link'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Pull first name from either display_name metadata or the email prefix */
function firstName(user: { email?: string; user_metadata?: Record<string, string> } | null): string {
  if (!user) return 'there'
  const full = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
  if (full) return full.split(' ')[0]
  // Fall back to email prefix, but capitalise and strip numbers
  const prefix = user.email?.split('@')[0] ?? ''
  return prefix.replace(/\d+/g, '').replace(/^./, c => c.toUpperCase()) || 'there'
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: bottles }, { data: notes }] = await Promise.all([
    supabase.from('cellar_bottles').select('*, wine:wines(*)'),
    supabase.from('tasting_notes').select('*, wine:wines(*)').order('tasted_at', { ascending: false }).limit(2),
  ])

  const allBottles  = (bottles ?? []) as CellarBottle[]
  const recentNotes = (notes   ?? []) as TastingNote[]

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon    = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length

  const name = firstName(user as Parameters<typeof firstName>[0])

  return (
    <div className="space-y-5 pb-4">

      {/* ── Greeting ── */}
      <h2 className="text-xl font-semibold" style={{ color: '#3a1a20' }}>
        {greeting()}, {name}
      </h2>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border"
           style={{ borderColor: '#d4b8aa' }}>
        {[
          { label: 'Bottles',       value: totalBottles },
          { label: 'Tasting notes', value: recentNotes.length },
          { label: 'Drink soon',    value: drinkSoon, highlight: drinkSoon > 0 },
        ].map(s => (
          <div key={s.label} className="text-center py-4 px-2" style={{ background: '#ecddd4' }}>
            <div className="text-2xl font-bold"
                 style={{ color: 'highlight' in s && s.highlight ? '#8b2035' : '#3a1a20' }}>
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Cellar balance ── */}
      {totalBottles >= 10 ? (
        <CellarBalanceChart bottles={allBottles} />
      ) : (
        <div className="rounded-2xl px-4 py-5 flex items-center gap-3"
             style={{ background: '#ecddd4', border: '1.5px dashed #c4a090' }}>
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#3a1a20' }}>Cellar by Vintage</p>
            <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
              Chart unlocks once you&apos;ve added 10 bottles
              {totalBottles > 0 ? ` · ${totalBottles} of 10 so far` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* ── Add a bottle ── */}
      <a
        href="/scan"
        className="flex items-center justify-center gap-2 rounded-xl py-4 text-white font-semibold"
        style={{ background: '#8b2035' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
          <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
          <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
          <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          <rect x="7" y="7" width="3" height="10"/>
          <rect x="14" y="7" width="3" height="10"/>
        </svg>
        Add a bottle
      </a>

      {/* ── 1. Pair my meal ── */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🍽️</span>
          <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>Pair my meal</h3>
        </div>
        <p className="text-xs" style={{ color: '#a07060' }}>
          Tell us what you&apos;re eating and we&apos;ll rank your cellar + suggest styles.
        </p>
        <form action="/pairing" method="get" className="flex gap-2 pt-1">
          <input
            name="meal"
            type="text"
            placeholder="e.g. Roast lamb with rosemary"
            className="flex-1 px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
          />
          <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: '#8b2035' }}>
            Match
          </button>
        </form>
      </div>

      {/* ── 2. What are you looking for? ── */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>What are you looking for?</h3>
        </div>
        <p className="text-xs" style={{ color: '#a07060' }}>
          Describe what you&apos;re after and we&apos;ll recommend the best grapes and styles.
        </p>
        <form action="/find" method="get" className="flex gap-2 pt-1">
          <input
            name="q"
            type="text"
            placeholder="e.g. something bold and oaky for a cold night"
            className="flex-1 px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
          />
          <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: '#8b2035' }}>
            Find
          </button>
        </form>
      </div>

      {/* ── Recent notes ── */}
      <div className="space-y-3">
        <h3 className="font-semibold" style={{ color: '#3a1a20' }}>Recent notes</h3>
        {recentNotes.length === 0 ? (
          <p className="text-sm" style={{ color: '#c4a090' }}>
            No tasting notes yet. Add bottles to your cellar to get started.
          </p>
        ) : (
          recentNotes.map(note => (
            <div key={note.id} className="rounded-xl p-3 flex gap-3"
                 style={{ background: '#ecddd4' }}>
              <div className="w-1 rounded-sm" style={{ background: '#8b2035' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
                    {note.wine?.name ?? 'Unknown wine'}
                  </span>
                  <ScoreBadge score={note.score} size="sm" />
                </div>
                <StarRating stars={note.stars} size={11} />
                {note.free_text && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: '#a07060' }}>
                    {note.free_text}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Link
        href="/cellar"
        className="block w-full text-center py-3 rounded-xl text-sm font-semibold border"
        style={{ borderColor: '#8b2035', color: '#8b2035' }}
      >
        View my cellar →
      </Link>
    </div>
  )
}
