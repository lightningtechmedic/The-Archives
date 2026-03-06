import { Cormorant_Garamond, Space_Mono, Caveat } from 'next/font/google'
import './globals.css'
import Cursor from '@/components/Cursor'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
})

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-caveat',
})

export const metadata = {
  title: 'The Vault',
  description: 'Private command center.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${spaceMono.variable} ${caveat.variable}`}>
      <body>
        <Cursor />
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
