'use client'

import { useState } from 'react'

interface Props {
  memberCount: number
  isShared: boolean
}

export default function SharingSection({ memberCount, isShared }: Props) {
  const [tab,      setTab]      = useState<'invite' | 'join'>('invite')
  const [code,     setCode]     = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [copied,   setCopied]   = useState(false)
  const [joinMsg,  setJoinMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  async function generateInvite() {
    setLoading(true)
    const res  = await fetch('/api/cellar/invite', { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (data.code) setCode(data.code)
  }

  async function copyLink() {
    if (!code) return
    const url = `${window.location.origin}/invite/${code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function joinCellar() {
    if (!joinCode.trim()) return
    setLoading(true)
    setJoinMsg(null)
    const res  = await fetch('/api/cellar/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setJoinMsg({ ok: true, text: 'Joined! Your cellars have been merged.' })
      setTimeout(() => window.location.reload(), 1500)
    } else {
      setJoinMsg({ ok: false, text: data.error ?? 'Invalid or expired code.' })
    }
  }

  const inviteUrl = code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${code}` : null

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#d4b8aa' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between"
           style={{ background: '#ecddd4', borderColor: '#d4b8aa' }}>
        <span className="font-semibold text-sm" style={{ color: '#3a1a20' }}>Shared cellar</span>
        {isShared && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#8b2035', color: 'white' }}>
            {memberCount} members
          </span>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ background: '#f5ede6' }}>

        {/* Status line */}
        {isShared ? (
          <p className="text-sm" style={{ color: '#a07060' }}>
            You're sharing this cellar with {memberCount - 1} partner{memberCount - 1 !== 1 ? 's' : ''}.
            Both of you can add bottles and log independent tasting notes.
          </p>
        ) : (
          <p className="text-sm" style={{ color: '#a07060' }}>
            Invite a partner to co-manage your cellar. You'll each keep
            your own independent tasting notes for the same bottles.
          </p>
        )}

        {/* Tabs */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#d4b8aa' }}>
          {(['invite', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: tab === t ? '#8b2035' : '#ecddd4',
                color:      tab === t ? 'white'   : '#a07060',
              }}
            >
              {t === 'invite' ? 'Invite partner' : 'Join a cellar'}
            </button>
          ))}
        </div>

        {/* Invite panel */}
        {tab === 'invite' && (
          <div className="space-y-2">
            {code ? (
              <>
                <div className="rounded-xl px-4 py-3 text-center"
                     style={{ background: '#ecddd4', border: '1px solid #d4b8aa' }}>
                  <p className="text-xs mb-1" style={{ color: '#a07060' }}>Invite code</p>
                  <p className="font-mono font-bold text-xl tracking-widest"
                     style={{ color: '#8b2035' }}>
                    {code}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#c4a090' }}>Valid for 7 days</p>
                </div>
                <button
                  onClick={copyLink}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#8b2035', color: 'white' }}
                >
                  {copied ? '✓ Link copied!' : 'Copy invite link'}
                </button>
                <button
                  onClick={() => setCode(null)}
                  className="w-full py-1.5 text-xs"
                  style={{ color: '#c4a090' }}
                >
                  Generate new code
                </button>
              </>
            ) : (
              <button
                onClick={generateInvite}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: '#8b2035',
                  color: 'white',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Generating…' : 'Generate invite code'}
              </button>
            )}
          </div>
        )}

        {/* Join panel */}
        {tab === 'join' && (
          <div className="space-y-2">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character code"
              maxLength={8}
              className="w-full px-3 py-2.5 rounded-xl text-sm border font-mono tracking-widest text-center"
              style={{
                background:  '#ecddd4',
                borderColor: '#d4b8aa',
                color:       '#3a1a20',
              }}
            />
            {joinMsg && (
              <p className="text-sm text-center"
                 style={{ color: joinMsg.ok ? '#2a7a4a' : '#8b2035' }}>
                {joinMsg.ok ? '✓ ' : '⚠ '}{joinMsg.text}
              </p>
            )}
            <button
              onClick={joinCellar}
              disabled={loading || joinCode.length < 6}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: '#8b2035',
                color: 'white',
                opacity: loading || joinCode.length < 6 ? 0.5 : 1,
              }}
            >
              {loading ? 'Joining…' : 'Join cellar'}
            </button>
            <p className="text-xs text-center" style={{ color: '#c4a090' }}>
              Your bottles will be merged into the shared cellar.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
