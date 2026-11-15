import React from 'react';
import { MoonIcon, OverviewIcon, PinIcon, SunIcon, TruckIcon } from './Icons';
import styles from './Header.module.css';

export type AppPersonaMode = 'business' | 'courier';
export type ThemeMode = 'light' | 'dark';

interface HeaderProps {
  mode: AppPersonaMode;
  onModeChange: (mode: AppPersonaMode) => void;
  onBrandClick: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onBrandClick,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.brandGroup}>
        <button
          type="button"
          className={styles.brandButton}
          onClick={onBrandClick}
          aria-label="Unter b2b home"
        >
          <span className={styles.wordmark}>Unter</span>
          <span className={styles.b2bMark}>b2b</span>
        </button>
      </div>

      <div className={styles.modeSwitcher} role="tablist" aria-label="Workspace mode switcher">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'business'}
          className={`${styles.modeBtn} ${mode === 'business' ? styles.modeBtnActive : ''}`}
          onClick={() => onModeChange('business')}
        >
          <OverviewIcon size={15} />
          Business Dashboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'courier'}
          className={`${styles.modeBtn} ${mode === 'courier' ? styles.modeBtnActiveCourier : ''}`}
          onClick={() => onModeChange('courier')}
        >
          <TruckIcon size={15} />
          Courier App
        </button>
      </div>

      <div className={styles.actionsGroup}>
        <button
          type="button"
          className={styles.themeToggleBtn}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <span className={styles.hubTag}>
          <PinIcon size={13} />
          Gdansk / Tricity
        </span>
      </div>
    </header>
  );
};
