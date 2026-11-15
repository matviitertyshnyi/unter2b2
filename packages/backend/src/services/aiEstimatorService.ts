import { z } from 'zod';
import { CARGO_ESTIMATOR_SYSTEM_PROMPT } from '../prompts/cargoEstimatorPrompt.js';
import { CargoEstimate, FragilityLevel, VehicleClass } from '../types/domain.js';

export const CargoEstimateResultSchema = z.object({
  itemsSummary: z.string().min(3).max(160),
  estimatedWeightKg: z.number().min(1).max(1500),
  dimensionsCm: z.object({
    lengthCm: z.number().min(1).max(320),
    widthCm: z.number().min(1).max(200),
    heightCm: z.number().min(1).max(200),
  }),
  volumeLiters: z.number().min(1).max(10000),
  requiredVehicleClass: z.enum(['hatchback', 'station_wagon', 'suv', 'van']),
  estimatedPricePln: z.number().min(1).max(10000),
  traditionalCourierPricePln: z.number().min(45).max(5000),
  co2SavedKg: z.number().min(0.4).max(100),
  fragility: z.enum(['standard', 'fragile', 'heavy']),
  confidenceScore: z.number().min(0.5).max(1),
  aiReasoning: z.string().min(10).max(420),
});

interface CatalogRule {
  keywords: RegExp;
  label: string;
  unitWeightKg: number;
  unitDimsCm: [number, number, number];
  fragility: FragilityLevel;
}

const CARGO_CATALOG: CatalogRule[] = [
  {
    keywords: /\b(tile|tiles|ceramic|gres|płytk|porcelain)\b/i,
    label: 'ceramic tile boxes',
    unitWeightKg: 18,
    unitDimsCm: [62, 62, 7],
    fragility: 'heavy',
  },
  {
    keywords: /\b(adhesive|mortar|cement|klej|zapraw|plaster|grout)\b/i,
    label: 'material bags',
    unitWeightKg: 25,
    unitDimsCm: [52, 34, 14],
    fragility: 'heavy',
  },
  {
    keywords: /\b(coffee|beans|bean sacks)\b/i,
    label: 'coffee bean sacks',
    unitWeightKg: 6,
    unitDimsCm: [40, 28, 16],
    fragility: 'standard',
  },
  {
    keywords: /\b(espresso|coffee machine|ekspres)\b/i,
    label: 'commercial espresso machines',
    unitWeightKg: 52,
    unitDimsCm: [74, 58, 54],
    fragility: 'fragile',
  },
  {
    keywords: /\b(monitor|monitors|screen|display|ekran)\b/i,
    label: 'boxed monitors',
    unitWeightKg: 7.5,
    unitDimsCm: [68, 44, 16],
    fragility: 'fragile',
  },
  {
    keywords: /\b(chair|chairs|desk|desks|fotel|krzes|biurk)\b/i,
    label: 'office furniture units',
    unitWeightKg: 19,
    unitDimsCm: [76, 68, 66],
    fragility: 'standard',
  },
  {
    keywords: /\b(keg|kegs|beczk|barrel)\b/i,
    label: 'stainless 30L kegs',
    unitWeightKg: 40,
    unitDimsCm: [40, 40, 58],
    fragility: 'heavy',
  },
  {
    keywords: /\b(catering|cambro|thermal|food|lunch|tray|trays)\b/i,
    label: 'insulated catering containers',
    unitWeightKg: 11,
    unitDimsCm: [60, 40, 32],
    fragility: 'fragile',
  },
  {
    keywords: /\b(euro-?crate|crates|produce|greens|skrzynk)\b/i,
    label: 'Euro-crates',
    unitWeightKg: 12,
    unitDimsCm: [60, 40, 22],
    fragility: 'standard',
  },
  {
    keywords: /\b(paint|farb|bucket|buckets|wiadro|oil)\b/i,
    label: 'industrial buckets',
    unitWeightKg: 16,
    unitDimsCm: [34, 34, 38],
    fragility: 'heavy',
  },
  {
    keywords: /\b(paper|brochure|catalog|print|ulotk|katalog|repro)\b/i,
    label: 'print paper cartons',
    unitWeightKg: 12.5,
    unitDimsCm: [44, 32, 24],
    fragility: 'standard',
  },
  {
    keywords: /\b(roll-?up|banner|stand|display stand)\b/i,
    label: 'display banners',
    unitWeightKg: 4.5,
    unitDimsCm: [90, 14, 14],
    fragility: 'standard',
  },
  {
    keywords: /\b(tire|tires|tyre|tyres|opon|wheel|rim)\b/i,
    label: 'automotive tires',
    unitWeightKg: 11,
    unitDimsCm: [66, 66, 24],
    fragility: 'standard',
  },
  {
    keywords: /\b(glass|glassware|mirror|szkł|bottle|bottles|wine)\b/i,
    label: 'fragile glass crates',
    unitWeightKg: 14,
    unitDimsCm: [48, 36, 32],
    fragility: 'fragile',
  },
  {
    keywords: /\b(server|rack|ups|network|switch|battery)\b/i,
    label: 'IT hardware units',
    unitWeightKg: 22,
    unitDimsCm: [76, 54, 24],
    fragility: 'fragile',
  },
  {
    keywords: /\b(pallet|palet|eur pallet)\b/i,
    label: 'Euro-pallet load',
    unitWeightKg: 260,
    unitDimsCm: [120, 80, 95],
    fragility: 'heavy',
  },
];

