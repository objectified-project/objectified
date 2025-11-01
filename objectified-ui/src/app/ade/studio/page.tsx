'use client';

import { useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    position: { x: 250, y: 0 },
    data: { label: 'Start Node' },
  },
  {
    id: '2',
    position: { x: 100, y: 100 },
    data: { label: 'Process A' },
  },
  {
    id: '3',
    position: { x: 400, y: 100 },
    data: { label: 'Process B' },
  },
  {
    id: '4',
    type: 'output',
    position: { x: 250, y: 200 },
    data: { label: 'End Node' },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-4', source: '3', target: '4' },
];

const Studio = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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

  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 48px)',
      }}
      className="bg-white dark:bg-gray-900"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
            color: 'rgb(156, 163, 175)', // gray-400 for both modes
            opacity: 0.5
          }}
        />
        <Controls
          className="dark:bg-gray-800 dark:border-gray-700"
        />
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
      </ReactFlow>
    </div>
  );
};

export default Studio;
