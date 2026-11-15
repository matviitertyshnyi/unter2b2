import React from 'react';
import {
  ChartIcon,
  FleetMapIcon,
  LedgerIcon,
  OverviewIcon,
} from './Icons';
import styles from './Sidebar.module.css';

export type BusinessTab = 'home' | 'couriers' | 'orders' | 'finances';

interface SidebarProps {
  activeTab: BusinessTab;
  onSelectTab: (tab: BusinessTab) => void;
  openOrdersCount: number;
  availableCouriersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  openOrdersCount,
  availableCouriersCount,
}) => {
  const navItems: Array<{
    id: BusinessTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'home', label: 'Home', icon: <OverviewIcon size={17} /> },
    {
      id: 'couriers',
      label: 'Available Couriers',
      icon: <FleetMapIcon size={17} />,
      badge: availableCouriersCount,
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: <LedgerIcon size={17} />,
      badge: openOrdersCount,
    },
    { id: 'finances', label: 'Finances', icon: <ChartIcon size={17} /> },
  ];

  return (
    <aside className={styles.sidebar} aria-label="Business navigation">
      <div>
        <p className={styles.sectionLabel}>Business Workspace</p>
        <nav className={styles.navList}>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.navBtn} ${active ? styles.navBtnActive : ''}`}
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.navLeft}>
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className={styles.countPill}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={styles.hubCard}>
        <span className={styles.hubTitle}>Olivia Business Centre</span>
        <span className={styles.hubMeta}>al. Grunwaldzka 472B, Gdansk</span>
        <span className={styles.hubMeta}>Verified B2B Shipper Account</span>
      </div>
    </aside>
  );
};
