# Spec 02: Architecture & REST API Contract

## 1. Monorepo Structure
```
UnterB2B/
├── package.json              # npm workspaces + root dev/build/test scripts
├── packages/
│   ├── backend/              # Express + TypeScript + SQLite + AI Services
│   │   ├── src/
│   │   │   ├── db/           # SQLite schema, connection, deterministic seed
│   │   │   ├── prompts/      # AI system prompt module
│   │   │   ├── services/     # AI estimator, 3D trunk matcher, analytics
│   │   │   ├── routes/       # REST controllers + Zod request validation
│   │   │   ├── types/        # Shared TypeScript domain interfaces
│   │   │   └── app.ts        # Express app + CORS + error middleware
│   └── frontend/             # React 19 + TypeScript + Vite + CSS Modules
│       ├── src/
│       │   ├── api/          # Typed REST client
│       │   ├── components/   # Reusable UI, SVG charts, 3D Trunk Visualizer, Map
│       │   ├── views/        # Business Dashboard views & Courier App view
│       │   └── styles/       # tokens.css + global reset
```

## 2. REST API Endpoints (`/api`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service status, SQLite check, active AI engine mode (`llm` or `deterministic-ai`) |
| `GET` | `/api/analytics` | KPIs, 12-month Outbound vs. Inbound volume/spend series, fit rate, CO2 saved |
| `POST` | `/api/ai/estimate` | Parses plain-text cargo description -> returns 3D estimate + ranked physical trunk matches |
| `GET` | `/api/ai/prompt` | Returns active `CARGO_ESTIMATOR_SYSTEM_PROMPT` & JSON schema for transparency |
| `GET` | `/api/hubs` | List Tricity hubs and distance matrix |
| `GET` | `/api/shipments` | List shipments (`?direction=outbound|inbound&status=...&courierId=...`) |
| `GET` | `/api/shipments/:id` | Get single shipment details |
| `POST` | `/api/shipments` | Create new Outbound or Inbound shipment |
| `PATCH` | `/api/shipments/:id/status` | Update shipment status and/or assign courier |
| `DELETE` | `/api/shipments/:id` | Delete/cancel a shipment |
| `GET` | `/api/couriers` | List couriers; accepts optional `?lengthCm=&widthCm=&heightCm=&weightKg=` to compute live physical fit |
| `POST` | `/api/couriers/:id/request-inbound` | Book an available courier heading toward the business for an Inbound pickup |

## 3. CORS & Error Handling
- CORS configured explicitly from `process.env.CORS_ORIGIN` (default `http://localhost:5173`, also allowing `http://127.0.0.1:5173`).
- All payloads validated with **Zod**; validation errors return HTTP `400` with structured field details.
- Missing resources return HTTP `404`; invalid state transitions return HTTP `409`.
