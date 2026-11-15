import React from 'react';
import styles from './RadialGauge.module.css';

interface RadialGaugeProps {
  percent: number;
  title: string;
  subtitle: string;
  color: string;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  percent,
  title,
  subtitle,
  color,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={styles.card}>
      <div className={styles.ringWrap}>
        <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth="6"
          />
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
          />
        </svg>
        <span className={styles.pctLabel}>{clamped}%</span>
      </div>
      <div className={styles.copy}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
    </div>
  );
};
