import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Discord Automation Cloud - Production SaaS Platform',
  description: 'Ultra-modern multi-tenant Discord bot automation platform with modular plugins, canvas generators, and AI assistants.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
