'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ScoreBadge from '@/components/ui/ScoreBadge'
import StarRating from '@/components/ui/StarRating'
import type { TastingNote, WineType } from '@/types/database'

const WINE_TYPE_BAR_COLOURS: Record<WineType, string> = {
  Red:       '#8b2035',
  White:     '#d4c060',
  Rosé:      '#e8a0b0',
  Champagne: '#c8b860',
}

const COPY = {
  en: {
    greeting:        (h: number) => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
    bottles:         'Bottles',
    tastingNotes:    'Tasting notes',
    drinkSoon:       'Drink soon',
    addBottle:       'Add a bottle',
    pairPlaceholder: 'e.g. Roast lamb with rosemary',
    pairButton:      'Match',
    findPlaceholder: 'e.g. something bold and oaky for a cold night',
    findButton:      'Find',
    recentNotes:     'Recent notes',
    noNotes:         'No tasting notes yet. Add bottles to your cellar to get started.',
    unknownWine:     'Unknown wine',
  },
  it: {
    greeting:        (h: number) => h < 12 ? 'Buongiorno' : h < 17 ? 'Buon pomeriggio' : 'Buona sera',
    bottles:         'Bottiglie',
    tastingNotes:    'Note di degustazione',
    drinkSoon:       'Da bere presto',
    addBottle:       'Aggiungi una bottiglia',
    pairPlaceholder: 'es. Agnello arrosto al rosmarino',
    pairButton:      'Abbina',
    findPlaceholder: 'es. qualcosa di corposo e legnoso per una fredda serata',
    findButton:      'Cerca',
    recentNotes:     'Note recenti',
    noNotes:         'Nessuna nota di degustazione. Aggiungi bottiglie alla cantina per iniziare.',
    unknownWine:     'Vino sconosciuto',
  },
} as const

type Lang = keyof typeof COPY

interface Props {
  name:         string | null
  totalBottles: number
  drinkSoon:    number
  noteCount:    number
  recentNotes:  TastingNote[]
  /** Chart rendered server-side and streamed in via Suspense */
  chartSlot:    React.ReactNode
}

function SetNamePrompt() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function save() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Please enter your first name'); return }
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
    if (err) { setError(err.message); return }
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4', border: '1.5px solid #d4b8aa' }}>
      <div className="flex items-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3a1a20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>What&apos;s your first name?</h3>
      </div>
      <p className="text-xs" style={{ color: '#a07060' }}>We&apos;ll use it to personalise your greeting.</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="e.g. Tom"
          className="flex-1 px-3 py-2 rounded-lg text-sm border"
          style={{ background: '#f5ede6', borderColor: error ? '#8b2035' : '#d4b8aa', color: '#3a1a20' }}
        />
        <button
          onClick={save}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#8b2035', opacity: isPending ? 0.6 : 1 }}
        >
          Save
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: '#8b2035' }}>{error}</p>}
    </div>
  )
}

