import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { CourierProfileCard } from '../components/CourierProfileCard';
import {
  Box3dIcon,
  CheckIcon,
  InboundArrowIcon,
  OutboundArrowIcon,
  TrashIcon,
} from '../components/Icons';
import { RoutePin, TricityMap } from '../components/TricityMap';
import { TrunkVisualizer } from '../components/TrunkVisualizer';
import {
  AiEstimateResponse,
  CargoEstimate,
  Courier,
  CourierWithFit,
  FragilityLevel,
  HubInfo,
  Shipment,
  ShipmentDirection,
  TrunkFitResult,
} from '../types/api';
import {
  formatPln,
  formatShipmentStatus,
  formatVehicleClass,
  getHubLabel,
  getNextShipmentStatus,
} from '../utils/format';
import { getHubCoordinates, MapPin, resolveAddressToPin } from '../utils/mapGeo';
import styles from './Views.module.css';

interface AiDispatchViewProps {
  hubs: HubInfo[];
  couriers: Courier[];
  shipments: Shipment[];
  onShipmentCreated: (shipment: Shipment) => void;
  onRefresh: () => void;
  onNavigateOrders: () => void;
}

const PRESET_SCENARIOS: Array<{
  label: string;
  direction: ShipmentDirection;
  businessName: string;
  pickupHub: string;
  pickupAddress: string;
  dropoffHub: string;
  dropoffAddress: string;
  cargoDescription: string;
}> = [
  {
    label: 'Send tiles & adhesive out',
    direction: 'outbound',
    businessName: 'Nordic Bath & Tile Studio',
    pickupHub: 'olivia',
    pickupAddress: 'al. Grunwaldzka 472B, Gdansk Oliwa',
    dropoffHub: 'wrzeszcz',
    dropoffAddress: 'ul. Wajdeloty 14, Gdansk Wrzeszcz',
    cargoDescription: '10 boxes of ceramic tiles 60x60cm and 3 bags of adhesive 25kg',
  },
  {
    label: 'Bring espresso unit to us',
    direction: 'inbound',
    businessName: 'Kawa & Bajgle Sopot',
    pickupHub: 'port',
    pickupAddress: 'ul. Oliwska 35, Port Gdansk',
    dropoffHub: 'sopot',
    dropoffAddress: 'ul. Bohaterow Monte Cassino 60, Sopot',
    cargoDescription: '1 commercial espresso machine upright in crate plus 4 coffee bean sacks',
  },
  {
    label: 'Send monitors & chairs out',
    direction: 'outbound',
    businessName: 'Baltic FinTech Hub',
    pickupHub: 'olivia',
    pickupAddress: 'al. Grunwaldzka 472C, Gdansk Oliwa',
    dropoffHub: 'gdynia',
    dropoffAddress: 'ul. Swietojanska 44, Gdynia',
    cargoDescription: '8 boxed 27-inch monitors and 3 ergonomic office chairs',
  },
  {
    label: 'Bring print brochures to us',
    direction: 'inbound',
    businessName: 'Olivia Marketing Desk',
    pickupHub: 'wrzeszcz',
    pickupAddress: 'ul. Slowackiego 19, Garnizon Wrzeszcz',
    dropoffHub: 'olivia',
    dropoffAddress: 'al. Grunwaldzka 472B, Gdansk Oliwa',
    cargoDescription: '8 boxes of A4 print brochures and 3 aluminum roll-up banners',
  },
];

function computeMinVehicleClass(estimate: CargoEstimate): CargoEstimate['requiredVehicleClass'] {
  const maxSide = Math.max(
    estimate.dimensionsCm.lengthCm,
    estimate.dimensionsCm.widthCm,
    estimate.dimensionsCm.heightCm
  );
  if (estimate.volumeLiters <= 380 && maxSide <= 95 && estimate.estimatedWeightKg <= 120) {
    return 'hatchback';
  }
  if (estimate.volumeLiters <= 620 && maxSide <= 115 && estimate.estimatedWeightKg <= 260) {
    return 'station_wagon';
  }
  if (estimate.volumeLiters <= 760 && maxSide <= 112 && estimate.estimatedWeightKg <= 320) {
    return 'suv';
  }
  return 'van';
}

