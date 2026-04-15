import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: 180, height: 180,
      background: '#8b2035',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    }}>
      {/* Wine glass */}
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none"
           stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22h8"/>
        <path d="M7 10h10"/>
        <path d="M12 15v7"/>
        <path d="M17 2H7l2 8a3 3 0 0 0 6 0l2-8z"/>
      </svg>
      {/* Wordmark */}
      <span style={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontFamily: 'serif',
      }}>
        VINO
      </span>
    </div>,
    { ...size },
  )
}
