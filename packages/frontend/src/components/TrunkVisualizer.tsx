import React, { memo } from 'react';
import { DimensionsCm, TrunkFitResult, VehicleTrunk } from '../types/api';
import styles from './TrunkVisualizer.module.css';

interface TrunkVisualizerProps {
  vehicleModel: string;
  trunk: VehicleTrunk;
  cargoDims: DimensionsCm;
  cargoWeightKg: number;
  fit: TrunkFitResult;
}

function projectIso(x: number, y: number, z: number, originX: number, originY: number) {
  // Isometric 30-degree projection: x = length (depth right-down), y = width (left-down), z = height (up)
  const cos30 = 0.866;
  const sin30 = 0.5;
  return {
    px: originX + (x - y) * cos30,
    py: originY + (x + y) * sin30 - z,
  };
}

function buildBoxVertices(
  len: number,
  wid: number,
  hei: number,
  originX: number,
  originY: number
) {
  const p000 = projectIso(0, 0, 0, originX, originY);
  const p100 = projectIso(len, 0, 0, originX, originY);
  const p110 = projectIso(len, wid, 0, originX, originY);
  const p010 = projectIso(0, wid, 0, originX, originY);

  const p001 = projectIso(0, 0, hei, originX, originY);
  const p101 = projectIso(len, 0, hei, originX, originY);
  const p111 = projectIso(len, wid, hei, originX, originY);
  const p011 = projectIso(0, wid, hei, originX, originY);

  return { p000, p100, p110, p010, p001, p101, p111, p011 };
}

function pts(points: Array<{ px: number; py: number }>): string {
  return points.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
}