function classifyVehicle(dims: { lengthCm: number; widthCm: number; heightCm: number }, weightKg: number): VehicleClass {
  const volL = Math.round((dims.lengthCm * dims.widthCm * dims.heightCm) / 1000);
  const longest = Math.max(dims.lengthCm, dims.widthCm);
  if (volL <= 360 && longest <= 90 && dims.heightCm <= 46 && weightKg <= 125) {
    return 'hatchback';
  }
  if (volL <= 610 && longest <= 116 && dims.heightCm <= 58 && weightKg <= 265) {
    return 'station_wagon';
  }
  if (volL <= 760 && longest <= 112 && dims.heightCm <= 67 && weightKg <= 320) {
    return 'suv';
  }
  return 'van';
}

function extractExplicitDimensions(text: string): { lengthCm: number; widthCm: number; heightCm: number } | null {
  const match3d = text.match(/(\d{2,3})\s*[x×*]\s*(\d{2,3})\s*[x×*]\s*(\d{2,3})\s*(cm)?/i);
  if (match3d) {
    const nums = [Number(match3d[1]), Number(match3d[2]), Number(match3d[3])];
    return {
      lengthCm: Math.min(280, Math.max(15, Math.max(nums[0], nums[1]))),
      widthCm: Math.min(180, Math.max(15, Math.min(nums[0], nums[1]))),
      heightCm: Math.min(160, Math.max(10, nums[2])),
    };
  }
  return null;
}

function extractLeadingCountNear(text: string, matchIndex: number): number {
  const window = text.slice(Math.max(0, matchIndex - 32), matchIndex);
  const afterBoundary = window.split(/\b(?:and|plus|with|,|\+)\b/i).pop() ?? window;
  // Strip size/capacity modifiers (e.g., "27-inch", "60x60cm", "30L", "25kg") before reading item quantity
  const cleaned = afterBoundary.replace(/\b\d+\s*(?:-|x|×)?\s*(?:\d+\s*)?(?:inch|in|cm|mm|kg|l|liters?)\b/gi, '');
  const nums = cleaned.match(/\b(\d{1,3})\b/g);
  if (nums && nums.length > 0) {
    return Math.min(80, Math.max(1, Number(nums[nums.length - 1])));
  }
  return 1;
}

