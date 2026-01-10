'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  addEdge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStudio } from '../../StudioContext';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  getOperationsForPath,
  createOperation,
} from '../../../../../../lib/db/helper-path-operations';
import {
  getParametersForOperation,
} from '../../../../../../lib/db/helper-path-parameters';
import { getPathById } from '../../../../../../lib/db/helper-paths';
import PathParameterNode from './PathParameterNode';

// Operation Node Component with Handle
function OperationNode({ data }: { data: { operation: string; color: string } }) {
  return (
    <>
      <div
        className="px-4 py-2 rounded-lg shadow-lg border-2 font-bold text-white text-sm cursor-pointer"
        style={{
          backgroundColor: data.color,
          borderColor: data.color,
          minWidth: '80px',
          textAlign: 'center',
        }}
      >
        {data.operation}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="operation-output"
        className="w-3 h-3 bg-white/80 border-2"
        style={{ borderColor: data.color }}
      />
    </>
  );
}

const nodeTypes = {
  operation: OperationNode,
  parameter: PathParameterNode,
};

// Operation color mapping
const OPERATION_COLORS: Record<string, string> = {
  'GET': '#10b981',
  'POST': '#3b82f6',
  'PUT': '#f59e0b',
  'PATCH': '#8b5cf6',
  'DELETE': '#ef4444',
  'HEAD': '#6b7280',
  'OPTIONS': '#64748b',
};

interface PathsCanvasInnerProps {
  selectedPathId: string | null;
  onOperationSelect: (operation: { id: string; operation: string } | null) => void;
  onParameterSelect?: (parameter: { id: string; name: string; operationId: string } | null) => void;
  refreshKey?: number;
}

