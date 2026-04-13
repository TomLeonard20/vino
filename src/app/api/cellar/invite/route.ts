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

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the user's cellar
  const { data: member } = await supabase
    .from('cellar_members')
    .select('cellar_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No cellar found' }, { status: 404 })

  // Generate a unique code (retry on collision, max 3 attempts)
  let invite = null
  for (let i = 0; i < 3; i++) {
    const code = makeCode()
    const { data, error } = await supabase
      .from('cellar_invites')
      .insert({ cellar_id: member.cellar_id, code, created_by: user.id })
      .select('code, expires_at')
      .single()

    if (!error && data) { invite = data; break }
  }

  if (!invite) return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })

  return NextResponse.json({ code: invite.code, expiresAt: invite.expires_at })
}
