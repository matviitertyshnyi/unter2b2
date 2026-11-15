---
name: backend-layered-api
description: Enforce clean layered REST API architecture (Routes -> Services -> Prompts -> SQLite DB), Zod validation, and explicit CORS in packages/backend.
---

# Backend Layered API Skill

When adding or modifying endpoints in `packages/backend`:

1. **Follow Layer Boundaries:**
   - `src/types/`: Domain TypeScript interfaces and shared DTO types.
   - `src/db/`: SQLite initialization, schema DDL, seeded Gdańsk/Tricity dataset, and repository helpers.
   - `src/prompts/`: Isolated AI system prompts and schema contracts.
   - `src/services/`: Business logic (AI estimation, 3D trunk-fit geometry, analytics aggregation).
   - `src/routes/`: Express route handlers with Zod request validation and clean HTTP status codes (`200`, `201`, `400`, `404`, `409`).
2. **Never put SQL queries or estimation math inside route handlers.**
3. **Validate every request body and query parameter with Zod** before passing data to services.
4. **Maintain full CRUD** on core resources (`/api/shipments`, `/api/couriers`, `/api/ai/estimate`) and explicit CORS origin allowlisting.
5. **Add or update `node:test` unit tests** under `src/__tests__/` for every new business rule.
