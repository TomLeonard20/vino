'use client'

import { useState, useEffect } from 'react'

type Lang = 'en' | 'it'
const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
]

export default function LanguageSelector() {
  const [lang, setLang] = useState<Lang>('en')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vino-lang') as Lang | null
      if (saved === 'en' || saved === 'it') setLang(saved)
    } catch {}
  }, [])

  function select(l: Lang) {
    setLang(l)
    setOpen(false)
    try { localStorage.setItem('vino-lang', l) } catch {}
  }

  const current = LANGUAGES.find(l => l.code === lang)!

  return (
    <div className="flex justify-between items-center px-4 py-3 relative"
         style={{ background: '#f5ede6' }}>
      <span className="text-sm" style={{ color: '#a07060' }}>Language</span>

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
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden shadow-lg"
                 style={{ background: '#f5ede6', border: '1px solid #d4b8aa', minWidth: 130 }}>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => select(l.code)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left"
                  style={{
                    background: lang === l.code ? '#ecddd4' : 'transparent',
                    color:      '#3a1a20',
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
  )
}
