import { HubInfo } from '../types/api';

export interface MapPin {
  mapX: number;
  mapY: number;
  hubId: string;
  address: string;
}

interface StreetAnchor {
  keywords: string[];
  streetLabel: string;
  district: string;
  hubId: string;
  mapX: number;
  mapY: number;
}

const TRICITY_ANCHORS: StreetAnchor[] = [
  {
    keywords: ['swietojanska', 'gdynia', 'skwer', 'kosciuszki', 'portowa', 'stocznia gdynia'],
    streetLabel: 'ul. Świętojańska',
    district: 'Gdynia Śródmieście',
    hubId: 'gdynia',
    mapX: 165,
    mapY: 75,
  },
  {
    keywords: ['morska', 'chylonia', 'kwiatkowskiego', 'grabowek'],
    streetLabel: 'ul. Morska',
    district: 'Gdynia Grabówek',
    hubId: 'gdynia',
    mapX: 118,
    mapY: 56,
  },
  {
    keywords: ['orlowo', 'redlowo', 'al. zwyciestwa', 'zwyciestwa'],
    streetLabel: 'al. Zwycięstwa',
    district: 'Gdynia Orłowo',
    hubId: 'gdynia',
    mapX: 255,
    mapY: 108,
  },
  {
    keywords: ['monte cassino', 'monciak', 'molo', 'powstancow', 'marina'],
    streetLabel: 'ul. Bohaterów Monte Cassino',
    district: 'Sopot Centrum',
    hubId: 'sopot',
    mapX: 335,
    mapY: 132,
  },
  {
    keywords: ['niepodleglosci', 'sopot', 'kamienny potok', 'karlikowo'],
    streetLabel: 'al. Niepodległości',
    district: 'Sopot',
    hubId: 'sopot',
    mapX: 330,
    mapY: 145,
  },
  {
    keywords: ['olivia', 'grunwaldzka 47', 'oliwa', 'opacka', 'al. grunwaldzka'],
    streetLabel: 'al. Grunwaldzka',
    district: 'Gdańsk Oliwa',
    hubId: 'olivia',
    mapX: 435,
    mapY: 195,
  },
  {
    keywords: ['przymorze', 'kolobrzeska', 'obroncow wybrzeza', 'ergo'],
    streetLabel: 'ul. Kołobrzeska',
    district: 'Gdańsk Przymorze',
    hubId: 'olivia',
    mapX: 478,
    mapY: 175,
  },
  {
    keywords: ['brzezno', 'hallera', 'al. hallera', 'zaspa'],
    streetLabel: 'al. gen. Józefa Hallera',
    district: 'Gdańsk Zaspa / Brzeźno',
    hubId: 'wrzeszcz',
    mapX: 562,
    mapY: 196,
  },
  {
    keywords: ['garnizon', 'slowackiego', 'wrzeszcz', 'wajdeloty', 'partyzantow', 'galerii baltyckiej'],
    streetLabel: 'ul. Juliusza Słowackiego',
    district: 'Gdańsk Wrzeszcz',
    hubId: 'wrzeszcz',
    mapX: 545,
    mapY: 255,
  },
  {
    keywords: ['oliwska', 'nowy port', 'port', 'marynarki polskiej', 'terminal'],
    streetLabel: 'ul. Oliwska',
    district: 'Port Gdańsk',
    hubId: 'port',
    mapX: 690,
    mapY: 215,
  },
  {
    keywords: ['elektrykow', 'stocznia', 'srodmiescie', 'dlugi targ', 'dlugie', 'motlawa', 'gdansk glowny'],
    streetLabel: 'ul. Elektryków',
    district: 'Gdańsk Śródmieście',
    hubId: 'port',
    mapX: 625,
    mapY: 272,
  },
  {
    keywords: ['kowale', 'magnacka', 'obwodnica', 's6', 'borkowo', 'swietego wojciecha'],
    streetLabel: 'ul. Magnacka',
    district: 'Kowale Logistics Park',
    hubId: 'kowale',
    mapX: 505,
    mapY: 350,
  },
];

