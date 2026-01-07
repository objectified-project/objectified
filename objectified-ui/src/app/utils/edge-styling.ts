/**
 * Edge Styling Utilities
 *
 * Converts edge style types to CSS stroke properties
 */

import type { EdgeStyleType } from '../ade/studio/StudioContext';

/**
 * Convert edge style type to strokeDasharray value
 */
export function getStrokeDashArray(styleType: EdgeStyleType, strokeWidth: number = 2): string | undefined {
  switch (styleType) {
    case 'solid':
      return undefined; // No dash array for solid lines
    case 'dashed':
      return '5,5'; // Medium dashes
    case 'dotted':
      return '2,3'; // Small dots with gaps
    case 'double':
      return undefined; // Double lines don't use dash array
    default:
      return undefined;
  }
}

/**
 * Get stroke style properties for an edge
 * Returns object with stroke properties to apply to edge style
 */
export function getEdgeStrokeStyle(
  styleType: EdgeStyleType,
  baseColor: string,
  strokeWidth: number = 2
): {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
} {
  const baseStyle: any = {
    stroke: baseColor,
    strokeWidth,
  };

  const dashArray = getStrokeDashArray(styleType, strokeWidth);
  if (dashArray) {
    baseStyle.strokeDasharray = dashArray;
  }

  // For double lines, we'll use a thicker stroke with a lighter inner line
  // This is handled differently - we return special properties
  if (styleType === 'double') {
    return {
      stroke: baseColor,
      strokeWidth: strokeWidth * 2.5, // Make it thicker for double effect
      strokeDasharray: undefined,
    };
  }

  return baseStyle;
}

/**
 * Determine edge category based on edge properties
 * This helps categorize edges for styling
 */
export function categorizeEdge(edge: {
  label?: string;
  markerStart?: any;
  markerEnd?: any;
  source: string;
  target: string;
}): 'direct' | 'optional' | 'weak' | 'bidirectional' {
  // Bidirectional: has both start and end markers
  if (edge.markerStart && edge.markerEnd) {
    return 'bidirectional';
  }

  // Optional: typically composition types like anyOf, oneOf
  const label = edge.label?.toLowerCase() || '';
  if (label.includes('anyof') || label.includes('oneof')) {
    return 'optional';
  }

  // Weak: composition like allOf or references with specific patterns
  if (label.includes('allof')) {
    return 'weak';
  }

  // Direct: standard property references
  return 'direct';
}

/**
 * Apply edge styling based on category and user preferences
 */
export function applyEdgeStyling(
  edge: any,
  edgeStylingOptions: {
    directReferences: EdgeStyleType;
    optionalReferences: EdgeStyleType;
    weakReferences: EdgeStyleType;
    bidirectional: EdgeStyleType;
    directColor: string;
    optionalColor: string;
    weakColor: string;
    bidirectionalColor: string;
  }
): any {
  const category = categorizeEdge(edge);
  let styleType: EdgeStyleType;
  let color: string;

  switch (category) {
    case 'direct':
      styleType = edgeStylingOptions.directReferences;
      color = edgeStylingOptions.directColor;
      break;
    case 'optional':
      styleType = edgeStylingOptions.optionalReferences;
      color = edgeStylingOptions.optionalColor;
      break;
    case 'weak':
      styleType = edgeStylingOptions.weakReferences;
      color = edgeStylingOptions.weakColor;
      break;
    case 'bidirectional':
      styleType = edgeStylingOptions.bidirectional;
      color = edgeStylingOptions.bidirectionalColor;
      break;
  }

  // Get the current stroke width
  const currentStrokeWidth = edge.style?.strokeWidth || 2;

  // Apply the styling with custom color
  const strokeStyle = getEdgeStrokeStyle(styleType, color, currentStrokeWidth);

  // Update marker colors to match edge color
  const updatedMarkerStart = edge.markerStart ? { ...edge.markerStart, color } : undefined;
  const updatedMarkerEnd = edge.markerEnd ? { ...edge.markerEnd, color } : undefined;

  return {
    ...edge,
    style: {
      ...edge.style,
      ...strokeStyle,
    },
    markerStart: updatedMarkerStart,
    markerEnd: updatedMarkerEnd,
  };
}

