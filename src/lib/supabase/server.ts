import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client (used in Server Components, Route Handlers, Middleware)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — can be ignored if
            // middleware is refreshing the session.
          }
        },
      },
    }
  )
}
