# Spec 04: UI/UX Design System & Component Rules

## 1. Visual Hierarchy (Operate Mode)
- **Top Header (`64px`):**
  - Left: `Unter` wordmark + electric blue `b2b` badge.
  - Center: 50/50 segmented switcher toggling between **Business Dashboard** and **Courier App**.
  - Right: Light/Dark theme toggle button immediately to the left of the active corridor pill (`Gdansk / Tricity`).
- **Theming (`[data-theme="dark"]`):**
  - Semantic CSS variables in `tokens.css` cover light (`#F8FAFC` / `#FFFFFF`) and dark (`#0B1120` / `#0F172A`) palettes, including bespoke SVG tokens (`--map-sea`, `--map-road`, `--trunk-floor`, `--trunk-edge`, `--chart-grid`).
- **Business Dashboard Shell (Square Reference):**
  - Left sidebar (`236px` fixed on desktop, horizontal scroll tabs on mobile) with clean flat navigation items (`Home`, `Available Couriers`, `Orders`, `Finances`) and active soft-blue highlight.
  - Interactive Tricity map supports clicking Pickup (`A`) / Delivery (`B`) pins or snapping pins from street addresses, plus live amber GPS vectors and profile/chat cards for selected couriers.
- **Courier App Shell (Uber Driver Reference):**
  - Driver console featuring `Available` / `Busy` status controls, live driver + order Pickup/Delivery map, street-addressed compatible orders, 3D Trunk Geometry visualizer, and direct dispatch text messaging.

## 2. Signature Interactive Element: 3D Trunk-Fit SVG Visualizer
- Renders an isometric wireframe/cutaway representation of the vehicle trunk proportional to `lengthCm x widthCm x heightCm`.
- Inside the trunk, draws the AI-estimated cargo bounding box in emerald (optimal fit), amber (tight fit >85% utilization), or red (overflows trunk boundary with exact overflow dimension label).

## 3. Anti-Slop & Accessibility Enforcement
- No Tailwind classes; pure CSS Modules with `src/styles/tokens.css`.
- No em dashes (`—`) or decorative emoji anywhere in UI labels.
- Every button, tab, and link must perform a real action or update visible state.
- Full keyboard accessibility (`Tab`, `Enter`, `Escape` on modals) and `prefers-reduced-motion` support.
