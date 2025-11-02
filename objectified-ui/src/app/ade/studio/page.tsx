'use client';

import { useCallback, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useStudio } from './StudioContext';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getProjectsForTenant,
  getVersionsForProject,
  getClassesForVersion,
  getPropertiesForClass,
  addPropertyToClass
} from '../../../../lib/db/helper';
import ClassNode from './ClassNode';
import { getLayoutedElements, type LayoutDirection } from './layoutUtils';

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
    </div>
  ),
});

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Version {
  id: string;
  version_id: string;
  description: string;
}

type ViewMode = 'canvas' | 'code';

const StudioContent = () => {
  const { data: session } = useSession();
  const {
    setSelectedProjectId: setContextProjectId,
    setSelectedVersionId: setContextVersionId,
    canvasRefreshKey
  } = useStudio();
  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');

  // Sample OpenAPI spec - will be replaced with actual data from project/version
  const [openApiSpec, setOpenApiSpec] = useState<string>('');

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const { fitView } = useReactFlow();

  // Apply auto-layout to current nodes and edges
  const onLayout = useCallback((direction: LayoutDirection) => {
    const layoutedNodes = getLayoutedElements(nodes, edges, { direction });
    setNodes(layoutedNodes);
    setLayoutDirection(direction);

    // Fit view after layout with a small delay to ensure layout is applied
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 10);
  }, [nodes, edges, setNodes, fitView]);

  // Handle property drop on class
  const handlePropertyDrop = useCallback(async (classId: string, propertyData: any) => {
    try {
      console.log('Property dropped on class:', classId, propertyData);

      // Add property to class in database
      const result = await addPropertyToClass(
        classId,
        propertyData.id,
        propertyData.name,
        propertyData.description || null,
        {
          type: propertyData.type,
          $ref: propertyData.$ref,
          title: propertyData.title,
          description: propertyData.description,
          format: propertyData.format,
          pattern: propertyData.pattern,
          minLength: propertyData.minLength,
          maxLength: propertyData.maxLength,
          minimum: propertyData.minimum,
          maximum: propertyData.maximum,
          minItems: propertyData.minItems,
          maxItems: propertyData.maxItems,
          enum: propertyData.enum,
          default: propertyData.default,
          required: propertyData.required
        }
      );

      const response = JSON.parse(result);
      if (response.success) {
        // Reload classes to show updated properties
        if (selectedVersionId) {
          const classesResult = await getClassesForVersion(selectedVersionId);
          const classesData = JSON.parse(classesResult);

          // Load properties for each class
          const classesWithProperties = await Promise.all(
            classesData.map(async (cls: any) => {
              const propsResult = await getPropertiesForClass(cls.id);
              const properties = JSON.parse(propsResult);
              return { ...cls, properties };
            })
          );

          const newNodes = await classesToNodes(classesWithProperties);
          const layoutedNodes = getLayoutedElements(newNodes, [], { direction: layoutDirection });
          setNodes(layoutedNodes);
        }
      } else {
        alert(response.error || 'Failed to add property to class');
      }
    } catch (error) {
      console.error('Error adding property to class:', error);
      alert('An error occurred while adding the property');
    }
  }, [selectedVersionId, layoutDirection, setNodes]);

  // Define custom node types
  const nodeTypes = {
    classNode: ClassNode,
  };

  // Helper function to convert classes to React Flow nodes
  const classesToNodes = async (classes: any[]): Promise<Node[]> => {
    return classes.map((cls, index) => ({
      id: cls.id,
      type: 'classNode',
      position: {
        x: 100 + (index % 4) * 280, // Arrange in a grid (4 columns)
        y: 100 + Math.floor(index / 4) * 180
      },
      data: {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        properties: cls.properties || [],
        onPropertyDrop: handlePropertyDrop
      }
    }));
  };

  // Load projects on mount
  useEffect(() => {
    if (currentTenantId) {
      loadProjects();
    }
  }, [currentTenantId]);

  // Sync selected project ID to context for sidebar
  useEffect(() => {
    setContextProjectId(selectedProjectId || null);
  }, [selectedProjectId, setContextProjectId]);

  // Sync selected version ID to context for sidebar
  useEffect(() => {
    setContextVersionId(selectedVersionId || null);
  }, [selectedVersionId, setContextVersionId]);

  // Load versions when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      loadVersions(selectedProjectId);
    } else {
      setVersions([]);
      setSelectedVersionId('');
    }
  }, [selectedProjectId]);

  // Load classes and render them on canvas when version changes or canvas refresh is triggered
  useEffect(() => {
    const loadClasses = async () => {
      if (!selectedVersionId) {
        setNodes([]);
        setEdges([]);
        return;
      }

      try {
        const result = await getClassesForVersion(selectedVersionId);
        const classesData = JSON.parse(result);

        // Load properties for each class
        const classesWithProperties = await Promise.all(
          classesData.map(async (cls: any) => {
            const propsResult = await getPropertiesForClass(cls.id);
            const properties = JSON.parse(propsResult);
            return { ...cls, properties };
          })
        );

        // Convert classes to React Flow nodes
        const newNodes = await classesToNodes(classesWithProperties);

        // Clear edges for now - we'll add relationships later
        const newEdges: Edge[] = [];

        // Apply auto-layout
        const layoutedNodes = getLayoutedElements(newNodes, newEdges, {
          direction: layoutDirection
        });

        setNodes(layoutedNodes);
        setEdges(newEdges);

        // Fit view after a short delay to ensure nodes are rendered
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 400 });
        }, 50);

        console.log('Loaded classes for version:', selectedVersionId, 'Classes:', classesData.length);
      } catch (error) {
        console.error('Failed to load classes:', error);
        setNodes([]);
        setEdges([]);
      }
    };

    loadClasses();
  }, [selectedVersionId, canvasRefreshKey, layoutDirection, setNodes, setEdges, fitView, handlePropertyDrop]);

  const loadProjects = async () => {
    if (!currentTenantId) return;

    setIsLoadingProjects(true);
    try {
      const result = await getProjectsForTenant(currentTenantId);
      const projectsData = JSON.parse(result);
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadVersions = async (projectId: string) => {
    setIsLoadingVersions(true);
    try {
      const result = await getVersionsForProject(projectId);
      const versionsData = JSON.parse(result);
      setVersions(versionsData);

      // Auto-select the first version if available
      if (versionsData.length > 0) {
        setSelectedVersionId(versionsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProjectId(e.target.value);
    setSelectedVersionId(''); // Reset version when project changes
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersionId(e.target.value);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    console.log('Clicked node:', node);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    console.log('Clicked edge:', edge);
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedVersion = versions.find(v => v.id === selectedVersionId);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Project and Version Selectors */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              disabled={isLoadingProjects || !currentTenantId}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Version Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedVersionId}
              onChange={handleVersionChange}
              disabled={isLoadingVersions || !selectedProjectId || versions.length === 0}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
            >
              <option value="">Select version...</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.version_id} - {version.description}
                </option>
              ))}
            </select>
          </div>

          {/* View Switcher */}
          {selectedProjectId && selectedVersionId && (
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button
                onClick={() => setViewMode('canvas')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'canvas'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                Canvas
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                  viewMode === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                Code
              </button>
            </div>
          )}

          {/* Context Display */}
          {selectedProject && selectedVersion && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">{selectedProject.name}</span>
              <span>/</span>
              <span className="font-mono">{selectedVersion.version_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas/Code Area */}
      <div className="flex-1 bg-white dark:bg-gray-900">
        {!selectedProjectId || !selectedVersionId ? (
          // Empty state when no project/version selected
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                No Project Selected
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select a project and version to view the class diagram
              </p>
            </div>
          </div>
        ) : viewMode === 'canvas' ? (
          // React Flow Canvas View
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            attributionPosition="bottom-left"
            className="dark:bg-gray-900"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={12}
              size={1}
              className="dark:bg-gray-900"
              color="currentColor"
              style={{
                color: 'rgb(156, 163, 175)',
                opacity: 0.5
              }}
            />
            <Controls className="dark:bg-gray-800 dark:border-gray-700" />
            <MiniMap
              nodeStrokeColor={(node) => {
                if (node.type === 'input') return '#3b82f6';
                if (node.type === 'output') return '#ec4899';
                return '#6b7280';
              }}
              nodeColor={(node) => {
                if (node.type === 'input') return '#dbeafe';
                if (node.type === 'output') return '#fce7f3';
                return '#f3f4f6';
              }}
              className="dark:bg-gray-800 dark:border-gray-700"
              maskColor="rgb(0, 0, 0, 0.1)"
            />

            {/* Layout Control Panel */}
            <Panel position="top-right" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2 py-1">
                  Auto Layout
                </div>
                <button
                  onClick={() => onLayout('TB')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    layoutDirection === 'TB'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Top to Bottom"
                >
                  ↓ Vertical
                </button>
                <button
                  onClick={() => onLayout('LR')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    layoutDirection === 'LR'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Left to Right"
                >
                  → Horizontal
                </button>
                <button
                  onClick={() => onLayout('BT')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    layoutDirection === 'BT'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Bottom to Top"
                >
                  ↑ Vertical (Up)
                </button>
                <button
                  onClick={() => onLayout('RL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    layoutDirection === 'RL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Right to Left"
                >
                  ← Horizontal (Rev)
                </button>
              </div>
            </Panel>
          </ReactFlow>
        ) : (
          // Monaco Editor Code View
          <Editor
            height="100%"
            defaultLanguage="yaml"
            value={openApiSpec}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              automaticLayout: true,
              wordWrap: 'on',
              folding: true,
            }}
          />
        )}
      </div>
    </div>
  );
};

const Studio = () => {
  return (
    <ReactFlowProvider>
      <StudioContent />
    </ReactFlowProvider>
  );
};

export default Studio;
