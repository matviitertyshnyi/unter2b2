# Spec 01: Product & Domain Model — Unter b2b

## 1. Domain Vision
Local B2B deliveries (20–350 kg, 100–2,000 L) are poorly served by both food/parcel bikes (too small) and scheduled pallet trucks (too slow and expensive). Meanwhile, thousands of station wagons, SUVs, and light vans commute daily across Gdańsk, Sopot, and Gdynia with empty trunks.

**Unter b2b** turns unused trunk space into an on-demand micro-freight network for same-day local logistics.

## 2. Core Entities

### Courier & Vehicle Trunk Profile
Every courier registers exact interior cargo dimensions (`lengthCm`, `widthCm`, `heightCm`), `volumeLiters`, and `maxWeightKg`:
- **Hatchback / Compact:** ~380–450 L (e.g., VW Golf)
- **Station Wagon (Combi):** ~600–700 L (e.g., Skoda Octavia Combi `110x100x55 cm`, Dacia Jogger `115x102x60 cm`)
- **SUV:** ~650–800 L (e.g., Toyota RAV4 Hybrid `108x105x65 cm`, Volvo XC60)
- **Cargo Van:** ~3,000–4,500 L (e.g., VW Transporter T6 `250x160x135 cm`)

Each courier also publishes their `currentHub`, `destinationHub`, `availableFrom`, and `pricePerKmPln`.

### Shipment (`outbound` vs. `inbound`)
- **Outbound (`outbound`):** Business creates a dispatch from its own location to a customer or branch.
- **Inbound (`inbound`):** Business schedules or requests an available courier to pick up goods from a supplier/wholesaler and bring them *to* the business.

### Shipment Lifecycle States
`pending` -> `matched` -> `picked_up` -> `in_transit` -> `delivered`

## 3. Tricity Geographic Hubs
Pre-seeded coordinates and pairwise road distances across Gdańsk / Sopot / Gdynia:
1. **Olivia Business Centre (Gdańsk Oliwa)** — `al. Grunwaldzka 472`
2. **Garnizon / Wrzeszcz (Gdańsk)** — `ul. Słowackiego 19`
3. **Port Gdańsk / Nowy Port** — `ul. Oliwska 35`
4. **Sopot Centrum** — `ul. Bohaterów Monte Cassino 60`
5. **Gdynia Śródmieście / Marina** — `ul. Świętojańska 44`
6. **Kowale Logistics Park** — `ul. Magnacka 15`
