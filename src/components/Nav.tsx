'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Home, BookOpen, Wine, Utensils, User as UserIcon } from 'lucide-react'

const tabs = [
  { href: '/',         label: 'Home',    icon: Home },
  { href: '/cellar',   label: 'Cellar',  icon: Wine },
  { href: '/journal',  label: 'Journal', icon: BookOpen },
  { href: '/pairing',  label: 'Pairing', icon: Utensils },
  { href: '/profile',  label: 'Profile', icon: UserIcon },
]

export default function Nav({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'ME'

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b px-4 py-3 flex items-center justify-between"
              style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}>
        <span className="font-serif text-2xl font-semibold" style={{ color: '#8b2035' }}>
          vino
        </span>
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: '#8b2035' }}
          title="Profile"
        >
          {initials}
        </Link>
      </header>

      {/* Bottom tab bar (mobile) / left sidebar on desktop — keeping it simple: bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t flex"
           style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors"
              style={{ color: active ? '#8b2035' : '#c4a090' }}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Padding so content clears the bottom nav */}
      <div className="h-16" aria-hidden />
    </>
  )
}
