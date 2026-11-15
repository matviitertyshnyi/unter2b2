import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { TRICITY_HUBS, getDistanceFromMapCoordsKm, getRouteDistanceKm } from '../db/hubs.js';
import { Repository } from '../db/repositories.js';
import {
  CARGO_ESTIMATE_JSON_SCHEMA,
  CARGO_ESTIMATOR_SYSTEM_PROMPT,
} from '../prompts/cargoEstimatorPrompt.js';
import {
  CargoEstimateResultSchema,
  estimateCargoFromText,
  getActiveAiProviderMode,
} from '../services/aiEstimatorService.js';
import { AnalyticsService } from '../services/analyticsService.js';
import {
  DomainConflictError,
  NotFoundError,
  ShipmentService,
} from '../services/shipmentService.js';
import { rankCouriersForCargo } from '../services/trunkMatcherService.js';

const EstimateRequestSchema = z.object({
  cargoDescription: z.string().trim().min(5, 'Describe the cargo in at least 5 characters').max(500),
  pickupHub: z.string().min(1).default('olivia'),
  dropoffHub: z.string().min(1).default('wrzeszcz'),
  pickupMapX: z.number().min(0).max(820).optional(),
  pickupMapY: z.number().min(0).max(400).optional(),
  dropoffMapX: z.number().min(0).max(820).optional(),
  dropoffMapY: z.number().min(0).max(400).optional(),
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
});

const CreateShipmentSchema = z.object({
  title: z.string().trim().max(100).optional(),
  businessName: z.string().trim().min(2).max(100),
  direction: z.enum(['outbound', 'inbound']),
  pickupHub: z.string().min(1),
  pickupAddress: z.string().trim().max(180).optional(),
  pickupMapX: z.number().min(0).max(820).nullable().optional(),
  pickupMapY: z.number().min(0).max(400).nullable().optional(),
  dropoffHub: z.string().min(1),
  dropoffAddress: z.string().trim().max(180).optional(),
  dropoffMapX: z.number().min(0).max(820).nullable().optional(),
  dropoffMapY: z.number().min(0).max(400).nullable().optional(),
  cargoDescription: z.string().trim().min(5).max(500),
  assignedCourierId: z.string().nullable().optional(),
  estimate: CargoEstimateResultSchema.extend({
    source: z.enum(['llm', 'deterministic-ai']).optional().default('deterministic-ai'),
  }).optional(),
});

const UpdateShipmentStatusSchema = z.object({
  status: z.enum(['pending', 'matched', 'picked_up', 'in_transit', 'delivered']),
  assignedCourierId: z.string().nullable().optional(),
});

const RequestInboundCourierSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  pickupHub: z.string().min(1),
  pickupAddress: z.string().trim().max(180).optional(),
  pickupMapX: z.number().min(0).max(820).nullable().optional(),
  pickupMapY: z.number().min(0).max(400).nullable().optional(),
  dropoffHub: z.string().min(1),
  dropoffAddress: z.string().trim().max(180).optional(),
  dropoffMapX: z.number().min(0).max(820).nullable().optional(),
  dropoffMapY: z.number().min(0).max(400).nullable().optional(),
  cargoDescription: z.string().trim().min(5).max(500),
});

const UpdateCourierStatusSchema = z.object({
  status: z.enum(['available', 'busy']),
  currentAddress: z.string().trim().max(180).optional(),
});

const CourierMessageSchema = z.object({
  sender: z.enum(['business', 'courier']).default('business'),
  senderName: z.string().trim().min(1).max(80).optional(),
  text: z.string().trim().min(1, 'Message text cannot be empty').max(500),
});

