'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function PathsCanvas() {
  const [nodes, , onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showMiniMap, setShowMiniMap] = useState(true);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="flex-1 relative h-full bg-gray-50 dark:bg-gray-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-gray-50 dark:bg-gray-900"
      >
        <Background color="#aaa" gap={16} />
        <Controls className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg" />
        {showMiniMap && (
          <MiniMap
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
            nodeColor={() => '#6366f1'}
          />
        )}
        <Panel position="bottom-right" className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 mr-2 mb-2 shadow-lg">
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showMiniMap ? 'Hide' : 'Show'} Mini-map
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Nodes: {nodes.length}
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

