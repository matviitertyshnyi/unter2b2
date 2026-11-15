import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api/client';
import { AppPersonaMode, Header, ThemeMode } from './components/Header';
import { BusinessTab, Sidebar } from './components/Sidebar';
import { AiDispatchView } from './views/AiDispatchView';
import { CourierAppView } from './views/CourierAppView';
import { InboundFleetView } from './views/InboundFleetView';
import { OverviewView } from './views/OverviewView';
import { ShipmentsView } from './views/ShipmentsView';
import { AnalyticsSummary, Courier, HubInfo, Shipment } from './types/api';
import styles from './App.module.css';

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppPersonaMode>('business');
  const [activeTab, setActiveTab] = useState<BusinessTab>('home');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return window.localStorage.getItem('unter-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('unter-theme', theme);
    } catch {
      // ignore storage access issues
    }
  }, [theme]);

  const [hubs, setHubs] = useState<HubInfo[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hubsRes, couriersRes, shipmentsRes, analyticsRes] = await Promise.all([
        api.getHubs(),
        api.getCouriers(),
        api.getShipments(),
        api.getAnalytics(),
      ]);

      setHubs(hubsRes.hubs);
      setCouriers(couriersRes.couriers);
      setShipments(shipmentsRes.shipments);
      setAnalytics(analyticsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reach Unter b2b API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleShipmentCreated = (_shipment: Shipment) => {
    void loadWorkspaceData();
  };

  const openOrdersCount = shipments.filter((s) => s.status !== 'delivered').length;
  const availableCouriersCount = couriers.filter((c) => c.status === 'available').length;

  return (
    <div className={styles.shell}>
      <Header
        mode={mode}
        onModeChange={setMode}
        onBrandClick={() => {
          setMode('business');
          setActiveTab('home');
        }}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <div className={styles.workspace}>
        {mode === 'business' && (
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            openOrdersCount={openOrdersCount}
            availableCouriersCount={availableCouriersCount}
          />
        )}

        <main className={styles.main}>
          {mode === 'courier' ? (
            <CourierAppView
              couriers={couriers}
              shipments={shipments}
              hubs={hubs}
              onRefresh={() => void loadWorkspaceData()}
            />
          ) : activeTab === 'home' ? (
            <AiDispatchView
              hubs={hubs}
              couriers={couriers}
              shipments={shipments}
              onShipmentCreated={handleShipmentCreated}
              onRefresh={() => void loadWorkspaceData()}
              onNavigateOrders={() => setActiveTab('orders')}
            />
          ) : activeTab === 'couriers' ? (
            <InboundFleetView
              hubs={hubs}
              couriers={couriers}
              onShipmentCreated={handleShipmentCreated}
            />
          ) : activeTab === 'orders' ? (
            <ShipmentsView
              shipments={shipments}
              couriers={couriers}
              hubs={hubs}
              loading={loading}
              onRefresh={() => void loadWorkspaceData()}
              onNavigateCreate={() => setActiveTab('home')}
            />
          ) : (
            <OverviewView
              analytics={analytics}
              loading={loading}
              error={error}
              onRetry={() => void loadWorkspaceData()}
            />
          )}
        </main>
      </div>
    </div>
  );
};
