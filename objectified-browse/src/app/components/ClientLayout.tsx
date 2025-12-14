'use client';

import { Navbar } from './Navbar';
import { ThemeProvider } from './ThemeProvider';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <Navbar />
        <main>{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                © {new Date().getFullYear()} Objectified. API Specification Browser.
              </div>
              <div className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                <a href="#" className="hover:text-zinc-900 dark:hover:text-zinc-50">Documentation</a>
                <a href="#" className="hover:text-zinc-900 dark:hover:text-zinc-50">Support</a>
                <a href="#" className="hover:text-zinc-900 dark:hover:text-zinc-50">GitHub</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

