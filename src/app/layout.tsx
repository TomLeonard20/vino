import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vino — Wine Cellar & Tasting Journal',
  description: 'A premium wine cellar manager and tasting journal with AI food pairing.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