function stripDiacritics(input: string): string {
  return input
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clampCoord(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function getHubCoordinates(hubId: string, hubs: HubInfo[]): { mapX: number; mapY: number } {
  const hub = hubs.find((h) => h.id === hubId) ?? hubs[0];
  return hub ? { mapX: hub.mapX, mapY: hub.mapY } : { mapX: 435, mapY: 195 };
}

export function findNearestHubId(mapX: number, mapY: number, hubs: HubInfo[]): string {
  if (hubs.length === 0) return 'olivia';
  let best = hubs[0];
  let bestDist = Infinity;
  for (const h of hubs) {
    const dist = (h.mapX - mapX) ** 2 + (h.mapY - mapY) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = h;
    }
  }
  return best.id;
}

export function resolveAddressToPin(
  address: string,
  hubs: HubInfo[],
  fallbackHubId: string
): { mapX: number; mapY: number; hubId: string; matched: boolean } {
  const clean = stripDiacritics(address.trim());
  const numMatch = clean.match(/\d+/);
  const houseNum = numMatch ? Number(numMatch[0]) : 0;
  // Deterministic micro-offset so street numbers visibly nudge the pin along the road
  const offsetX = houseNum ? ((houseNum * 7) % 24) - 12 : 0;
  const offsetY = houseNum ? ((houseNum * 5) % 18) - 9 : 0;

  if (clean.length >= 2) {
    for (const anchor of TRICITY_ANCHORS) {
      if (anchor.keywords.some((kw) => clean.includes(kw))) {
        return {
          mapX: clampCoord(anchor.mapX + offsetX, 32, 788),
          mapY: clampCoord(anchor.mapY + offsetY, 26, 376),
          hubId: anchor.hubId,
          matched: true,
        };
      }
    }

    for (const hub of hubs) {
      const hubText = stripDiacritics(`${hub.name} ${hub.district} ${hub.sampleAddress}`);
      const tokens = clean.split(/[\s,.-]+/).filter((t) => t.length >= 4);
      if (tokens.some((tok) => hubText.includes(tok))) {
        return {
          mapX: clampCoord(hub.mapX + offsetX, 32, 788),
          mapY: clampCoord(hub.mapY + offsetY, 26, 376),
          hubId: hub.id,
          matched: true,
        };
      }
    }
  }

  const fallback = getHubCoordinates(fallbackHubId, hubs);
  return {
    mapX: fallback.mapX,
    mapY: fallback.mapY,
    hubId: fallbackHubId,
    matched: false,
  };
}

export function resolvePinToAddress(
  rawX: number,
  rawY: number,
  hubs: HubInfo[]
): MapPin {
  const mapX = clampCoord(rawX, 24, 796);
  const mapY = clampCoord(rawY, 24, 376);

  let bestAnchor = TRICITY_ANCHORS[0];
  let bestDist = Infinity;
  for (const anchor of TRICITY_ANCHORS) {
    const dist = (anchor.mapX - mapX) ** 2 + (anchor.mapY - mapY) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestAnchor = anchor;
    }
  }

  const hubId = findNearestHubId(mapX, mapY, hubs);
  const streetNum = Math.max(1, Math.round(((mapX * 3 + mapY * 5) % 140) + 4));

  return {
    mapX,
    mapY,
    hubId,
    address: `${bestAnchor.streetLabel} ${streetNum}, ${bestAnchor.district}`,
  };
}

export function calculatePinDistanceKm(
  a: { mapX: number; mapY: number },
  b: { mapX: number; mapY: number }
): number {
  const dx = b.mapX - a.mapX;
  const dy = b.mapY - a.mapY;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  const roadKm = (pixelDist / 41) * 1.32;
  return Math.max(1.4, Math.round(roadKm * 10) / 10);
}