export function createApiRouter(repo: Repository): Router {
  const router = Router();
  const analyticsService = new AnalyticsService(repo);
  const shipmentService = new ShipmentService(repo);

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'unter-b2b-api',
      aiMode: getActiveAiProviderMode(),
      hubsCount: TRICITY_HUBS.length,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/hubs', (_req: Request, res: Response) => {
    res.json({ hubs: TRICITY_HUBS });
  });

  router.get('/analytics', (_req: Request, res: Response) => {
    res.json(analyticsService.getSummary());
  });

  router.get('/ai/prompt', (_req: Request, res: Response) => {
    res.json({
      aiMode: getActiveAiProviderMode(),
      systemPrompt: CARGO_ESTIMATOR_SYSTEM_PROMPT,
      outputSchema: CARGO_ESTIMATE_JSON_SCHEMA,
    });
  });

  router.post('/ai/estimate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = EstimateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid estimate request', details: parsed.error.flatten() });
        return;
      }

      const {
        cargoDescription,
        pickupHub,
        dropoffHub,
        pickupMapX,
        pickupMapY,
        dropoffMapX,
        dropoffMapY,
        direction,
      } = parsed.data;
      const distanceKm =
        pickupMapX !== undefined &&
        pickupMapY !== undefined &&
        dropoffMapX !== undefined &&
        dropoffMapY !== undefined
          ? getDistanceFromMapCoordsKm(pickupMapX, pickupMapY, dropoffMapX, dropoffMapY)
          : getRouteDistanceKm(pickupHub, dropoffHub);
      const estimate = await estimateCargoFromText(cargoDescription, distanceKm);
      const couriers = repo.listCouriers();
      const matchedCouriers = rankCouriersForCargo(couriers, {
        dimensionsCm: estimate.dimensionsCm,
        weightKg: estimate.estimatedWeightKg,
        fragility: estimate.fragility,
        distanceKm,
        pickupHub,
        dropoffHub,
      });

      res.json({
        direction,
        distanceKm,
        estimate,
        couriers: matchedCouriers,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/couriers', (req: Request, res: Response) => {
    const couriers = repo.listCouriers();
    const lengthCm = Number(req.query.lengthCm);
    const widthCm = Number(req.query.widthCm);
    const heightCm = Number(req.query.heightCm);
    const weightKg = Number(req.query.weightKg);
    const fragility =
      req.query.fragility === 'fragile' || req.query.fragility === 'heavy'
        ? req.query.fragility
        : 'standard';

    if (
      Number.isFinite(lengthCm) &&
      Number.isFinite(widthCm) &&
      Number.isFinite(heightCm) &&
      Number.isFinite(weightKg) &&
      lengthCm > 0 &&
      widthCm > 0 &&
      heightCm > 0 &&
      weightKg > 0
    ) {
      const distanceKm = Number(req.query.distanceKm) || 6.5;
      const ranked = rankCouriersForCargo(couriers, {
        dimensionsCm: { lengthCm, widthCm, heightCm },
        weightKg,
        fragility,
        distanceKm,
        pickupHub: typeof req.query.pickupHub === 'string' ? req.query.pickupHub : undefined,
        dropoffHub: typeof req.query.dropoffHub === 'string' ? req.query.dropoffHub : undefined,
      });
      res.json({ couriers: ranked });
      return;
    }

    res.json({ couriers });
  });

  router.get('/couriers/:id', (req: Request, res: Response) => {
    const courier = repo.getCourierById(String(req.params.id));
    if (!courier) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }
    const messages = repo.listMessagesByCourier(courier.id);
    const activeShipments = repo.listShipments({ courierId: courier.id });
    res.json({ courier, messages, activeShipments });
  });

  router.patch('/couriers/:id/status', (req: Request, res: Response) => {
    const parsed = UpdateCourierStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid courier status update', details: parsed.error.flatten() });
      return;
    }
    const updated = repo.updateCourierStatus(
      String(req.params.id),
      parsed.data.status,
      parsed.data.currentAddress
    );
    if (!updated) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }
    res.json({ courier: updated });
  });

  router.get('/couriers/:id/messages', (req: Request, res: Response) => {
    const courier = repo.getCourierById(String(req.params.id));
    if (!courier) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }
    res.json({ courierId: courier.id, messages: repo.listMessagesByCourier(courier.id) });
  });

  router.post('/couriers/:id/messages', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CourierMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid message payload', details: parsed.error.flatten() });
        return;
      }

      const result = shipmentService.sendCourierMessage({
        courierId: String(req.params.id),
        sender: parsed.data.sender,
        senderName: parsed.data.senderName,
        text: parsed.data.text,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/couriers/:id/request-inbound', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = RequestInboundCourierSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid inbound courier request', details: parsed.error.flatten() });
        return;
      }

      const shipment = await shipmentService.requestInboundFromCourier({
        courierId: String(req.params.id),
        businessName: parsed.data.businessName,
        pickupHub: parsed.data.pickupHub,
        pickupAddress: parsed.data.pickupAddress,
        pickupMapX: parsed.data.pickupMapX,
        pickupMapY: parsed.data.pickupMapY,
        dropoffHub: parsed.data.dropoffHub,
        dropoffAddress: parsed.data.dropoffAddress,
        dropoffMapX: parsed.data.dropoffMapX,
        dropoffMapY: parsed.data.dropoffMapY,
        cargoDescription: parsed.data.cargoDescription,
      });
      res.status(201).json({ shipment });
    } catch (err) {
      next(err);
    }
  });

  router.get('/shipments', (req: Request, res: Response) => {
    const direction =
      req.query.direction === 'outbound' || req.query.direction === 'inbound'
        ? req.query.direction
        : undefined;
    const status =
      req.query.status === 'pending' ||
      req.query.status === 'matched' ||
      req.query.status === 'picked_up' ||
      req.query.status === 'in_transit' ||
      req.query.status === 'delivered'
        ? req.query.status
        : undefined;
    const courierId = typeof req.query.courierId === 'string' ? req.query.courierId : undefined;

    const shipments = repo.listShipments({ direction, status, courierId });
    res.json({ shipments });
  });

  router.get('/shipments/:id', (req: Request, res: Response) => {
    const shipment = repo.getShipmentById(String(req.params.id));
    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }
    res.json({ shipment });
  });

  router.post('/shipments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateShipmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid shipment payload', details: parsed.error.flatten() });
        return;
      }

      const shipment = await shipmentService.createShipment(parsed.data);
      res.status(201).json({ shipment });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/shipments/:id/status', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UpdateShipmentStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid status update', details: parsed.error.flatten() });
        return;
      }

      const shipment = shipmentService.updateShipmentStatus(
        String(req.params.id),
        parsed.data.status,
        parsed.data.assignedCourierId
      );
      res.json({ shipment });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/shipments/:id', (req: Request, res: Response) => {
    const deleted = repo.deleteShipment(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  });

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof DomainConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return router;
}
