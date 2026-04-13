import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from './SignOutButton'
import SharingSection from './SharingSection'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ count: noteCount }, { data: bottles }, { data: members }] = await Promise.all([
    supabase.from('tasting_notes').select('*', { count: 'exact', head: true }),
    supabase.from('cellar_bottles').select('quantity'),
    supabase.from('cellar_members').select('cellar_id, user_id'),
  ])

  const totalBottles  = (bottles ?? []).reduce((s, b) => s + b.quantity, 0)
  const memberCount   = (members ?? []).length
  const isShared      = memberCount > 1

  return (
    <div className="space-y-5 pb-4">
      {/* Avatar */}
      <div className="flex items-center gap-4 rounded-xl p-4" style={{ background: '#ecddd4' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
             style={{ background: '#8b2035' }}>
          {user.email?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold" style={{ color: '#3a1a20' }}>{user.email}</p>
          <p className="text-xs" style={{ color: '#a07060' }}>Vino Free</p>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#d4b8aa' }}>
        <div className="px-4 py-3 font-semibold text-sm border-b"
             style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }}>
          My palate
        </div>
        {[
          { label: 'Tasting notes', value: noteCount ?? 0 },
          { label: 'Bottles in cellar', value: totalBottles },
        ].map((row, i, arr) => (
          <div key={row.label}
               className={`flex justify-between items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b' : ''}`}
               style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}>
            <span className="text-sm" style={{ color: '#a07060' }}>{row.label}</span>
            <span className="font-semibold text-sm" style={{ color: '#3a1a20' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Shared cellar */}
      <SharingSection memberCount={memberCount} isShared={isShared} />

      {/* Pro upsell */}
      <div className="rounded-xl p-4" style={{ background: '#ecddd4' }}>
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold text-sm" style={{ color: '#3a1a20' }}>Upgrade to Vino Pro</p>
            <p className="text-xs mt-0.5" style={{ color: '#a07060' }}>
              Unlimited notes, WSET mode, food pairing AI
            </p>
          </div>
          <span className="text-sm font-semibold" style={{ color: '#8b2035' }}>A$6.99/mo</span>
        </div>
        <button
          className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#8b2035' }}
        >
          Coming soon
        </button>
      </div>

      {/* About */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#d4b8aa' }}>
        <div className="px-4 py-3 font-semibold text-sm border-b"
             style={{ background: '#ecddd4', borderColor: '#d4b8aa', color: '#3a1a20' }}>
          About
        </div>
        <div className="flex justify-between items-center px-4 py-3 border-b"
             style={{ background: '#f5ede6', borderColor: '#d4b8aa' }}>
          <span className="text-sm" style={{ color: '#a07060' }}>Version</span>
          <span className="text-sm" style={{ color: '#3a1a20' }}>1.0.0 (Phase 1 MVP)</span>
        </div>
        <div className="px-4 py-3" style={{ background: '#f5ede6' }}>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
