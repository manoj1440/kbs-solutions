'use client';

import { useEffect } from 'react';

/**
 * F-908 P4: last-resort screen when the root layout itself fails. It replaces the whole document, so it carries its
 * own <html>/<body> and a few inline styles (globals.css and fonts may be what failed). No crash details are shown;
 * the digest lets support find the server log line.
 */
const CSS = `
:root{color-scheme:light dark;--bg:#f7f3ee;--card:#fffdfa;--fg:#211c18;--fg2:#5b524b;--brand:#c14015;--ring:#c14015}
@media (prefers-color-scheme:dark){:root{--bg:#1a1715;--card:#26221f;--fg:#f5f1ec;--fg2:#c9c0b7;--brand:#c4461b;--ring:#f28a5f}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:28rem;width:100%;background:var(--card);border-radius:16px;padding:32px 24px;text-align:center}
h1{font-size:1.375rem;line-height:1.3;margin:0 0 8px;font-weight:600}
p{margin:0 0 24px;color:var(--fg2)}
.row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
button,a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;border-radius:10px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
button{border:0;background:var(--brand);color:#fff}
a{border:1px solid currentColor;color:var(--fg)}
button:focus-visible,a:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
small{display:block;margin-top:20px;color:var(--fg2);font-size:.75rem}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[KBS] app failed to render', error.digest ?? '');
  }, [error]);
  return (
    <html lang="en">
      <head>
        <title>Something went wrong · KBS Solutions</title>
        <meta name="robots" content="noindex, nofollow" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main role="alert">
          <h1>KBS could not load this page</h1>
          <p>Check your internet connection and try again. Nothing you saved on the server is lost.</p>
          <div className="row">
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
            {/* A plain <a>: the app's router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go to my home</a>
          </div>
          {error.digest ? <small>Reference: {error.digest}</small> : null}
        </main>
      </body>
    </html>
  );
}
