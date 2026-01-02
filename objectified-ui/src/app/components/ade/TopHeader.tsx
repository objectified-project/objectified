// objectified-ui/src/app/components/ade/TopHeader.tsx
'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import Avatar from '@mui/material/Avatar';
import { usePathname } from 'next/navigation';
import WhatsNewDialog from './WhatsNewDialog';
import { getTenantsForUser } from '../../../../lib/db/helper';

// Import version from package.json
const APP_VERSION = '02-2026';

type NavItem = { label: string; href: string; enabled?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/ade/dashboard" },
  { label: "Studio", href: "/ade/studio" },
  { label: "Database", href: "/ade/database", enabled: false },
];

const TopHeader = () => {
  const [open, setOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [currentTenantName, setCurrentTenantName] = useState<string>('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();
  const pathname = usePathname();
  const currentTenantId = (session?.user as any)?.current_tenant_id;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    // Detect dark mode - prioritize localStorage, then fall back to system preference
    const initTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const html = document.documentElement;

      if (savedTheme === 'dark') {
        html.classList.add('dark');
        setIsDarkMode(true);
      } else if (savedTheme === 'light') {
        html.classList.remove('dark');
        setIsDarkMode(false);
      } else {
        // No saved preference - use system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          html.classList.add('dark');
          setIsDarkMode(true);
        } else {
          html.classList.remove('dark');
          setIsDarkMode(false);
        }
      }
    };

    initTheme();

    // Listen for changes to dark mode class
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load current tenant name
  useEffect(() => {
    const loadTenantName = async () => {
      if (session && currentTenantId) {
        try {
          const userId = (session.user as any)?.user_id;
          const result = await getTenantsForUser(userId);
          const tenants = JSON.parse(result);
          const currentTenant = tenants.find((t: any) => t.id === currentTenantId);
          if (currentTenant) {
            setCurrentTenantName(currentTenant.name);
          }
        } catch (error) {
          console.error('Failed to load tenant name:', error);
        }
      }
    };
    loadTenantName();
  }, [session, currentTenantId]);

  // Toggle theme function
  const toggleTheme = () => {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains('dark');

    if (currentlyDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  return (
    <header
      className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 12px",
        height: 48,
        position: "relative",
        zIndex: 2000,
      }}
    >
      {/* Left: Logo */}
      <div style={{ display: "flex", alignItems: "center", height: 40, gap: 8 }}>
        <img
          src={isDarkMode ? "/Objectified-05.png" : "/Objectified-02.png"}
          alt="Objectified Logo"
          style={{ height: "100%", width: "auto", objectFit: "contain" }}
        />
        <button
          onClick={() => setShowWhatsNew(true)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="View What's New"
          style={{
            border: "1px solid currentColor",
            fontFamily: "monospace",
            fontWeight: 500
          }}
        >
          v{APP_VERSION}
        </button>
      </div>

      {/* Center: Navigation */}
      <nav aria-label="Main navigation" style={{ flex: 1, textAlign: "center" }}>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "inline-flex",
            gap: 12,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          {NAV_ITEMS.map((item) => {
            // Check if current path matches or is a subdirectory of this nav item
            // For exact matches, always activate
            // For subdirectory matches, only activate if the path continues with a slash
            const isActive = pathname === item.href ||
                            (item.href !== '/ade' && pathname?.startsWith(item.href + '/'));

            return (
              <li key={item.href}>
                {item.enabled === false ? (
                  <span
                    className="text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors ${
                      isActive ? 'underline bg-gray-200 dark:bg-gray-600' : ''
                    }`}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tenant Name Display */}
      {currentTenantName && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{currentTenantName}</span>
        </div>
      )}

      {/* Right: Profile / Selector */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          className="border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 8,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Avatar sx={{ width: 28, height: 28 }} />
          <span style={{ display: "none" /* hidden on small, shown via CSS if desired */ }}>
            {session?.user?.name}
          </span>
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Profile menu"
            className="bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50"
            style={{
              position: "absolute",
              right: 0,
              marginTop: 8,
              minWidth: 160,
              borderRadius: 8,
              padding: 4,
              zIndex: 2001,
            }}
          >
            <Link href="/ade/dashboard/profile" role="menuitem" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded text-sm transition-colors text-gray-700 dark:text-gray-300" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
              View Profile
            </Link>
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
            {/* Theme Toggle */}
            <button
              onClick={() => {
                toggleTheme();
              }}
              role="menuitem"
              className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded text-sm transition-colors text-gray-700 dark:text-gray-300"
              style={{ border: "none", cursor: "pointer", background: "transparent" }}
            >
              <span className="flex items-center gap-2">
                {isDarkMode ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                Theme
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {isDarkMode ? 'Dark' : 'Light'}
              </span>
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
            <button
              onClick={() => signOut()}
              className="w-full text-left block px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-300 rounded text-sm transition-colors text-gray-700 dark:text-gray-300"
              style={{ border: "none", cursor: "pointer" }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* What's New Dialog */}
      <WhatsNewDialog
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
      />
    </header>
  );
}

export default TopHeader;
