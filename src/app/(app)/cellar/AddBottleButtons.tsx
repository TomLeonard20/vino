'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function AddButton({
  href,
  children,
}: {
  href:     string
  children: React.ReactNode
}) {
  const router  = useRouter()
  const [down, setDown] = useState(false)

  return (
    <button
      onPointerDown={() => setDown(true)}
      onPointerUp={() => { setDown(false); router.push(href) }}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border"
      style={{
        borderColor: '#8b2035',
        color:       '#8b2035',
        background:  down ? 'rgba(139,32,53,0.12)' : '#f5ede6',
        transition:  down ? 'none' : 'background 0.15s',
        cursor:      'pointer',
      }}
    >
      {children}
    </button>
  )
}

const ScanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="7" y2="12"/>
    <line x1="12" y1="12" x2="17" y2="12"/>
  </svg>
)

const PenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export default function AddBottleButtons() {
  return (
    <div className="flex gap-2 pt-1">
      <AddButton href="/scan"><ScanIcon /> Scan label</AddButton>
      <AddButton href="/add"><PenIcon /> Add manually</AddButton>
    </div>
  )
}
