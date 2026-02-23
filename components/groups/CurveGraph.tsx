import React, { useMemo, useState, useCallback, useRef } from 'react';
import type { StopValueCurve } from '../../lib/types';
import {
  getCurveControlPoints,
  LIGHTNESS_CURVE_PRESETS,
  CONTRAST_CURVE_PRESETS,
  normalizeStopPosition,
  interpolateCurveValue
} from '../../lib/stop-value-curves';

interface CurveGraphProps {
  curve: StopValueCurve;
  type: 'lightness' | 'contrast';
  width?: number;
  height?: number;
  stops?: number[];  // Optional: highlight actual stop positions
  onControlPointChange?: (point: 'light' | 'mid' | 'dark', value: number) => void;
}

/**
 * SVG-based visual curve graph with draggable control points
 * X-axis: stop position (light → dark)
 * Y-axis: value (lightness 0-1 or contrast 1-21)
 */
export function CurveGraph({
  curve,
  type,
  width = 120,
  height = 60,
  stops = [],
  onControlPointChange
}: CurveGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPoint, setDraggingPoint] = useState<'light' | 'mid' | 'dark' | null>(null);

  const presets = type === 'lightness' ? LIGHTNESS_CURVE_PRESETS : CONTRAST_CURVE_PRESETS;
  const { light, mid, dark } = getCurveControlPoints(curve, presets);

  // Normalize values to 0-1 for display
  const normalizeValue = (val: number) => {
    if (type === 'lightness') {
      return val; // Already 0-1
    } else {
      // Contrast: 1-21 → 0-1
      return (val - 1) / 20;
    }
  };

  // Denormalize from 0-1 back to actual value
  const denormalizeValue = (normalized: number) => {
    if (type === 'lightness') {
      return Math.max(0, Math.min(1, normalized));
    } else {
      // 0-1 → 1-21
      return Math.max(1, Math.min(21, normalized * 20 + 1));
    }
  };

  // For lightness: higher value = higher on graph (lighter)
  // For contrast: higher value = higher on graph (more contrast)
  const lightNorm = normalizeValue(light);
  const midNorm = normalizeValue(mid);
  const darkNorm = normalizeValue(dark);

  // Padding for the graph
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Generate path points for smooth curve
  const pathPoints = useMemo(() => {
    const points: string[] = [];
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
      const position = i / steps;
      const value = interpolateCurveValue(position, lightNorm, midNorm, darkNorm);

      const x = padding.left + position * graphWidth;
      // Flip Y: SVG has 0 at top, but we want higher values at top
      const y = padding.top + (1 - value) * graphHeight;

      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')}`;
  }, [lightNorm, midNorm, darkNorm, graphWidth, graphHeight, padding]);

  // Control points for display
  const controlPoints: Array<{
    key: 'light' | 'mid' | 'dark';
    position: number;
    value: number;
    label: string;
  }> = [
    { key: 'light', position: 0, value: lightNorm, label: 'L' },
    { key: 'mid', position: 0.5, value: midNorm, label: 'M' },
    { key: 'dark', position: 1, value: darkNorm, label: 'D' }
  ];

  // Override points (if any)
  const overridePoints = useMemo(() => {
    if (!curve.overrides || stops.length === 0) return [];

    const sorted = [...stops].sort((a, b) => a - b);
    const minStop = sorted[0];
    const maxStop = sorted[sorted.length - 1];

    return Object.entries(curve.overrides).map(([stopStr, value]) => {
      const stopNum = parseInt(stopStr, 10);
      const position = normalizeStopPosition(stopNum, minStop, maxStop);
      const normalizedValue = normalizeValue(value);
      return { position, value: normalizedValue, stopNum };
    });
  }, [curve.overrides, stops, type]);

  // Handle mouse down on control point
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    point: 'light' | 'mid' | 'dark'
  ) => {
    if (!onControlPointChange) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingPoint(point);
  }, [onControlPointChange]);

  // Handle mouse move while dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingPoint || !onControlPointChange || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Calculate Y position relative to graph area
    const y = e.clientY - rect.top;
    const graphY = y - padding.top;

    // Convert to normalized value (0-1, inverted because SVG Y is flipped)
    let normalizedValue = 1 - (graphY / graphHeight);
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

    // Convert to actual value for this type
    const actualValue = denormalizeValue(normalizedValue);

    // Round to appropriate precision
    const roundedValue = type === 'lightness'
      ? Math.round(actualValue * 100) / 100
      : Math.round(actualValue * 10) / 10;

    onControlPointChange(draggingPoint, roundedValue);
  }, [draggingPoint, onControlPointChange, graphHeight, padding.top, denormalizeValue, type]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  const isInteractive = !!onControlPointChange;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className={`curve-graph ${isInteractive ? 'curve-graph-interactive' : ''}`}
      style={{ display: 'block' }}
      onMouseMove={isInteractive ? handleMouseMove : undefined}
      onMouseUp={isInteractive ? handleMouseUp : undefined}
      onMouseLeave={isInteractive ? handleMouseLeave : undefined}
    >
      {/* Background */}
      <rect
        x={padding.left}
        y={padding.top}
        width={graphWidth}
        height={graphHeight}
        fill="var(--figma-color-bg-secondary)"
        rx={2}
      />

      {/* Grid lines (subtle) */}
      <line
        x1={padding.left}
        y1={padding.top + graphHeight / 2}
        x2={padding.left + graphWidth}
        y2={padding.top + graphHeight / 2}
        stroke="var(--figma-color-border)"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />

      {/* Curve path */}
      <path
        d={pathPoints}
        fill="none"
        stroke="var(--figma-color-text-brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Control points */}
      {controlPoints.map((point) => {
        const x = padding.left + point.position * graphWidth;
        const y = padding.top + (1 - point.value) * graphHeight;
        const isDragging = draggingPoint === point.key;
        const radius = isDragging ? 6 : (isInteractive ? 5 : 4);

        return (
          <g key={point.key}>
            {/* Larger invisible hit area for easier dragging */}
            {isInteractive && (
              <circle
                cx={x}
                cy={y}
                r={12}
                fill="transparent"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleMouseDown(e, point.key)}
              />
            )}
            {/* Visible control point */}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={isDragging ? 'var(--figma-color-text-brand)' : 'var(--figma-color-bg)'}
              stroke="var(--figma-color-text-brand)"
              strokeWidth={2}
              style={{
                cursor: isInteractive ? (isDragging ? 'grabbing' : 'grab') : 'default',
                pointerEvents: isInteractive ? 'none' : 'auto'
              }}
            />
          </g>
        );
      })}

      {/* Override points (different color) */}
      {overridePoints.map((point, i) => {
        const x = padding.left + point.position * graphWidth;
        const y = padding.top + (1 - point.value) * graphHeight;
        return (
          <circle
            key={`override-${i}`}
            cx={x}
            cy={y}
            r={3}
            fill="var(--figma-color-text-warning)"
            stroke="var(--figma-color-bg)"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
