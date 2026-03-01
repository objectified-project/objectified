'use client';

import * as React from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMigration } from '../MigrationContext';
import MigrationClassNode, { type MigrationClassNodeData } from './MigrationClassNode';

const FROM_NODE_X = 30;
const TO_NODE_X = 650;
const NODE_Y = 150;

function extractProperties(schema: Record<string, unknown>): Array<{ name: string; type?: string }> {
  const props = schema?.properties;
  if (typeof props !== 'object' || props === null) return [];
  return Object.entries(props).map(([name, def]) => {
    const d = def as Record<string, unknown> | undefined;
    const type = typeof d?.type === 'string' ? d.type : undefined;
    return { name, type };
  });
}

function MigrationCanvasInner() {
  const { fromTables, toTables, selectedClassName } = useMigration();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MigrationClassNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = React.useMemo(() => ({ migrationClass: MigrationClassNode }), []);

  React.useEffect(() => {
    if (!selectedClassName) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const fromRow = fromTables.find((r) => r.class_name === selectedClassName);
    const toRow = toTables.find((r) => r.class_name === selectedClassName);
    const fromSchema = fromRow?.schema ?? {};
    const toSchema = toRow?.schema ?? {};
    const fromProps = extractProperties(fromSchema);
    const toProps = extractProperties(toSchema);

    const fromNode: Node<MigrationClassNodeData> = {
      id: 'migration-from',
      type: 'migrationClass',
      position: { x: FROM_NODE_X, y: NODE_Y },
      data: { className: selectedClassName, properties: fromProps, side: 'from' },
      draggable: false,
      selectable: false,
    };
    const toNode: Node<MigrationClassNodeData> = {
      id: 'migration-to',
      type: 'migrationClass',
      position: { x: TO_NODE_X, y: NODE_Y },
      data: { className: selectedClassName, properties: toProps, side: 'to' },
      draggable: false,
      selectable: false,
    };
    const edge: Edge = {
      id: 'migration-edge',
      source: 'migration-from',
      target: 'migration-to',
      type: 'smoothstep',
    };
    setNodes([fromNode, toNode]);
    setEdges([edge]);
  }, [selectedClassName, fromTables, toTables, setNodes, setEdges]);

  return (
    <div className="w-full h-full min-h-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        className="bg-gray-50 dark:bg-gray-900"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default function MigrationCanvas() {
  return (
    <ReactFlowProvider>
      <MigrationCanvasInner />
    </ReactFlowProvider>
  );
}
