'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ScoreBadge from '@/components/ui/ScoreBadge'
import StarRating from '@/components/ui/StarRating'
import CellarBalanceChart from '@/components/ui/CellarBalanceChart'
import type { CellarBottle, TastingNote } from '@/types/database'

type Lang = 'en' | 'it'

const COPY = {
  en: {
    greeting:         (h: number) => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
    bottles:          'Bottles',
    tastingNotes:     'Tasting notes',
    drinkSoon:        'Drink soon',
    chartTitle:       'Cellar by Vintage',
    chartUnlock:      (n: number) => `Chart unlocks once you've added 10 bottles${n > 0 ? ` · ${n} of 10 so far` : ''}.`,
    addBottle:        'Add a bottle',
    pairTitle:        'Pair my meal',
    pairDesc:         "Tell us what you're eating and we'll rank your cellar + suggest styles.",
    pairPlaceholder:  'e.g. Roast lamb with rosemary',
    pairButton:       'Match',
    findTitle:        'What are you looking for?',
    findDesc:         "Describe the style, mood or occasion and we'll recommend the best grapes and regions.",
    findPlaceholder:  'e.g. something bold and oaky for a cold night',
    findButton:       'Find',
    recentNotes:      'Recent notes',
    noNotes:          'No tasting notes yet. Add bottles to your cellar to get started.',
    viewCellar:       'View my cellar →',
    unknownWine:      'Unknown wine',
  },
  it: {
    greeting:         (h: number) => h < 12 ? 'Buongiorno' : h < 17 ? 'Buon pomeriggio' : 'Buona sera',
    bottles:          'Bottiglie',
    tastingNotes:     'Note di degustazione',
    drinkSoon:        'Da bere presto',
    chartTitle:       'Cantina per Annata',
    chartUnlock:      (n: number) => `Il grafico si sblocca dopo 10 bottiglie${n > 0 ? ` · ${n} di 10 finora` : ''}.`,
    addBottle:        'Aggiungi una bottiglia',
    pairTitle:        'Abbina il mio pasto',
    pairDesc:         "Dicci cosa stai mangiando e classificheremo la tua cantina + suggeriremo gli stili.",
    pairPlaceholder:  'es. Agnello arrosto al rosmarino',
    pairButton:       'Abbina',
    findTitle:        'Cosa stai cercando?',
    findDesc:         "Descrivi lo stile, l'umore o l'occasione e consiglieremo i migliori vitigni e regioni.",
    findPlaceholder:  'es. qualcosa di corposo e legnoso per una fredda serata',
    findButton:       'Cerca',
    recentNotes:      'Note recenti',
    noNotes:          'Nessuna nota di degustazione. Aggiungi bottiglie alla cantina per iniziare.',
    viewCellar:       'Vai alla mia cantina →',
    unknownWine:      'Vino sconosciuto',
  },
} as const

interface Props {
  name:          string
  totalBottles:  number
  drinkSoon:     number
  noteCount:     number
  allBottles:    CellarBottle[]
  recentNotes:   TastingNote[]
}

export default function HomeClient({ name, totalBottles, drinkSoon, noteCount, allBottles, recentNotes }: Props) {
  const [lang, setLang]   = useState<Lang>('en')
  const [open, setOpen]   = useState(false)
  const hour = new Date().getHours()

  // Persist language preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vino-lang') as Lang | null
      if (saved === 'it' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  function selectLang(l: Lang) {
    setLang(l)
    setOpen(false)
    try { localStorage.setItem('vino-lang', l) } catch {}
  }

  const t = COPY[lang]

  const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  ]
  const current = LANGUAGES.find(l => l.code === lang)!

  return (
    <div className="space-y-5 pb-4">

      {/* ── Greeting + language selector ── */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold" style={{ color: '#3a1a20' }}>
          {t.greeting(hour)}, {name}
        </h2>

        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}
          >
            <span>{current.flag}</span>
            <span>{current.label}</span>
            <span style={{ color: '#a07060', fontSize: 9 }}>▾</span>
          </button>

          {open && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              {/* Menu */}
              <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden shadow-lg"
                   style={{ background: '#f5ede6', border: '1px solid #d4b8aa', minWidth: 130 }}>
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => selectLang(l.code)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                    style={{
                      background: lang === l.code ? '#ecddd4' : 'transparent',
                      color: '#3a1a20',
                      fontWeight: lang === l.code ? 600 : 400,
                    }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {lang === l.code && <span className="ml-auto" style={{ color: '#8b2035' }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border"
           style={{ borderColor: '#d4b8aa' }}>
        {[
          { label: t.bottles,      value: totalBottles },
          { label: t.tastingNotes, value: noteCount },
          { label: t.drinkSoon,    value: drinkSoon, highlight: drinkSoon > 0 },
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

      {/* ── Cellar balance chart ── */}
      {totalBottles >= 10 ? (
        <CellarBalanceChart bottles={allBottles} />
      ) : (
        <div className="rounded-2xl px-4 py-5 flex items-center gap-3"
             style={{ background: '#ecddd4', border: '1.5px dashed #c4a090' }}>
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#3a1a20' }}>{t.chartTitle}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
              {t.chartUnlock(totalBottles)}
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
        {t.addBottle}
      </a>

      {/* ── Pair my meal ── */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🍽️</span>
          <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{t.pairTitle}</h3>
        </div>
        <p className="text-xs" style={{ color: '#a07060' }}>{t.pairDesc}</p>
        <form action="/pairing" method="get" className="flex gap-2 pt-1">
          <input
            name="meal"
            type="text"
            placeholder={t.pairPlaceholder}
            className="flex-1 px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
          />
          <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: '#8b2035' }}>
            {t.pairButton}
          </button>
        </form>
      </div>

      {/* ── What are you looking for? ── */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#ecddd4' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <h3 className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{t.findTitle}</h3>
        </div>
        <p className="text-xs" style={{ color: '#a07060' }}>{t.findDesc}</p>
        <form action="/find" method="get" className="flex gap-2 pt-1">
          <input
            name="q"
            type="text"
            placeholder={t.findPlaceholder}
            className="flex-1 px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#f5ede6', borderColor: '#d4b8aa', color: '#3a1a20' }}
          />
          <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: '#8b2035' }}>
            {t.findButton}
          </button>
        </form>
      </div>

      {/* ── Recent notes ── */}
      <div className="space-y-3">
        <h3 className="font-semibold" style={{ color: '#3a1a20' }}>{t.recentNotes}</h3>
        {recentNotes.length === 0 ? (
          <p className="text-sm" style={{ color: '#c4a090' }}>{t.noNotes}</p>
        ) : (
          recentNotes.map(note => (
            <div key={note.id} className="rounded-xl p-3 flex gap-3"
                 style={{ background: '#ecddd4' }}>
              <div className="w-1 rounded-sm" style={{ background: '#8b2035' }} />
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
          ))
        )}
      </div>

      <Link
        href="/cellar"
        className="block w-full text-center py-3 rounded-xl text-sm font-semibold border"
        style={{ borderColor: '#8b2035', color: '#8b2035' }}
      >
        {t.viewCellar}
      </Link>
    </div>
  )
}
