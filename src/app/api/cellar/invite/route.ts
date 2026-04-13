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

  // Get or create the user's cellar via stored procedure (bypasses RLS)
  const { data: cellarId, error: rpcErr } = await supabase.rpc('get_or_create_cellar')
  if (rpcErr || !cellarId) {
    return NextResponse.json({ error: rpcErr?.message ?? 'Could not get or create cellar' }, { status: 500 })
  }

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
