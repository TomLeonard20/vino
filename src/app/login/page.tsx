'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [firstName, setFirstName] = useState('')
  const [mode,      setMode]      = useState<'signin' | 'signup'>('signin')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [message,   setMessage]   = useState('')
  const router  = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: firstName.trim() },
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    }
    setLoading(false)
  }

  const inputStyle = {
    background:  'white',
    borderColor: '#d4b8aa',
    color:       '#3a1a20',
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: '#f5ede6' }}>

      {/* Wordmark */}
      <h1 className="font-serif text-5xl font-semibold mb-2" style={{ color: '#8b2035' }}>
        vino
      </h1>
      <p className="text-sm mb-10" style={{ color: '#a07060' }}>
        Wine Cellar &amp; Tasting Journal
      </p>

      <div className="w-full max-w-sm">
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden mb-6 border"
             style={{ borderColor: '#d4b8aa' }}>
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === m ? '#8b2035' : '#ecddd4',
                color:      mode === m ? 'white'   : '#a07060',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* First name — signup only */}
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#3a1a20' }}>
                First name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={inputStyle}
                placeholder="e.g. Tom"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#3a1a20' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#3a1a20' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2"
               style={{ background: '#fce4ec', color: '#8b0000' }}>
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm rounded-lg px-3 py-2"
               style={{ background: '#c8e6c9', color: '#2e5c30' }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm text-white transition-opacity"
            style={{ background: '#8b2035', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
