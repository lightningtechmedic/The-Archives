import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const path = request.nextUrl.pathname

  // Pass through without touching Supabase — public paths and static assets
  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/api') ||
    path.endsWith('.html')

  if (isPublic) return NextResponse.next()

  let response = NextResponse.next({ request: { headers: request.headers } })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return request.cookies.get(name)?.value },
          set(name, value, options) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value, ...options })
          },
          remove(name, options) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (path === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (err) {
    console.error('Middleware auth error:', err)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  // Exclude all _next internals (static, image, data fetches) and favicon
  matcher: ['/((?!_next|favicon.ico).*)'],
}