export function runDeterministicCargoEstimator(
  description: string,
  distanceKm: number
): CargoEstimate {
  const cleanText = description.trim();
  const explicitWeightMatch = cleanText.match(/(\d{1,4})\s*kg\b/i);
  const explicitDims = extractExplicitDimensions(cleanText);

  const matchedItems: Array<{ rule: CatalogRule; count: number }> = [];
  for (const rule of CARGO_CATALOG) {
    const match = rule.keywords.exec(cleanText);
    if (match) {
      // Skip inner contents when preceded directly by a matched container phrase like "Euro-crates of coffee"
      const precedingSlice = cleanText.slice(Math.max(0, match.index - 32), match.index);
      const isContainedInPrevious =
        matchedItems.length > 0 && /\b(?:crates?|boxes|cartons?|pallets?)\s+of\b/i.test(precedingSlice);
      if (isContainedInPrevious) {
        continue;
      }
      matchedItems.push({
        rule,
        count: extractLeadingCountNear(cleanText, match.index),
      });
    }
  }

  let totalWeightKg = 0;
  let totalVolumeCm3 = 0;
  let maxUnitL = 45;
  let maxUnitW = 35;
  let maxUnitH = 28;
  let fragility: FragilityLevel = 'standard';
  const summaryParts: string[] = [];

  if (matchedItems.length > 0) {
    for (const { rule, count } of matchedItems) {
      totalWeightKg += rule.unitWeightKg * count;
      const [uL, uW, uH] = rule.unitDimsCm;
      totalVolumeCm3 += uL * uW * uH * count;
      maxUnitL = Math.max(maxUnitL, uL);
      maxUnitW = Math.max(maxUnitW, uW);
      maxUnitH = Math.max(maxUnitH, uH);
      if (rule.fragility === 'fragile') {
        fragility = 'fragile';
      } else if (rule.fragility === 'heavy' && fragility !== 'fragile') {
        fragility = 'heavy';
      }
      summaryParts.push(`${count}x ${rule.label}`);
    }
  } else {
    const genericCountMatch = cleanText.match(/\b(\d{1,3})\s*(box|boxes|carton|cartons|pack|packs|unit|units|pcs)\b/i);
    const count = genericCountMatch ? Math.min(60, Math.max(1, Number(genericCountMatch[1]))) : 4;
    totalWeightKg = count * 14;
    totalVolumeCm3 = count * (48 * 36 * 28);
    maxUnitL = 52;
    maxUnitW = 38;
    maxUnitH = 30;
    summaryParts.push(`${count}x commercial cargo units`);
  }

  if (explicitWeightMatch && matchedItems.length <= 1) {
    const rawKg = Number(explicitWeightMatch[1]);
    const itemCount = matchedItems[0]?.count ?? 1;
    // Detect whether user wrote per-unit weight ("25kg bags") vs total weight ("180kg total")
    if (/\btotal\b/i.test(cleanText) || rawKg >= 65) {
      totalWeightKg = rawKg;
    } else if (itemCount > 1) {
      totalWeightKg = rawKg * itemCount;
    }
  }

  // Pack items into a realistic 3D footprint with 10% clearance
  const clearanceFactor = 1.1;
  let lengthCm: number;
  let widthCm: number;
  let heightCm: number;

  if (explicitDims && matchedItems.length === 0) {
    lengthCm = Math.round(explicitDims.lengthCm * clearanceFactor);
    widthCm = Math.round(explicitDims.widthCm * clearanceFactor);
    heightCm = Math.round(explicitDims.heightCm * clearanceFactor);
  } else {
    const packedVolumeCm3 = totalVolumeCm3 * 1.15;
    const baseFootprintL = Math.max(maxUnitL, Math.min(220, Math.round(Math.cbrt(packedVolumeCm3 * 2.5))));
    const baseFootprintW = Math.max(maxUnitW, Math.min(145, Math.round(Math.cbrt(packedVolumeCm3 * 1.5))));
    const computedH = Math.ceil(packedVolumeCm3 / (baseFootprintL * baseFootprintW));
    lengthCm = Math.min(260, Math.max(maxUnitL, baseFootprintL));
    widthCm = Math.min(165, Math.max(maxUnitW, baseFootprintW));
    heightCm = Math.min(140, Math.max(maxUnitH, computedH));
    if (lengthCm < widthCm) {
      [lengthCm, widthCm] = [widthCm, lengthCm];
    }
  }

  const volumeLiters = Math.max(12, Math.round((lengthCm * widthCm * heightCm) / 1000));
  const roundedWeightKg = Math.max(4, Math.round(totalWeightKg));
  const requiredVehicleClass = classifyVehicle({ lengthCm, widthCm, heightCm }, roundedWeightKg);

  const classBaseFee: Record<VehicleClass, number> = {
    hatchback: 26,
    station_wagon: 34,
    suv: 38,
    van: 54,
  };

  const estimatedPricePln = Math.round(
    classBaseFee[requiredVehicleClass] + distanceKm * 4.2 + roundedWeightKg * 0.08
  );
  const traditionalCourierPricePln = Math.round(estimatedPricePln * 1.88 + 18);
  const co2SavedKg = Math.round((distanceKm * 0.24 + volumeLiters * 0.0028) * 10) / 10;

  const fragilityNote =
    fragility === 'fragile'
      ? 'Fragile load locked to upright orientation during trunk-fit rotation checks.'
      : fragility === 'heavy'
        ? 'High-density cargo kept low across max 2 layers for trunk axle safety.'
        : 'Standard packed footprint with 10% loading clearance margin included.';

  return {
    itemsSummary: summaryParts.join(' + '),
    estimatedWeightKg: roundedWeightKg,
    dimensionsCm: { lengthCm, widthCm, heightCm },
    volumeLiters,
    requiredVehicleClass,
    estimatedPricePln,
    traditionalCourierPricePln,
    co2SavedKg,
    fragility,
    confidenceScore: matchedItems.length > 0 ? 0.93 : 0.84,
    aiReasoning: `${fragilityNote} Recommended minimum vehicle class: ${requiredVehicleClass.replace('_', ' ')}.`,
    source: 'deterministic-ai',
  };
}

