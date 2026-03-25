import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { StopValueCurve } from '../../lib/types';
import {
  getCurveControlPoints,
  LIGHTNESS_CURVE_PRESETS,
  CONTRAST_CURVE_PRESETS,
  normalizeStopPosition,
  interpolateCurveValue
} from '../../lib/stop-value-curves';

// Constant padding (hoisted to module scope for stable useMemo deps)
const PADDING = 8;

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
  const rafRef = useRef<number | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<'light' | 'mid' | 'dark' | null>(null);

  // Cancel any pending RAF on unmount to avoid calling setState on unmounted component
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
  const denormalizeValue = useCallback((normalized: number) => {
    if (type === 'lightness') {
      return Math.max(0, Math.min(1, normalized));
    } else {
      // 0-1 → 1-21
      return Math.max(1, Math.min(21, normalized * 20 + 1));
    }
  }, [type]);

  // For lightness: higher value = higher on graph (lighter)
  // For contrast: higher value = higher on graph (more contrast)
  const lightNorm = normalizeValue(light);
  const midNorm = normalizeValue(mid);
  const darkNorm = normalizeValue(dark);

  // Padding for the graph (derived from stable props)
  const graphWidth = width - PADDING * 2;
  const graphHeight = height - PADDING * 2;

  // Generate path points for smooth curve
  const pathPoints = useMemo(() => {
    const points: string[] = [];
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
      const position = i / steps;
      const value = interpolateCurveValue(position, lightNorm, midNorm, darkNorm);

      const x = PADDING + position * graphWidth;
      // Flip Y: SVG has 0 at top, but we want higher values at top
      const y = PADDING + (1 - value) * graphHeight;

      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')}`;
  }, [lightNorm, midNorm, darkNorm, graphWidth, graphHeight]);

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

  // Handle mouse move while dragging (throttled to one update per animation frame)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingPoint || !onControlPointChange || !svgRef.current) return;

    // Throttle with requestAnimationFrame to avoid excessive re-renders
    if (rafRef.current !== null) return;

    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const y = clientY - rect.top;
      const graphY = y - PADDING;

      let normalizedValue = 1 - (graphY / graphHeight);
      normalizedValue = Math.max(0, Math.min(1, normalizedValue));

      const actualValue = denormalizeValue(normalizedValue);
      const roundedValue = type === 'lightness'
        ? Math.round(actualValue * 100) / 100
        : Math.round(actualValue * 10) / 10;

      onControlPointChange(draggingPoint, roundedValue);
    });
  }, [draggingPoint, onControlPointChange, graphHeight, denormalizeValue, type]);

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
        x={PADDING}
        y={PADDING}
        width={graphWidth}
        height={graphHeight}
        fill="var(--figma-color-bg-secondary)"
        rx={2}
      />

      {/* Grid lines (subtle) */}
      <line
        x1={PADDING}
        y1={PADDING + graphHeight / 2}
        x2={PADDING + graphWidth}
        y2={PADDING + graphHeight / 2}
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
        const x = PADDING + point.position * graphWidth;
        const y = PADDING + (1 - point.value) * graphHeight;
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
        const x = PADDING + point.position * graphWidth;
        const y = PADDING + (1 - point.value) * graphHeight;
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