function recalculateCouriersForEstimate(
  couriersList: Courier[],
  estimate: CargoEstimate,
  distanceKm: number,
  pickupHub: string,
  dropoffHub: string,
  customPriceLocked: boolean
): CourierWithFit[] {
  const cargo = estimate.dimensionsCm;
  const weightKg = estimate.estimatedWeightKg;
  const uprightOnly = estimate.fragility === 'fragile';
  const orientations = uprightOnly
    ? [
        { dims: { ...cargo }, rotated: false },
        {
          dims: { lengthCm: cargo.widthCm, widthCm: cargo.lengthCm, heightCm: cargo.heightCm },
          rotated: cargo.lengthCm !== cargo.widthCm,
        },
      ]
    : [
        { dims: { ...cargo }, rotated: false },
        { dims: { lengthCm: cargo.widthCm, widthCm: cargo.lengthCm, heightCm: cargo.heightCm }, rotated: true },
        { dims: { lengthCm: cargo.lengthCm, widthCm: cargo.heightCm, heightCm: cargo.widthCm }, rotated: true },
        { dims: { lengthCm: cargo.heightCm, widthCm: cargo.lengthCm, heightCm: cargo.widthCm }, rotated: true },
        { dims: { lengthCm: cargo.widthCm, widthCm: cargo.heightCm, heightCm: cargo.lengthCm }, rotated: true },
        { dims: { lengthCm: cargo.heightCm, widthCm: cargo.widthCm, heightCm: cargo.lengthCm }, rotated: true },
      ];

  const evaluated = couriersList.map((courier) => {
    const cargoVolL = Math.max(1, (cargo.lengthCm * cargo.widthCm * cargo.heightCm) / 1000);
    const volumeUtilizationPct = Math.round((cargoVolL / courier.trunk.volumeLiters) * 100);
    const weightUtilizationPct = Math.round((weightKg / courier.trunk.maxWeightKg) * 100);
    const routeAligned = Boolean(
      pickupHub &&
        dropoffHub &&
        (courier.currentHub === pickupHub ||
          courier.destinationHub === dropoffHub ||
          courier.destinationHub === pickupHub)
    );

    let fit: TrunkFitResult;
    if (weightKg > courier.trunk.maxWeightKg) {
      fit = {
        fits: false,
        fitLabel: 'incompatible',
        fitScore: 0,
        volumeUtilizationPct,
        weightUtilizationPct,
        orientedCargoCm: cargo,
        rotated: false,
        routeAligned,
        reason: `Payload ${weightKg} kg exceeds vehicle max payload ${courier.trunk.maxWeightKg} kg`,
      };
    } else {
      let bestFit: { dims: typeof cargo; rotated: boolean; minMargin: number } | null = null;
      for (const option of orientations) {
        const mL = courier.trunk.lengthCm - option.dims.lengthCm;
        const mW = courier.trunk.widthCm - option.dims.widthCm;
        const mH = courier.trunk.heightCm - option.dims.heightCm;
        if (mL >= 0 && mW >= 0 && mH >= 0) {
          const minMargin = Math.min(mL, mW, mH);
          if (!bestFit || minMargin > bestFit.minMargin) {
            bestFit = { dims: option.dims, rotated: option.rotated, minMargin };
          }
        }
      }

      if (!bestFit) {
        fit = {
          fits: false,
          fitLabel: 'incompatible',
          fitScore: 0,
          volumeUtilizationPct,
          weightUtilizationPct,
          orientedCargoCm: cargo,
          rotated: false,
          routeAligned,
          reason: `Cargo ${cargo.lengthCm}x${cargo.widthCm}x${cargo.heightCm} cm exceeds ${courier.vehicleModel} trunk`,
        };
      } else {
        const efficiencyPeak = Math.max(0, 100 - Math.abs(65 - volumeUtilizationPct) * 1.15);
        const routeBonus = routeAligned ? 14 : 0;
        const fitScore = Math.min(99, Math.max(35, Math.round(efficiencyPeak * 0.86 + routeBonus)));
        const isOptimalScore = fitScore >= 70;
        fit = {
          fits: true,
          fitLabel: isOptimalScore ? 'optimal' : 'tight',
          fitScore,
          volumeUtilizationPct,
          weightUtilizationPct,
          orientedCargoCm: bestFit.dims,
          rotated: bestFit.rotated,
          routeAligned,
          reason: isOptimalScore
            ? `Optimal physical fit (${volumeUtilizationPct}% trunk volume, ${weightUtilizationPct}% payload)`
            : `Moderate capacity match (${volumeUtilizationPct}% trunk volume, ${bestFit.minMargin} cm min clearance)`,
        };
      }
    }

    const estimatedPayoutPln = customPriceLocked
      ? Math.max(1, Math.round(estimate.estimatedPricePln))
      : Math.round(28 + distanceKm * courier.pricePerKmPln + weightKg * 0.08);

    return {
      ...courier,
      fit,
      estimatedPayoutPln,
    };
  });

  return evaluated.sort((a, b) => {
    if (a.fit.fits !== b.fit.fits) return a.fit.fits ? -1 : 1;
    if (a.status !== b.status) return a.status === 'available' ? -1 : 1;
    if (b.fit.fitScore !== a.fit.fitScore) return b.fit.fitScore - a.fit.fitScore;
    return b.rating - a.rating;
  });
}

