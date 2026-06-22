// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value
    ?? request.cookies.get('sb-auth-token')?.value

  // Cek semua cookie yang mengandung 'sb-' dan 'auth'
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(cookie => 
    cookie.name.includes('auth-token') && cookie.value
  )

  const protectedRoutes = ['/home', '/deals', '/profile', '/verifier', '/register']
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  const isAuthPage = ['/login', '/signup'].includes(request.nextUrl.pathname)

  if (!hasSession && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/home/:path*',
    '/deals/:path*',
    '/profile/:path*',
    '/verifier/:path*',
    '/register/:path*',
    '/login',
    '/signup',
  ],
}