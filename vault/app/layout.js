import { Caveat, Lora, DM_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Cursor from '@/components/Cursor'

const GFONTS_URL = 'https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@300;400;500;700;800&family=Lora:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={GFONTS_URL} rel="stylesheet" />
      </head>
      <body>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js" strategy="afterInteractive" />
        <Cursor />
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
