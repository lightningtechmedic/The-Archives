import { Cormorant_Garamond, Space_Mono } from 'next/font/google'
import './globals.css'
import Cursor from '@/components/Cursor'

let cormorant, spaceMono

try {
  cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['300', '400', '600'],
    style: ['normal', 'italic'],
    variable: '--font-serif',
    display: 'swap',
  })
} catch (e) {
  console.error('[layout] Cormorant_Garamond failed:', e)
}

try {
  spaceMono = Space_Mono({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-mono',
    display: 'swap',
  })
} catch (e) {
  console.error('[layout] Space_Mono failed:', e)
}

export const metadata = {
  title: 'The Vault',
  description: 'Private command center.',
}

export default function RootLayout({ children }) {
  try {
    const fontClasses = [
      cormorant?.variable,
      spaceMono?.variable,
    ].filter(Boolean).join(' ')

    return (
      <html lang="en" className={fontClasses}>
        <body>
          <Cursor />
          <div className="noise-overlay" aria-hidden="true" />
          {children}
        </body>
      </html>
    )
  } catch (e) {
    console.error('[layout] RootLayout render failed:', e)
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    )
  }
}
