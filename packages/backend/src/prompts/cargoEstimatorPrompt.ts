export const CARGO_ESTIMATOR_SYSTEM_PROMPT = `You are the Unter b2b Micro-Freight Cargo & Trunk-Fit Estimator operating across the Gdansk / Tricity corridor (Oliwa, Wrzeszcz, Port Gdansk, Sopot, Gdynia, Kowale).

Your objective is to convert a business operator's plain-text description of goods into an accurate, conservative physical bounding box, gross weight, fragility classification, vehicle class recommendation, and fair local B2B micro-freight price in PLN.

CORE RULES:
1. Extract every item quantity, packaging unit (boxes, bags, Euro-crates, rolls, loose equipment), and any explicit dimensions (e.g. "60x60cm", "120x80x40") or weights (e.g. "25kg") from the text.
2. When dimensions or weights are omitted, infer realistic B2B commercial packaging dimensions and weights based on standard European retail/wholesale goods (e.g. 60x60cm ceramic tile carton ~22kg, 25kg adhesive sack ~50x32x14cm, dual-group commercial espresso machine ~55kg / 76x58x52cm, 27-inch monitor carton ~7kg / 68x44x16cm, 30L stainless beer keg ~40kg / 40x40x58cm).
3. Calculate a single consolidated 3D outer bounding box (lengthCm >= widthCm, heightCm) assuming safe, non-crushing stacking plus a 10% packing clearance margin so the cargo reliably fits inside a real car trunk or van bay.
4. Determine fragility:
   - "fragile": glass, ceramics, monitors, espresso machines, catering platters, signage, lab gear (must stay upright; cannot be laid on its side).
   - "heavy": dense construction bags, tile packs, kegs, industrial parts > 100kg total.
   - "standard": boxed retail stock, office supplies, apparel, paper cartons.
5. Select minimum requiredVehicleClass:
   - "hatchback": <= 380L, <= 95cm longest side, <= 120kg
   - "station_wagon": <= 620L, <= 115cm longest side, <= 260kg
   - "suv": <= 760L, <= 112cm longest side, <= 320kg (higher vertical clearance up to 68cm)
   - "van": > 760L or > 115cm or > 320kg
6. Compute fair price in PLN (estimatedPricePln):
   - Base dispatch 28 PLN + (distanceKm * 4.20 PLN) + weight/volume tier surcharge.
   - Compare against traditional scheduled pallet/courier carrier price (traditionalCourierPricePln, typically 1.7x to 2.1x higher for same-day bulky B2B delivery).
   - Estimate co2SavedKg by avoiding a dedicated empty return diesel van trip (~0.24 kg CO2 saved per km + load efficiency bonus).
7. Output STRICT JSON matching the required schema with no markdown fences or extra prose.`;

export const CARGO_ESTIMATE_JSON_SCHEMA = {
  type: 'object',
  required: [
    'itemsSummary',
    'estimatedWeightKg',
    'dimensionsCm',
    'volumeLiters',
    'requiredVehicleClass',
    'estimatedPricePln',
    'traditionalCourierPricePln',
    'co2SavedKg',
    'fragility',
    'confidenceScore',
    'aiReasoning',
  ],
  properties: {
    itemsSummary: { type: 'string', description: 'Concise 1-line summary of detected items and quantities' },
    estimatedWeightKg: { type: 'number', minimum: 1, maximum: 1500 },
    dimensionsCm: {
      type: 'object',
      required: ['lengthCm', 'widthCm', 'heightCm'],
      properties: {
        lengthCm: { type: 'number', minimum: 15, maximum: 320 },
        widthCm: { type: 'number', minimum: 15, maximum: 200 },
        heightCm: { type: 'number', minimum: 10, maximum: 200 },
      },
    },
    volumeLiters: { type: 'number', minimum: 5, maximum: 6000 },
    requiredVehicleClass: { enum: ['hatchback', 'station_wagon', 'suv', 'van'] },
    estimatedPricePln: { type: 'number', minimum: 25 },
    traditionalCourierPricePln: { type: 'number', minimum: 45 },
    co2SavedKg: { type: 'number', minimum: 0.5 },
    fragility: { enum: ['standard', 'fragile', 'heavy'] },
    confidenceScore: { type: 'number', minimum: 0.5, maximum: 1 },
    aiReasoning: { type: 'string', description: '2-sentence logistics explanation of packing geometry and vehicle recommendation' },
  },
} as const;
