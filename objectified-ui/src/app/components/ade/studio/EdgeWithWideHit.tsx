'use client';

import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  getEdgeCenter,
  getSmoothStepPath,
  getStraightPath,
  useStore,
} from '@xyflow/react';

/** Invisible stroke width for easier edge hover (hit area) */
const HIT_AREA_STROKE = 20;

/**
 * Edge component that renders the same as React Flow's default/straight/smoothstep
 * but with a wider invisible path so the hover area is ~20px instead of 2–3px.
 */
const EdgeWithWideHit: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelBgStyle,
}) => {
  const edgeType = useStore((s) => s.edges.find((e) => e.id === id)?.type ?? 'default');

  const { path, labelX, labelY } = useMemo(() => {
    const params = {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    };
    const [cx, cy] = getEdgeCenter({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    if (edgeType === 'straight') {
      const [p] = getStraightPath(params);
      return { path: p, labelX: cx, labelY: cy };
    }
    if (edgeType === 'smoothstep') {
      const [p] = getSmoothStepPath({ ...params, borderRadius: 8 });
      return { path: p, labelX: cx, labelY: cy };
    }
    const [p, lx, ly] = getBezierPath(params);
    return { path: p, labelX: lx, labelY: ly };
  }, [edgeType, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
      />
      {/* Wider invisible path for easier hover */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_AREA_STROKE}
        style={{ cursor: 'pointer' }}
      />
      {label != null && typeof label === 'string' && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-Math.max(80, Math.min(200, label.length * 6.5)) / 2}
            y={-10}
            width={Math.max(80, Math.min(200, label.length * 6.5))}
            height={20}
            rx={4}
            style={labelBgStyle ?? { fill: 'white', fillOpacity: 0.95 }}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            style={labelStyle ?? { fill: '#374151', fontSize: 10, fontWeight: 600 }}
            className="react-flow__edge-text"
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
};

export default EdgeWithWideHit;
