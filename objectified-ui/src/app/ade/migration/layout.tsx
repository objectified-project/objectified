'use client';

import '../../globals.css';
import * as React from 'react';
import { MigrationProvider, useMigration } from './MigrationContext';
import MigrationHeader from './components/MigrationHeader';

function MigrationLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <MigrationHeader />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: 48 }}>
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function MigrationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <MigrationProvider>
      <MigrationLayoutInner>{children}</MigrationLayoutInner>
    </MigrationProvider>
  );
}
