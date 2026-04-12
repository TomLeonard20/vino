import { createClient } from '@/lib/supabase/server'
import { drinkingStatus, starsForScore, CURRENCY_SYMBOLS } from '@/types/database'
import type { CellarBottle, TastingNote } from '@/types/database'
import ScoreBadge from '@/components/ui/ScoreBadge'
import StarRating from '@/components/ui/StarRating'
import Link from 'next/link'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: bottles }, { data: notes }] = await Promise.all([
    supabase.from('cellar_bottles').select('*, wine:wines(*)'),
    supabase.from('tasting_notes').select('*, wine:wines(*)').order('tasted_at', { ascending: false }).limit(2),
  ])

  const allBottles = (bottles ?? []) as CellarBottle[]
  const recentNotes = (notes ?? []) as TastingNote[]

  const totalBottles = allBottles.reduce((s, b) => s + b.quantity, 0)
  const drinkSoon = allBottles.filter(b => {
    const s = drinkingStatus(b)
    return s === 'Drink now' || s === 'At peak' || s === 'Open soon'
  }).length

  const firstName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-5 pb-4">
      {/* Greeting */}
      <h2 className="text-xl font-semibold" style={{ color: '#3a1a20' }}>
        {greeting()}, {firstName}
      </h2>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border"
           style={{ borderColor: '#d4b8aa' }}>
        {[
          { label: 'Bottles', value: totalBottles },
          { label: 'Tasting notes', value: recentNotes.length },
          { label: 'Drink soon', value: drinkSoon, highlight: drinkSoon > 0 },
        ].map(s => (
          <div key={s.label} className="text-center py-4 px-2"
               style={{ background: '#ecddd4' }}>
            <div className="text-2xl font-bold"
                 style={{ color: s.highlight ? '#8b2035' : '#3a1a20' }}>
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pair my meal card */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <h3 className="font-semibold" style={{ color: '#3a1a20' }}>Pair my meal</h3>
        <form action="/pairing" method="get" className="flex gap-2">
          <input
            name="meal"
            type="text"
            placeholder="What are you eating tonight?"
            className="flex-1 px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#8b2035' }}
          >
            Match
          </button>
        </form>
      </div>

      {/* Scan CTA */}
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
        Scan a bottle
      </a>

      {/* Recent notes */}
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
