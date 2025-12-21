'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StudioContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedVersionId: string | null;
  setSelectedVersionId: (id: string | null) => void;
  canvasRefreshKey: number;
  triggerCanvasRefresh: () => void;
  sidebarRefreshKey: number;
  triggerSidebarRefresh: () => void;
  isReadOnly: boolean;
  setIsReadOnly: (value: boolean) => void;
  zoomToClassFn: ((classId: string) => void) | null;
  setZoomToClassFn: (fn: ((classId: string) => void) | null) => void;
  clickToFocusEnabled: boolean;
  setClickToFocusEnabled: (value: boolean) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [canvasRefreshKey, setCanvasRefreshKey] = useState<number>(0);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState<number>(0);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [zoomToClassFn, setZoomToClassFn] = useState<((classId: string) => void) | null>(null);
  const [clickToFocusEnabled, setClickToFocusEnabled] = useState<boolean>(true);

  const triggerCanvasRefresh = () => {
    setCanvasRefreshKey(prev => prev + 1);
  };

  const triggerSidebarRefresh = () => {
    setSidebarRefreshKey(prev => prev + 1);
  };

  return (
    <StudioContext.Provider value={{
      selectedProjectId,
      setSelectedProjectId,
      selectedVersionId,
      setSelectedVersionId,
      canvasRefreshKey,
      triggerCanvasRefresh,
      sidebarRefreshKey,
      triggerSidebarRefresh,
      isReadOnly,
      setIsReadOnly,
      zoomToClassFn,
      setZoomToClassFn,
      clickToFocusEnabled,
      setClickToFocusEnabled
    }}>
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

