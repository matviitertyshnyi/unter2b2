import React, { useState } from 'react';
import { api, ApiError } from '../api/client';
import { CourierProfileCard } from '../components/CourierProfileCard';
import { InboundArrowIcon, TruckIcon } from '../components/Icons';
import { TricityMap } from '../components/TricityMap';
import { Courier, HubInfo, Shipment } from '../types/api';
import { formatVehicleClass, getHubLabel } from '../utils/format';
import { resolveAddressToPin } from '../utils/mapGeo';
import styles from './Views.module.css';

interface InboundFleetViewProps {
  hubs: HubInfo[];
  couriers: Courier[];
  onShipmentCreated: (shipment: Shipment) => void;
}

export const InboundFleetView: React.FC<InboundFleetViewProps> = ({
  hubs,
  couriers,
  onShipmentCreated,
}) => {
  const [selectedCourierId, setSelectedCourierId] = useState<string>(
    couriers.find((c) => c.status === 'available')?.id ?? couriers[0]?.id ?? ''
  );
  const [businessName, setBusinessName] = useState('Olivia Star Roastery & Cafe');
  const [pickupHub, setPickupHub] = useState('port');
  const [pickupAddress, setPickupAddress] = useState('ul. Oliwska 35, Port Gdansk');

  const [dropoffHub, setDropoffHub] = useState('olivia');
  const [dropoffAddress, setDropoffAddress] = useState('al. Grunwaldzka 472B, Gdansk Oliwa');

  const [cargoDescription, setCargoDescription] = useState(
    '6 Euro-crates of specialty coffee beans and 2 cartons of oat milk'
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedCourier = couriers.find((c) => c.id === selectedCourierId) ?? couriers[0];

  const handleSelectCourier = (id: string) => {
    setSelectedCourierId(id);
    const chosen = couriers.find((c) => c.id === id);
    if (chosen) {
      setPickupHub(chosen.currentHub);
      const pHub = hubs.find((h) => h.id === chosen.currentHub);
      setPickupAddress(pHub?.sampleAddress ?? chosen.currentAddress);

      setDropoffHub(chosen.destinationHub);
      const dHub = hubs.find((h) => h.id === chosen.destinationHub);
      setDropoffAddress(dHub?.sampleAddress ?? '');
    }
  };

  const handlePickupHubChange = (hubId: string) => {
    setPickupHub(hubId);
    const hub = hubs.find((h) => h.id === hubId);
    if (hub) setPickupAddress(hub.sampleAddress);
  };

  const handleDropoffHubChange = (hubId: string) => {
    setDropoffHub(hubId);
    const hub = hubs.find((h) => h.id === hubId);
    if (hub) setDropoffAddress(hub.sampleAddress);
  };

  const handlePickupAddressInput = (value: string) => {
    setPickupAddress(value);
    const resolved = resolveAddressToPin(value, hubs, pickupHub);
    if (resolved.matched) setPickupHub(resolved.hubId);
  };

  const handleDropoffAddressInput = (value: string) => {
    setDropoffAddress(value);
    const resolved = resolveAddressToPin(value, hubs, dropoffHub);
    if (resolved.matched) setDropoffHub(resolved.hubId);
  };

  const handleRequestInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier) return;
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const pPin = resolveAddressToPin(pickupAddress, hubs, pickupHub);
      const dPin = resolveAddressToPin(dropoffAddress, hubs, dropoffHub);
      const { shipment } = await api.requestInboundCourier(selectedCourier.id, {
        businessName,
        pickupHub,
        pickupAddress,
        pickupMapX: pPin.mapX,
        pickupMapY: pPin.mapY,
        dropoffHub,
        dropoffAddress,
        dropoffMapX: dPin.mapX,
        dropoffMapY: dPin.mapY,
        cargoDescription,
      });
      onShipmentCreated(shipment);
      setSuccessMsg(
        `Asked ${selectedCourier.name} (${selectedCourier.vehicleModel}) to pick up at ${shipment.pickupAddress} and bring to you.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Unable to book courier for inbound pickup'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Available Couriers</h1>
          <p className={styles.pageSubtitle}>
            Select any driver on the map or list to open their profile, inspect busy driver live location, text them directly, or book a pickup.
          </p>
        </div>
      </div>

      {error && (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className={`${styles.noticeBanner} ${styles.noticeSuccess}`}>
          <span>{successMsg}</span>
        </div>
      )}

      <div className={styles.twoCol}>
        <div className={styles.gaugeStack}>
          <TricityMap
            hubs={hubs}
            couriers={couriers}
            selectedCourierId={selectedCourierId}
            onSelectCourier={handleSelectCourier}
          />

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Nearby Drivers ({couriers.length})</h2>
            <div className={styles.courierList}>
              {couriers.map((c) => {
                const selected = c.id === selectedCourierId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.courierRow} ${selected ? styles.courierRowSelected : ''}`}
                    style={{ textAlign: 'left', width: '100%' }}
                    onClick={() => handleSelectCourier(c.id)}
                  >
                    <div className={styles.courierTop}>
                      <div className={styles.courierInfo}>
                        <span className={styles.avatar}>{c.avatarInitials}</span>
                        <div>
                          <div className={styles.courierName}>{c.name}</div>
                          <div className={styles.courierMeta}>
                            {c.vehicleModel} ({formatVehicleClass(c.vehicleClass)}) | {c.trunk.volumeLiters} L free
                          </div>
                        </div>
                      </div>
                      <span
                        className={`${styles.badge} ${
                          c.status === 'available' ? styles.badgeDone : styles.badgePending
                        }`}
                      >
                        {c.status === 'available' ? 'Available' : 'Busy on Run'}
                      </span>
                    </div>
                    <div className={styles.courierMeta}>
                      {c.status === 'busy'
                        ? `Live location: ${c.currentAddress} | Free ${c.availableFrom}`
                        : `Heading: ${getHubLabel(c.currentHub, hubs)} to ${getHubLabel(c.destinationHub, hubs)} | ${c.availableFrom}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.gaugeStack}>
          {selectedCourier && (
            <CourierProfileCard
              courier={selectedCourier}
              hubs={hubs}
              viewerRole="business"
              viewerName={businessName}
            />
          )}

          {/* Ask Courier to Bring Goods To Us */}
          <form className={styles.card} onSubmit={handleRequestInbound}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>Ask Courier to Bring Goods To Us</h2>
              <span className={`${styles.badge} ${styles.badgeInbound}`}>
                <InboundArrowIcon size={12} />
                Bring To Us
              </span>
            </div>

            {selectedCourier ? (
              <div className={styles.statWell}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TruckIcon size={18} />
                  <strong>
                    {selectedCourier.name} | {selectedCourier.vehicleModel}
                  </strong>
                </div>
                <span className={styles.kpiSub}>
                  Interior bay{' '}
                  <span className="mono">
                    {selectedCourier.trunk.lengthCm}x{selectedCourier.trunk.widthCm}x
                    {selectedCourier.trunk.heightCm} cm
                  </span>{' '}
                  | Max payload {selectedCourier.trunk.maxWeightKg} kg | {selectedCourier.licensePlate}
                </span>
              </div>
            ) : null}

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="inbound-biz">
                  Your Business Name
                </label>
                <input
                  id="inbound-biz"
                  className={styles.input}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inbound-pickup">
                  Pick Up Zone
                </label>
                <select
                  id="inbound-pickup"
                  className={styles.select}
                  value={pickupHub}
                  onChange={(e) => handlePickupHubChange(e.target.value)}
                >
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inbound-dropoff">
                  Bring To Our Zone
                </label>
                <select
                  id="inbound-dropoff"
                  className={styles.select}
                  value={dropoffHub}
                  onChange={(e) => handleDropoffHubChange(e.target.value)}
                >
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inbound-pickup-addr">
                  Pickup Street Address
                </label>
                <input
                  id="inbound-pickup-addr"
                  className={styles.input}
                  value={pickupAddress}
                  onChange={(e) => handlePickupAddressInput(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inbound-dropoff-addr">
                  Delivery Street Address
                </label>
                <input
                  id="inbound-dropoff-addr"
                  className={styles.input}
                  value={dropoffAddress}
                  onChange={(e) => handleDropoffAddressInput(e.target.value)}
                  required
                />
              </div>

              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="inbound-cargo">
                  What Should the Courier Bring To You?
                </label>
                <textarea
                  id="inbound-cargo"
                  className={styles.textarea}
                  value={cargoDescription}
                  onChange={(e) => setCargoDescription(e.target.value)}
                  required
                  minLength={5}
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={submitting || !selectedCourier}
            >
              <InboundArrowIcon size={16} />
              {submitting ? 'Checking Trunk Fit & Requesting...' : 'Ask Courier to Bring Goods'}
            </button>

            <p className={styles.kpiSub} style={{ margin: 0 }}>
              Cargo size and weight are automatically checked against {selectedCourier?.vehicleModel ?? 'the vehicle'} before confirming the pickup.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
