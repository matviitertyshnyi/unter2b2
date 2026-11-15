import React, { useMemo, useState } from 'react';
import { MonthlyMetric } from '../types/api';
import { formatPln } from '../utils/format';
import styles from './FreightChart.module.css';

interface FreightChartProps {
  series: MonthlyMetric[];
}

interface Point {
  x: number;
  y: number;
}

function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const FreightChart: React.FC<FreightChartProps> = ({ series }) => {
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(0, series.length - 2));

  const chart = useMemo(() => {
    const width = 680;
    const height = 240;
    const padLeft = 52;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 30;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    const maxVal = Math.max(
      40000,
      ...series.map((s) => Math.max(s.outboundPln, s.inboundPln))
    );
    const yCeiling = Math.ceil(maxVal / 10000) * 10000;

    const outboundPts: Point[] = series.map((item, idx) => ({
      x: padLeft + (idx / Math.max(1, series.length - 1)) * innerW,
      y: padTop + innerH - (item.outboundPln / yCeiling) * innerH,
    }));

    const inboundPts: Point[] = series.map((item, idx) => ({
      x: padLeft + (idx / Math.max(1, series.length - 1)) * innerW,
      y: padTop + innerH - (item.inboundPln / yCeiling) * innerH,
    }));

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(yCeiling * ratio),
      y: padTop + innerH - ratio * innerH,
    }));

    return {
      width,
      height,
      padTop,
      padBottom,
      innerH,
      outboundPts,
      inboundPts,
      outboundPath: buildSmoothPath(outboundPts),
      inboundPath: buildSmoothPath(inboundPts),
      yTicks,
    };
  }, [series]);

  const activePoint = series[activeIndex] ?? series[0];
  const activeOut = chart.outboundPts[activeIndex];
  const activeIn = chart.inboundPts[activeIndex];

  if (!activePoint) {
    return null;
  }

  return (
    <section className={styles.chartCard} aria-label="Monthly Outbound vs Inbound Freight Value">
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>Freight Figures (Outbound vs. Inbound PLN)</h2>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dotBlue} />
            Outbound Dispatches
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dotEmerald} />
            Inbound Supply Pickups
          </span>
        </div>
      </div>

      <div className={styles.svgWrap}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label="Smooth line chart comparing monthly outbound and inbound micro-freight volume in PLN"
        >
          {chart.yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={52}
                y1={tick.y}
                x2={chart.width - 18}
                y2={tick.y}
                stroke="var(--chart-grid)"
                strokeWidth="1.2"
              />
              <text x={44} y={tick.y + 4} textAnchor="end" className={styles.axisText}>
                {tick.value === 0 ? '0' : `${Math.round(tick.value / 1000)}k`}
              </text>
            </g>
          ))}

          {activeOut && (
            <line
              x1={activeOut.x}
              y1={chart.padTop}
              x2={activeOut.x}
              y2={chart.padTop + chart.innerH}
              stroke="#CBD5E1"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          )}

          <path
            d={chart.inboundPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d={chart.outboundPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {activeIn && (
            <circle cx={activeIn.x} cy={activeIn.y} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
          )}
          {activeOut && (
            <circle cx={activeOut.x} cy={activeOut.y} r="5.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
          )}

          {series.map((item, idx) => {
            const pt = chart.outboundPts[idx];
            const hitX = pt.x - 24;
            return (
              <g key={item.month}>
                <text
                  x={pt.x}
                  y={chart.height - 8}
                  textAnchor="middle"
                  className={styles.axisText}
                  style={{
                    fontWeight: idx === activeIndex ? 700 : 500,
                    fill: idx === activeIndex ? 'var(--ink-primary)' : 'var(--ink-muted)',
                  }}
                >
                  {item.month}
                </text>
                <rect
                  x={Math.max(40, hitX)}
                  y={chart.padTop}
                  width={48}
                  height={chart.innerH + 20}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => setActiveIndex(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.tooltipBox}>
        <span className={styles.tooltipMonth}>{activePoint.month} Corridor Snapshot</span>
        <div className={styles.tooltipMetrics}>
          <span className={styles.metricBlue}>
            Outbound: {formatPln(activePoint.outboundPln)} ({activePoint.outboundCount} runs)
          </span>
          <span className={styles.metricEmerald}>
            Inbound: {formatPln(activePoint.inboundPln)} ({activePoint.inboundCount} runs)
          </span>
          <span className="tabular" style={{ color: 'var(--ink-secondary)' }}>
            CO2 saved: {activePoint.co2SavedKg} kg
          </span>
        </div>
      </div>
    </section>
  );
};
