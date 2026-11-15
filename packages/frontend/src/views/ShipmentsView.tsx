import React, { useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import {
  CheckIcon,
  InboundArrowIcon,
  OutboundArrowIcon,
  RefreshIcon,
  TrashIcon,
} from '../components/Icons';
import { Courier, HubInfo, Shipment, ShipmentDirection, ShipmentStatus } from '../types/api';
import {
  formatPln,
  formatShipmentStatus,
  getHubLabel,
  getNextShipmentStatus,
} from '../utils/format';
import styles from './Views.module.css';

interface ShipmentsViewProps {
  shipments: Shipment[];
  couriers: Courier[];
  hubs: HubInfo[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateCreate: () => void;
}

export const ShipmentsView: React.FC<ShipmentsViewProps> = ({
  shipments,
  couriers,
  hubs,
  loading,
  onRefresh,
  onNavigateCreate,
}) => {
  const [directionFilter, setDirectionFilter] = useState<'all' | ShipmentDirection>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShipmentStatus>('all');
  const [searchText, setSearchText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredShipments = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return shipments.filter((s) => {
      if (directionFilter !== 'all' && s.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (query) {
        const hay = `${s.title} ${s.businessName} ${s.cargoDescription} ${s.assignedCourierName ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [shipments, directionFilter, statusFilter, searchText]);

  const handleAdvanceStatus = async (shipment: Shipment) => {
    const next = getNextShipmentStatus(shipment.status);
    if (!next) return;
    setError(null);
    setBusyId(shipment.id);
    try {
      await api.updateShipmentStatus(shipment.id, { status: next });
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignCourier = async (shipmentId: string, courierId: string) => {
    if (!courierId) return;
    setError(null);
    setBusyId(shipmentId);
    try {
      await api.updateShipmentStatus(shipmentId, {
        status: 'matched',
        assignedCourierId: courierId,
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to assign vehicle');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (shipmentId: string) => {
    setError(null);
    setBusyId(shipmentId);
    try {
      await api.deleteShipment(shipmentId);
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel order');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manage Orders</h1>
          <p className={styles.pageSubtitle}>
            Track orders sent out from your business and supplies couriers are bringing to you, assign vehicles, or update delivery progress.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
            <RefreshIcon size={15} />
            Refresh
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onNavigateCreate}>
            Create Order
          </button>
        </div>
      </div>

      {error && (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          <span>{error}</span>
          <button type="button" className={styles.btnSecondary} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.cardTitleRow}>
          <div className={styles.presetRow}>
            {(['all', 'outbound', 'inbound'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`${styles.chipBtn} ${directionFilter === dir ? styles.chipBtnActive : ''}`}
                onClick={() => setDirectionFilter(dir)}
              >
                {dir === 'all' ? 'All Directions' : dir === 'outbound' ? 'Sent From Us' : 'Brought To Us'}
              </button>
            ))}

            {(['all', 'pending', 'matched', 'in_transit', 'delivered'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`${styles.chipBtn} ${statusFilter === st ? styles.chipBtnActive : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'All Statuses' : formatShipmentStatus(st)}
              </button>
            ))}
          </div>

          <input
            type="search"
            className={styles.input}
            style={{ maxWidth: 260 }}
            placeholder="Search business, cargo, driver..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search orders"
          />
        </div>

        {filteredShipments.length === 0 ? (
          <div className={styles.emptyState}>
            <p style={{ margin: 0 }}>No orders match the active filters.</p>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setDirectionFilter('all');
                setStatusFilter('all');
                setSearchText('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order & Business</th>
                  <th>Type</th>
                  <th>Route</th>
                  <th>Box & Weight</th>
                  <th>Courier Vehicle</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((s) => {
                  const next = getNextShipmentStatus(s.status);
                  const isBusy = busyId === s.id;
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.title}</strong>
                        <div className={styles.kpiSub}>{s.businessName}</div>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            s.direction === 'outbound' ? styles.badgeOutbound : styles.badgeInbound
                          }`}
                        >
                          {s.direction === 'outbound' ? (
                            <OutboundArrowIcon size={12} />
                          ) : (
                            <InboundArrowIcon size={12} />
                          )}
                          {s.direction === 'outbound' ? 'Sent From Us' : 'Brought To Us'}
                        </span>
                      </td>
                      <td>
                        <div>
                          {s.pickupAddress} to {s.dropoffAddress}
                        </div>
                        <div className={styles.kpiSub}>
                          {getHubLabel(s.pickupHub, hubs)} to {getHubLabel(s.dropoffHub, hubs)} | {s.distanceKm} km
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {s.estimate.dimensionsCm.lengthCm}x{s.estimate.dimensionsCm.widthCm}x
                        {s.estimate.dimensionsCm.heightCm} cm
                        <div className={styles.kpiSub}>{s.estimate.estimatedWeightKg} kg</div>
                      </td>
                      <td>
                        {s.assignedCourierName ? (
                          <div>
                            <strong>{s.assignedCourierName}</strong>
                            <div className={styles.kpiSub}>{s.assignedVehicleModel}</div>
                          </div>
                        ) : (
                          <select
                            className={styles.select}
                            style={{ minHeight: 36, fontSize: 12.5, padding: '4px 8px' }}
                            value=""
                            disabled={isBusy}
                            aria-label={`Assign courier to ${s.title}`}
                            onChange={(e) => handleAssignCourier(s.id, e.target.value)}
                          >
                            <option value="">Assign courier...</option>
                            {couriers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.vehicleModel})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="tabular">
                        <strong>{formatPln(s.estimate.estimatedPricePln)}</strong>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            s.status === 'delivered'
                              ? styles.badgeDone
                              : s.status === 'pending'
                                ? styles.badgePending
                                : styles.badgeActive
                          }`}
                        >
                          {formatShipmentStatus(s.status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {next && (
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              style={{ minHeight: 36, padding: '0 10px', fontSize: 12.5 }}
                              disabled={isBusy}
                              onClick={() => handleAdvanceStatus(s)}
                            >
                              <CheckIcon size={14} />
                              {formatShipmentStatus(next)}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={isBusy}
                            aria-label={`Delete order ${s.title}`}
                            onClick={() => handleDelete(s.id)}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
