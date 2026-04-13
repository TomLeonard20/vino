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

  // Try up to 3 times in case of code collision
  for (let i = 0; i < 3; i++) {
    const code = makeCode()
    const { data, error } = await supabase.rpc('create_cellar_invite', { p_code: code })
    if (!error && data) {
      return NextResponse.json({ code: data })
    }
    // If it's not a unique violation, bail immediately
    if (error && !error.message.includes('unique')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
}
