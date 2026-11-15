import { SqlValue } from 'sql.js';
import { SqliteStore } from './database.js';
import {
  CargoEstimate,
  Courier,
  CourierMessage,
  MonthlyMetric,
  Shipment,
  ShipmentDirection,
  ShipmentStatus,
  VehicleClass,
} from '../types/domain.js';

interface CourierRow {
  id: string;
  name: string;
  rating: number;
  completed_deliveries: number;
  vehicle_model: string;
  vehicle_class: VehicleClass;
  license_plate: string;
  phone: string;
  bio: string;
  current_address: string;
  active_order_title: string | null;
  trunk_length_cm: number;
  trunk_width_cm: number;
  trunk_height_cm: number;
  trunk_max_weight_kg: number;
  trunk_volume_liters: number;
  current_hub: string;
  destination_hub: string;
  available_from: string;
  price_per_km_pln: number;
  status: 'available' | 'busy';
  avatar_initials: string;
  map_x: number;
  map_y: number;
}

interface CourierMessageRow {
  id: string;
  courier_id: string;
  sender: 'business' | 'courier';
  sender_name: string;
  text: string;
  created_at: string;
}

interface ShipmentRow {
  id: string;
  title: string;
  business_name: string;
  direction: ShipmentDirection;
  pickup_hub: string;
  pickup_address: string;
  pickup_map_x: number | null;
  pickup_map_y: number | null;
  dropoff_hub: string;
  dropoff_address: string;
  dropoff_map_x: number | null;
  dropoff_map_y: number | null;
  distance_km: number;
  cargo_description: string;
  estimate_json: string;
  status: ShipmentStatus;
  assigned_courier_id: string | null;
  assigned_courier_name: string | null;
  assigned_vehicle_model: string | null;
  created_at: string;
}

function mapCourierRow(row: CourierRow): Courier {
  return {
    id: row.id,
    name: row.name,
    rating: Number(row.rating),
    completedDeliveries: Number(row.completed_deliveries),
    vehicleModel: row.vehicle_model,
    vehicleClass: row.vehicle_class,
    licensePlate: row.license_plate,
    phone: row.phone || '+48 500 100 200',
    bio: row.bio || '',
    currentAddress: row.current_address || '',
    activeOrderTitle: row.active_order_title ?? null,
    trunk: {
      lengthCm: Number(row.trunk_length_cm),
      widthCm: Number(row.trunk_width_cm),
      heightCm: Number(row.trunk_height_cm),
      maxWeightKg: Number(row.trunk_max_weight_kg),
      volumeLiters: Number(row.trunk_volume_liters),
    },
    currentHub: row.current_hub,
    destinationHub: row.destination_hub,
    availableFrom: row.available_from,
    pricePerKmPln: Number(row.price_per_km_pln),
    status: row.status,
    avatarInitials: row.avatar_initials,
    mapX: Number(row.map_x),
    mapY: Number(row.map_y),
  };
}

