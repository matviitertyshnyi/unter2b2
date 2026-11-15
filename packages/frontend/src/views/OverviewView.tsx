import React from 'react';
import { FreightChart } from '../components/FreightChart';
import { Box3dIcon, RefreshIcon } from '../components/Icons';
import { RadialGauge } from '../components/RadialGauge';
import { AnalyticsSummary } from '../types/api';
import { formatPln } from '../utils/format';
import styles from './Views.module.css';

interface OverviewViewProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  analytics,
  loading,
  error,
  onRetry,
}) => {
  if (loading && !analytics) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Finances & Cost Savings</h1>
        </div>
        <div className={styles.kpiGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
        <div className={styles.skeletonCard} style={{ height: 280 }} />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={styles.page}>
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          <span>Failed to load financial analytics: {error ?? 'API unreachable'}</span>
          <button type="button" className={styles.btnSecondary} onClick={onRetry}>
            <RefreshIcon size={15} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { kpis, deltas } = analytics;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Finances & Cost Savings</h1>
          <p className={styles.pageSubtitle}>
            Monthly spend across outbound dispatches, inbound courier deliveries, and savings vs. traditional pallet carriers
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={onRetry}>
            <RefreshIcon size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <section className={styles.kpiGrid} aria-label="Financial metrics">
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Freight Volume (Nov)</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatPln(kpis.totalFreightValuePln)}</span>
            <span className={styles.deltaPositive}>+{deltas.totalFreightPct}%</span>
          </div>
          <span className={styles.kpiSub}>Combined Sent & Brought micro-freight</span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Sent From Us (Outbound)</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatPln(kpis.outboundValuePln)}</span>
            <span className={styles.deltaPositive}>+{deltas.outboundPct}%</span>
          </div>
          <span className={styles.kpiSub}>Delivered from our business to clients</span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Brought To Us (Inbound)</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatPln(kpis.inboundValuePln)}</span>
            <span className={styles.deltaPositive}>+{deltas.inboundPct}%</span>
          </div>
          <span className={styles.kpiSub}>Picked up and delivered in by couriers</span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Saved vs. Pallet Couriers</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatPln(kpis.totalSavingsPln)}</span>
            <span className={styles.deltaPositive}>-{deltas.savingsCostReductionPct}% cost</span>
          </div>
          <span className={styles.kpiSub}>
            {kpis.co2SavedKg.toLocaleString('en-US')} kg CO2 avoided across Tricity
          </span>
        </article>
      </section>

      {/* Main Chart + Right Radial Gauges */}
      <div className={styles.overviewSplit}>
        <FreightChart series={analytics.monthlySeries} />

        <div className={styles.gaugeStack}>
          <RadialGauge
            percent={kpis.trunkFitHitRatePct}
            title="Trunk Fit Hit Rate"
            subtitle="Matched on first pass without van waste"
            color="#2563EB"
          />
          <RadialGauge
            percent={kpis.sameDayCompletionPct}
            title="Same-Day Completion"
            subtitle="Delivered under 90 min across Tricity"
            color="#10B981"
          />
          <div className={styles.kpiCard}>
            <div className={styles.cardTitleRow}>
              <span className={styles.kpiLabel}>Available Spare Trunk Pool</span>
              <Box3dIcon size={16} />
            </div>
            <div className={styles.kpiValueRow}>
              <span className={styles.kpiValue}>
                {kpis.unusedTrunkCapacityLiters.toLocaleString('en-US')} L
              </span>
              <span className={styles.deltaPositive}>{kpis.activeCouriersCount} couriers online</span>
            </div>
            <span className={styles.kpiSub}>
              Ready across Gdansk, Sopot, and Gdynia
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
