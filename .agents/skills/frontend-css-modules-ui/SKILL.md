---
name: frontend-css-modules-ui
description: Build and refine Unter b2b frontend views using React 19, TypeScript, CSS Modules, DESIGN.md tokens, and Operate-mode UX discipline.
---

# Frontend CSS Modules UI Skill

When building or editing UI in `packages/frontend`:

1. **Styling System:**
   - Always use **CSS Modules** (`Component.module.css`) paired with custom properties in `src/styles/tokens.css`.
   - Never introduce Tailwind utility classes or arbitrary ad-hoc hex colors outside `tokens.css`.
2. **Visual & Brand Rules:**
   - Preserve the `Unter` (`#0F172A`, bold geometric sans) + `b2b` (`#2563EB` blue pill) lockup.
   - Use `tabular-nums` for every price (`PLN / zł`), weight (`kg`), volume (`L`), percentage, and dimension.
   - Keep concentric border radii (`16px` cards, `10px` inner wells, `8px` controls) and >= `44px` interactive tap targets.
3. **UI Craft & Anti-Slop Rules:**
   - Use bespoke inline SVGs for icons, charts, the 3D trunk visualizer, and the Tricity map. Never use emoji as UI icons.
   - Never use em dashes (`—`) or generic AI buzzwords in UI copy.
   - Every async panel must explicitly handle `loading`, `empty`, and `error` states with actionable next steps.
   - Every interactive control must perform a real action and support keyboard focus.
