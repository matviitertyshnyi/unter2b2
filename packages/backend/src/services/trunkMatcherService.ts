import {
  Courier,
  CourierWithFit,
  DimensionsCm,
  FragilityLevel,
  TrunkFitResult,
  VehicleTrunk,
} from '../types/domain.js';

function getOrientations(dims: DimensionsCm, uprightOnly: boolean): Array<{ dims: DimensionsCm; rotated: boolean }> {
  const { lengthCm: l, widthCm: w, heightCm: h } = dims;
  if (uprightOnly) {
    return [
      { dims: { lengthCm: l, widthCm: w, heightCm: h }, rotated: false },
      { dims: { lengthCm: w, widthCm: l, heightCm: h }, rotated: l !== w },
    ];
  }

  return [
    { dims: { lengthCm: l, widthCm: w, heightCm: h }, rotated: false },
    { dims: { lengthCm: w, widthCm: l, heightCm: h }, rotated: true },
    { dims: { lengthCm: l, widthCm: h, heightCm: w }, rotated: true },
    { dims: { lengthCm: h, widthCm: l, heightCm: w }, rotated: true },
    { dims: { lengthCm: w, widthCm: h, heightCm: l }, rotated: true },
    { dims: { lengthCm: h, widthCm: w, heightCm: l }, rotated: true },
  ];
}

function buildAxisOverflowReason(cargo: DimensionsCm, trunk: VehicleTrunk, uprightOnly: boolean): string {
  if (uprightOnly && cargo.heightCm > trunk.heightCm) {
    return `Upright cargo height ${cargo.heightCm} cm exceeds trunk height ${trunk.heightCm} cm`;
  }

  const cSorted = [cargo.lengthCm, cargo.widthCm, cargo.heightCm].sort((a, b) => b - a);
  const tSorted = [trunk.lengthCm, trunk.widthCm, trunk.heightCm].sort((a, b) => b - a);

  if (cSorted[0] > tSorted[0]) {
    return `Cargo length ${cSorted[0]} cm exceeds trunk length ${trunk.lengthCm} cm`;
  }
  if (cSorted[1] > tSorted[1]) {
    return `Cargo width ${cSorted[1]} cm exceeds trunk width ${trunk.widthCm} cm`;
  }
  return `Cargo height ${cSorted[2]} cm exceeds trunk clearance ${trunk.heightCm} cm`;
}

export function checkPhysicalTrunkFit(
  cargo: DimensionsCm,
  weightKg: number,
  fragility: FragilityLevel,
  trunk: VehicleTrunk,
  routeContext?: {
    courierCurrentHub: string;
    courierDestinationHub: string;
    pickupHub?: string;
    dropoffHub?: string;
  }
): TrunkFitResult {
  const cargoVolL = Math.max(1, (cargo.lengthCm * cargo.widthCm * cargo.heightCm) / 1000);
  const volumeUtilizationPct = Math.round((cargoVolL / trunk.volumeLiters) * 100);
  const weightUtilizationPct = Math.round((weightKg / trunk.maxWeightKg) * 100);

  const routeAligned = Boolean(
    routeContext?.pickupHub &&
      routeContext?.dropoffHub &&
      (routeContext.courierCurrentHub === routeContext.pickupHub ||
        routeContext.courierDestinationHub === routeContext.dropoffHub ||
        routeContext.courierDestinationHub === routeContext.pickupHub)
  );

  if (weightKg > trunk.maxWeightKg) {
    return {
      fits: false,
      fitLabel: 'incompatible',
      fitScore: 0,
      volumeUtilizationPct,
      weightUtilizationPct,
      orientedCargoCm: cargo,
      rotated: false,
      routeAligned,
      reason: `Payload ${weightKg} kg exceeds vehicle max payload ${trunk.maxWeightKg} kg`,
    };
  }

  const uprightOnly = fragility === 'fragile';
  const orientations = getOrientations(cargo, uprightOnly);

  let bestFit: { dims: DimensionsCm; rotated: boolean; minMargin: number } | null = null;

  for (const option of orientations) {
    const marginL = trunk.lengthCm - option.dims.lengthCm;
    const marginW = trunk.widthCm - option.dims.widthCm;
    const marginH = trunk.heightCm - option.dims.heightCm;
    if (marginL >= 0 && marginW >= 0 && marginH >= 0) {
      const minMargin = Math.min(marginL, marginW, marginH);
      if (!bestFit || minMargin > bestFit.minMargin) {
        bestFit = { dims: option.dims, rotated: option.rotated, minMargin };
      }
    }
  }

  if (!bestFit) {
    return {
      fits: false,
      fitLabel: 'incompatible',
      fitScore: 0,
      volumeUtilizationPct,
      weightUtilizationPct,
      orientedCargoCm: cargo,
      rotated: false,
      routeAligned,
      reason: buildAxisOverflowReason(cargo, trunk, uprightOnly),
    };
  }

  // Score rewards snug capacity match (ideal 40-85%) so small loads prefer cars over large vans
  const efficiencyPeak = Math.max(0, 100 - Math.abs(65 - volumeUtilizationPct) * 1.15);
  const routeBonus = routeAligned ? 14 : 0;
  const fitScore = Math.min(99, Math.max(35, Math.round(efficiencyPeak * 0.86 + routeBonus)));
  const isOptimalScore = fitScore >= 70;

  return {
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

export function rankCouriersForCargo(
  couriers: Courier[],
  params: {
    dimensionsCm: DimensionsCm;
    weightKg: number;
    fragility: FragilityLevel;
    distanceKm: number;
    pickupHub?: string;
    dropoffHub?: string;
  }
): CourierWithFit[] {
  const evaluated = couriers.map((courier) => {
    const fit = checkPhysicalTrunkFit(
      params.dimensionsCm,
      params.weightKg,
      params.fragility,
      courier.trunk,
      {
        courierCurrentHub: courier.currentHub,
        courierDestinationHub: courier.destinationHub,
        pickupHub: params.pickupHub,
        dropoffHub: params.dropoffHub,
      }
    );

    const estimatedPayoutPln = Math.round(28 + params.distanceKm * courier.pricePerKmPln + params.weightKg * 0.08);
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
