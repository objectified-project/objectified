'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MigrationContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  fromVersionId: string | null;
  setFromVersionId: (id: string | null) => void;
  toVersionId: string | null;
  setToVersionId: (id: string | null) => void;
}

const MigrationContext = createContext<MigrationContextType | undefined>(undefined);

export function MigrationProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fromVersionId, setFromVersionId] = useState<string | null>(null);
  const [toVersionId, setToVersionId] = useState<string | null>(null);

  return (
    <MigrationContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        fromVersionId,
        setFromVersionId,
        toVersionId,
        setToVersionId,
      }}
    >
      {children}
    </MigrationContext.Provider>
  );
}

export function useMigration() {
  const ctx = useContext(MigrationContext);
  if (ctx === undefined) {
    throw new Error('useMigration must be used within MigrationProvider');
  }
  return ctx;
}
