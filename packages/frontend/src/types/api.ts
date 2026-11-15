export type VehicleClass = 'hatchback' | 'station_wagon' | 'suv' | 'van';
export type ShipmentDirection = 'outbound' | 'inbound';
export type ShipmentStatus = 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered';
export type FragilityLevel = 'standard' | 'fragile' | 'heavy';

export interface DimensionsCm {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface VehicleTrunk extends DimensionsCm {
  maxWeightKg: number;
  volumeLiters: number;
}

export interface HubInfo {
  id: string;
  name: string;
  district: string;
  sampleAddress: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
}

export interface Courier {
  id: string;
  name: string;
  rating: number;
  completedDeliveries: number;
  vehicleModel: string;
  vehicleClass: VehicleClass;
  licensePlate: string;
  phone: string;
  bio: string;
  currentAddress: string;
  activeOrderTitle?: string | null;
  trunk: VehicleTrunk;
  currentHub: string;
  destinationHub: string;
  availableFrom: string;
  pricePerKmPln: number;
  status: 'available' | 'busy';
  avatarInitials: string;
  mapX: number;
  mapY: number;
}

export interface CourierMessage {
  id: string;
  courierId: string;
  sender: 'business' | 'courier';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface CargoEstimate {
  itemsSummary: string;
  estimatedWeightKg: number;
  dimensionsCm: DimensionsCm;
  volumeLiters: number;
  requiredVehicleClass: VehicleClass;
  estimatedPricePln: number;
  traditionalCourierPricePln: number;
  co2SavedKg: number;
  fragility: FragilityLevel;
  confidenceScore: number;
  aiReasoning: string;
  source: 'llm' | 'deterministic-ai';
}

export interface TrunkFitResult {
  fits: boolean;
  fitLabel: 'optimal' | 'tight' | 'incompatible';
  fitScore: number;
  volumeUtilizationPct: number;
  weightUtilizationPct: number;
  orientedCargoCm: DimensionsCm;
  rotated: boolean;
  routeAligned: boolean;
  reason: string;
}

export interface CourierWithFit extends Courier {
  fit: TrunkFitResult;
  estimatedPayoutPln: number;
}

export interface Shipment {
  id: string;
  title: string;
  businessName: string;
  direction: ShipmentDirection;
  pickupHub: string;
  pickupAddress: string;
  pickupMapX?: number | null;
  pickupMapY?: number | null;
  dropoffHub: string;
  dropoffAddress: string;
  dropoffMapX?: number | null;
  dropoffMapY?: number | null;
  distanceKm: number;
  cargoDescription: string;
  estimate: CargoEstimate;
  status: ShipmentStatus;
  assignedCourierId: string | null;
  assignedCourierName: string | null;
  assignedVehicleModel: string | null;
  createdAt: string;
}

export interface MonthlyMetric {
  month: string;
  monthIndex: number;
  outboundPln: number;
  inboundPln: number;
  outboundCount: number;
  inboundCount: number;
  co2SavedKg: number;
}

export interface AnalyticsSummary {
  kpis: {
    totalFreightValuePln: number;
    outboundValuePln: number;
    inboundValuePln: number;
    totalSavingsPln: number;
    co2SavedKg: number;
    trunkFitHitRatePct: number;
    sameDayCompletionPct: number;
    activeCouriersCount: number;
    unusedTrunkCapacityLiters: number;
  };
  deltas: {
    totalFreightPct: number;
    outboundPct: number;
    inboundPct: number;
    savingsCostReductionPct: number;
  };
  monthlySeries: MonthlyMetric[];
  recentShipmentsCount: {
    pending: number;
    matched: number;
    inTransit: number;
    delivered: number;
  };
}

export interface AiEstimateResponse {
  direction: ShipmentDirection;
  distanceKm: number;
  estimate: CargoEstimate;
  couriers: CourierWithFit[];
}

export interface AiPromptResponse {
  aiMode: 'llm' | 'deterministic-ai';
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
}
