'use client';

import React, { useCallback, useState, useEffect } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStudio } from '../../StudioContext';

export default function PathsCanvasView() {
  const {
    gridSize,
    gridStyle,
  } = useStudio();

  const [nodes, , onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const [isDark, setIsDark] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
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
      </ReactFlowProvider>

      {/* Placeholder for Toolbox */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-xs">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Toolbox</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Additional objects to add to the canvas will appear here.
        </p>
      </div>
    </div>
  );
}

