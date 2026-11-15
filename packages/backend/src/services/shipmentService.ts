import crypto from 'node:crypto';
import { getDistanceFromMapCoordsKm, getHubById, getRouteDistanceKm } from '../db/hubs.js';
import { Repository } from '../db/repositories.js';
import { estimateCargoFromText } from './aiEstimatorService.js';
import { checkPhysicalTrunkFit } from './trunkMatcherService.js';
import {
  CargoEstimate,
  Courier,
  CourierMessage,
  Shipment,
  ShipmentDirection,
  ShipmentStatus,
} from '../types/domain.js';

export class DomainConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface CreateShipmentInput {
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
  estimate?: CargoEstimate;
  assignedCourierId?: string | null;
}

export class ShipmentService {
  constructor(private readonly repo: Repository) {}

  async createShipment(input: CreateShipmentInput): Promise<Shipment> {
    const pickupHubInfo = getHubById(input.pickupHub);
    const dropoffHubInfo = getHubById(input.dropoffHub);
    const hasCustomPins =
      typeof input.pickupMapX === 'number' &&
      typeof input.pickupMapY === 'number' &&
      typeof input.dropoffMapX === 'number' &&
      typeof input.dropoffMapY === 'number';
    const distanceKm = hasCustomPins
      ? getDistanceFromMapCoordsKm(
          input.pickupMapX!,
          input.pickupMapY!,
          input.dropoffMapX!,
          input.dropoffMapY!
        )
      : getRouteDistanceKm(pickupHubInfo.id, dropoffHubInfo.id);

    const estimate =
      input.estimate ?? (await estimateCargoFromText(input.cargoDescription, distanceKm));

    let status: ShipmentStatus = 'pending';
    let assignedCourierId: string | null = null;

    if (input.assignedCourierId) {
      const courier = this.repo.getCourierById(input.assignedCourierId);
      if (!courier) {
        throw new NotFoundError(`Courier ${input.assignedCourierId} not found`);
      }
      const fit = checkPhysicalTrunkFit(
        estimate.dimensionsCm,
        estimate.estimatedWeightKg,
        estimate.fragility,
        courier.trunk
      );
      if (!fit.fits) {
        throw new DomainConflictError(
          `Assigned vehicle ${courier.vehicleModel} cannot physically fit load: ${fit.reason}`
        );
      }
      assignedCourierId = courier.id;
      status = 'matched';
    }

    const shipmentId = `ship-${crypto.randomUUID().slice(0, 8)}`;
    const title =
      input.title?.trim() ||
      (estimate.itemsSummary.length > 48
        ? `${estimate.itemsSummary.slice(0, 45)}...`
        : estimate.itemsSummary);

    return this.repo.insertShipment({
      id: shipmentId,
      title,
      businessName: input.businessName.trim(),
      direction: input.direction,
      pickupHub: pickupHubInfo.id,
      pickupAddress: input.pickupAddress?.trim() || pickupHubInfo.sampleAddress,
      pickupMapX: input.pickupMapX ?? pickupHubInfo.mapX,
      pickupMapY: input.pickupMapY ?? pickupHubInfo.mapY,
      dropoffHub: dropoffHubInfo.id,
      dropoffAddress: input.dropoffAddress?.trim() || dropoffHubInfo.sampleAddress,
      dropoffMapX: input.dropoffMapX ?? dropoffHubInfo.mapX,
      dropoffMapY: input.dropoffMapY ?? dropoffHubInfo.mapY,
      distanceKm,
      cargoDescription: input.cargoDescription.trim(),
      estimate,
      status,
      assignedCourierId,
      createdAt: new Date().toISOString(),
    });
  }

  updateShipmentStatus(
    id: string,
    status: ShipmentStatus,
    assignedCourierId?: string | null
  ): Shipment {
    const existing = this.repo.getShipmentById(id);
    if (!existing) {
      throw new NotFoundError(`Shipment ${id} not found`);
    }

    const nextCourierId =
      assignedCourierId !== undefined ? assignedCourierId : existing.assignedCourierId;

    if (nextCourierId) {
      const courier = this.repo.getCourierById(nextCourierId);
      if (!courier) {
        throw new NotFoundError(`Courier ${nextCourierId} not found`);
      }
      const fit = checkPhysicalTrunkFit(
        existing.estimate.dimensionsCm,
        existing.estimate.estimatedWeightKg,
        existing.estimate.fragility,
        courier.trunk
      );
      if (!fit.fits) {
        throw new DomainConflictError(
          `Vehicle ${courier.vehicleModel} cannot fit this cargo: ${fit.reason}`
        );
      }
      if (status === 'picked_up' || status === 'in_transit') {
        this.repo.updateCourierStatus(courier.id, 'busy');
      } else if (status === 'delivered') {
        this.repo.updateCourierStatus(courier.id, 'available');
      }
    }

    const updated = this.repo.updateShipment(id, status, nextCourierId);
    if (!updated) {
      throw new NotFoundError(`Shipment ${id} not found`);
    }
    return updated;
  }

