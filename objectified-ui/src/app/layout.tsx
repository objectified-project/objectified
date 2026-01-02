import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/app/components/auth/SessionWrapper";
import ThemeRegistry from "@/app/components/theme/ThemeRegistry";
import { DialogProvider } from "@/app/components/providers/DialogProvider";

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Objectified",
  description: "Objectified ADE Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to set theme before hydration (prevents flash)
  const themeScript = `
    (function() {
      try {
        const savedTheme = localStorage.getItem('theme');
        const html = document.documentElement;
        if (savedTheme === 'dark') {
          html.classList.add('dark');
        } else if (savedTheme === 'light') {
          html.classList.remove('dark');
        } else {
          // No saved preference - use system preference
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            html.classList.add('dark');
          }
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeRegistry>
          <SessionWrapper>
            <DialogProvider>
              {children}
            </DialogProvider>
          </SessionWrapper>
        </ThemeRegistry>
      </body>
    </html>
  );
}
