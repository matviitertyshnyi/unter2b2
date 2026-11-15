import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { CourierProfileCard } from '../components/CourierProfileCard';
import {
  InboundArrowIcon,
  OutboundArrowIcon,
  TruckIcon,
} from '../components/Icons';
import { RoutePin, TricityMap } from '../components/TricityMap';
import { TrunkVisualizer } from '../components/TrunkVisualizer';
import {
  Courier,
  HubInfo,
  Shipment,
  TrunkFitResult,
  VehicleTrunk,
} from '../types/api';
import {
  formatPln,
  formatVehicleClass,
  getHubLabel,
} from '../utils/format';
import { getHubCoordinates } from '../utils/mapGeo';
import styles from './Views.module.css';

interface CourierAppViewProps {
  couriers: Courier[];
  shipments: Shipment[];
  hubs: HubInfo[];
  onRefresh: () => void;
}

function evaluateClientTrunkFit(shipment: Shipment, trunk: VehicleTrunk): TrunkFitResult {
  const cargo = shipment.estimate.dimensionsCm;
  const weightKg = shipment.estimate.estimatedWeightKg;
  const fragility = shipment.estimate.fragility;

  const cargoVol = Math.max(1, (cargo.lengthCm * cargo.widthCm * cargo.heightCm) / 1000);
  const volumeUtilizationPct = Math.round((cargoVol / trunk.volumeLiters) * 100);
  const weightUtilizationPct = Math.round((weightKg / trunk.maxWeightKg) * 100);

  if (weightKg > trunk.maxWeightKg) {
    return {
      fits: false,
      fitLabel: 'incompatible',
      fitScore: 0,
      volumeUtilizationPct,
      weightUtilizationPct,
      orientedCargoCm: cargo,
      rotated: false,
      routeAligned: false,
      reason: `Payload ${weightKg} kg exceeds trunk max ${trunk.maxWeightKg} kg`,
    };
  }

  const orientations =
    fragility === 'fragile'
      ? [
          { dims: { ...cargo }, rotated: false },
          { dims: { lengthCm: cargo.widthCm, widthCm: cargo.lengthCm, heightCm: cargo.heightCm }, rotated: cargo.lengthCm !== cargo.widthCm },
        ]
      : [
          { dims: { ...cargo }, rotated: false },
          { dims: { lengthCm: cargo.widthCm, widthCm: cargo.lengthCm, heightCm: cargo.heightCm }, rotated: true },
          { dims: { lengthCm: cargo.lengthCm, widthCm: cargo.heightCm, heightCm: cargo.widthCm }, rotated: true },
          { dims: { lengthCm: cargo.heightCm, widthCm: cargo.lengthCm, heightCm: cargo.widthCm }, rotated: true },
          { dims: { lengthCm: cargo.widthCm, widthCm: cargo.heightCm, heightCm: cargo.lengthCm }, rotated: true },
          { dims: { lengthCm: cargo.heightCm, widthCm: cargo.widthCm, heightCm: cargo.lengthCm }, rotated: true },
        ];

  let best: { dims: typeof cargo; rotated: boolean; minMargin: number } | null = null;
  for (const opt of orientations) {
    const mL = trunk.lengthCm - opt.dims.lengthCm;
    const mW = trunk.widthCm - opt.dims.widthCm;
    const mH = trunk.heightCm - opt.dims.heightCm;
    if (mL >= 0 && mW >= 0 && mH >= 0) {
      const minMargin = Math.min(mL, mW, mH);
      if (!best || minMargin > best.minMargin) {
        best = { dims: opt.dims, rotated: opt.rotated, minMargin };
      }
    }
  }

  if (!best) {
    return {
      fits: false,
      fitLabel: 'incompatible',
      fitScore: 0,
      volumeUtilizationPct,
      weightUtilizationPct,
      orientedCargoCm: cargo,
      rotated: false,
      routeAligned: false,
      reason: `Cargo ${cargo.lengthCm}x${cargo.widthCm}x${cargo.heightCm} cm exceeds trunk bay`,
    };
  }

  const fitScore = Math.max(45, Math.min(98, Math.round(100 - Math.abs(65 - volumeUtilizationPct))));
  const isOptimalScore = fitScore >= 70;
  return {
    fits: true,
    fitLabel: isOptimalScore ? 'optimal' : 'tight',
    fitScore,
    volumeUtilizationPct,
    weightUtilizationPct,
    orientedCargoCm: best.dims,
    rotated: best.rotated,
    routeAligned: true,
    reason: isOptimalScore
      ? `Clean trunk fit (${volumeUtilizationPct}% trunk volume)`
      : `Moderate capacity match (${volumeUtilizationPct}% trunk volume)`,
  };
}

