import { createClient } from '@/lib/supabase/server'
import type { TastingNote, WineType } from '@/types/database'
import { WINE_TYPE_COLOURS } from '@/types/database'
import ScoreBadge from '@/components/ui/ScoreBadge'
import StarRating from '@/components/ui/StarRating'
import WineTypeBar from '@/components/ui/WineTypeBar'

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; sort?: string }>
}) {
  const { q, type: filterType, sort } = await searchParams
  const supabase = await createClient()
  const ascending = sort === 'asc'

  const { data } = await supabase
    .from('tasting_notes')
    .select('*, wine:wines(*)')
    .order('score', { ascending })

  let notes = (data ?? []) as TastingNote[]

  if (filterType && filterType !== 'All') {
    // Filter by matching bottle type — we join via wines, use grapes/type heuristic
    // In Phase 2 this will use the wine_type from cellar_bottles properly
  }

  if (q) {
    const qLower = q.toLowerCase()
    notes = notes.filter(n =>
      n.wine?.name?.toLowerCase().includes(qLower) ||
      n.free_text.toLowerCase().includes(qLower) ||
      [...n.nose_tags, ...n.palate_tags].some(t => t.toLowerCase().includes(qLower))
    )
  }

  const avgScore = notes.length
    ? (notes.reduce((s, n) => s + n.score, 0) / notes.length).toFixed(1)
    : null
  const thisYear = new Date().getFullYear()
  const thisYearCount = notes.filter(n =>
    new Date(n.tasted_at).getFullYear() === thisYear
  ).length

  return (
    <div className="space-y-5 pb-4">
      {/* Search */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Search wines, aromas, notes…"
          className="flex-1 px-3 py-2 rounded-lg text-sm border"
          style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }}
        />
        {q && (
          <a href="/journal"
             className="px-3 py-2 rounded-lg text-sm"
             style={{ color: '#a07060' }}>
            Clear
          </a>
        )}
      </form>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border"
           style={{ borderColor: '#d4b8aa' }}>
        {[
          { label: 'Notes', value: notes.length },
          { label: 'Avg score', value: avgScore ?? '—' },
          { label: 'This year', value: thisYearCount },
        ].map(s => (
          <div key={s.label} className="text-center py-3 px-2" style={{ background: '#ecddd4' }}>
            <div className="text-xl font-bold" style={{ color: '#3a1a20' }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sort toggle */}
      <div className="flex justify-end">
        <a
          href={`/journal${q ? `?q=${q}&` : '?'}sort=${ascending ? 'desc' : 'asc'}`}
          className="text-xs font-medium flex items-center gap-1"
          style={{ color: '#8b2035' }}
        >
          {ascending ? '↑' : '↓'} Score
        </a>
      </div>

      {/* Note list */}
      {notes.length === 0 ? (
        <p className="text-center text-sm py-8" style={{ color: '#c4a090' }}>
          No tasting notes yet.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note, idx) => (
            <NoteCard key={note.id} note={note} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteCard({ note, rank }: { note: TastingNote; rank: number }) {
  const isTop3 = rank <= 3
  const allTags = [...note.nose_tags, ...note.palate_tags]

  return (
    <div className="rounded-xl overflow-hidden flex" style={{ background: '#ecddd4' }}>
      <WineTypeBar type="Red" />
      <div className="flex-1 px-3 py-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs font-bold shrink-0"
              style={{ color: isTop3 ? '#8b2035' : '#c4a090' }}
            >
              #{rank}
            </span>
            <span className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
              {note.wine?.name ?? 'Unknown wine'}
            </span>
          </div>
          <ScoreBadge score={note.score} size="sm" />
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <StarRating stars={note.stars} size={11} />
          {note.wine?.region && (
            <span className="text-xs" style={{ color: '#a07060' }}>
              · {note.wine.region}
            </span>
          )}
          {note.wine?.vintage && (
            <span className="text-xs" style={{ color: '#a07060' }}>
              · {note.wine.vintage}
            </span>
          )}
        </div>

        {note.free_text && (
          <p className="text-xs mt-1 line-clamp-2" style={{ color: '#a07060' }}>
            {note.free_text}
          </p>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.slice(0, 5).map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,32,53,0.1)', color: '#8b2035' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
