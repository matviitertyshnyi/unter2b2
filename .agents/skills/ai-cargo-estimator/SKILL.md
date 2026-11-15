---
name: ai-cargo-estimator
description: Design, prompt, test, and maintain the plain-text AI Cargo & 3D Trunk-Fit Estimator in Unter b2b.
---

# AI Cargo & Trunk-Fit Estimator Skill

When working on cargo estimation or vehicle matching:

1. **System Prompt Ownership:**
   - Keep the authoritative prompt in `packages/backend/src/prompts/cargoEstimatorPrompt.ts` and document changes in `specs/03-ai-estimator-prompt.md`.
2. **Structured Output Contract:**
   - Both live LLM responses (Gemini / OpenAI) and the deterministic AI fallback must pass the same Zod schema:
     `itemsSummary`, `estimatedWeightKg`, `dimensionsCm` (`lengthCm`, `widthCm`, `heightCm`), `volumeLiters`, `requiredVehicleClass`, `estimatedPricePln`, `traditionalCourierPricePln`, `co2SavedKg`, `fragility`, `confidenceScore`, and `aiReasoning`.
3. **Physical 3D Trunk-Fit Guarantee:**
   - Reject any courier whose `maxWeightKg < estimatedWeightKg`.
   - When `fragility === 'fragile'`, keep cargo height upright against trunk `heightCm` and only allow horizontal 90-degree rotation.
   - When `fragility !== 'fragile'`, test orthogonal 3D orientations against trunk `(lengthCm, widthCm, heightCm)`.
   - Never display a courier as compatible if any axis exceeds trunk interior geometry.
