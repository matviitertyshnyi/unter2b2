# AGENTS.md — Shared Engineering Instructions (Codex / Antigravity / Cursor)

This file defines repository standards for **Unter b2b**, a full-stack B2B micro-freight MVP monorepo.
Claude Code agents should read `CLAUDE.md` (which mirrors these standards and points to the same specs and skills).

## Repository Layout
- `packages/backend` — Node.js + TypeScript + Express + SQLite REST API + AI Cargo Estimator
- `packages/frontend` — React 19 + TypeScript + Vite + CSS Modules SPA
- `specs/` — Product, architecture, AI prompt, and design system specifications
- `.agents/skills/` & `.claude/skills/` — Mirrored domain skills for agent execution

## Source-of-Truth Specs (Read Before Major Changes)
1. `PRODUCT.md` & `DESIGN.md`
2. `specs/01-product-and-domain.md`
3. `specs/02-architecture-and-api.md`
4. `specs/03-ai-estimator-prompt.md`
5. `specs/04-ui-ux-design-system.md`

## Architectural & Code Quality Rules
- **Backend Layering:** Keep strict separation between `routes/` (HTTP + Zod validation), `services/` (AI estimator, 3D trunk-fit math, analytics), `prompts/` (system prompt definition), and `db/` (SQLite schema, seed, repositories). Never put SQL or business logic inside route handlers.
- **Frontend Styling:** Use **CSS Modules (`*.module.css`)** + `src/styles/tokens.css`. Do not introduce Tailwind utility classes or UI component bloat.
- **UI Craft Rules:**
  - Keep `Unter` (`#0F172A`) + `b2b` (`#2563EB`) brand lockup intact.
  - Use custom drawn SVGs for charts, the 3D trunk-fit visualizer, and the Tricity map. Never use emoji as UI icons.
  - Avoid em dashes (`—`) and generic AI marketing buzzwords in UI copy.
  - Every async view must render explicit `loading`, `empty`, and `error` states.
- **Git & Delivery Workflow:**
  - Protect `main` — never commit unverified breaking code directly; work on feature branches (`feat/...`, `fix/...`, `docs/...`) and open Pull Requests using `.github/pull_request_template.md`.
  - Always run `npm test` and `npm run build` from the repository root before merging or finalizing a PR.
