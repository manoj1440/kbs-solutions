import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// F-814 U1: self-hosted at build time by next/font (no runtime request to Google).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'KBS Solutions',
  description: 'Credit-card DSA operations — Admin, Manager and Accounts workspace',
};

// F-817 dark mode: apply the `kbs_theme` cookie (light | dark | system, default system) before the first paint.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )kbs_theme=(light|dark|system)/);var t=m?m[1]:'system';var e=document.documentElement;e.classList.toggle('dark',t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches));e.dataset.theme=t;}catch(_){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
