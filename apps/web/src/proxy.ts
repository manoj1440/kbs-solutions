import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge routing guard (F-801). Presence of the access cookie decides between /login and role areas;
 * the actual role/permission check happens server-side in each route group layout via /auth/me.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get('kbs_access') || req.cookies.get('kbs_refresh'));
  const isProtected = /^\/(admin|manager|accounts)(\/|$)/.test(pathname);
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === '/login' && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|api|verify).*)'] };
