# Unter b2b

**Crowd-Sourced B2B Micro-Freight & 3D Trunk-Fit Platform (Gdańsk / Tricity)**

> Recruitment Full-Stack MVP built for **Xelerit**.

![Unter b2b Demo](./docs/demo.mp4) 
or use link:
https://drive.google.com/file/d/1hTFI-NMLmSaZKpL7u2MouFkJNhpuM9eA/view?usp=drive_link

---

## 1. Application Overview

**Unter b2b** connects local businesses in **Gdańsk, Sopot, and Gdynia** needing same-day, bulky B2B deliveries (20–350 kg) with everyday drivers who already have unused trunk space in their station wagons, SUVs, hatchbacks, or vans.

### Core Capabilities

1. **Plain-Text AI Cargo & 3D Trunk-Fit Estimator:**
   - Businesses describe goods in plain text (for example: *"10 boxes of ceramic tiles 60x60cm and 3 bags of adhesive 25kg"*).
   - The AI Estimator calculates gross weight (`kg`), consolidated 3D bounding box (`Length × Width × Height cm`), volume (`L`), fragility/upright constraint, fair `PLN (zł)` price vs. traditional pallet carriers, and `CO₂` avoided.
   - An interactive **3D Isometric SVG Trunk-Fit Visualizer** renders the cargo box inside each candidate vehicle's cargo bay and filters out vehicles whose trunk geometry or payload cannot physically carry the load.
2. **Bidirectional Micro-Freight & Interactive Map Pinning (Outbound + Inbound):**
   - **Outbound & Inbound Orders:** Send goods out or request passing drivers to pick up supplies into your business.
   - **Map Pinning & Street Address Geocoding:** Drop Pickup (`A`) and Delivery (`B`) pins directly on the **Tricity Corridor Map** (`Port Gdańsk <-> Wrzeszcz <-> Olivia Business Centre <-> Sopot <-> Gdynia`) or type a street address to snap the pin and recalculate route distance live.
3. **Courier Profiles, Direct Text Chat & Live Busy GPS Tracking:**
   - Selecting any courier opens their driver profile, phone/bio specs, and direct two-way text chat.
   - Busy drivers display a real-time corridor position marker, active route dashed vector, and live GPS street banner on the map.
4. **Unified 50/50 Single-App Experience + Light/Dark Theme Switcher:**
   - **Top Header Theme Toggle:** Switch between Square-inspired Light mode and high-contrast Uber-inspired Dark mode directly next to the `Gdansk / Tricity` pill (`[data-theme="dark"]`).
   - **Business Dashboard Mode:** **Home** tab to create Outbound or Inbound orders with AI cargo estimation, map pinning, and driver messaging; **Available Couriers** board with corridor map + driver profiles; **Orders** CRUD ledger; and **Finances** analytics.
   - **Courier App Mode:** Driver status toggle (`Available` / `Busy`), live driver + order Pickup (`A`) / Delivery (`B`) corridor map, street-addressed order cards, 3D Trunk Geometry visualizer, and dispatch message inbox with instant replies.

---

## 2. Architecture & Technical Stack

### Monorepo Structure

```text
UnterB2B/
├── AGENTS.md                 # Shared instructions for Codex / Antigravity / Cursor
├── CLAUDE.md                 # Shared instructions for Claude Code
├── PRODUCT.md                # Product truth & domain constraints
├── DESIGN.md                 # Visual tokens & Operate-mode design contract
├── specs/                    # Domain, API, AI prompt, and UI specifications
├── .agents/skills/           # Codex-compatible project skills
├── .claude/skills/           # Claude Code-compatible project skills
├── .github/                  # PR template & GitHub Actions CI workflow
├── package.json              # npm workspaces + root dev/build/test scripts
└── packages/
    ├── backend/              # Node.js + TypeScript + Express + SQLite + Zod
    └── frontend/             # React 19 + TypeScript + Vite + CSS Modules
```

### Technology Choices

- **Backend (`@unter-b2b/backend`):**
  - **Node.js 20 + TypeScript + Express 4** with strict layered separation:
    - `src/routes/` — REST endpoints and **Zod** schema validation
    - `src/services/` — `aiEstimatorService`, `trunkMatcherService` (6-permutation / upright-constrained 3D bounding-box geometry), `shipmentService`, `analyticsService`
    - `src/prompts/` — Authoritative `CARGO_ESTIMATOR_SYSTEM_PROMPT` & JSON schema
    - `src/db/` — **SQLite** via `sql.js` (genuine SQLite 3 database persisted to `./data/unterb2b.sqlite` with zero native C++ `node-gyp` build dependencies) + pre-seeded Gdańsk/Tricity dataset
  - **CORS:** Explicitly configured via `CORS_ORIGIN` (`http://localhost:5173`).