export const CourierAppView: React.FC<CourierAppViewProps> = ({
  couriers,
  shipments,
  hubs,
  onRefresh,
}) => {
  const [activeCourierId, setActiveCourierId] = useState<string>(couriers[0]?.id ?? '');
  const [onlyFitting, setOnlyFitting] = useState(true);
  const [previewShipmentId, setPreviewShipmentId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCourierId && couriers.length > 0) {
      setActiveCourierId(couriers[0].id);
    }
  }, [activeCourierId, couriers]);

  const activeCourier = couriers.find((c) => c.id === activeCourierId) ?? couriers[0];

  const openJobs = useMemo(() => {
    if (!activeCourier) return [];
    return shipments
      .filter((s) => s.status === 'pending')
      .map((s) => ({
        shipment: s,
        fit: evaluateClientTrunkFit(s, activeCourier.trunk),
      }));
  }, [shipments, activeCourier]);

  const visibleJobs = useMemo(() => {
    if (!onlyFitting) return openJobs;
    return openJobs.filter((j) => j.fit.fits);
  }, [openJobs, onlyFitting]);

  const previewTarget =
    visibleJobs.find((j) => j.shipment.id === previewShipmentId) ??
    openJobs.find((j) => j.shipment.id === previewShipmentId) ??
    visibleJobs[0] ??
    openJobs[0] ??
    null;

  const selectedPickupPin: RoutePin | null = useMemo(() => {
    if (!previewTarget) return null;
    const s = previewTarget.shipment;
    if (typeof s.pickupMapX === 'number' && typeof s.pickupMapY === 'number') {
      return { mapX: s.pickupMapX, mapY: s.pickupMapY, address: s.pickupAddress };
    }
    const c = getHubCoordinates(s.pickupHub, hubs);
    return { mapX: c.mapX, mapY: c.mapY, address: s.pickupAddress };
  }, [previewTarget, hubs]);

  const selectedDropoffPin: RoutePin | null = useMemo(() => {
    if (!previewTarget) return null;
    const s = previewTarget.shipment;
    if (typeof s.dropoffMapX === 'number' && typeof s.dropoffMapY === 'number') {
      return { mapX: s.dropoffMapX, mapY: s.dropoffMapY, address: s.dropoffAddress };
    }
    const c = getHubCoordinates(s.dropoffHub, hubs);
    return { mapX: c.mapX, mapY: c.mapY, address: s.dropoffAddress };
  }, [previewTarget, hubs]);

  const handleToggleDriverStatus = async (nextStatus: 'available' | 'busy') => {
    if (!activeCourier || statusUpdating || activeCourier.status === nextStatus) return;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      await api.updateCourierStatus(activeCourier.id, { status: nextStatus });
      onRefresh();
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Unable to update driver availability');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!activeCourier) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p style={{ margin: 0 }}>Loading driver vehicle profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.courierBanner} aria-label="Driver vehicle trunk profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TruckIcon size={20} />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              Driver View: {activeCourier.name}
            </h1>
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={statusUpdating}
                onClick={() => void handleToggleDriverStatus('available')}
                style={{
                  minHeight: 32,
                  padding: '0 10px',
                  fontSize: 12,
                  background: activeCourier.status === 'available' ? '#10B981' : '#1E293B',
                  borderColor: activeCourier.status === 'available' ? '#10B981' : '#334155',
                  color: '#FFFFFF',
                }}
              >
                Available
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={statusUpdating}
                onClick={() => void handleToggleDriverStatus('busy')}
                style={{
                  minHeight: 32,
                  padding: '0 10px',
                  fontSize: 12,
                  background: activeCourier.status === 'busy' ? '#D97706' : '#1E293B',
                  borderColor: activeCourier.status === 'busy' ? '#F59E0B' : '#334155',
                  color: '#FFFFFF',
                }}
              >
                Busy (On Delivery)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="driver-select" style={{ fontSize: 13, color: '#CBD5E1' }}>
              Vehicle Profile:
            </label>
            <select
              id="driver-select"
              className={styles.select}
              style={{
                width: 'auto',
                minHeight: 38,
                background: '#1E293B',
                color: '#FFFFFF',
                borderColor: '#334155',
              }}
              value={activeCourier.id}
              onChange={(e) => setActiveCourierId(e.target.value)}
            >
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.vehicleModel} ({c.trunk.volumeLiters} L)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.courierBannerSpecs}>
          <div>
            <span className={styles.bannerMetricLabel}>Trunk Bay (L x W x H)</span>
            <span className={`${styles.bannerMetricValue} mono`}>
              {activeCourier.trunk.lengthCm}x{activeCourier.trunk.widthCm}x
              {activeCourier.trunk.heightCm} cm
            </span>
          </div>
          <div>
            <span className={styles.bannerMetricLabel}>Capacity</span>
            <span className={styles.bannerMetricValue}>
              {activeCourier.trunk.volumeLiters} L / {activeCourier.trunk.maxWeightKg} kg
            </span>
          </div>
          <div>
            <span className={styles.bannerMetricLabel}>Vehicle Class</span>
            <span className={styles.bannerMetricValue}>
              {formatVehicleClass(activeCourier.vehicleClass)}
            </span>
          </div>
          <div>
            <span className={styles.bannerMetricLabel}>Corridor Route</span>
            <span className={styles.bannerMetricValue}>
              {getHubLabel(activeCourier.currentHub, hubs).split(' ')[0]} to{' '}
              {getHubLabel(activeCourier.destinationHub, hubs).split(' ')[0]}
            </span>
          </div>
        </div>
      </section>

      {statusError && (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          <span>{statusError}</span>
        </div>
      )}

      <div className={styles.twoCol}>
        <section className={styles.card}>
          <div className={styles.cardTitleRow}>
            <div>
              <h2 className={styles.cardTitle}>
                Matching Orders & Pinned Routes ({visibleJobs.length})
              </h2>
              <p className={styles.kpiSub} style={{ margin: '2px 0 0' }}>
                Select an order to inspect Pin A to Pin B on the map and verify trunk fit
              </p>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={onlyFitting}
                onChange={(e) => setOnlyFitting(e.target.checked)}
              />
              Hide oversized loads ({openJobs.length - openJobs.filter((j) => j.fit.fits).length})
            </label>
          </div>

          {visibleJobs.length === 0 ? (
            <div className={styles.emptyState}>
              <p style={{ margin: 0 }}>
                No open loads currently fit this trunk. Switch to a larger vehicle above or toggle off the oversized filter to inspect dimensions.
              </p>
            </div>
          ) : (
            <div className={styles.courierList}>
              {visibleJobs.map(({ shipment, fit }) => (
                <div
                  key={shipment.id}
                  className={`${styles.courierRow} ${
                    previewTarget?.shipment.id === shipment.id ? styles.courierRowSelected : ''
                  } ${!fit.fits ? styles.courierRowBlocked : ''}`}
                  onClick={() => setPreviewShipmentId(shipment.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.courierTop}>
                    <div>
                      <div className={styles.courierName}>{shipment.title}</div>
                      <div className={styles.courierMeta}>
                        {shipment.businessName} | {shipment.pickupAddress} to{' '}
                        {shipment.dropoffAddress} ({shipment.distanceKm} km)
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        className={`${styles.badge} ${
                          shipment.direction === 'outbound'
                            ? styles.badgeOutbound
                            : styles.badgeInbound
                        }`}
                      >
                        {shipment.direction === 'outbound' ? (
                          <OutboundArrowIcon size={12} />
                        ) : (
                          <InboundArrowIcon size={12} />
                        )}
                        {shipment.direction === 'outbound' ? 'Sent From Business' : 'Bring To Business'}
                      </span>
                      <span
                        className={`${styles.badge} ${
                          !fit.fits
                            ? styles.badgeFail
                            : fit.fitScore >= 70
                              ? styles.badgeDone
                              : styles.badgePending
                        }`}
                      >
                        {fit.fits ? `${fit.volumeUtilizationPct}% Trunk` : 'Oversized'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.courierBottom}>
                    <span className={styles.courierMeta}>
                      Cargo:{' '}
                      <span className="mono">
                        {shipment.estimate.dimensionsCm.lengthCm}x
                        {shipment.estimate.dimensionsCm.widthCm}x
                        {shipment.estimate.dimensionsCm.heightCm} cm
                      </span>{' '}
                      | {shipment.estimate.estimatedWeightKg} kg
                    </span>

                    <span className="tabular" style={{ fontSize: 15, fontWeight: 800 }}>
                      Payout: {formatPln(shipment.estimate.estimatedPricePln)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.gaugeStack}>
          <TricityMap
            title={`Driver Map & Pinned Order (${activeCourier.name})`}
            hubs={hubs}
            couriers={couriers}
            selectedCourierId={activeCourier.id}
            onSelectCourier={(id) => setActiveCourierId(id)}
            pickupPin={selectedPickupPin}
            dropoffPin={selectedDropoffPin}
          />

          {previewTarget ? (
            <TrunkVisualizer
              vehicleModel={activeCourier.vehicleModel}
              trunk={activeCourier.trunk}
              cargoDims={previewTarget.shipment.estimate.dimensionsCm}
              cargoWeightKg={previewTarget.shipment.estimate.estimatedWeightKg}
              fit={previewTarget.fit}
            />
          ) : (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>3D Trunk Preview</h2>
              <div className={styles.emptyState}>
                <p style={{ margin: 0 }}>Select an open order to preview how it sits in this trunk.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Driver Profile & Business Chat Inbox */}
      <CourierProfileCard
        courier={activeCourier}
        hubs={hubs}
        viewerRole="courier"
        viewerName={activeCourier.name}
      />
    </div>
  );
};
