import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Always let these through — vault app, API routes, and static assets
  if (
    pathname.startsWith('/vault') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Check for access cookie
  const cookie = request.cookies.get('carbon_access')
  if (cookie?.value && cookie.value === process.env.NEXT_PUBLIC_SITE_PASSWORD) {
    return NextResponse.next()
  }

  // Redirect to gate, preserving the original destination
  const url = request.nextUrl.clone()
  const from = pathname + (request.nextUrl.search || '')
  url.pathname = '/vault/coming-soon'
  url.search = from && from !== '/' ? `?from=${encodeURIComponent(from)}` : ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}
