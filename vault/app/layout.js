import { Caveat, Lora, DM_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Cursor from '@/components/Cursor'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-caveat',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-prose',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-mono',
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
    <html lang="en" className={`${caveat.variable} ${lora.variable} ${dmMono.variable}`}>
      <body>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js" strategy="afterInteractive" />
        <Cursor />
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