export default function HomeClient({ name, totalBottles, drinkSoon, noteCount, recentNotes, chartSlot }: Props) {
  const [lang, setLang] = useState<Lang>('en')
  const [aiTab, setAiTab] = useState<'pair' | 'find'>('pair')
  const hour = new Date().getHours()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vino-lang') as Lang | null
      if (saved === 'it' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  const t = COPY[lang]

  return (
    <div className="space-y-5 pb-4">

      {/* ── Greeting ── */}
      <h2 className="text-xl font-semibold" style={{ color: '#3a1a20' }}>
        {name ? `${t.greeting(hour)}, ${name}` : t.greeting(hour)}
      </h2>

      {/* ── Name prompt (shown only when name not yet set) ── */}
      {!name && <SetNamePrompt />}

      {/* ── Stats row — individual cards ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Bottles → cellar */}
        <Link href="/cellar" className="text-center py-4 px-2 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: '#ecddd4' }}>
          <div className="text-2xl font-bold" style={{ color: '#3a1a20' }}>{totalBottles}</div>
          <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{t.bottles}</div>
        </Link>

        {/* Tasting notes → journal */}
        <Link href="/journal" className="text-center py-4 px-2 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: '#ecddd4' }}>
          <div className="text-2xl font-bold" style={{ color: '#3a1a20' }}>{noteCount}</div>
          <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{t.tastingNotes}</div>
        </Link>

        {/* Drink soon → cellar (no filter needed — drink-soon banner handles it) */}
        <Link href="/cellar" className="text-center py-4 px-2 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: '#ecddd4' }}>
          <div className="text-2xl font-bold"
               style={{ color: drinkSoon > 0 ? '#8b2035' : '#3a1a20' }}>
            {drinkSoon}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#a07060' }}>{t.drinkSoon}</div>
        </Link>
      </div>

      {/* ── Cellar balance chart (streamed in via Suspense) ── */}
      {chartSlot}

      {/* ── Add a bottle ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#ecddd4' }}>
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3a1a20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{t.addBottle}</h3>
        </div>
        <div className="flex gap-2">
          <a href="/scan"
             className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white"
             style={{ background: '#8b2035' }}>
            {/* Barcode / scan icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <rect x="7" y="7" width="3" height="10"/><rect x="14" y="7" width="3" height="10"/>
            </svg>
            Scan a bottle
          </a>
          <a href="/add"
             className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold"
             style={{ background: '#f5ede6', color: '#8b2035', border: '1.5px solid #8b2035' }}>
            {/* Pencil icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Add manually
          </a>
        </div>
      </div>

      {/* ── AI assistant — Pair / Find in a single card ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#ecddd4' }}>
        {/* Tab bar */}
        <div className="flex" style={{ borderBottom: '1px solid #d4b8aa' }}>
          {([
            {
              id: 'pair' as const,
              label: 'Pair a meal',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                </svg>
              ),
            },
            {
              id: 'find' as const,
              label: 'Find a style',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              ),
            },
          ] as const).map(tab => {
            const active = aiTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setAiTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
                style={{
                  color:      active ? '#8b2035' : '#a07060',
                  background: active ? '#f5ede6' : 'transparent',
                  borderBottom: active ? '2px solid #8b2035' : '2px solid transparent',
                }}
              >
                {tab.icon}{tab.label}
              </button>
            )
          })}
        </div>

        {/* Input area */}
        <div className="p-3">
          {aiTab === 'pair' ? (
            <form action="/pairing" method="get" className="flex gap-2">
              <input name="meal" type="text" placeholder={t.pairPlaceholder}
                className="flex-1 px-3 py-2 rounded-lg text-sm border"
                style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }} />
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
                style={{ background: '#8b2035' }}>{t.pairButton}</button>
            </form>
          ) : (
            <form action="/find" method="get" className="flex gap-2">
              <input name="q" type="text" placeholder={t.findPlaceholder}
                className="flex-1 px-3 py-2 rounded-lg text-sm border"
                style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }} />
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
                style={{ background: '#8b2035' }}>{t.findButton}</button>
            </form>
          )}
        </div>
      </div>

      {/* ── Recent notes ── */}
      <div className="space-y-3">
        <h3 className="font-semibold" style={{ color: '#3a1a20' }}>{t.recentNotes}</h3>
        {recentNotes.length === 0 ? (
          <p className="text-sm" style={{ color: '#c4a090' }}>{t.noNotes}</p>
        ) : (
          recentNotes.map(note => {
            const wineType = (note.wine as { wine_type?: WineType } | undefined)?.wine_type
            const barColour = wineType ? WINE_TYPE_BAR_COLOURS[wineType] : '#8b2035'
            return (
              <div key={note.id} className="rounded-xl p-3 flex gap-3" style={{ background: '#ecddd4' }}>
                <div className="w-1 rounded-sm shrink-0" style={{ background: barColour }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate" style={{ color: '#3a1a20' }}>
                      {note.wine?.name ?? t.unknownWine}
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
            )
          })
        )}
      </div>
    </div>
  )
}
