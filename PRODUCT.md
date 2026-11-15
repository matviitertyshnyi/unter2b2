# PRODUCT.md — Unter b2b

## Product Truth
**Unter b2b** is a crowd-sourced B2B micro-freight platform for Gdańsk and the Tricity corridor (Olivia Business Centre, Wrzeszcz, Port Gdańsk, Sopot, Gdynia). It connects local businesses needing same-day bulky deliveries with everyday drivers who have unused cargo space in their station wagons, SUVs, hatchbacks, or vans.

## Core Mechanism
1. **Plain-Text AI Cargo & Trunk-Fit Estimator:** A business types a plain-text description of goods (for example: "14 boxes of ceramic tiles 60x60cm and 4 bags of adhesive"). The AI Estimator calculates total weight (`kg`), 3D cargo bounding box (`L x W x H cm`), volume (`L`), fragility/handling class, fair price (`PLN`), and `CO2` saved versus traditional pallet courier dispatch.
2. **Bidirectional Freight with Map Pinning & Live Driver Chat:**
   - **Outbound & Inbound:** Send goods out or request nearby couriers to bring supplies into the business.
   - **Interactive Pinning & Address Geocoding:** Drop Pickup (`A`) / Delivery (`B`) pins on the Tricity map or type a Tricity street address to snap the pin to the exact district.
   - **Courier Profiles, Direct Chat & Busy GPS Tracking:** Selecting any courier opens their profile card and two-way text thread; busy drivers expose their live corridor GPS coordinates and active route vector on the map.
3. **Physical 3D Trunk-Fit Matching:** Orders match strictly with vehicles whose interior trunk dimensions (`L x W x H cm`) and payload limit (`kg`) can physically contain the estimated cargo bounding box.

## Unified Single-App Experience
Both personas operate inside one responsive web application via a 50/50 top-bar mode switcher and header Light/Dark mode toggle:
- **Business Dashboard:** **Home** (single AI cargo estimator + map pinning + bidirectional order creation + matched driver chat), **Available Couriers** (Tricity corridor map with busy GPS tracking + driver profile/chat + Inbound pickup requests), **Orders** (full CRUD ledger), and **Finances** (cost savings, Outbound vs. Inbound freight chart, and radial hit-rate gauges).
- **Courier App:** Driver profile selector, live `Available` / `Busy` status toggle, live driver + Pickup (`A`) / Delivery (`B`) corridor map, street-addressed order cards, 3D Trunk Geometry visualizer, and two-way dispatch messaging inbox.

## Brand Commitments
- **Wordmark:** `Unter` in bold geometric sans (`#0F172A`) paired with `b2b` badge to its right in electric blue (`#2563EB`).
- **Visual Reference:** Clean white/slate B2B dashboard structure inspired by Square's analytics console combined with Uber's crisp high-contrast operational clarity.
- **Language & Localization:** English product copy with authentic Gdańsk / Tricity addresses, vehicle classes, and `PLN (zł)` currency formatting.
