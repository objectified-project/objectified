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
                <a
                  href="https://www.youtube.com/@objectifieddev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Tutorials
                </a>
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

