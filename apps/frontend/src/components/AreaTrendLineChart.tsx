import React, { useState, useRef, useMemo } from 'react';
import { AreaTrendsData } from '../types/index.js';

interface AreaTrendLineChartProps {
  data: AreaTrendsData;
  metric: 'PERCENTAGE' | 'FILLED_COUNT' | 'OPEN_COUNT';
  visibleAreas: Set<string>;
  onToggleArea: (areaName: string) => void;
  onSelectAllAreas?: () => void;
  onClearAllAreas?: () => void;
}

export const AreaTrendLineChart: React.FC<AreaTrendLineChartProps> = ({
  data,
  metric,
  visibleAreas,
  onToggleArea,
  onSelectAllAreas,
  onClearAllAreas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const dates = data.dates;
  const numDays = dates.length;

  // Chart dimensions & padding
  const svgWidth = 860;
  const svgHeight = 360;
  const padding = { top: 24, right: 36, bottom: 48, left: 54 };

  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Compute Max Value for Y-Axis
  const maxY = useMemo(() => {
    if (metric === 'PERCENTAGE') return 100;

    let max = 1;
    data.areas.forEach((area) => {
      if (visibleAreas.has(area.name)) {
        area.data.forEach((pt) => {
          const val = metric === 'FILLED_COUNT' ? pt.filledCount : pt.openCount;
          if (val > max) max = val;
        });
      }
    });
    // Add headroom
    return Math.max(5, Math.ceil(max * 1.15));
  }, [data, metric, visibleAreas]);

  // Coordinate scales
  const getX = (index: number) => {
    if (numDays <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (numDays - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return padding.top + plotHeight - (clamped / maxY) * plotHeight;
  };

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    if (metric === 'PERCENTAGE') {
      return [0, 25, 50, 75, 100];
    }
    const step = Math.max(1, Math.ceil(maxY / 4));
    const ticks: number[] = [];
    for (let i = 0; i <= maxY; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] < maxY) ticks.push(maxY);
    return ticks;
  }, [metric, maxY]);

  // X-axis date labels downsampling (show ~6-8 labels max)
  const xLabels = useMemo(() => {
    if (numDays === 0) return [];
    if (numDays <= 8) {
      return dates.map((d, i) => ({ date: d, index: i }));
    }
    const step = Math.ceil(numDays / 7);
    const labels: { date: string; index: number }[] = [];
    for (let i = 0; i < numDays; i += step) {
      labels.push({ date: dates[i], index: i });
    }
    // ensure last date is included
    if (labels[labels.length - 1].index !== numDays - 1) {
      labels.push({ date: dates[numDays - 1], index: numDays - 1 });
    }
    return labels;
  }, [dates, numDays]);

  const formatDateLabel = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return `${monthNames[m]} ${d}`;
    }
    return dStr;
  };

  // Mouse Move Event Handler for Hover Crosshair & Tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || numDays <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert clientX to SVG coordinate scale
    const scaleX = svgWidth / rect.width;
    const svgX = clientX * scaleX;

    const relX = Math.max(0, Math.min(plotWidth, svgX - padding.left));
    const closestIdx = Math.round((relX / plotWidth) * (numDays - 1));

    setHoverIndex(closestIdx);
    setMousePos({ x: clientX, y: clientY });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* 1. Interactive Legend / Series Toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Territories:
          </span>
          {data.areas.map((area) => {
            const isVisible = visibleAreas.has(area.name);
            return (
              <button
                key={area.name}
                onClick={() => onToggleArea(area.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: isVisible ? `1px solid ${area.color}` : '1px solid var(--border-subtle)',
                  backgroundColor: isVisible ? `${area.color}22` : 'transparent',
                  color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                  opacity: isVisible ? 1 : 0.45,
                }}
                title={isVisible ? `Click to hide ${area.name}` : `Click to show ${area.name}`}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: area.color,
                    display: 'inline-block',
                  }}
                />
                <span>{area.name}</span>
                <span style={{ fontSize: '10.5px', color: isVisible ? area.color : '#64748b' }}>
                  ({metric === 'PERCENTAGE' ? `${area.currentFillRate}%` : area.currentFilled})
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Legend Actions */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
          {onSelectAllAreas && (
            <button
              onClick={onSelectAllAreas}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', padding: '2px 6px' }}
            >
              Select All
            </button>
          )}
          {onClearAllAreas && (
            <button
              onClick={onClearAllAreas}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', padding: '2px 6px' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 2. Responsive SVG Line Chart Canvas */}
      <div style={{ width: '100%', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible', userSelect: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y-Axis Horizontal Gridlines & Values */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeDasharray={tick === 0 ? 'none' : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="11"
                  textAnchor="end"
                  fontWeight="600"
                >
                  {metric === 'PERCENTAGE' ? `${tick}%` : tick}
                </text>
              </g>
            );
          })}

          {/* X-Axis Date Labels & Ticks */}
          {xLabels.map((item) => {
            const x = getX(item.index);
            return (
              <g key={item.date}>
                <line
                  x1={x}
                  y1={svgHeight - padding.bottom}
                  x2={x}
                  y2={svgHeight - padding.bottom + 5}
                  stroke="rgba(15, 23, 42, 0.18)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 20}
                  fill="#64748b"
                  fontSize="11.5"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {formatDateLabel(item.date)}
                </text>
              </g>
            );
          })}

          {/* Baseline Zero Axis */}
          <line
            x1={padding.left}
            y1={getY(0)}
            x2={svgWidth - padding.right}
            y2={getY(0)}
            stroke="rgba(15, 23, 42, 0.22)"
            strokeWidth={1.5}
          />

          {/* Multi-Area Polylines */}
          {data.areas.map((area) => {
            if (!visibleAreas.has(area.name)) return null;

            const pointsStr = area.data
              .map((pt, i) => {
                const x = getX(i);
                const val =
                  metric === 'PERCENTAGE'
                    ? pt.percentage
                    : metric === 'FILLED_COUNT'
                    ? pt.filledCount
                    : pt.openCount;
                const y = getY(val);
                return `${x},${y}`;
              })
              .join(' ');

            return (
              <g key={area.name}>
                {/* Glow/Shadow filter layer for active lines */}
                <polyline
                  points={pointsStr}
                  fill="none"
                  stroke={area.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: `drop-shadow(0 2px 6px ${area.color}55)`,
                    transition: 'stroke 0.2s ease',
                  }}
                />

                {/* Dots on Data Points (if <= 25 days) */}
                {numDays <= 25 &&
                  area.data.map((pt, i) => {
                    const x = getX(i);
                    const val =
                      metric === 'PERCENTAGE'
                        ? pt.percentage
                        : metric === 'FILLED_COUNT'
                        ? pt.filledCount
                        : pt.openCount;
                    const y = getY(val);
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={hoverIndex === i ? 5 : 2.5}
                        fill={hoverIndex === i ? '#ffffff' : area.color}
                        stroke={area.color}
                        strokeWidth={hoverIndex === i ? 2.5 : 1}
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* Vertical Hover Crosshair Cursor (Matching User's Reference Image) */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={svgHeight - padding.bottom}
                stroke="var(--primary)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.7}
              />
              {/* Highlight Circle Dots on each line at this hover index */}
              {data.areas.map((area) => {
                if (!visibleAreas.has(area.name)) return null;
                const pt = area.data[hoverIndex];
                if (!pt) return null;
                const x = getX(hoverIndex);
                const val =
                  metric === 'PERCENTAGE'
                    ? pt.percentage
                    : metric === 'FILLED_COUNT'
                    ? pt.filledCount
                    : pt.openCount;
                const y = getY(val);

                return (
                  <circle
                    key={area.name}
                    cx={x}
                    cy={y}
                    r={6}
                    fill={area.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    style={{ filter: `drop-shadow(0 0 6px ${area.color})` }}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating Tooltip matching the hover crosshair */}
        {hoverIndex !== null && mousePos && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(mousePos.x + 18, (containerRef.current?.clientWidth || 700) - 260),
              top: Math.max(10, mousePos.y - 40),
              backgroundColor: '#ffffff',
              border: '1.5px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '12px 14px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 0 12px rgba(6, 148, 148, 0.1)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '220px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '8px', borderBottom: '1.5px solid var(--border-subtle)', paddingBottom: '4px' }}>
              📅 {formatDateLabel(dates[hoverIndex])} ({dates[hoverIndex]})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.areas
                .filter((area) => visibleAreas.has(area.name))
                .map((area) => {
                  const pt = area.data[hoverIndex];
                  if (!pt) return null;
                  const valDisplay =
                    metric === 'PERCENTAGE'
                      ? `${pt.percentage}% Fill Rate`
                      : metric === 'FILLED_COUNT'
                      ? `${pt.filledCount} Filled Hires`
                      : `${pt.openCount} Open Vacancies`;

                  return (
                    <div key={area.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: area.color }} />
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{area.name}:</span>
                      </div>
                      <span style={{ fontWeight: '800', color: area.color }}>{valDisplay}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
