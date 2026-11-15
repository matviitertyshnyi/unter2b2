# DESIGN.md — Unter b2b Design System

## Surface Mode & Direction
- **Mode:** `Operate` (working B2B dispatch and courier execution platform).
- **Theme:** Light canvas with high-contrast ink hierarchy, zero dark-mode-by-default gimmicks, zero glassmorphism bloat, zero decorative gradients or emoji.
- **Brand Lockup:** `Unter` (`font-weight: 800`, `letter-spacing: -0.04em`, `#0F172A`) + `b2b` compact pill (`#2563EB` background, `#FFFFFF` label, `font-weight: 700`).

## Color Tokens
- `--bg-canvas`: `#F8FAFC` (app backdrop)
- `--bg-surface`: `#FFFFFF` (cards, tables, sidebar)
- `--bg-well`: `#F1F5F9` (recessed filter tracks, input wells, map backdrop)
- `--ink-primary`: `#0F172A` (headings, primary figures, wordmark)
- `--ink-secondary`: `#475569` (labels, table headers, secondary descriptions)
- `--ink-muted`: `#64748B` (timestamps, axis labels; >= 4.5:1 contrast on `#FFFFFF`)
- `--border-line`: `#E2E8F0` (structural card/table boundaries)
- `--border-subtle`: `#F1F5F9` (row dividers)
- `--accent-blue`: `#2563EB` (primary CTAs, active nav, `b2b` mark, Outbound series)
- `--accent-blue-soft`: `#EFF6FF` (active nav fill, selected courier tint)
- `--accent-emerald`: `#10B981` (optimal trunk fit, Inbound series, CO2 saved)
- `--accent-amber`: `#D97706` (tight trunk fit warning, pending state)
- `--accent-red`: `#DC2626` (does not fit trunk / error state)

## Typography
- **UI & Display:** `'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Measurements & Codes:** `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` (used strictly for dimensions `110x100x55 cm`, weights, license plates, and AI prompt/JSON inspection).
- **Numerals:** `font-variant-numeric: tabular-nums` enforced on every KPI figure, currency value, percentage, weight, and dimension.

## Concentric Geometry & Interactive Standards
- **Radii:** Outer cards `16px`, inner wells/panels `10px`, inputs and action buttons `8px`.
- **Hit Targets:** Minimum `44px` height on primary controls, mode switcher segments, sidebar nav items, and mobile action buttons.
- **States:** Every interactive view handles `loading`, `empty`, and `error` states explicitly. Focus rings use `2px solid #2563EB` with `2px` offset.
