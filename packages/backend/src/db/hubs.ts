import { HubInfo } from '../types/domain.js';

export const TRICITY_HUBS: HubInfo[] = [
  {
    id: 'olivia',
    name: 'Olivia Business Centre',
    district: 'Gdańsk Oliwa',
    sampleAddress: 'al. Grunwaldzka 472B, 80-309 Gdańsk',
    lat: 54.4032,
    lng: 18.5714,
    mapX: 435,
    mapY: 195,
  },
  {
    id: 'wrzeszcz',
    name: 'Garnizon / Wrzeszcz',
    district: 'Gdańsk Wrzeszcz',
    sampleAddress: 'ul. Juliusza Słowackiego 19, 80-257 Gdańsk',
    lat: 54.3821,
    lng: 18.5988,
    mapX: 545,
    mapY: 255,
  },
  {
    id: 'port',
    name: 'Port Gdańsk / Nowy Port',
    district: 'Gdańsk Port',
    sampleAddress: 'ul. Oliwska 35, 80-563 Gdańsk',
    lat: 54.4055,
    lng: 18.6684,
    mapX: 690,
    mapY: 215,
  },
  {
    id: 'sopot',
    name: 'Sopot Centrum',
    district: 'Sopot',
    sampleAddress: 'al. Niepodległości 742, 81-840 Sopot',
    lat: 54.4416,
    lng: 18.5601,
    mapX: 330,
    mapY: 140,
  },
  {
    id: 'gdynia',
    name: 'Gdynia Śródmieście',
    district: 'Gdynia',
    sampleAddress: 'ul. Świętojańska 44, 81-391 Gdynia',
    lat: 54.5189,
    lng: 18.5388,
    mapX: 165,
    mapY: 75,
  },
  {
    id: 'kowale',
    name: 'Kowale Logistics Park',
    district: 'Gdańsk Południe',
    sampleAddress: 'ul. Magnacka 15, 80-180 Kowale',
    lat: 54.3168,
    lng: 18.5542,
    mapX: 505,
    mapY: 350,
  },
];

export function getHubById(id: string): HubInfo {
  return TRICITY_HUBS.find((hub) => hub.id === id) ?? TRICITY_HUBS[0];
}

export function getRouteDistanceKm(fromHubId: string, toHubId: string): number {
  if (fromHubId === toHubId) {
    return 2.8;
  }
  const from = getHubById(fromHubId);
  const to = getHubById(toHubId);

  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2;
  const straightKm = 2 * 6371 * Math.asin(Math.sqrt(a));
  // Urban road detour multiplier across Tricity arterial routes
  return Math.round(straightKm * 1.32 * 10) / 10;
}

export function getDistanceFromMapCoordsKm(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  // 820x400 schematic map spans ~28 km across Tricity corridor
  const roadKm = (pixelDist / 41) * 1.32;
  return Math.max(1.4, Math.round(roadKm * 10) / 10);
}
