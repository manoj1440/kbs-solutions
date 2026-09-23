import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge routing guard (F-801, F-804). The access cookie decides between the role areas and the session hop; the actual
 * role/permission check happens server-side in each route-group layout via /auth/me.
 *
 * The refresh cookie is scoped to the API's `/api/v1/auth` path, so it never reaches the web pages: a protected page
 * without an access cookie goes to `/session`, which asks the API to refresh (the browser sends the refresh cookie
 * there) and comes back — instead of a silent logout every access-token lifetime (F-804).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasAccess = Boolean(req.cookies.get('kbs_access'));
  const isProtected = /^\/(admin|manager|accounts)(\/|$)/.test(pathname);
  if (isProtected && !hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = '/session';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (pathname === '/login') {
    // a login with a reason means the session is gone: drop any stale access cookie so the page cannot bounce back
    if (req.nextUrl.searchParams.has('reason')) {
      const res = NextResponse.next();
      if (hasAccess) res.cookies.delete('kbs_access');
      return res;
    }
    if (hasAccess) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  // expose the requested path to server layouts so a server-side 401 can return here after the hop
  const headers = new Headers(req.headers);
  headers.set('x-kbs-path', `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next|favicon.ico|api|verify).*)'] };