export const TrunkVisualizer: React.FC<TrunkVisualizerProps> = memo(({
  vehicleModel,
  trunk,
  cargoDims,
  cargoWeightKg,
  fit,
}) => {
  const maxDim = Math.max(trunk.lengthCm, trunk.widthCm, trunk.heightCm, 120);
  const scale = 122 / maxDim;

  const tL = trunk.lengthCm * scale;
  const tW = trunk.widthCm * scale;
  const tH = trunk.heightCm * scale;

  const oriented = fit.fits ? fit.orientedCargoCm : cargoDims;
  const cL = Math.min(tL * 1.25, oriented.lengthCm * scale);
  const cW = Math.min(tW * 1.25, oriented.widthCm * scale);
  const cH = Math.min(tH * 1.32, oriented.heightCm * scale);

  const originX = 165;
  const originY = 102;

  const tv = buildBoxVertices(tL, tW, tH, originX, originY);
  const cv = buildBoxVertices(cL, cW, cH, originX, originY);

  const palette =
    fit.fitLabel === 'optimal'
      ? {
          badgeClass: styles.fitOptimal,
          label: 'Optimal Fit',
          top: 'rgba(16, 185, 129, 0.36)',
          left: 'rgba(16, 185, 129, 0.24)',
          right: 'rgba(16, 185, 129, 0.48)',
          stroke: '#047857',
          bar: '#10B981',
        }
      : fit.fitLabel === 'tight'
        ? {
            badgeClass: styles.fitTight,
            label: 'Tight Fit',
            top: 'rgba(245, 158, 11, 0.36)',
            left: 'rgba(245, 158, 11, 0.24)',
            right: 'rgba(245, 158, 11, 0.48)',
            stroke: '#D97706',
            bar: '#F59E0B',
          }
        : {
            badgeClass: styles.fitFail,
            label: 'Does Not Fit',
            top: 'rgba(239, 68, 68, 0.34)',
            left: 'rgba(239, 68, 68, 0.22)',
            right: 'rgba(239, 68, 68, 0.44)',
            stroke: '#DC2626',
            bar: '#DC2626',
          };

  const volWidth = Math.min(100, Math.max(4, fit.volumeUtilizationPct));
  const weightWidth = Math.min(100, Math.max(4, fit.weightUtilizationPct));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>3D Trunk Geometry Check: {vehicleModel}</h3>
          <p className={styles.sub}>
            Trunk bay <span className="mono">{trunk.lengthCm}x{trunk.widthCm}x{trunk.heightCm} cm</span>{' '}
            vs cargo <span className="mono">{oriented.lengthCm}x{oriented.widthCm}x{oriented.heightCm} cm</span>
            {fit.rotated ? ' (rotated 90 deg)' : ''}
          </p>
        </div>
        <span className={`${styles.fitPill} ${palette.badgeClass}`}>{palette.label}</span>
      </div>

      <div className={styles.stage}>
        <svg
          className={styles.svg}
          viewBox="0 0 330 220"
          role="img"
          aria-label={`3D wireframe showing ${oriented.lengthCm} by ${oriented.widthCm} by ${oriented.heightCm} cm cargo inside ${vehicleModel} trunk`}
        >
          {/* Trunk bay back floor & inner walls */}
          <polygon
            points={pts([tv.p000, tv.p100, tv.p110, tv.p010])}
            fill="var(--trunk-floor)"
            fillOpacity="0.45"
            stroke="var(--ink-muted)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <line x1={tv.p000.px} y1={tv.p000.py} x2={tv.p001.px} y2={tv.p001.py} stroke="var(--ink-muted)" strokeWidth="1.2" strokeDasharray="3 3" />

          {/* Cargo solid 3D faces */}
          <polygon
            points={pts([cv.p001, cv.p101, cv.p111, cv.p011])}
            fill={palette.top}
            stroke={palette.stroke}
            strokeWidth="1.6"
          />
          <polygon
            points={pts([cv.p010, cv.p110, cv.p111, cv.p011])}
            fill={palette.left}
            stroke={palette.stroke}
            strokeWidth="1.6"
          />
          <polygon
            points={pts([cv.p100, cv.p110, cv.p111, cv.p101])}
            fill={palette.right}
            stroke={palette.stroke}
            strokeWidth="1.6"
          />

          {/* Outer trunk wireframe edges */}
          <polygon
            points={pts([tv.p001, tv.p101, tv.p111, tv.p011])}
            fill="none"
            stroke="var(--trunk-edge)"
            strokeWidth="1.5"
          />
          <line x1={tv.p100.px} y1={tv.p100.py} x2={tv.p101.px} y2={tv.p101.py} stroke="var(--trunk-edge)" strokeWidth="1.5" />
          <line x1={tv.p110.px} y1={tv.p110.py} x2={tv.p111.px} y2={tv.p111.py} stroke="var(--trunk-edge)" strokeWidth="1.5" />
          <line x1={tv.p010.px} y1={tv.p010.py} x2={tv.p011.px} y2={tv.p011.py} stroke="var(--trunk-edge)" strokeWidth="1.5" />
          <polyline
            points={pts([tv.p010, tv.p110, tv.p100])}
            fill="none"
            stroke="var(--trunk-edge)"
            strokeWidth="1.5"
          />

          {/* Dimension labels */}
          <text
            x={(tv.p110.px + tv.p100.px) / 2 + 12}
            y={(tv.p110.py + tv.p100.py) / 2 + 14}
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            fill="var(--ink-secondary)"
          >
            W {trunk.widthCm}cm
          </text>
          <text
            x={(tv.p010.px + tv.p110.px) / 2 - 42}
            y={(tv.p010.py + tv.p110.py) / 2 + 14}
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            fill="var(--ink-secondary)"
          >
            L {trunk.lengthCm}cm
          </text>
          <text
            x={tv.p011.px - 44}
            y={(tv.p010.py + tv.p011.py) / 2}
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            fill="var(--ink-secondary)"
          >
            H {trunk.heightCm}cm
          </text>
        </svg>
      </div>

      <div className={styles.bars}>
        <div className={styles.barBlock}>
          <div className={styles.barLabelRow}>
            <span>Volume Used</span>
            <span className="tabular">{fit.volumeUtilizationPct}% of {trunk.volumeLiters} L</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${volWidth}%`, background: palette.bar }} />
          </div>
        </div>

        <div className={styles.barBlock}>
          <div className={styles.barLabelRow}>
            <span>Payload Load</span>
            <span className="tabular">{cargoWeightKg} / {trunk.maxWeightKg} kg</span>
          </div>
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{
                width: `${weightWidth}%`,
                background: cargoWeightKg > trunk.maxWeightKg ? '#DC2626' : '#2563EB',
              }}
            />
          </div>
        </div>
      </div>

      <p className={styles.reason}>{fit.reason}</p>
    </div>
  );
});
