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
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const active = cellars.find(c => c.id === activeCellarId) ?? cellars[0]

  // Only show switcher if user has more than one cellar
  if (cellars.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
           style={{ background: '#ecddd4', color: '#3a1a20', border: '1.5px solid #d4b8aa' }}>
        <span>🍷</span>
        <span>{active?.name ?? 'My Cellar'}</span>
        {active?.isShared && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-white font-semibold"
                style={{ background: '#8b2035', fontSize: 9 }}>
            {active.memberCount}
          </span>
        )}
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
        <span>🍷</span>
        <span>{active?.name ?? 'My Cellar'}</span>
        {active?.isShared && (
          <span className="px-1.5 py-0.5 rounded-full text-white font-semibold"
                style={{ background: '#8b2035', fontSize: 9 }}>
            {active.memberCount}
          </span>
        )}
        <span style={{ color: '#a07060', fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden shadow-lg"
               style={{ background: '#f5ede6', border: '1px solid #d4b8aa', minWidth: 160 }}>
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
                  <span>🍷</span>
                  <span>{c.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.isShared && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: '#8b2035', fontSize: 9 }}>
                      {c.memberCount} members
                    </span>
                  )}
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
