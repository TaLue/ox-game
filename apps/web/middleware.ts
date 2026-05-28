import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSid = req.cookies.has('sid');

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSid ? '/play' : '/login', req.url));
  }
  if (!hasSid && (pathname === '/play' || pathname === '/leaderboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasSid && pathname === '/login') {
    return NextResponse.redirect(new URL('/play', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/play', '/leaderboard'],
};
