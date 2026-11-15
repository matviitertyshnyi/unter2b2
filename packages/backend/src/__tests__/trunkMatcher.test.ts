import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createApp } from '../app.js';
import { SqliteStore } from '../db/database.js';
import { Repository } from '../db/repositories.js';
import { seedDatabase } from '../db/seed.js';
import { runDeterministicCargoEstimator } from '../services/aiEstimatorService.js';
import { checkPhysicalTrunkFit } from '../services/trunkMatcherService.js';

test('3D trunk matcher accepts rotatable standard cargo and rejects upright fragile overflow', () => {
  const octaviaTrunk = {
    lengthCm: 112,
    widthCm: 100,
    heightCm: 56,
    maxWeightKg: 260,
    volumeLiters: 627,
  };

  // Standard 62x50x95 box fits when rotated horizontally/orthogonally
  const standardFit = checkPhysicalTrunkFit(
    { lengthCm: 62, widthCm: 50, heightCm: 95 },
    90,
    'standard',
    octaviaTrunk
  );
  assert.equal(standardFit.fits, true);
  assert.equal(standardFit.rotated, true);

  // Fragile 70cm-tall espresso crate cannot be laid flat, so 56cm trunk rejects it
  const fragileReject = checkPhysicalTrunkFit(
    { lengthCm: 74, widthCm: 58, heightCm: 70 },
    85,
    'fragile',
    octaviaTrunk
  );
  assert.equal(fragileReject.fits, false);
  assert.match(fragileReject.reason, /exceeds trunk height/i);
});

test('3D trunk matcher rejects cargo exceeding max payload weight', () => {
  const golfTrunk = {
    lengthCm: 92,
    widthCm: 98,
    heightCm: 48,
    maxWeightKg: 135,
    volumeLiters: 432,
  };

  const result = checkPhysicalTrunkFit(
    { lengthCm: 70, widthCm: 60, heightCm: 35 },
    180,
    'heavy',
    golfTrunk
  );
  assert.equal(result.fits, false);
  assert.match(result.reason, /exceeds vehicle max payload/i);
});

test('Deterministic AI estimator parses ceramic tiles and ignores inch/cm modifiers when counting', () => {
  const estimate = runDeterministicCargoEstimator(
    '12 boxes of ceramic tiles 60x60cm and 4 bags of adhesive',
    6.2
  );

  assert.ok(estimate.estimatedWeightKg >= 250);
  assert.ok(estimate.dimensionsCm.lengthCm >= 62);
  assert.ok(estimate.estimatedPricePln > 40);
  assert.ok(estimate.traditionalCourierPricePln > estimate.estimatedPricePln);
  assert.ok(estimate.co2SavedKg > 1);
  assert.equal(estimate.source, 'deterministic-ai');

  const monitorEstimate = runDeterministicCargoEstimator(
    '8 boxed 27-inch monitors and 3 ergonomic office chairs',
    13.6
  );
  assert.match(monitorEstimate.itemsSummary, /^8x boxed monitors \+ 3x office furniture units$/);
  assert.ok(monitorEstimate.estimatedWeightKg < 150);
});

test('REST API supports health, AI estimate, and full shipment CRUD with trunk-fit validation', async () => {
  const store = await SqliteStore.open(':memory:');
  seedDatabase(store);
  const repo = new Repository(store);
  const app = createApp(repo, 'http://localhost:5173');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as { status: string };
    assert.equal(health.status, 'ok');

    // 2. AI Estimate endpoint
    const estRes = await fetch(`${baseUrl}/ai/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cargoDescription: '8 boxes of A4 print brochures and 2 roll-up banners',
        pickupHub: 'wrzeszcz',
        dropoffHub: 'olivia',
        direction: 'outbound',
      }),
    });
    assert.equal(estRes.status, 200);
    const estBody = (await estRes.json()) as {
      estimate: { estimatedPricePln: number };
      couriers: Array<{ id: string; fit: { fits: boolean } }>;
    };
    assert.ok(estBody.estimate.estimatedPricePln > 25);
    assert.ok(estBody.couriers.some((c) => c.fit.fits));

    // 3. Create inbound shipment assigned to Marek (Octavia Combi)
    const createRes = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Olivia Roastery',
        direction: 'inbound',
        pickupHub: 'port',
        dropoffHub: 'olivia',
        cargoDescription: '6 Euro-crates of roasted coffee bags',
        assignedCourierId: 'cour-marek',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { shipment: { id: string; status: string } };
    assert.equal(created.shipment.status, 'matched');

    // 4. Advance status to delivered
    const patchRes = await fetch(`${baseUrl}/shipments/${created.shipment.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    assert.equal(patchRes.status, 200);
    const patched = (await patchRes.json()) as { shipment: { status: string } };
    assert.equal(patched.shipment.status, 'delivered');

    // 5. Reject assigning oversized cargo to Golf Hatchback (409 Conflict)
    const oversizedRes = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Gdynia Timber',
        direction: 'outbound',
        pickupHub: 'gdynia',
        dropoffHub: 'olivia',
        cargoDescription: '1 Euro-pallet load of birch plywood',
        assignedCourierId: 'cour-ola',
      }),
    });
    assert.equal(oversizedRes.status, 409);

    // 6. Delete created shipment
    const delRes = await fetch(`${baseUrl}/shipments/${created.shipment.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);

    // 7. Courier profile, live status toggle, and bidirectional text messaging
    const msgRes = await fetch(`${baseUrl}/couriers/cour-marek/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'business',
        senderName: 'Olivia Studio',
        text: 'Where are you right now for loading bay pickup?',
      }),
    });
    assert.equal(msgRes.status, 201);
    const msgBody = (await msgRes.json()) as {
      messages: Array<{ sender: string; text: string }>;
    };
    assert.ok(msgBody.messages.some((m) => m.sender === 'business' && m.text.includes('loading bay')));
    assert.ok(msgBody.messages.some((m) => m.sender === 'courier'));

    const statusRes = await fetch(`${baseUrl}/couriers/cour-marek/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'busy',
        currentAddress: 'al. Grunwaldzka 300, Wrzeszcz',
      }),
    });
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as {
      courier: { status: string; currentAddress: string };
    };
    assert.equal(statusBody.courier.status, 'busy');
    assert.equal(statusBody.courier.currentAddress, 'al. Grunwaldzka 300, Wrzeszcz');

    // 8. Shipment created with custom map pin coordinates & street addresses
    const pinnedRes = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Port Logistics',
        direction: 'outbound',
        pickupHub: 'port',
        pickupAddress: 'ul. Oliwska 35, Port Gdansk',
        pickupMapX: 690,
        pickupMapY: 215,
        dropoffHub: 'sopot',
        dropoffAddress: 'ul. Bohaterow Monte Cassino 60, Sopot',
        dropoffMapX: 335,
        dropoffMapY: 132,
        cargoDescription: '4 boxes of marine electronics',
      }),
    });
    assert.equal(pinnedRes.status, 201);
    const pinnedBody = (await pinnedRes.json()) as {
      shipment: {
        pickupAddress: string;
        pickupMapX: number;
        dropoffMapX: number;
        distanceKm: number;
      };
    };
    assert.equal(pinnedBody.shipment.pickupAddress, 'ul. Oliwska 35, Port Gdansk');
    assert.equal(pinnedBody.shipment.pickupMapX, 690);
    assert.equal(pinnedBody.shipment.dropoffMapX, 335);
    assert.ok(pinnedBody.shipment.distanceKm > 5);
  } finally {
    server.close();
    store.close();
  }
});
