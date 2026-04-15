'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Cellar {
  id: string
  name: string
  memberCount: number
  isShared: boolean
}

interface Props {
  cellars: Cellar[]
  activeCellarId: string
}

export default function CellarSwitcher({ cellars, activeCellarId }: Props) {
  const router = useRouter()

  // ── Single cellar — static label, nothing to switch ──────────
  if (cellars.length <= 1) {
    const c = cellars[0]
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
           style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}>
        <WineGlassIcon />
        <span>{c?.name ?? 'My Cellar'}</span>
        {c?.isShared && <SharedDot />}
      </div>
    )
  }

  // ── Two cellars — segmented toggle ────────────────────────────
  if (cellars.length === 2) {
    return (
      <div className="flex rounded-full p-0.5"
           style={{ background: '#d4b8aa' }}>
        {cellars.map(c => {
          const active = c.id === activeCellarId
          return (
            <button
              key={c.id}
              onClick={() => { if (!active) router.push(`/cellar?cellar=${c.id}`) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background:  active ? '#8b2035' : 'transparent',
                color:       active ? 'white'   : '#3a1a20',
                fontWeight:  active ? 600       : 400,
              }}
            >
              {c.isShared
                ? <SharedDot active={active} />
                : <WineGlassIcon active={active} />
              }
              <span>{c.name}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Three+ cellars — dropdown ─────────────────────────────────
  return <CellarDropdown cellars={cellars} activeCellarId={activeCellarId} />
}

// ── Dropdown (3+ cellars) ─────────────────────────────────────

function CellarDropdown({ cellars, activeCellarId }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const active = cellars.find(c => c.id === activeCellarId) ?? cellars[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}
      >
        <WineGlassIcon />
        <span>{active?.name ?? 'My Cellar'}</span>
        {active?.isShared && <SharedDot />}
        <span style={{ color: '#a07060', fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden shadow-lg"
               style={{ background: '#f5ede6', border: '1px solid #d4b8aa', minWidth: 170 }}>
            {cellars.map(c => (
              <button
                key={c.id}
                onClick={() => { setOpen(false); router.push(`/cellar?cellar=${c.id}`) }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left"
                style={{
                  background: c.id === activeCellarId ? '#ecddd4' : 'transparent',
                  color:      '#3a1a20',
                  fontWeight: c.id === activeCellarId ? 600 : 400,
                }}
              >
                <div className="flex items-center gap-2">
                  <WineGlassIcon />
                  <span>{c.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.isShared && <SharedDot />}
                  {c.id === activeCellarId && <span style={{ color: '#8b2035' }}>✓</span>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Icons & badges ────────────────────────────────────────────

function WineGlassIcon({ active }: { active?: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'white' : 'currentColor'}
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22h8"/>
      <path d="M7 10h10"/>
      <path d="M12 15v7"/>
      <path d="M17 2H7l2 8a3 3 0 0 0 6 0l2-8z"/>
    </svg>
  )
}

function SharedDot({ active }: { active?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: active ? 'rgba(255,255,255,0.8)' : '#c8a84b' }} />
    </span>
  )
}
