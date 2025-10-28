// objectified-ui/src/app/components/ade/TopHeader.tsx
'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import Avatar from '@mui/material/Avatar';
import { useRouter } from 'next/navigation';

type NavItem = { label: string; href: string };

export default function TopHeader(): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { data: session, status, update } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (session) {
      console.log('Session:', session, 'status:', status, 'update:', update);
    }

    if (session === null) {
      router.push('/login');
    }
  }, [session]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 20px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "var(--geist-background, #fff)",
      }}
    >
      {/* Left: Logo / App Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg,#5b8def,#7b61ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          O
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700, color: 'black' }}>Objectified</span>
          <small style={{ color: "rgba(0,0,0,0.5)" }}>Admin</small>
        </div>
      </div>

      {/* Right: Profile / Selector */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.06)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Avatar/>
          <span style={{ display: "none" /* hidden on small, shown via CSS if desired */ }}>
            {session?.user.name}
          </span>
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Profile menu"
            style={{
              position: "absolute",
              right: 0,
              marginTop: 8,
              minWidth: 180,
              background: "white",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              borderRadius: 8,
              padding: 8,
              zIndex: 50,
            }}
            className={'dark:text-black dark:bg-gray-800'}
          >
            <Link href="/ade/profile" role="menuitem" style={menuItemStyle}>
              View Profile
            </Link>
            <Link href="/ade/account" role="menuitem" style={menuItemStyle}>
              Account
            </Link>
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0" }} />
            <button onClick={() => {
              signOut()
            }} style={menuItemButtonStyle}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* Inline styles for menu items kept outside component for clarity */
const menuItemStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  color: "inherit",
  textDecoration: "none",
  borderRadius: 6,
  fontSize: 14,
};

const menuItemButtonStyle: React.CSSProperties = {
  ...menuItemStyle,
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  cursor: "pointer",
};