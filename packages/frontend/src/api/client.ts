import {
  AiEstimateResponse,
  AiPromptResponse,
  AnalyticsSummary,
  Courier,
  CourierMessage,
  CourierWithFit,
  DimensionsCm,
  FragilityLevel,
  HubInfo,
  Shipment,
  ShipmentDirection,
  ShipmentStatus,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) {
        message = errBody.error;
      }
    } catch {
      // keep fallback HTTP message
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  getHealth: () =>
    request<{ status: string; aiMode: 'llm' | 'deterministic-ai'; hubsCount: number }>('/health'),

  getHubs: () => request<{ hubs: HubInfo[] }>('/hubs'),

  getAnalytics: () => request<AnalyticsSummary>('/analytics'),

  getAiPrompt: () => request<AiPromptResponse>('/ai/prompt'),

  estimateCargo: (payload: {
    cargoDescription: string;
    pickupHub: string;
    dropoffHub: string;
    pickupMapX?: number;
    pickupMapY?: number;
    dropoffMapX?: number;
    dropoffMapY?: number;
    direction: ShipmentDirection;
  }) =>
    request<AiEstimateResponse>('/ai/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCouriers: () => request<{ couriers: Courier[] }>('/couriers'),

  getCourierProfile: (id: string) =>
    request<{ courier: Courier; messages: CourierMessage[]; activeShipments: Shipment[] }>(
      `/couriers/${encodeURIComponent(id)}`
    ),

  updateCourierStatus: (id: string, payload: { status: 'available' | 'busy'; currentAddress?: string }) =>
    request<{ courier: Courier }>(`/couriers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getCourierMessages: (id: string) =>
    request<{ courierId: string; messages: CourierMessage[] }>(
      `/couriers/${encodeURIComponent(id)}/messages`
    ),

  sendCourierMessage: (
    id: string,
    payload: { sender: 'business' | 'courier'; senderName?: string; text: string }
  ) =>
    request<{ courier: Courier; messages: CourierMessage[] }>(
      `/couriers/${encodeURIComponent(id)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getCouriersWithFit: (params: {
    dims: DimensionsCm;
    weightKg: number;
    fragility: FragilityLevel;
    distanceKm?: number;
    pickupHub?: string;
    dropoffHub?: string;
  }) => {
    const query = new URLSearchParams({
      lengthCm: String(params.dims.lengthCm),
      widthCm: String(params.dims.widthCm),
      heightCm: String(params.dims.heightCm),
      weightKg: String(params.weightKg),
      fragility: params.fragility,
      ...(params.distanceKm ? { distanceKm: String(params.distanceKm) } : {}),
      ...(params.pickupHub ? { pickupHub: params.pickupHub } : {}),
      ...(params.dropoffHub ? { dropoffHub: params.dropoffHub } : {}),
    });
    return request<{ couriers: CourierWithFit[] }>(`/couriers?${query.toString()}`);
  },

  getShipments: (filters?: {
    direction?: ShipmentDirection;
    status?: ShipmentStatus;
    courierId?: string;
  }) => {
    const query = new URLSearchParams();
    if (filters?.direction) query.set('direction', filters.direction);
    if (filters?.status) query.set('status', filters.status);
    if (filters?.courierId) query.set('courierId', filters.courierId);
    const qs = query.toString();
    return request<{ shipments: Shipment[] }>(`/shipments${qs ? `?${qs}` : ''}`);
  },

  createShipment: (payload: {
    title?: string;
    businessName: string;
    direction: ShipmentDirection;
    pickupHub: string;
    pickupAddress?: string;
    pickupMapX?: number | null;
    pickupMapY?: number | null;
    dropoffHub: string;
    dropoffAddress?: string;
    dropoffMapX?: number | null;
    dropoffMapY?: number | null;
    cargoDescription: string;
    assignedCourierId?: string | null;
    estimate?: AiEstimateResponse['estimate'];
  }) =>
    request<{ shipment: Shipment }>('/shipments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateShipmentStatus: (
    id: string,
    payload: { status: ShipmentStatus; assignedCourierId?: string | null }
  ) =>
    request<{ shipment: Shipment }>(`/shipments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteShipment: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/shipments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  requestInboundCourier: (
    courierId: string,
    payload: {
      businessName: string;
      pickupHub: string;
      pickupAddress?: string;
      pickupMapX?: number | null;
      pickupMapY?: number | null;
      dropoffHub: string;
      dropoffAddress?: string;
      dropoffMapX?: number | null;
      dropoffMapY?: number | null;
      cargoDescription: string;
    }
  ) =>
    request<{ shipment: Shipment }>(`/couriers/${encodeURIComponent(courierId)}/request-inbound`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