- **Frontend (`@unter-b2b/frontend`):**
  - **React 19 + TypeScript + Vite 6**
  - **CSS Modules + CSS Design Tokens (`src/styles/tokens.css`):** Custom Square-inspired light analytics dashboard and Uber-inspired dark driver console with zero utility-class clutter.
  - **Bespoke Inline SVGs:** Smooth cubic-bezier dual-series freight chart, radial progress rings, 3D isometric trunk wireframe visualizer, and interactive Tricity corridor map.
- **Hybrid AI Strategy (Zero-Friction Evaluation):**
  - If `GEMINI_API_KEY` or `OPENAI_API_KEY` is configured in `.env`, the backend calls the live LLM with `CARGO_ESTIMATOR_SYSTEM_PROMPT` and validates strict JSON with Zod.
  - If no external API key is provided, the backend automatically executes a deterministic B2B logistics estimator using the exact same output contract so reviewers can test every AI feature immediately out of the box.

---

## 3. Running Locally (Step by Step)

### Prerequisites

- **Node.js** `>= 20.x` and **npm** `>= 10.x`

### Option A: Single-Command Monorepo Start (Recommended)

1. Clone the repository and install all workspace dependencies:
   ```bash
   git clone <your-repo-url>
   cd UnterB2B
   npm install
   ```
2. *(Optional)* Copy `.env.example` to `.env` if you want to customize ports or add a `GEMINI_API_KEY` / `OPENAI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
3. Run both the API (`http://localhost:4000`) and Frontend (`http://localhost:5173`) concurrently from the root:
   ```bash
   npm run dev
   ```
4. Open **`http://localhost:5173`** in your browser.

### Option B: Run Backend and Frontend Separately

- **Terminal 1 (REST API + SQLite):**
  ```bash
  npm run dev:backend
  ```
- **Terminal 2 (React Vite Frontend):**
  ```bash
  npm run dev:frontend
  ```

### Running Tests & Production Build

```bash
# Run backend unit & integration tests + frontend TypeScript check
npm test

# Compile backend TypeScript and build frontend production bundle
npm run build
```

---

## 4. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and active AI engine mode (`llm` or `deterministic-ai`) |
| `GET` | `/api/hubs` | Tricity corridor hubs (`Olivia Business Centre`, `Wrzeszcz`, `Port Gdańsk`, `Sopot`, `Gdynia`, `Kowale`) |
| `GET` | `/api/analytics` | Overview KPIs, 12-month Outbound vs. Inbound PLN series, fit rates, CO₂ metrics |
| `POST` | `/api/ai/estimate` | Parses plain-text cargo -> 3D estimate + ranked physical trunk matches |
| `GET` | `/api/ai/prompt` | Inspect active `CARGO_ESTIMATOR_SYSTEM_PROMPT` and JSON schema |
| `GET` | `/api/couriers` | List couriers (optionally pass `?lengthCm=&widthCm=&heightCm=&weightKg=` for live 3D fit) |
| `POST` | `/api/couriers/:id/request-inbound` | Book an available passing courier for an Inbound supply pickup |
| `GET` | `/api/shipments` | List shipments (supports `direction`, `status`, `courierId` filters) |
| `POST` | `/api/shipments` | Create Outbound or Inbound shipment (validates physical trunk fit) |
| `PATCH` | `/api/shipments/:id/status` | Update status (`matched` -> `picked_up` -> `in_transit` -> `delivered`) or assign courier |
| `DELETE` | `/api/shipments/:id` | Delete/cancel shipment |

---

## 5. AI-Native Development Workflow & Tooling

To align with modern AI-native software engineering practices, this repository includes committed specs, agent rules, and dual-compatible skills:

- **`specs/` (`01` through `04`):** Written prior to implementation to lock down the domain model, REST API contract, AI estimator system prompt, and UI/UX design system.
- **`AGENTS.md` & `CLAUDE.md`:** Shared repository rules read automatically by OpenAI Codex, Antigravity, Cursor, and Claude Code so every agent respects the layered backend architecture, CSS Modules styling rules, and verification checklist.
- **`.agents/skills/` & `.claude/skills/`:** Mirrored domain-specific skills (`backend-layered-api`, `frontend-css-modules-ui`, `ai-cargo-estimator`) ensuring consistent changes across both agent ecosystems.
- **Branch & PR Hygiene:** Includes `.github/pull_request_template.md` and `.github/workflows/ci.yml` designed for PR-driven merges into a protected `main` branch.
- **How AI Assisted Delivery:** AI coding agents were used in a spec-first workflow to scaffold the monorepo, implement the 3D trunk rotation algorithm and deterministic fallback estimator, build bespoke SVG visualizations (charts, isometric trunk wireframe, Tricity map), and write unit/API tests, with manual verification of every endpoint, type check, and UI flow.
