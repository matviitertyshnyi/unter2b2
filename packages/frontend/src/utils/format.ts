import { HubInfo, ShipmentStatus, VehicleClass } from '../types/api';

export function formatPln(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US').replace(/,/g, ' ')} zł`;
}

export function formatVehicleClass(vc: VehicleClass): string {
  const labels: Record<VehicleClass, string> = {
    hatchback: 'Hatchback',
    station_wagon: 'Station Wagon',
    suv: 'SUV',
    van: 'Cargo Van',
  };
  return labels[vc];
}

export function formatShipmentStatus(status: ShipmentStatus): string {
  const labels: Record<ShipmentStatus, string> = {
    pending: 'Open for Match',
    matched: 'Matched',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    delivered: 'Delivered',
  };
  return labels[status];
}

export function getNextShipmentStatus(status: ShipmentStatus): ShipmentStatus | null {
  switch (status) {
    case 'pending':
      return 'matched';
    case 'matched':
      return 'picked_up';
    case 'picked_up':
      return 'in_transit';
    case 'in_transit':
      return 'delivered';
    case 'delivered':
      return null;
  }
}

export function getHubLabel(hubId: string, hubs: HubInfo[]): string {
  const found = hubs.find((h) => h.id === hubId);
  return found ? found.name : hubId;
}

export function formatShortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
