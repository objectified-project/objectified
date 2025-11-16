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
  description: "Objectified",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
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
