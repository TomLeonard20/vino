import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vino — Wine Cellar & Tasting Journal',
  description: 'A premium wine cellar manager and tasting journal with AI food pairing.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Vino',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#8b2035',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
