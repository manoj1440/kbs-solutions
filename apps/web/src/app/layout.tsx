import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KBS Solutions',
  description: 'Credit-card DSA operations — Admin, Manager and Accounts workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
