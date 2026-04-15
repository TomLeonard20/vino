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

// Gold "Shared" badge
const SharedBadge = () => (
  <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#c8a84b', color: '#fff', fontSize: 9, letterSpacing: '0.02em' }}>
    Shared
  </span>
)

export default function CellarSwitcher({ cellars, activeCellarId }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const active = cellars.find(c => c.id === activeCellarId) ?? cellars[0]

  // Single cellar — static pill (no dropdown)
  if (cellars.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
           style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}>
        <WineGlassIcon />
        <span>{active?.name ?? 'My Cellar'}</span>
        {active?.isShared && <SharedBadge />}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}
      >
        <WineGlassIcon />
        <span>{active?.name ?? 'My Cellar'}</span>
        {active?.isShared && <SharedBadge />}
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
                onClick={() => {
                  setOpen(false)
                  router.push(`/cellar?cellar=${c.id}`)
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left"
                style={{
                  background: c.id === activeCellarId ? '#ecddd4' : 'transparent',
                  color: '#3a1a20',
                  fontWeight: c.id === activeCellarId ? 600 : 400,
                }}
              >
                <div className="flex items-center gap-2">
                  <WineGlassIcon />
                  <span>{c.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.isShared && <SharedBadge />}
                  {c.id === activeCellarId && (
                    <span style={{ color: '#8b2035' }}>✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WineGlassIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22h8"/>
      <path d="M7 10h10"/>
      <path d="M12 15v7"/>
      <path d="M17 2H7l2 8a3 3 0 0 0 6 0l2-8z"/>
    </svg>
  )
}