function stripJsonFences(rawText: string): string {
  return rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

const VALID_VEHICLE_CLASSES: ReadonlySet<string> = new Set(['hatchback', 'station_wagon', 'suv', 'van']);
const VALID_FRAGILITY_LEVELS: ReadonlySet<string> = new Set(['standard', 'fragile', 'heavy']);

function normalizeLlmCargoPayload(raw: unknown, distanceKm: number): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;
  const rawDims = (data.dimensionsCm && typeof data.dimensionsCm === 'object'
    ? data.dimensionsCm
    : {}) as Record<string, unknown>;

  const lengthCm = Math.max(5, Math.min(320, Math.round(Number(rawDims.lengthCm) || 60)));
  const widthCm = Math.max(5, Math.min(200, Math.round(Number(rawDims.widthCm) || 40)));
  const heightCm = Math.max(5, Math.min(200, Math.round(Number(rawDims.heightCm) || 35)));
  const computedVolume = Math.max(1, Math.min(10000, Math.round((lengthCm * widthCm * heightCm) / 1000)));
  const estimatedPricePln = Math.max(1, Math.min(10000, Math.round(Number(data.estimatedPricePln) || 55)));
  const fallbackTrad = Math.max(45, Math.round(estimatedPricePln * 1.85));
  const rawVehicleClass = String(data.requiredVehicleClass ?? '').trim().toLowerCase();
  const rawFragility = String(data.fragility ?? '').trim().toLowerCase();

  return {
    itemsSummary: String(data.itemsSummary ?? '').trim().slice(0, 160),
    estimatedWeightKg: Math.max(1, Math.min(1500, Math.round(Number(data.estimatedWeightKg) || 10))),
    dimensionsCm: { lengthCm, widthCm, heightCm },
    volumeLiters: Math.max(1, Math.min(10000, Math.round(Number(data.volumeLiters) || computedVolume))),
    requiredVehicleClass: VALID_VEHICLE_CLASSES.has(rawVehicleClass) ? rawVehicleClass : 'suv',
    estimatedPricePln,
    traditionalCourierPricePln: Math.max(
      45,
      Math.min(5000, Math.round(Number(data.traditionalCourierPricePln) || fallbackTrad))
    ),
    co2SavedKg: Math.max(
      0.4,
      Math.min(100, Number((Number(data.co2SavedKg) || distanceKm * 0.24 + 0.5).toFixed(1)))
    ),
    fragility: VALID_FRAGILITY_LEVELS.has(rawFragility) ? rawFragility : 'standard',
    confidenceScore: Math.max(0.5, Math.min(1, Number(data.confidenceScore) || 0.9)),
    aiReasoning: String(data.aiReasoning ?? '').trim().slice(0, 420),
  };
}

