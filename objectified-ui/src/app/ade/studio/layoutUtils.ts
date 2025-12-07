import type { Node, Edge } from '@xyflow/react';
import { applyAutoLayout, type LayoutAlgorithm } from './autoLayoutAlgorithms';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

// Default node dimensions
const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSeparation?: number;
  nodeSeparation?: number;
  edgeSeparation?: number;
}

/**
 * Layout nodes and edges using Dagre (backwards compatibility)
 * @param nodes - Array of nodes to layout
 * @param edges - Array of edges connecting the nodes
 * @param options - Layout configuration options
 * @returns Array of nodes with updated positions
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const {
    direction = 'TB',
    nodeWidth = NODE_WIDTH,
    nodeHeight = NODE_HEIGHT,
    rankSeparation = 100,
    nodeSeparation = 100,
    edgeSeparation = 30,
  } = options;

  // Map direction to algorithm
  let algorithm: LayoutAlgorithm = 'hierarchical-tb';
  switch (direction) {
    case 'TB':
      algorithm = 'hierarchical-tb';
      break;
    case 'LR':
      algorithm = 'hierarchical-lr';
      break;
    case 'BT':
      algorithm = 'hierarchical-bt';
      break;
    case 'RL':
      algorithm = 'hierarchical-rl';
      break;
  }

  return applyAutoLayout(nodes, edges, {
    algorithm,
    nodeWidth,
    nodeHeight,
    rankSeparation,
    nodeSeparation,
    edgeSeparation,
  });
}

/**
 * Applies horizontal layout (left to right)
 */
export function getHorizontalLayout(nodes: Node[], edges: Edge[]): Node[] {
  return getLayoutedElements(nodes, edges, { direction: 'LR' });
}

/**
 * Applies vertical layout (top to bottom)
 */
export function getVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  return getLayoutedElements(nodes, edges, { direction: 'TB' });
}

// Re-export for convenience
export { applyAutoLayout, type LayoutAlgorithm } from './autoLayoutAlgorithms';

