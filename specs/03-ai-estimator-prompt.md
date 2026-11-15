# Spec 03: AI Cargo Estimator & 3D Trunk-Fit Algorithm

## 1. System Prompt Design (`CARGO_ESTIMATOR_SYSTEM_PROMPT`)
The in-app AI agent acts as a **B2B Micro-Freight Logistics & Packaging Estimator** operating in Gdańsk / Tricity.

### Prompt Responsibilities
1. **Extract Structured Quantities & Units:** Identify item counts, packaging types (boxes, bags, Euro-crates, pallets, loose appliances), and any explicit measurements (`60x60cm`, `25kg`) in the plain-text request.
2. **Infer Realistic Dimensions & Weight:** Estimate realistic outer packaged dimensions `(lengthCm, widthCm, heightCm)` and total gross weight (`estimatedWeightKg`) including safe stacking efficiency (typically 1.10x–1.18x clearance factor for irregular items).
3. **Determine Handling Profile:** Classify fragility (`standard`, `fragile`, `heavy`) so fragile items (monitors, espresso machines, glass) forbid laying flat on their side during trunk-fit rotation checks.
4. **Calculate Fair B2B Micro-Freight Price (`PLN`):**
   - Base dispatch fee + distance fee (`km * rate`) + weight/bulk factor.
   - Always calculate comparison price against standard commercial next-day pallet/van courier rates so businesses see concrete savings, plus `co2SavedKg` based on utilizing existing commuter trunk capacity instead of dispatching an empty diesel van.
5. **Strict JSON Output:** Return strictly typed JSON validated by Zod on the server.

## 2. Hybrid Execution Guarantee
- **Live LLM Mode:** When `GEMINI_API_KEY` or `OPENAI_API_KEY` is configured in `.env`, the backend sends the system prompt + user cargo description to the LLM with `response_format` / JSON parsing and Zod validation.
- **Deterministic AI Fallback Mode:** When no external API key is present (for instant reviewer evaluation), a structured logistics parser extracts item categories, quantities, explicit dimensions/weights, packing geometry, and PLN pricing deterministically with identical JSON schema and human-readable reasoning.

## 3. Physical 3D Trunk-Fit Matching Algorithm
Given cargo box `(cL, cW, cH)` and weight `W`, and courier trunk `(tL, tW, tH)` with `maxWeightKg`:
1. Reject immediately if `W > maxWeightKg`.
2. Check axis orientations:
   - If `fragile === 'fragile'`: upright height `cH` stays fixed against `tH`, while footprint `(cL, cW)` may rotate 90 degrees in the horizontal plane `(tL, tW)`.
   - Otherwise: test all 6 orthogonal 3D orientations `[cL, cW, cH]` against sorted `[tL, tW, tH]`.
3. Compute `volumeUtilizationPct = (cargoVolume / trunkVolume) * 100`.
4. Score compatible vehicles from `0` to `100`, rewarding snug capacity utilization (`45%–85%` avoids wasting a large van on a small load) and close hub proximity.