  async requestInboundFromCourier(params: {
    courierId: string;
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
  }): Promise<Shipment> {
    const courier = this.repo.getCourierById(params.courierId);
    if (!courier) {
      throw new NotFoundError(`Courier ${params.courierId} not found`);
    }

    return this.createShipment({
      businessName: params.businessName,
      direction: 'inbound',
      pickupHub: params.pickupHub,
      pickupAddress: params.pickupAddress,
      pickupMapX: params.pickupMapX,
      pickupMapY: params.pickupMapY,
      dropoffHub: params.dropoffHub,
      dropoffAddress: params.dropoffAddress,
      dropoffMapX: params.dropoffMapX,
      dropoffMapY: params.dropoffMapY,
      cargoDescription: params.cargoDescription,
      assignedCourierId: courier.id,
    });
  }

  sendCourierMessage(params: {
    courierId: string;
    sender: 'business' | 'courier';
    senderName?: string;
    text: string;
  }): { courier: Courier; messages: CourierMessage[] } {
    const courier = this.repo.getCourierById(params.courierId);
    if (!courier) {
      throw new NotFoundError(`Courier ${params.courierId} not found`);
    }

    const now = new Date().toISOString();
    this.repo.insertCourierMessage({
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      courierId: courier.id,
      sender: params.sender,
      senderName:
        params.senderName?.trim() ||
        (params.sender === 'courier' ? courier.name : 'Unter Dispatch Desk'),
      text: params.text.trim(),
      createdAt: now,
    });

    if (params.sender === 'business') {
      const replyTime = new Date(Date.now() + 1000).toISOString();
      const lower = params.text.toLowerCase();
      const destName = getHubById(courier.destinationHub).name;
      let replyText = `Copy that! I am currently near ${courier.currentAddress} heading to ${destName} (${courier.vehicleModel}, ${courier.trunk.volumeLiters} L bay).`;

      if (lower.includes('where') || lower.includes('eta') || lower.includes('location')) {
        replyText =
          courier.status === 'busy'
            ? `Currently on an active delivery near ${courier.currentAddress}. Free for the next load ${courier.availableFrom}.`
            : `Parked and available near ${courier.currentAddress}, heading toward ${destName}. Ready when you confirm!`;
      } else if (lower.includes('bay') || lower.includes('gate') || lower.includes('ramp') || lower.includes('pickup')) {
        replyText = `Understood, I will pull up directly to your loading bay in my ${courier.vehicleModel} (${courier.licensePlate}). Call ${courier.phone} on arrival if locked.`;
      } else if (lower.includes('fragile') || lower.includes('upright') || lower.includes('strap')) {
        replyText = `No problem, I have ratchet straps and rubber floor mats in the ${courier.vehicleModel} (${courier.trunk.heightCm} cm height clearance).`;
      }

      this.repo.insertCourierMessage({
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        courierId: courier.id,
        sender: 'courier',
        senderName: courier.name,
        text: replyText,
        createdAt: replyTime,
      });
    } else if (params.sender === 'courier') {
      const replyTime = new Date(Date.now() + 1000).toISOString();
      const history = this.repo.listMessagesByCourier(courier.id);
      const businessClient =
        [...history].reverse().find((m) => m.sender === 'business')?.senderName ??
        'Olivia Star Roastery & Cafe';
      const lower = params.text.toLowerCase();
      let businessReply = `Thanks ${courier.name.split(' ')[0]}! Gate B is open and our dispatch desk will meet your ${courier.vehicleModel} at reception.`;

      if (lower.includes('arriving') || lower.includes('bay') || lower.includes('gate')) {
        businessReply = `Perfect, warehouse team is rolling the crates out to Gate B now. Pull right up to the yellow bay.`;
      } else if (lower.includes('unloaded') || lower.includes('free') || lower.includes('available')) {
        businessReply = `Great timing, we have another palletized order ready for pickup at Port Gdansk terminal if you have room.`;
      }

      this.repo.insertCourierMessage({
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        courierId: courier.id,
        sender: 'business',
        senderName: businessClient,
        text: businessReply,
        createdAt: replyTime,
      });
    }

    return {
      courier,
      messages: this.repo.listMessagesByCourier(courier.id),
    };
  }
}
