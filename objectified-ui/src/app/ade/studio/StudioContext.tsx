'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StudioContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <StudioContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}

