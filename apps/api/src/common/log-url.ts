/** Query parameters whose values never reach logs (F-908 S6: e.g. the Exotel webhook `?token=`). */
export const SECRET_QUERY_KEY = /^(.*token|.*secret|signature|sig|otp|code|password|api[_-]?key|key)$/i;

/** Request URL for logs: the path, plus the query string with secret-looking values replaced. */
export function loggableUrl(url: string | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  if (q < 0) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  for (const k of [...params.keys()]) if (SECRET_QUERY_KEY.test(k)) params.set(k, '[redacted]');
  const rest = params.toString();
  return rest ? `${url.slice(0, q)}?${rest}` : url.slice(0, q);
}

/** Parsed query for logs, secret-looking values replaced. */
export function loggableQuery<T>(query: T): T {
  if (!query || typeof query !== 'object') return query;
  return Object.fromEntries(Object.entries(query).map(([k, v]) => [k, SECRET_QUERY_KEY.test(k) ? '[redacted]' : v])) as T;
}