function getGeminiCandidateModels(): string[] {
  const configured = process.env.AI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  return Array.from(new Set([configured, 'gemini-3.5-flash-lite', 'gemini-3-flash-preview']));
}

async function callGeminiEstimator(description: string, distanceKm: number): Promise<CargoEstimate | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: CARGO_ESTIMATOR_SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Route distance across Gdansk/Tricity: ${distanceKm} km.`,
              `Cargo description: "${description}"`,
              'Return valid JSON only with exact keys:',
              '{',
              '  "itemsSummary": string,',
              '  "estimatedWeightKg": number,',
              '  "dimensionsCm": { "lengthCm": number, "widthCm": number, "heightCm": number },',
              '  "volumeLiters": number,',
              '  "requiredVehicleClass": "hatchback" | "station_wagon" | "suv" | "van",',
              '  "estimatedPricePln": number,',
              '  "traditionalCourierPricePln": number,',
              '  "co2SavedKg": number,',
              '  "fragility": "standard" | "fragile" | "heavy",',
              '  "confidenceScore": number,',
              '  "aiReasoning": string',
              '}',
            ].join('\n'),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  for (const model of getGeminiCandidateModels()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(7000),
      });

      if (!response.ok) continue;
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      };
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      const nonThoughtText = parts
        .filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text as string)
        .join('\n');
      const rawText = nonThoughtText || parts.find((part) => typeof part.text === 'string')?.text;
      if (!rawText) continue;

      const parsedJson = JSON.parse(stripJsonFences(rawText));
      const parsed = CargoEstimateResultSchema.safeParse(normalizeLlmCargoPayload(parsedJson, distanceKm));
      if (parsed.success) {
        return { ...parsed.data, source: 'llm' };
      }
    } catch {
      // Try next model if request or parsing failed
    }
  }

  return null;
}

async function callOpenAiEstimator(description: string, distanceKm: number): Promise<CargoEstimate | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CARGO_ESTIMATOR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Route distance across Gdansk/Tricity: ${distanceKm} km.\nCargo description: "${description}"\nReturn valid JSON only.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = payload.choices?.[0]?.message?.content;
  if (!rawText) return null;

  const parsed = CargoEstimateResultSchema.safeParse(JSON.parse(rawText));
  if (!parsed.success) return null;
  return { ...parsed.data, source: 'llm' };
}

export function getActiveAiProviderMode(): 'llm' | 'deterministic-ai' {
  if (process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()) {
    return 'llm';
  }
  return 'deterministic-ai';
}

export async function estimateCargoFromText(
  description: string,
  distanceKm: number
): Promise<CargoEstimate> {
  try {
    const geminiResult = await callGeminiEstimator(description, distanceKm);
    if (geminiResult) return geminiResult;

    const openAiResult = await callOpenAiEstimator(description, distanceKm);
    if (openAiResult) return openAiResult;
  } catch {
    // Transparently fall back to deterministic AI engine if external LLM is unreachable
  }

  return runDeterministicCargoEstimator(description, distanceKm);
}
