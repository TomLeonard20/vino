import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: 32, height: 32,
      background: '#8b2035',
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22h8"/>
        <path d="M7 10h10"/>
        <path d="M12 15v7"/>
        <path d="M17 2H7l2 8a3 3 0 0 0 6 0l2-8z"/>
      </svg>
    </div>,
    { ...size },
  )
}
