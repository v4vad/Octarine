import React, { useMemo } from 'react';
import type { StopValueCurve, StopValueCurvePreset } from '../../lib/types';
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
}

/**
 * SVG-based visual curve graph
 * X-axis: stop position (light → dark)
 * Y-axis: value (lightness 0-1 or contrast 1-21)
 */
export function CurveGraph({
  curve,
  type,
  width = 120,
  height = 60,
  stops = []
}: CurveGraphProps) {
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

  // For lightness: higher value = higher on graph (lighter)
  // For contrast: higher value = higher on graph (more contrast)
  const lightNorm = normalizeValue(light);
  const midNorm = normalizeValue(mid);
  const darkNorm = normalizeValue(dark);

  // Padding for the graph
  const padding = { top: 6, right: 6, bottom: 6, left: 6 };
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
  const controlPoints = [
    { position: 0, value: lightNorm, label: 'L' },
    { position: 0.5, value: midNorm, label: 'M' },
    { position: 1, value: darkNorm, label: 'D' }
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

  return (
    <svg
      width={width}
      height={height}
      className="curve-graph"
      style={{ display: 'block' }}
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
      {controlPoints.map((point, i) => {
        const x = padding.left + point.position * graphWidth;
        const y = padding.top + (1 - point.value) * graphHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={4}
            fill="var(--figma-color-bg)"
            stroke="var(--figma-color-text-brand)"
            strokeWidth={2}
          />
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