function PathsCanvasInner({ selectedPathId, onOperationSelect, onParameterSelect, refreshKey }: PathsCanvasInnerProps) {
  const {
    gridSize,
    gridStyle,
  } = useStudio();

  const { alert: alertDialog } = useDialog();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isDark, setIsDark] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  // Load operations and parameters when path is selected
  useEffect(() => {
    if (!selectedPathId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const loadOperationsAndParameters = async () => {
      try {
        // Load operations
        const operationsResponse = await getOperationsForPath(selectedPathId);
        const operations = JSON.parse(operationsResponse);

        // Convert operations to nodes
        const operationNodes: Node[] = operations.map((op: any, index: number) => ({
          id: op.id,
          type: 'operation',
          position: { x: 100 + (index * 150), y: 100 },
          data: {
            operation: op.operation,
            color: OPERATION_COLORS[op.operation] || '#64748b',
            dbOperationId: op.id,
          },
        }));

        // Load parameters for all operations and create parameter nodes
        const allParameterNodes: Node[] = [];
        const allEdges: Edge[] = [];
        let paramYOffset = 250;

        for (const op of operations) {
          const paramsResponse = await getParametersForOperation(op.id);
          const paramsData = JSON.parse(paramsResponse);

          if (paramsData.success && paramsData.parameters) {
            paramsData.parameters.forEach((param: any, paramIndex: number) => {
              const paramNodeId = `param-${param.id}`;

              // Create parameter node
              allParameterNodes.push({
                id: paramNodeId,
                type: 'parameter',
                position: {
                  x: 350 + (paramIndex * 220),
                  y: paramYOffset
                },
                data: {
                  name: param.name,
                  inLocation: param.in_location,
                  summary: param.summary,
                  description: param.description,
                  required: param.metadata?.required ?? (param.in_location === 'path'),
                  dbParameterId: param.id,
                  operationId: op.id,
                },
              });

              // Create edge from operation to parameter
              allEdges.push({
                id: `edge-${op.id}-${param.id}`,
                source: op.id,
                sourceHandle: 'operation-output',
                target: paramNodeId,
                targetHandle: 'parameter-input',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#9ca3af', strokeWidth: 2 },
              });
            });

            if (paramsData.parameters.length > 0) {
              paramYOffset += 120;
            }
          }
        }

        setNodes([...operationNodes, ...allParameterNodes]);
        setEdges(allEdges);
      } catch (error) {
        console.error('Error loading operations and parameters:', error);
      }
    };

    loadOperationsAndParameters();
  }, [selectedPathId, setNodes, setEdges, refreshKey]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Get background variant
  const backgroundVariant = useCallback((style: 'dots' | 'lines' | 'cross'): BackgroundVariant => {
    switch (style) {
      case 'dots': return BackgroundVariant.Dots;
      case 'lines': return BackgroundVariant.Lines;
      case 'cross': return BackgroundVariant.Cross;
      default: return BackgroundVariant.Dots;
    }
  }, []);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle node click to show properties in sidebar
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'operation') {
        onOperationSelect({
          id: node.data.dbOperationId as string,
          operation: node.data.operation as string,
        });
        if (onParameterSelect) {
          onParameterSelect(null);
        }
      } else if (node.type === 'parameter') {
        if (onParameterSelect) {
          onParameterSelect({
            id: node.data.dbParameterId as string,
            name: node.data.name as string,
            operationId: node.data.operationId as string,
          });
        }
        onOperationSelect(null);
      }
    },
    [onOperationSelect, onParameterSelect]
  );

  // Handle connecting nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2 },
      }, eds));
    },
    [setEdges]
  );

  // Handle drop
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      if (!selectedPathId) {
        await alertDialog({
          title: 'No Path Selected',
          message: 'Please select a path from the sidebar before adding operations to the canvas.',
          variant: 'warning',
        });
        return;
      }

      const data = event.dataTransfer.getData('application/json');
      if (!data) return;

      const dropData = JSON.parse(data);

      if (dropData.type === 'operation') {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        try {
          // Save to database
          const result = await createOperation(
            selectedPathId,
            dropData.operation,
            { position }
          );
          const savedOperation = JSON.parse(result);

          // Add to canvas
          const newNode: Node = {
            id: savedOperation.id,
            type: 'operation',
            position,
            data: {
              operation: savedOperation.operation,
              color: dropData.color,
              dbOperationId: savedOperation.id,
            },
          };

          setNodes((nds) => [...nds, newNode]);
        } catch (error) {
          console.error('Error creating operation:', error);
          await alertDialog({
            title: 'Error',
            message: 'Failed to add operation. Please try again.',
            variant: 'error',
          });
        }
      } else if (dropData.type === 'parameter') {
        await alertDialog({
          title: 'Add Parameter via Properties Panel',
          message: 'To add a parameter, click on an operation node and use the "Add Parameter" button in the Operation Details panel on the right.',
          variant: 'info',
        });
      }
    },
    [screenToFlowPosition, setNodes, selectedPathId, alertDialog]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background
          variant={backgroundVariant(gridStyle)}
          gap={gridSize}
          size={1.5}
          color="currentColor"
          style={{
            color: isDark ? 'rgb(148, 163, 184)' : 'rgb(99, 102, 241)',
            opacity: isDark ? 0.3 : 0.2
          }}
        />
        <Controls
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
          style={{
            bottom: 20,
            left: 20,
            right: 'auto',
            top: 'auto',
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default function PathsCanvasView({
  selectedPathId,
  onOperationSelect,
  onParameterSelect,
  refreshKey,
}: {
  selectedPathId: string | null;
  onOperationSelect: (operation: { id: string; operation: string } | null) => void;
  onParameterSelect?: (parameter: { id: string; name: string; operationId: string } | null) => void;
  refreshKey?: number;
}) {
  return (
    <ReactFlowProvider>
      <PathsCanvasInner
        selectedPathId={selectedPathId}
        onOperationSelect={onOperationSelect}
        onParameterSelect={onParameterSelect}
        refreshKey={refreshKey}
      />
    </ReactFlowProvider>
  );
}
