# CLAUDE.md — Claude Code Instructions

Follow all rules in `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, and `specs/` as the single source of truth for **Unter b2b**.

## Skills Available in This Repository
Load the relevant skill from `.claude/skills/` when working in its domain:
- `.claude/skills/backend-layered-api/SKILL.md` — Express routes, Zod validation, SQLite persistence, and REST conventions
- `.claude/skills/frontend-css-modules-ui/SKILL.md` — React 19 + CSS Modules + `tokens.css` + Square/Uber Operate UI standards
- `.claude/skills/ai-cargo-estimator/SKILL.md` — AI Cargo Estimator system prompt, LLM + deterministic fallback, and 3D bounding-box matching

## Root Commands
- `npm run dev` — Run backend (`http://localhost:4000`) and frontend (`http://localhost:5173`) concurrently
- `npm test` — Execute backend automated unit & API tests
- `npm run build` — Type-check and compile both `packages/backend` and `packages/frontend`

## PR & Branching Convention
- Keep `main` clean and protected; land changes via feature branches (`feat/*`, `chore/*`) and Pull Requests.
- Update `specs/` whenever API contracts, DB schema, or AI prompt behavior changes.
