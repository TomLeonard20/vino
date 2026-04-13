import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Generate a random 8-character alphanumeric code (no external deps) */
function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/I/1 to avoid confusion
  let code = ''
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  for (const b of buf) code += chars[b % chars.length]
  return code
}

/** Get or create a personal cellar for the user */
async function getOrCreateCellarId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  // Try to find existing membership
  const { data: member } = await supabase
    .from('cellar_members')
    .select('cellar_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (member?.cellar_id) return member.cellar_id

  // No cellar yet — create a personal one using a service-role bypass via RPC
  // We insert directly; the cellars INSERT policy allows owner inserts
  const { data: cellar, error: cellarErr } = await supabase
    .from('cellars')
    .insert({ owner_id: userId, name: 'My Cellar' })
    .select('id')
    .single()

  if (cellarErr || !cellar) {
    console.error('Failed to create cellar:', cellarErr)
    return null
  }

  const { error: memberErr } = await supabase
    .from('cellar_members')
    .insert({ cellar_id: cellar.id, user_id: userId, role: 'owner' })

  if (memberErr) {
    console.error('Failed to create cellar member:', memberErr)
    return null
  }

  return cellar.id
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cellarId = await getOrCreateCellarId(supabase, user.id)
  if (!cellarId) return NextResponse.json({ error: 'Could not get or create cellar' }, { status: 500 })

  // Generate a unique code (retry on collision, max 3 attempts)
  let invite = null
  for (let i = 0; i < 3; i++) {
    const code = makeCode()
    const { data, error } = await supabase
      .from('cellar_invites')
      .insert({ cellar_id: cellarId, code, created_by: user.id })
      .select('code, expires_at')
      .single()

    if (!error && data) { invite = data; break }
  }

  if (!invite) return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })

  return NextResponse.json({ code: invite.code, expiresAt: invite.expires_at })
}
