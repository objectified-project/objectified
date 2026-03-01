'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MigrationTableRow {
  class_schema_id: string;
  class_id: string;
  class_name: string;
  schema: Record<string, unknown>;
}

export interface MigrationContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  fromVersionId: string | null;
  setFromVersionId: (id: string | null) => void;
  toVersionId: string | null;
  setToVersionId: (id: string | null) => void;
  selectedClassName: string | null;
  setSelectedClassName: (name: string | null) => void;
  fromTables: MigrationTableRow[];
  toTables: MigrationTableRow[];
  setFromTables: (tables: MigrationTableRow[]) => void;
  setToTables: (tables: MigrationTableRow[]) => void;
}

const MigrationContext = createContext<MigrationContextType | undefined>(undefined);

export function MigrationProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fromVersionId, setFromVersionId] = useState<string | null>(null);
  const [toVersionId, setToVersionId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const [fromTables, setFromTables] = useState<MigrationTableRow[]>([]);
  const [toTables, setToTables] = useState<MigrationTableRow[]>([]);

  return (
    <MigrationContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        fromVersionId,
        setFromVersionId,
        toVersionId,
        setToVersionId,
        selectedClassName,
        setSelectedClassName,
        fromTables,
        toTables,
        setFromTables,
        setToTables,
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
