'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Home, BookOpen, Wine, Utensils, User as UserIcon } from 'lucide-react'

const tabs = [
  { href: '/',        label: 'Home',    icon: Home },
  { href: '/cellar',  label: 'Cellar',  icon: Wine },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/pairing', label: 'Pairing', icon: Utensils },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

export default function Nav({ user }: { user: User }) {
  const pathname = usePathname()
  const router   = useRouter()
  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'ME'

  // Track which tab is being pressed for instant visual feedback
  const [pressed, setPressed] = useState<string | null>(null)

  return (
    <>
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}
      >
        <span className="font-serif text-2xl font-semibold" style={{ color: '#8b2035' }}>
          vino
        </span>
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: '#8b2035' }}
          title="Profile"
          onMouseDown={e => e.currentTarget.style.filter = 'brightness(0.75)'}
          onMouseUp={e => e.currentTarget.style.filter = ''}
          onMouseLeave={e => e.currentTarget.style.filter = ''}
          onTouchStart={e => e.currentTarget.style.filter = 'brightness(0.75)'}
          onTouchEnd={e => e.currentTarget.style.filter = ''}
        >
          {initials}
        </Link>
      </header>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t flex"
        style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active      = pathname === href || (href !== '/' && pathname.startsWith(href))
          const isPressed   = pressed === href
          const fgColor     = active ? '#8b2035' : '#c4a090'
          const pressedBg   = 'rgba(139,32,53,0.10)'

          return (
            <button
              key={href}
              onPointerDown={() => setPressed(href)}
              onPointerUp={() => { setPressed(null); router.push(href) }}
              onPointerLeave={() => setPressed(null)}
              onPointerCancel={() => setPressed(null)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium"
              style={{
                color:      fgColor,
                background: isPressed ? pressedBg : 'transparent',
                transition: isPressed ? 'none' : 'background 0.15s',
                border:     'none',
                cursor:     'pointer',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Spacer so content clears the bottom nav */}
      <div className="h-16" aria-hidden />
    </>
  )
}