function mapCourierMessageRow(row: CourierMessageRow): CourierMessage {
  return {
    id: row.id,
    courierId: row.courier_id,
    sender: row.sender,
    senderName: row.sender_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

function mapShipmentRow(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    title: row.title,
    businessName: row.business_name,
    direction: row.direction,
    pickupHub: row.pickup_hub,
    pickupAddress: row.pickup_address,
    pickupMapX: row.pickup_map_x !== null && row.pickup_map_x !== undefined ? Number(row.pickup_map_x) : null,
    pickupMapY: row.pickup_map_y !== null && row.pickup_map_y !== undefined ? Number(row.pickup_map_y) : null,
    dropoffHub: row.dropoff_hub,
    dropoffAddress: row.dropoff_address,
    dropoffMapX: row.dropoff_map_x !== null && row.dropoff_map_x !== undefined ? Number(row.dropoff_map_x) : null,
    dropoffMapY: row.dropoff_map_y !== null && row.dropoff_map_y !== undefined ? Number(row.dropoff_map_y) : null,
    distanceKm: Number(row.distance_km),
    cargoDescription: row.cargo_description,
    estimate: JSON.parse(row.estimate_json) as CargoEstimate,
    status: row.status,
    assignedCourierId: row.assigned_courier_id,
    assignedCourierName: row.assigned_courier_name ?? null,
    assignedVehicleModel: row.assigned_vehicle_model ?? null,
    createdAt: row.created_at,
  };
}

export class Repository {
  constructor(private readonly store: SqliteStore) {}

  listCouriers(): Courier[] {
    const rows = this.store.queryAll<CourierRow>(`
      SELECT
        c.*,
        (
          SELECT s.title FROM shipments s
          WHERE s.assigned_courier_id = c.id
            AND s.status IN ('in_transit', 'picked_up', 'matched')
          ORDER BY s.created_at DESC
          LIMIT 1
        ) as active_order_title
      FROM couriers c
      ORDER BY c.status ASC, c.rating DESC
    `);
    return rows.map(mapCourierRow);
  }

  getCourierById(id: string): Courier | null {
    const row = this.store.queryOne<CourierRow>(
      `
      SELECT
        c.*,
        (
          SELECT s.title FROM shipments s
          WHERE s.assigned_courier_id = c.id
            AND s.status IN ('in_transit', 'picked_up', 'matched')
          ORDER BY s.created_at DESC
          LIMIT 1
        ) as active_order_title
      FROM couriers c
      WHERE c.id = ?
      `,
      [id]
    );
    return row ? mapCourierRow(row) : null;
  }

  updateCourierStatus(
    id: string,
    status: 'available' | 'busy',
    currentAddress?: string
  ): Courier | null {
    if (currentAddress && currentAddress.trim()) {
      this.store.execute('UPDATE couriers SET status = ?, current_address = ? WHERE id = ?', [
        status,
        currentAddress.trim(),
        id,
      ]);
    } else {
      this.store.execute('UPDATE couriers SET status = ? WHERE id = ?', [status, id]);
    }
    return this.getCourierById(id);
  }

  listMessagesByCourier(courierId: string): CourierMessage[] {
    const rows = this.store.queryAll<CourierMessageRow>(
      'SELECT * FROM courier_messages WHERE courier_id = ? ORDER BY created_at ASC',
      [courierId]
    );
    return rows.map(mapCourierMessageRow);
  }

  insertCourierMessage(msg: CourierMessage): CourierMessage {
    this.store.execute(
      `
      INSERT INTO courier_messages (id, courier_id, sender, sender_name, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [msg.id, msg.courierId, msg.sender, msg.senderName, msg.text, msg.createdAt]
    );
    return msg;
  }

  listShipments(filters?: {
    direction?: ShipmentDirection;
    status?: ShipmentStatus;
    courierId?: string;
  }): Shipment[] {
    const clauses: string[] = [];
    const params: SqlValue[] = [];

    if (filters?.direction) {
      clauses.push('s.direction = ?');
      params.push(filters.direction);
    }
    if (filters?.status) {
      clauses.push('s.status = ?');
      params.push(filters.status);
    }
    if (filters?.courierId) {
      clauses.push('s.assigned_courier_id = ?');
      params.push(filters.courierId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.store.queryAll<ShipmentRow>(
      `
      SELECT
        s.*,
        c.name as assigned_courier_name,
        c.vehicle_model as assigned_vehicle_model
      FROM shipments s
      LEFT JOIN couriers c ON s.assigned_courier_id = c.id
      ${where}
      ORDER BY s.created_at DESC
      `,
      params
    );
    return rows.map(mapShipmentRow);
  }

  getShipmentById(id: string): Shipment | null {
    const row = this.store.queryOne<ShipmentRow>(
      `
      SELECT
        s.*,
        c.name as assigned_courier_name,
        c.vehicle_model as assigned_vehicle_model
      FROM shipments s
      LEFT JOIN couriers c ON s.assigned_courier_id = c.id
      WHERE s.id = ?
      `,
      [id]
    );
    return row ? mapShipmentRow(row) : null;
  }

  insertShipment(shipment: Omit<Shipment, 'assignedCourierName' | 'assignedVehicleModel'>): Shipment {
    this.store.execute(
      `
      INSERT INTO shipments (
        id, title, business_name, direction, pickup_hub, pickup_address,
        pickup_map_x, pickup_map_y, dropoff_hub, dropoff_address,
        dropoff_map_x, dropoff_map_y, distance_km, cargo_description,
        estimate_json, status, assigned_courier_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        shipment.id,
        shipment.title,
        shipment.businessName,
        shipment.direction,
        shipment.pickupHub,
        shipment.pickupAddress,
        shipment.pickupMapX ?? null,
        shipment.pickupMapY ?? null,
        shipment.dropoffHub,
        shipment.dropoffAddress,
        shipment.dropoffMapX ?? null,
        shipment.dropoffMapY ?? null,
        shipment.distanceKm,
        shipment.cargoDescription,
        JSON.stringify(shipment.estimate),
        shipment.status,
        shipment.assignedCourierId,
        shipment.createdAt,
      ]
    );
    return this.getShipmentById(shipment.id)!;
  }

  updateShipment(id: string, status: ShipmentStatus, assignedCourierId: string | null): Shipment | null {
    this.store.execute(
      'UPDATE shipments SET status = ?, assigned_courier_id = ? WHERE id = ?',
      [status, assignedCourierId, id]
    );
    return this.getShipmentById(id);
  }

  deleteShipment(id: string): boolean {
    const existing = this.getShipmentById(id);
    if (!existing) {
      return false;
    }
    this.store.execute('DELETE FROM shipments WHERE id = ?', [id]);
    return true;
  }

  listMonthlyMetrics(): MonthlyMetric[] {
    const rows = this.store.queryAll<{
      month_index: number;
      month: string;
      outbound_pln: number;
      inbound_pln: number;
      outbound_count: number;
      inbound_count: number;
      co2_saved_kg: number;
    }>('SELECT * FROM monthly_metrics ORDER BY month_index ASC');

    return rows.map((r) => ({
      monthIndex: Number(r.month_index),
      month: r.month,
      outboundPln: Number(r.outbound_pln),
      inboundPln: Number(r.inbound_pln),
      outboundCount: Number(r.outbound_count),
      inboundCount: Number(r.inbound_count),
      co2SavedKg: Number(r.co2_saved_kg),
    }));
  }
}
