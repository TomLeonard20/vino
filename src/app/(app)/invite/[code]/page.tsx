import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/invite/${code}`)

  // Look up the invite
  const { data: invite } = await supabase
    .from('cellar_invites')
    .select('*, cellar:cellars(name, owner_id)')
    .eq('code', code.toUpperCase())
    .single()

  const invalid = !invite || invite.used_at || new Date(invite.expires_at) < new Date()

  // If invite is valid and user clicks "Join", we call the RPC
  // This page is rendered server-side; the action is a server action
  async function joinAction() {
    'use server'
    const sb = await createClient()
    const { error } = await sb.rpc('join_cellar', { invite_code: code.toUpperCase() })
    if (!error) redirect('/cellar?joined=1')
    else redirect(`/invite/${code}?error=1`)
  }

  const isOwnInvite = invite?.created_by === user.id
  const alreadyMember = invite && !invite.used_at && !invalid && (
    (await supabase
      .from('cellar_members')
      .select('cellar_id')
      .eq('cellar_id', invite.cellar_id)
      .eq('user_id', user.id)
      .maybeSingle()
    ).data !== null
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: '#f5ede6' }}>
      <div className="w-full max-w-sm space-y-4">

        {/* Logo */}
        <div className="text-center mb-2">
          <span className="font-serif text-3xl font-semibold" style={{ color: '#8b2035' }}>vino</span>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4b8aa', background: '#ecddd4' }}>
          <div className="p-5 space-y-4">

            {invalid ? (
              <>
                <div className="text-center">
                  <span className="text-4xl">⚠️</span>
                  <h1 className="mt-2 font-semibold text-lg" style={{ color: '#3a1a20' }}>
                    Invite not valid
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#a07060' }}>
                    This invite has already been used or has expired.
                  </p>
                </div>
                <Link href="/"
                      className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-white"
                      style={{ background: '#8b2035' }}>
                  Go to home
                </Link>
              </>
            ) : isOwnInvite ? (
              <>
                <div className="text-center">
                  <span className="text-4xl">🔗</span>
                  <h1 className="mt-2 font-semibold text-lg" style={{ color: '#3a1a20' }}>
                    Your invite link
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#a07060' }}>
                    Share this page with your partner so they can join your cellar.
                  </p>
                </div>
                <div className="rounded-xl px-4 py-3 text-center font-mono font-bold text-lg"
                     style={{ background: '#f5ede6', color: '#8b2035', letterSpacing: '0.15em' }}>
                  {code.toUpperCase()}
                </div>
                <Link href="/profile"
                      className="block w-full py-3 rounded-xl text-sm font-semibold text-center"
                      style={{ background: '#ecddd4', color: '#3a1a20', border: '1px solid #d4b8aa' }}>
                  Back to profile
                </Link>
              </>
            ) : alreadyMember ? (
              <>
                <div className="text-center">
                  <span className="text-4xl">✓</span>
                  <h1 className="mt-2 font-semibold text-lg" style={{ color: '#3a1a20' }}>
                    Already a member!
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#a07060' }}>
                    You're already sharing this cellar.
                  </p>
                </div>
                <Link href="/cellar"
                      className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-white"
                      style={{ background: '#8b2035' }}>
                  View cellar
                </Link>
              </>
            ) : (
              <>
                <div className="text-center">
                  <span className="text-4xl">🍾</span>
                  <h1 className="mt-2 font-semibold text-lg" style={{ color: '#3a1a20' }}>
                    You're invited to a shared cellar
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#a07060' }}>
                    Joining will merge your bottles into a shared cellar.
                    You'll each keep your own tasting notes.
                  </p>
                </div>

                <div className="rounded-xl px-4 py-3 text-center" style={{ background: '#f5ede6' }}>
                  <p className="text-xs" style={{ color: '#a07060' }}>Joining cellar</p>
                  <p className="font-semibold mt-0.5" style={{ color: '#3a1a20' }}>
                    {(invite.cellar as { name: string })?.name ?? 'Shared Cellar'}
                  </p>
                </div>

                <form action={joinAction}>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#8b2035' }}
                  >
                    Join cellar
                  </button>
                </form>

                <Link href="/"
                      className="block w-full text-center text-sm py-1"
                      style={{ color: '#a07060' }}>
                  Cancel
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