export const AiDispatchView: React.FC<AiDispatchViewProps> = ({
  hubs,
  couriers,
  shipments,
  onShipmentCreated,
  onRefresh,
  onNavigateOrders,
}) => {
  const [direction, setDirection] = useState<ShipmentDirection>('outbound');
  const [businessName, setBusinessName] = useState('Olivia Tech Studio');
  const [pickupHub, setPickupHub] = useState('olivia');
  const [pickupAddress, setPickupAddress] = useState('al. Grunwaldzka 472B, Gdansk Oliwa');
  const [pickupPin, setPickupPin] = useState<RoutePin>({ mapX: 435, mapY: 195 });

  const [dropoffHub, setDropoffHub] = useState('wrzeszcz');
  const [dropoffAddress, setDropoffAddress] = useState('ul. Slowackiego 19, Gdansk Wrzeszcz');
  const [dropoffPin, setDropoffPin] = useState<RoutePin>({ mapX: 545, mapY: 255 });

  const [pinMode, setPinMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [requestedCourierId, setRequestedCourierId] = useState<string>('');
  const [cargoDescription, setCargoDescription] = useState(
    '10 boxes of ceramic tiles 60x60cm and 3 bags of adhesive 25kg'
  );

  const [estimating, setEstimating] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [result, setResult] = useState<AiEstimateResponse | null>(null);
  const [aiBaseEstimate, setAiBaseEstimate] = useState<CargoEstimate | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [priceLocked, setPriceLocked] = useState(false);
  const [manualDraft, setManualDraft] = useState({
    weight: '',
    price: '',
    length: '',
    width: '',
    height: '',
  });

  const availableCouriers = couriers.filter((c) => c.status === 'available');
  const activeOrders = shipments.filter((s) => s.status !== 'delivered').slice(0, 6);

  useEffect(() => {
    if (hubs.length > 0 && pickupAddress.trim() === '') {
      const h = hubs.find((item) => item.id === pickupHub) ?? hubs[0];
      setPickupAddress(h.sampleAddress);
      setPickupPin({ mapX: h.mapX, mapY: h.mapY });
    }
  }, [hubs, pickupHub, pickupAddress]);

  const handlePickupHubSelect = (hubId: string) => {
    setPickupHub(hubId);
    const hub = hubs.find((h) => h.id === hubId);
    if (hub) {
      setPickupAddress(hub.sampleAddress);
      setPickupPin({ mapX: hub.mapX, mapY: hub.mapY, address: hub.sampleAddress });
    } else {
      const coords = getHubCoordinates(hubId, hubs);
      setPickupPin(coords);
    }
  };

  const handleDropoffHubSelect = (hubId: string) => {
    setDropoffHub(hubId);
    const hub = hubs.find((h) => h.id === hubId);
    if (hub) {
      setDropoffAddress(hub.sampleAddress);
      setDropoffPin({ mapX: hub.mapX, mapY: hub.mapY, address: hub.sampleAddress });
    } else {
      const coords = getHubCoordinates(hubId, hubs);
      setDropoffPin(coords);
    }
  };

  const handlePickupAddressInput = (value: string) => {
    setPickupAddress(value);
    setPinMode('pickup');
    const resolved = resolveAddressToPin(value, hubs, pickupHub);
    setPickupPin({ mapX: resolved.mapX, mapY: resolved.mapY, address: value });
    if (resolved.matched) {
      setPickupHub(resolved.hubId);
    }
  };

  const handleDropoffAddressInput = (value: string) => {
    setDropoffAddress(value);
    setPinMode('dropoff');
    const resolved = resolveAddressToPin(value, hubs, dropoffHub);
    setDropoffPin({ mapX: resolved.mapX, mapY: resolved.mapY, address: value });
    if (resolved.matched) {
      setDropoffHub(resolved.hubId);
    }
  };

  const handleSelectCourier = useCallback((id: string) => {
    setSelectedCourierId(id);
  }, []);

  const handleMapPinDrop = useCallback(
    (targetMode: 'pickup' | 'dropoff', resolved: MapPin) => {
      if (targetMode === 'pickup') {
        setPickupHub(resolved.hubId);
        setPickupAddress(resolved.address);
        setPickupPin({ mapX: resolved.mapX, mapY: resolved.mapY, address: resolved.address });
        setPinMode('dropoff');
      } else {
        setDropoffHub(resolved.hubId);
        setDropoffAddress(resolved.address);
        setDropoffPin({ mapX: resolved.mapX, mapY: resolved.mapY, address: resolved.address });
      }
    },
    []
  );

  const handleDirectionChange = (nextDir: ShipmentDirection) => {
    setDirection(nextDir);
    setSuccessMsg(null);
    setError(null);
    if (nextDir === 'inbound' && pickupHub === 'olivia' && dropoffHub === 'wrzeszcz') {
      handlePickupHubSelect('port');
      handleDropoffHubSelect('olivia');
    } else if (nextDir === 'outbound') {
      setRequestedCourierId('');
    }
  };

  const syncDraftFromEstimate = (est: CargoEstimate) => {
    setManualDraft({
      weight: String(est.estimatedWeightKg),
      price: String(est.estimatedPricePln),
      length: String(est.dimensionsCm.lengthCm),
      width: String(est.dimensionsCm.widthCm),
      height: String(est.dimensionsCm.heightCm),
    });
  };

  const handleRunEstimate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setEstimating(true);
    try {
      const response = await api.estimateCargo({
        cargoDescription,
        pickupHub,
        dropoffHub,
        pickupMapX: pickupPin.mapX,
        pickupMapY: pickupPin.mapY,
        dropoffMapX: dropoffPin.mapX,
        dropoffMapY: dropoffPin.mapY,
        direction,
      });
      setResult(response);
      setAiBaseEstimate(response.estimate);
      syncDraftFromEstimate(response.estimate);
      setIsManualEdit(false);
      setPriceLocked(false);
      const preferred =
        requestedCourierId && response.couriers.find((c) => c.id === requestedCourierId);
      const firstMatch =
        preferred ?? response.couriers.find((c) => c.fit.fits) ?? response.couriers[0];
      setSelectedCourierId(firstMatch ? firstMatch.id : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to estimate cargo dimensions');
    } finally {
      setEstimating(false);
    }
  };

  const updateManualEstimate = (patch: Partial<CargoEstimate>, lockPrice = false) => {
    if (!result) return;
    const mergedDims = patch.dimensionsCm ?? result.estimate.dimensionsCm;
    const nextDims = {
      lengthCm: Math.max(1, Math.min(320, Math.round(mergedDims.lengthCm))),
      widthCm: Math.max(1, Math.min(200, Math.round(mergedDims.widthCm))),
      heightCm: Math.max(1, Math.min(200, Math.round(mergedDims.heightCm))),
    };
    const nextWeight = Math.max(
      1,
      Math.min(1500, Math.round(patch.estimatedWeightKg ?? result.estimate.estimatedWeightKg))
    );
    const nextVolume = Math.max(
      1,
      Math.round((nextDims.lengthCm * nextDims.widthCm * nextDims.heightCm) / 1000)
    );
    const nextPriceLocked = priceLocked || lockPrice;
    const autoPrice = Math.max(
      25,
      Math.min(
        2500,
        Math.round(
          28 + result.distanceKm * 4.2 + nextWeight * 0.14 + Math.max(0, nextVolume - 180) * 0.06
        )
      )
    );
    const nextPrice = nextPriceLocked
      ? Math.max(
          1,
          Math.min(10000, Math.round(patch.estimatedPricePln ?? result.estimate.estimatedPricePln))
        )
      : autoPrice;

    const baseEstimate: CargoEstimate = {
      ...result.estimate,
      ...patch,
      dimensionsCm: nextDims,
      estimatedWeightKg: nextWeight,
      estimatedPricePln: nextPrice,
      volumeLiters: nextVolume,
    };
    const nextEstimate: CargoEstimate = {
      ...baseEstimate,
      requiredVehicleClass: computeMinVehicleClass(baseEstimate),
    };
    const nextCouriers = recalculateCouriersForEstimate(
      couriers,
      nextEstimate,
      result.distanceKm,
      pickupHub,
      dropoffHub,
      nextPriceLocked
    );

    setResult({
      ...result,
      estimate: nextEstimate,
      couriers: nextCouriers,
    });
    if (lockPrice) {
      setPriceLocked(true);
    } else if (!priceLocked) {
      setManualDraft((prev) => ({ ...prev, price: String(nextPrice) }));
    }
  };

  const handleManualNumberChange = (
    field: 'weight' | 'price' | 'length' | 'width' | 'height',
    raw: string
  ) => {
    setManualDraft((prev) => ({ ...prev, [field]: raw }));
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1 || !result) return;

    const dims = { ...result.estimate.dimensionsCm };
    if (field === 'length') dims.lengthCm = parsed;
    if (field === 'width') dims.widthCm = parsed;
    if (field === 'height') dims.heightCm = parsed;

    updateManualEstimate(
      {
        ...(field === 'weight' ? { estimatedWeightKg: parsed } : {}),
        ...(field === 'price' ? { estimatedPricePln: parsed } : {}),
        ...(field === 'length' || field === 'width' || field === 'height'
          ? { dimensionsCm: dims }
          : {}),
      },
      field === 'price'
    );
  };

  const handleToggleManualEdit = (checked: boolean) => {
    setIsManualEdit(checked);
    if (checked && result) {
      syncDraftFromEstimate(result.estimate);
    } else if (!checked && aiBaseEstimate) {
      setPriceLocked(false);
      syncDraftFromEstimate(aiBaseEstimate);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          estimate: aiBaseEstimate,
          couriers: recalculateCouriersForEstimate(
            couriers,
            aiBaseEstimate,
            prev.distanceKm,
            pickupHub,
            dropoffHub,
            false
          ),
        };
      });
    }
  };

  const handleCreateShipment = async (courierId: string | null) => {
    if (!result) return;
    setError(null);
    setSuccessMsg(null);
    setDispatchingId(courierId ?? 'open');
    try {
      const { shipment } = await api.createShipment({
        businessName,
        direction,
        pickupHub,
        pickupAddress,
        pickupMapX: pickupPin.mapX,
        pickupMapY: pickupPin.mapY,
        dropoffHub,
        dropoffAddress,
        dropoffMapX: dropoffPin.mapX,
        dropoffMapY: dropoffPin.mapY,
        cargoDescription,
        assignedCourierId: courierId,
        estimate: result.estimate,
      });
      onShipmentCreated(shipment);
      setSuccessMsg(
        courierId
          ? direction === 'inbound'
            ? `Asked ${shipment.assignedCourierName} (${shipment.assignedVehicleModel}) to bring this order to you.`
            : `Order dispatched to ${shipment.assignedCourierName} (${shipment.assignedVehicleModel}).`
          : `Posted open order (${shipment.id}) to the network.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create order');
    } finally {
      setDispatchingId(null);
    }
  };

  const handleAdvanceOrder = async (shipment: Shipment) => {
    const next = getNextShipmentStatus(shipment.status);
    if (!next) return;
    setError(null);
    setBusyOrderId(shipment.id);
    try {
      await api.updateShipmentStatus(shipment.id, { status: next });
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order status update failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleDeleteOrder = async (shipmentId: string) => {
    setError(null);
    setBusyOrderId(shipmentId);
    try {
      await api.deleteShipment(shipmentId);
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel order');
    } finally {
      setBusyOrderId(null);
    }
  };

  const applyPreset = (preset: (typeof PRESET_SCENARIOS)[number]) => {
    setDirection(preset.direction);
    setBusinessName(preset.businessName);
    setPickupHub(preset.pickupHub);
    setPickupAddress(preset.pickupAddress);
    const pPin = resolveAddressToPin(preset.pickupAddress, hubs, preset.pickupHub);
    setPickupPin({ mapX: pPin.mapX, mapY: pPin.mapY, address: preset.pickupAddress });

    setDropoffHub(preset.dropoffHub);
    setDropoffAddress(preset.dropoffAddress);
    const dPin = resolveAddressToPin(preset.dropoffAddress, hubs, preset.dropoffHub);
    setDropoffPin({ mapX: dPin.mapX, mapY: dPin.mapY, address: preset.dropoffAddress });

    setCargoDescription(preset.cargoDescription);
    setSuccessMsg(null);
    setError(null);
  };

  const selectedCourierFit: CourierWithFit | undefined = result?.couriers.find(
    (c) => c.id === selectedCourierId
  );
  const inspectedCourier: Courier | undefined =
    selectedCourierFit ?? couriers.find((c) => c.id === selectedCourierId);

  const compatibleCouriers = result?.couriers.filter((c) => c.fit.fits) ?? [];
  const incompatibleCouriers = result?.couriers.filter((c) => !c.fit.fits) ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Home</h1>
          <p className={styles.pageSubtitle}>
            Pin pickup and delivery points on the map or enter street addresses, estimate cargo size, inspect courier profiles, and manage active orders.
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
        {/* Left: Create Order Form */}
        <form className={styles.card} onSubmit={handleRunEstimate}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Create Delivery Order</h2>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>What do you need?</span>
            <div className={styles.segmented} role="group" aria-label="Delivery direction">
              <button
                type="button"
                className={`${styles.segBtn} ${direction === 'outbound' ? styles.segBtnActive : ''}`}
                onClick={() => handleDirectionChange('outbound')}
              >
                <OutboundArrowIcon size={15} />
                Send Goods From Us
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${direction === 'inbound' ? styles.segBtnActive : ''}`}
                onClick={() => handleDirectionChange('inbound')}
              >
                <InboundArrowIcon size={15} />
                Ask Courier to Bring To Us
              </button>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor="business-name">
                Business Name
              </label>
              <input
                id="business-name"
                className={styles.input}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div className={styles.fieldFull}>
              <TricityMap
                title="Pin Pickup (A) & Delivery (B) on Map"
                embedded
                hubs={hubs}
                couriers={couriers}
                selectedCourierId={selectedCourierId}
                onSelectCourier={handleSelectCourier}
                pickupPin={pickupPin}
                dropoffPin={dropoffPin}
                pinMode={pinMode}
                onPinModeChange={setPinMode}
                onPinChange={handleMapPinDrop}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="pickup-address">
                Pickup Street Address (Pin A)
              </label>
              <input
                id="pickup-address"
                className={styles.input}
                value={pickupAddress}
                onFocus={() => setPinMode('pickup')}
                onChange={(e) => handlePickupAddressInput(e.target.value)}
                placeholder="Type street or click map for Pin A..."
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="dropoff-address">
                Delivery Street Address (Pin B)
              </label>
              <input
                id="dropoff-address"
                className={styles.input}
                value={dropoffAddress}
                onFocus={() => setPinMode('dropoff')}
                onChange={(e) => handleDropoffAddressInput(e.target.value)}
                placeholder="Type street or click map for Pin B..."
                required
              />
            </div>

            {direction === 'inbound' && (
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="inbound-courier-pick">
                  Ask Specific Passing Courier (Optional)
                </label>
                <select
                  id="inbound-courier-pick"
                  className={styles.select}
                  value={requestedCourierId}
                  onChange={(e) => {
                    setRequestedCourierId(e.target.value);
                    if (e.target.value) setSelectedCourierId(e.target.value);
                  }}
                >
                  <option value="">Match any compatible courier automatically</option>
                  {availableCouriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.vehicleModel} ({c.trunk.volumeLiters} L, heading{' '}
                      {getHubLabel(c.currentHub, hubs)} to {getHubLabel(c.destinationHub, hubs)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor="cargo-desc">
                Describe Your Goods (Plain Text)
              </label>
              <textarea
                id="cargo-desc"
                className={styles.textarea}
                value={cargoDescription}
                onChange={(e) => setCargoDescription(e.target.value)}
                placeholder="Example: 14 boxes of ceramic tiles 60x60cm and 4 bags of mortar..."
                required
                minLength={5}
              />
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Sample Orders</span>
            <div className={styles.presetRow}>
              {PRESET_SCENARIOS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={styles.chipBtn}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className={styles.btnPrimary} disabled={estimating}>
            <Box3dIcon size={17} />
            {estimating ? 'Calculating Dimensions & Price...' : 'Estimate Size, Price & Match Couriers'}
          </button>
        </form>

        {/* Right: Cargo Size & Estimate Breakdown + 3D Trunk Visualizer */}
        <div className={styles.gaugeStack}>
          {!result ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Cargo Size & Trunk-Fit Preview</h2>
              <div className={styles.emptyState}>
                <Box3dIcon size={28} />
                <p style={{ margin: 0, maxWidth: 380 }}>
                  Pin Pickup (A) & Delivery (B) on the map or enter street addresses on the left, then click{' '}
                  <strong>Estimate Size, Price & Match Couriers</strong> to preview dimensions and compatible trunks.
                </p>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const shownAi = aiBaseEstimate ?? result.estimate;
                return (
                  <section className={styles.card} aria-label="Cargo estimate results">
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={styles.cardTitle}>Estimated Load & Price</h2>
                        <p className={styles.kpiSub} style={{ margin: '2px 0 0' }}>
                          {result.estimate.itemsSummary} ({result.distanceKm} km route)
                        </p>
                      </div>
                      <span
                        className={`${styles.badge} ${
                          direction === 'outbound' ? styles.badgeOutbound : styles.badgeInbound
                        }`}
                      >
                        {direction === 'outbound' ? 'Send From Us' : 'Bring To Us'}
                      </span>
                    </div>

                    <div className={styles.estimateStats}>
                      <div className={styles.statWell}>
                        <span className={styles.statWellLabel}>Est. Weight</span>
                        <span className={styles.statWellVal}>{shownAi.estimatedWeightKg} kg</span>
                      </div>

                      <div className={styles.statWell}>
                        <span className={styles.statWellLabel}>Bounding Box</span>
                        <span className={`${styles.statWellVal} mono`} style={{ fontSize: 14 }}>
                          {shownAi.dimensionsCm.lengthCm}x
                          {shownAi.dimensionsCm.widthCm}x
                          {shownAi.dimensionsCm.heightCm}
                        </span>
                      </div>

                      <div className={styles.statWell}>
                        <span className={styles.statWellLabel}>Unter Price</span>
                        <span className={styles.statWellVal} style={{ color: 'var(--accent-blue)' }}>
                          {formatPln(shownAi.estimatedPricePln)}
                        </span>
                      </div>

                      <div className={styles.statWell}>
                        <span className={styles.statWellLabel}>Traditional Van</span>
                        <span
                          className={styles.statWellVal}
                          style={{ textDecoration: 'line-through', color: 'var(--ink-muted)' }}
                        >
                          {formatPln(shownAi.traditionalCourierPricePln)}
                        </span>
                      </div>
                    </div>

                    <label className={styles.manualCheckRow}>
                      <input
                        type="checkbox"
                        checked={isManualEdit}
                        onChange={(e) => handleToggleManualEdit(e.target.checked)}
                      />
                      <span>Enter exact weight, dimensions &amp; custom price manually</span>
                    </label>

                    {isManualEdit && (
                      <div className={styles.manualEditBox}>
                        <div className={styles.manualField}>
                          <label className={styles.statWellLabel} htmlFor="manual-weight">
                            Real Weight (kg)
                          </label>
                          <input
                            id="manual-weight"
                            type="number"
                            min={1}
                            max={1500}
                            className={styles.statEditInput}
                            value={manualDraft.weight}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => handleManualNumberChange('weight', e.target.value)}
                            onBlur={() => syncDraftFromEstimate(result.estimate)}
                          />
                        </div>

                        <div className={styles.manualField}>
                          <label className={styles.statWellLabel} htmlFor="manual-price">
                            Set Price (zl)
                          </label>
                          <input
                            id="manual-price"
                            type="number"
                            min={1}
                            max={10000}
                            className={styles.statEditInput}
                            style={{ color: 'var(--accent-blue)' }}
                            value={manualDraft.price}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => handleManualNumberChange('price', e.target.value)}
                            onBlur={() => syncDraftFromEstimate(result.estimate)}
                          />
                        </div>

                        <div className={styles.manualField}>
                          <span className={styles.statWellLabel}>
                            Exact Dimensions L x W x H (cm)
                          </span>
                          <div className={styles.dimsEditRow}>
                            <input
                              type="number"
                              min={1}
                              max={320}
                              aria-label="Real cargo length cm"
                              className={`${styles.statEditInput} mono`}
                              value={manualDraft.length}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => handleManualNumberChange('length', e.target.value)}
                              onBlur={() => syncDraftFromEstimate(result.estimate)}
                            />
                            <input
                              type="number"
                              min={1}
                              max={200}
                              aria-label="Real cargo width cm"
                              className={`${styles.statEditInput} mono`}
                              value={manualDraft.width}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => handleManualNumberChange('width', e.target.value)}
                              onBlur={() => syncDraftFromEstimate(result.estimate)}
                            />
                            <input
                              type="number"
                              min={1}
                              max={200}
                              aria-label="Real cargo height cm"
                              className={`${styles.statEditInput} mono`}
                              value={manualDraft.height}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => handleManualNumberChange('height', e.target.value)}
                              onBlur={() => syncDraftFromEstimate(result.estimate)}
                            />
                          </div>
                        </div>

                        <div className={styles.manualField}>
                          <label className={styles.statWellLabel} htmlFor="manual-handling">
                            Handling
                          </label>
                          <select
                            id="manual-handling"
                            className={styles.statEditInput}
                            value={result.estimate.fragility}
                            onChange={(e) =>
                              updateManualEstimate({
                                fragility: e.target.value as FragilityLevel,
                              })
                            }
                          >
                            <option value="standard">standard</option>
                            <option value="fragile">fragile</option>
                            <option value="heavy">heavy</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`${styles.badge} ${styles.badgeDone}`}>
                          Min Class: {formatVehicleClass(result.estimate.requiredVehicleClass)}
                        </span>
                        <span className={`${styles.badge} ${styles.badgePending}`}>
                          Handling: {result.estimate.fragility}
                        </span>
                        <span className={`${styles.badge} ${styles.badgeInbound}`}>
                          CO2 Saved: {result.estimate.co2SavedKg} kg
                        </span>
                      </div>

                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={dispatchingId !== null}
                        onClick={() => handleCreateShipment(null)}
                      >
                        {dispatchingId === 'open' ? 'Posting...' : 'Post Open Order'}
                      </button>
                    </div>

                    <p className={styles.kpiSub} style={{ margin: 0, fontSize: 13 }}>
                      {result.estimate.aiReasoning}
                    </p>
                  </section>
                );
              })()}

              {selectedCourierFit && (
                <TrunkVisualizer
                  vehicleModel={selectedCourierFit.vehicleModel}
                  trunk={selectedCourierFit.trunk}
                  cargoDims={result.estimate.dimensionsCm}
                  cargoWeightKg={result.estimate.estimatedWeightKg}
                  fit={selectedCourierFit.fit}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Selected Courier Profile & Direct Text Chat */}
      {inspectedCourier && (
        <CourierProfileCard
          courier={inspectedCourier}
          hubs={hubs}
          viewerRole="business"
          viewerName={businessName}
        />
      )}

      {/* Compatible Couriers for Order */}
      {result && (
        <section className={styles.card}>
          <div className={styles.cardTitleRow}>
            <div>
              <h2 className={styles.cardTitle}>
                Matching Vehicles ({compatibleCouriers.length} Fit / {incompatibleCouriers.length} Too Small)
              </h2>
              <p className={styles.kpiSub} style={{ margin: '2px 0 0' }}>
                Click any courier row to open their profile, live map location, text chat, and 3D trunk check.
              </p>
            </div>
          </div>

          <div className={styles.courierList}>
            {result.couriers.map((courier) => {
              const selected = courier.id === selectedCourierId;
              const fits = courier.fit.fits;
              return (
                <div
                  key={courier.id}
                  className={`${styles.courierRow} ${selected ? styles.courierRowSelected : ''} ${
                    !fits ? styles.courierRowBlocked : ''
                  }`}
                  onClick={() => setSelectedCourierId(courier.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.courierTop}>
                    <div className={styles.courierInfo}>
                      <span className={styles.avatar}>{courier.avatarInitials}</span>
                      <div>
                        <div className={styles.courierName}>
                          {courier.name} | {courier.vehicleModel}
                        </div>
                        <div className={styles.courierMeta}>
                          Trunk{' '}
                          <span className="mono">
                            {courier.trunk.lengthCm}x{courier.trunk.widthCm}x{courier.trunk.heightCm} cm
                          </span>{' '}
                          ({courier.trunk.volumeLiters} L, max {courier.trunk.maxWeightKg} kg) | Location:{' '}
                          {courier.currentAddress}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {courier.status === 'busy' && (
                        <span className={`${styles.badge} ${styles.badgePending}`}>
                          Busy on Run
                        </span>
                      )}
                      {courier.fit.routeAligned && fits && (
                        <span className={`${styles.badge} ${styles.badgeOutbound}`}>
                          On Route Match
                        </span>
                      )}
                      <span
                        className={`${styles.badge} ${
                          !fits
                            ? styles.badgeFail
                            : courier.fit.fitScore >= 70
                              ? styles.badgeDone
                              : styles.badgePending
                        }`}
                      >
                        {fits ? `Fit Score ${courier.fit.fitScore}/100` : 'Trunk Too Small'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.courierBottom}>
                    <span className={styles.courierMeta}>{courier.fit.reason}</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="tabular" style={{ fontWeight: 700, fontSize: 14 }}>
                        {formatPln(courier.estimatedPayoutPln)}
                      </span>
                      {fits && (
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}
                          disabled={dispatchingId !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateShipment(courier.id);
                          }}
                        >
                          <CheckIcon size={15} />
                          {dispatchingId === courier.id
                            ? 'Confirming...'
                            : direction === 'inbound'
                              ? 'Ask Courier to Bring'
                              : 'Dispatch Courier'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Manage Active Orders Directly on Home */}
      <section className={styles.card}>
        <div className={styles.cardTitleRow}>
          <div>
            <h2 className={styles.cardTitle}>Manage Active Orders ({activeOrders.length})</h2>
            <p className={styles.kpiSub} style={{ margin: '2px 0 0' }}>
              Orders sent out from your business and supplies couriers are bringing to you
            </p>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={onNavigateOrders}>
            Open All Orders
          </button>
        </div>

        {activeOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <p style={{ margin: 0 }}>All current orders have been delivered. Create a new order above.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Type</th>
                  <th>Pinned Route</th>
                  <th>Courier</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((s) => {
                  const next = getNextShipmentStatus(s.status);
                  const isBusy = busyOrderId === s.id;
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
                        <div className={styles.kpiSub}>{s.distanceKm} km</div>
                      </td>
                      <td>
                        {s.assignedCourierName ? (
                          <div>
                            <strong>{s.assignedCourierName}</strong>
                            <div className={styles.kpiSub}>{s.assignedVehicleModel}</div>
                          </div>
                        ) : (
                          <span className={styles.kpiSub}>Awaiting courier</span>
                        )}
                      </td>
                      <td className="tabular">
                        <strong>{formatPln(s.estimate.estimatedPricePln)}</strong>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            s.status === 'pending' ? styles.badgePending : styles.badgeActive
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
                              onClick={() => void handleAdvanceOrder(s)}
                            >
                              <CheckIcon size={14} />
                              {formatShipmentStatus(next)}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={isBusy}
                            aria-label={`Cancel order ${s.title}`}
                            onClick={() => void handleDeleteOrder(s.id)}
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
