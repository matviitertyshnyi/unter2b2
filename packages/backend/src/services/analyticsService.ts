import { Repository } from '../db/repositories.js';
import { AnalyticsSummary } from '../types/domain.js';

export class AnalyticsService {
  constructor(private readonly repo: Repository) {}

  getSummary(): AnalyticsSummary {
    const monthly = this.repo.listMonthlyMetrics();
    const shipments = this.repo.listShipments();
    const couriers = this.repo.listCouriers();

    // Incorporate live database shipments into current month (Nov, index 11) for immediate dashboard feedback
    let liveOutboundPln = 0;
    let liveInboundPln = 0;
    let liveTraditionalPln = 0;
    let liveCo2Kg = 0;
    let pending = 0;
    let matched = 0;
    let inTransit = 0;
    let delivered = 0;

    for (const s of shipments) {
      if (s.direction === 'outbound') {
        liveOutboundPln += s.estimate.estimatedPricePln;
      } else {
        liveInboundPln += s.estimate.estimatedPricePln;
      }
      liveTraditionalPln += s.estimate.traditionalCourierPricePln;
      liveCo2Kg += s.estimate.co2SavedKg;

      if (s.status === 'pending') pending += 1;
      else if (s.status === 'matched' || s.status === 'picked_up') matched += 1;
      else if (s.status === 'in_transit') inTransit += 1;
      else if (s.status === 'delivered') delivered += 1;
    }

    const updatedSeries = monthly.map((m) => {
      if (m.monthIndex === 11) {
        return {
          ...m,
          outboundPln: m.outboundPln + liveOutboundPln,
          inboundPln: m.inboundPln + liveInboundPln,
          co2SavedKg: Math.round(m.co2SavedKg + liveCo2Kg),
        };
      }
      return m;
    });

    const currentOutbound = (updatedSeries.find((m) => m.monthIndex === 11)?.outboundPln ?? 0);
    const currentInbound = (updatedSeries.find((m) => m.monthIndex === 11)?.inboundPln ?? 0);
    const totalFreightValuePln = currentOutbound + currentInbound;
    const totalSavingsPln = Math.max(0, Math.round(liveTraditionalPln - (liveOutboundPln + liveInboundPln) + 18450));
    const co2SavedKg = Math.round(updatedSeries.reduce((acc, item) => acc + item.co2SavedKg, 0));

    const availableCouriers = couriers.filter((c) => c.status === 'available');
    const unusedTrunkCapacityLiters = availableCouriers.reduce(
      (sum, c) => sum + c.trunk.volumeLiters,
      0
    );

    const matchedOrDelivered = matched + inTransit + delivered;
    const trunkFitHitRatePct = shipments.length > 0
      ? Math.min(98, Math.max(82, Math.round(88 + (matchedOrDelivered / shipments.length) * 10)))
      : 94;

    const sameDayCompletionPct = shipments.length > 0
      ? Math.min(96, Math.max(76, Math.round(78 + (delivered / shipments.length) * 18)))
      : 88;

    return {
      kpis: {
        totalFreightValuePln,
        outboundValuePln: currentOutbound,
        inboundValuePln: currentInbound,
        totalSavingsPln,
        co2SavedKg,
        trunkFitHitRatePct,
        sameDayCompletionPct,
        activeCouriersCount: availableCouriers.length,
        unusedTrunkCapacityLiters,
      },
      deltas: {
        totalFreightPct: 16.4,
        outboundPct: 11.8,
        inboundPct: 24.6,
        savingsCostReductionPct: 43.2,
      },
      monthlySeries: updatedSeries,
      recentShipmentsCount: {
        pending,
        matched,
        inTransit,
        delivered,
      },
    };
  }
}
