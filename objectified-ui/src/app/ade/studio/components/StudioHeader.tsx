'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Check, Settings } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useStudio } from '../StudioContext';
import {
  getTagsForProject
} from '../../../../../lib/db/helper';
import CanvasSettingsDialog from './CanvasSettingsDialog';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Version {
  id: string;
  version_id: string;
  description: string;
  published: boolean;
}

type ViewMode = 'editor' | 'paths' | 'code';

interface StudioHeaderProps {
  projectTags?: any[];
  onProjectTagsLoaded?: (tags: any[]) => void;
}

export default function StudioHeader({ onProjectTagsLoaded }: StudioHeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const currentTenantId = (session?.user as any)?.current_tenant_id;

  const {
    selectedProjectId,
    setSelectedProjectId: setContextProjectId,
    selectedVersionId,
    setSelectedVersionId: setContextVersionId,
    setIsReadOnly,
    clickToFocusEnabled,
    setClickToFocusEnabled,
    gridSize,
    setGridSize,
    snapToGrid,
    setSnapToGrid,
    gridStyle,
    setGridStyle,
    smartGuidesEnabled,
    setSmartGuidesEnabled,
    edgeStyling,
    setEdgeStyling,
    edgeRouting,
    setEdgeRouting,
    edgeAnimation,
    setEdgeAnimation
  } = useStudio();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [versions, setVersions] = React.useState<Version[]>([]);
  const [localProjectId, setLocalProjectId] = React.useState<string>(selectedProjectId || '');
  const [localVersionId, setLocalVersionId] = React.useState<string>(selectedVersionId || '');
  const [isLoadingProjects, setIsLoadingProjects] = React.useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = React.useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);

  // Determine current view mode from pathname
  const viewMode: ViewMode = pathname?.includes('/code')
    ? 'code'
    : pathname?.includes('/paths')
      ? 'paths'
      : 'editor';

  // Handle settings save
  const handleSettingsSave = React.useCallback((settings: {
    clickToFocusEnabled: boolean;
    snapToGrid: boolean;
    smartGuidesEnabled: boolean;
    gridSize: number;
    gridStyle: 'dots' | 'lines' | 'cross';
    edgeStyling: typeof edgeStyling;
    edgeRouting: typeof edgeRouting;
    edgeAnimation: typeof edgeAnimation;
  }) => {
    setClickToFocusEnabled(settings.clickToFocusEnabled);
    localStorage.setItem('clickToFocusEnabled', JSON.stringify(settings.clickToFocusEnabled));

    setSnapToGrid(settings.snapToGrid);
    localStorage.setItem('snapToGrid', JSON.stringify(settings.snapToGrid));

    setSmartGuidesEnabled(settings.smartGuidesEnabled);
    localStorage.setItem('smartGuidesEnabled', JSON.stringify(settings.smartGuidesEnabled));

    setGridSize(settings.gridSize);
    localStorage.setItem('gridSize', String(settings.gridSize));

    setGridStyle(settings.gridStyle);
    localStorage.setItem('gridStyle', settings.gridStyle);

    setEdgeStyling(settings.edgeStyling);
    localStorage.setItem('edgeStyling', JSON.stringify(settings.edgeStyling));

    setEdgeRouting(settings.edgeRouting);
    localStorage.setItem('edgeRouting', settings.edgeRouting);

    setEdgeAnimation(settings.edgeAnimation);
    localStorage.setItem('edgeAnimation', settings.edgeAnimation);
  }, [setClickToFocusEnabled, setSnapToGrid, setSmartGuidesEnabled, setGridSize, setGridStyle, setEdgeStyling, setEdgeRouting, setEdgeAnimation]);

  // Sync local state with context
  React.useEffect(() => {
    if (selectedProjectId !== localProjectId) {
      setLocalProjectId(selectedProjectId || '');
    }
    if (selectedVersionId !== localVersionId) {
      setLocalVersionId(selectedVersionId || '');
    }
  }, [selectedProjectId, selectedVersionId]);

  // Load projects on mount
  React.useEffect(() => {
    const loadProjects = async () => {
      if (!currentTenantId) {
        setProjects([]);
        return;
      }
      setIsLoadingProjects(true);
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success && data.projects) {
          setProjects(data.projects);
        } else {
          throw new Error(data.error || 'Failed to load projects');
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    loadProjects();
  }, [currentTenantId]);

  // Load versions when project changes and auto-select most recent
  React.useEffect(() => {
    const loadVersions = async () => {
      if (!localProjectId) {
        setVersions([]);
        return;
      }
      setIsLoadingVersions(true);
      try {
        const response = await fetch(`/api/versions?projectId=${localProjectId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch versions: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success && result.versions) {
          setVersions(result.versions);

          // Auto-select the most recent version (first in the list)
          if (result.versions.length > 0) {
            const mostRecentVersion = result.versions[0];
            setLocalVersionId(mostRecentVersion.id);
            setContextVersionId(mostRecentVersion.id);
            setIsReadOnly(mostRecentVersion.published ?? false);
          }
        } else {
          throw new Error(result.error || 'Failed to load versions');
        }
      } catch (error) {
        console.error('Failed to load versions:', error);
        setVersions([]);
      } finally {
        setIsLoadingVersions(false);
      }
    };
    loadVersions();
  }, [localProjectId, setContextVersionId, setIsReadOnly]);

  // Load project tags when project changes
  const loadProjectTags = React.useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const result = await getTagsForProject(projectId);
      const tags = JSON.parse(result);
      onProjectTagsLoaded?.(tags);
    } catch (error) {
      console.error('Failed to load project tags:', error);
    }
  }, [onProjectTagsLoaded]);

  // Handle project selection
  const handleProjectChange = (value: string) => {
    setLocalProjectId(value);
    setContextProjectId(value);
    setLocalVersionId('');
    setContextVersionId('');
    setIsReadOnly(false);
    if (value) {
      loadProjectTags(value);
    }
  };

  // Handle version selection
  const handleVersionChange = (value: string) => {
    setLocalVersionId(value);
    setContextVersionId(value);
    const version = versions.find(v => v.id === value);
    setIsReadOnly(version?.published ?? false);
  };

  // Handle view mode change
  const handleViewModeChange = (value: string) => {
    if (!value) return;
    if (value === 'editor') {
      router.push('/ade/studio/editor');
    } else if (value === 'paths') {
      router.push('/ade/studio/paths');
    } else if (value === 'code') {
      router.push('/ade/studio/code');
    }
  };

  if (!currentTenantId) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-white via-slate-50 to-white dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 border-b border-gray-200/80 dark:border-gray-700/80 px-2 py-1.5 shadow-sm" style={{ position: 'fixed', top: 48, left: 0, right: 0, zIndex: 1000 }}>
      <div className="flex flex-wrap items-center gap-4 w-full">
        {/* Project Selector */}
        <div className="flex items-center gap-2" style={{ position: 'relative', zIndex: 1001 }}>
          <Select.Root
            value={localProjectId}
            onValueChange={handleProjectChange}
            disabled={isLoadingProjects || !currentTenantId}
          >
            <Select.Trigger className="inline-flex items-center gap-2 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <Select.Value placeholder="Select project..." />
              <Select.Icon className="ml-auto">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]" position="popper" sideOffset={5}>
                <Select.Viewport className="p-1">
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No projects available</div>
                  ) : (
                    projects.map((project) => (
                      <Select.Item
                        key={project.id}
                        value={project.id}
                        className="relative flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[state=checked]:bg-indigo-50 dark:data-[state=checked]:bg-indigo-900/30"
                      >
                        <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{project.name}</Select.ItemText>
                      </Select.Item>
                    ))
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Version Selector */}
        <div className="flex items-center gap-2" style={{ position: 'relative', zIndex: 1001 }}>
          <Select.Root
            value={localVersionId}
            onValueChange={handleVersionChange}
            disabled={isLoadingVersions || !localProjectId || versions.length === 0}
          >
            <Select.Trigger className="inline-flex items-center gap-2 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <Select.Value placeholder="Select version..." />
              <Select.Icon className="ml-auto">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]" position="popper" sideOffset={5}>
                <Select.Viewport className="p-1">
                  {versions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No versions available</div>
                  ) : (
                    versions.map((version) => (
                      <Select.Item
                        key={version.id}
                        value={version.id}
                        className="relative flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[state=checked]:bg-indigo-50 dark:data-[state=checked]:bg-indigo-900/30"
                      >
                        <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </Select.ItemIndicator>
                        <Select.ItemText>
                          {version.published ? '🔒 ' : ''}{version.version_id} - {version.description}
                        </Select.ItemText>
                      </Select.Item>
                    ))
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* View Switcher and Settings - only show when project and version selected */}
        {localProjectId && localVersionId && (
          <>
            {/* Separator */}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />

            <ToggleGroup.Root
              type="single"
              value={viewMode}
              onValueChange={handleViewModeChange}
              className="inline-flex bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1 shadow-inner"
            >
              <ToggleGroup.Item
                value="editor"
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-600 data-[state=on]:text-indigo-600 dark:data-[state=on]:text-indigo-400 data-[state=on]:shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Canvas
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="paths"
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-600 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400 data-[state=on]:shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Paths
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="code"
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-600 data-[state=on]:text-indigo-600 dark:data-[state=on]:text-indigo-400 data-[state=on]:shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Code
              </ToggleGroup.Item>
            </ToggleGroup.Root>

            {/* Settings Button */}
            <div className="ml-auto">
              <button
                onClick={() => setSettingsDialogOpen(true)}
                className="p-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Settings Dialog */}
            <CanvasSettingsDialog
              open={settingsDialogOpen}
              onOpenChange={setSettingsDialogOpen}
              clickToFocusEnabled={clickToFocusEnabled}
              snapToGrid={snapToGrid}
              smartGuidesEnabled={smartGuidesEnabled}
              gridSize={gridSize}
              gridStyle={gridStyle}
              edgeStyling={edgeStyling}
              edgeRouting={edgeRouting}
              edgeAnimation={edgeAnimation}
              onSave={handleSettingsSave}
            />
          </>
        )}
      </div>
    </div>
  );
}

