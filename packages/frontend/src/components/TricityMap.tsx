import React, { memo, useRef } from 'react';
import { Courier, HubInfo } from '../types/api';
import { calculatePinDistanceKm, MapPin, resolvePinToAddress } from '../utils/mapGeo';
import { CrosshairIcon } from './Icons';
import styles from './TricityMap.module.css';

export interface RoutePin {
  mapX: number;
  mapY: number;
  address?: string;
}

interface TricityMapProps {
  hubs: HubInfo[];
  couriers: Courier[];
  selectedCourierId: string | null;
  onSelectCourier: (courierId: string) => void;
  pickupPin?: RoutePin | null;
  dropoffPin?: RoutePin | null;
  pinMode?: 'pickup' | 'dropoff' | null;
  onPinModeChange?: (mode: 'pickup' | 'dropoff') => void;
  onPinChange?: (mode: 'pickup' | 'dropoff', resolved: MapPin) => void;
  title?: string;
  embedded?: boolean;
}

export const TricityMap: React.FC<TricityMapProps> = memo(({
  hubs,
  couriers,
  selectedCourierId,
  onSelectCourier,
  pickupPin,
  dropoffPin,
  pinMode = null,
  onPinModeChange,
  onPinChange,
  title = 'Live Tricity Micro-Freight Corridor',
  embedded = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const findHub = (id: string) => hubs.find((h) => h.id === id);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPinChange || !pinMode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 820;
    const rawY = ((e.clientY - rect.top) / rect.height) * 400;
    const resolved = resolvePinToAddress(rawX, rawY, hubs);
    onPinChange(pinMode, resolved);
  };

  const selectedCourier = couriers.find((c) => c.id === selectedCourierId) ?? null;
  const routeDistanceKm =
    pickupPin && dropoffPin ? calculatePinDistanceKm(pickupPin, dropoffPin) : null;

  return (
    <div className={`${styles.mapCard} ${embedded ? styles.mapEmbedded : ''}`}>
      <div className={styles.mapHeader}>
        <h2 className={styles.title}>{title}</h2>

        {onPinChange && (
          <div className={styles.pinControls} role="group" aria-label="Map pin selector">
            <button
              type="button"
              className={`${styles.pinModeBtn} ${
                pinMode === 'pickup' ? styles.pinModePickupActive : ''
              }`}
              onClick={() => onPinModeChange?.('pickup')}
            >
              <CrosshairIcon size={13} />
              Pin Pickup (A)
            </button>
            <button
              type="button"
              className={`${styles.pinModeBtn} ${
                pinMode === 'dropoff' ? styles.pinModeDropoffActive : ''
              }`}
              onClick={() => onPinModeChange?.('dropoff')}
            >
              <CrosshairIcon size={13} />
              Pin Delivery (B)
            </button>
          </div>
        )}

        <div className={styles.legend}>
          <span>
            <span className={styles.legendDot} style={{ background: '#10B981' }} />
            Available
          </span>
          <span>
            <span className={styles.legendDot} style={{ background: '#F59E0B' }} />
            Busy (Live GPS)
          </span>
          <span>
            <span className={styles.legendDot} style={{ background: '#2563EB' }} />
            {pickupPin || onPinChange ? 'Hub / Pin A' : 'Corridor Hub'}
          </span>
        </div>
      </div>

      <div className={styles.svgWrap}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox="0 0 820 400"
          role="img"
          style={{ cursor: onPinChange && pinMode ? 'crosshair' : 'default' }}
          onClick={handleSvgClick}
          aria-label="Interactive map of Gdansk, Sopot, and Gdynia hubs, live couriers, and route pins"
        >
          {/* Baltic Sea / Gdansk Bay backdrop */}
          <path
            d="M 220 0 L 820 0 L 820 265 Q 720 220 620 185 Q 480 155 370 115 Q 280 80 220 0 Z"
            fill="var(--map-sea)"
            opacity="0.82"
          />
          <text
            x="640"
            y="88"
            fontSize="13"
            fontWeight="600"
            fill="var(--map-sea-label)"
            opacity="0.8"
            fontFamily="Figtree, sans-serif"
          >
            Gdansk Bay
          </text>

          {/* Main Tricity Arterial Spine */}
          <polyline
            points="165,75 330,140 435,195 545,255 690,215"
            fill="none"
            stroke="var(--map-road)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="435,195 505,350 545,255"
            fill="none"
            stroke="var(--map-road)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 6"
          />

          {/* Selected order Pickup -> Delivery route connector */}
          {pickupPin && dropoffPin && (
            <g>
              <line
                x1={pickupPin.mapX}
                y1={pickupPin.mapY}
                x2={dropoffPin.mapX}
                y2={dropoffPin.mapY}
                stroke="#10B981"
                strokeWidth="3"
                strokeDasharray="7 5"
              />
              {routeDistanceKm !== null && (
                <g
                  transform={`translate(${(pickupPin.mapX + dropoffPin.mapX) / 2}, ${
                    (pickupPin.mapY + dropoffPin.mapY) / 2 - 10
                  })`}
                >
                  <rect x="-32" y="-11" width="64" height="19" rx="9" fill="#0F172A" />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#FFFFFF"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {routeDistanceKm} km
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Active route trajectory for busy couriers (always visible) or selected courier */}
          {couriers.map((c) => {
            if (c.status !== 'busy' && c.id !== selectedCourierId) return null;
            const dest = findHub(c.destinationHub);
            if (!dest) return null;
            const isBusy = c.status === 'busy';
            return (
              <line
                key={`route-${c.id}`}
                x1={c.mapX}
                y1={c.mapY}
                x2={dest.mapX}
                y2={dest.mapY}
                stroke={isBusy ? '#F59E0B' : '#2563EB'}
                strokeWidth={c.id === selectedCourierId ? '3' : '2'}
                strokeDasharray="6 4"
              />
            );
          })}

          {/* Business Hubs */}
          {hubs.map((hub) => (
            <g key={hub.id}>
              <circle
                cx={hub.mapX}
                cy={hub.mapY}
                r="8"
                fill="var(--map-hub-fill)"
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              <text
                x={hub.mapX}
                y={hub.mapY + 21}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="var(--ink-primary)"
                fontFamily="Figtree, sans-serif"
              >
                {hub.name.split(' ')[0]}
              </text>
            </g>
          ))}

          {/* Pickup Pin (A) */}
          {pickupPin && (
            <g transform={`translate(${pickupPin.mapX}, ${pickupPin.mapY})`} style={{ pointerEvents: 'none' }}>
              <circle cx="0" cy="0" r="18" fill="#2563EB" fillOpacity="0.18" />
              <path
                d="M 0 0 L -8 -14 A 10 10 0 1 1 8 -14 Z"
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x="0"
                y="-15"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill="#FFFFFF"
                fontFamily="Figtree, sans-serif"
              >
                A
              </text>
            </g>
          )}

          {/* Delivery Pin (B) */}
          {dropoffPin && (
            <g transform={`translate(${dropoffPin.mapX}, ${dropoffPin.mapY})`} style={{ pointerEvents: 'none' }}>
              <circle cx="0" cy="0" r="18" fill="#10B981" fillOpacity="0.2" />
              <path
                d="M 0 0 L -8 -14 A 10 10 0 1 1 8 -14 Z"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x="0"
                y="-15"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill="#FFFFFF"
                fontFamily="Figtree, sans-serif"
              >
                B
              </text>
            </g>
          )}

          {/* Live Couriers */}
          {couriers.map((c) => {
            const selected = c.id === selectedCourierId;
            const isBusy = c.status === 'busy';
            const fill = isBusy ? '#F59E0B' : '#10B981';
            return (
              <g
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCourier(c.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {(selected || isBusy) && (
                  <circle
                    cx={c.mapX}
                    cy={c.mapY}
                    r={selected ? '21' : '18'}
                    fill={isBusy ? '#F59E0B' : '#2563EB'}
                    fillOpacity="0.18"
                    stroke={isBusy ? '#F59E0B' : '#2563EB'}
                    strokeWidth="2"
                  />
                )}
                <circle
                  cx={c.mapX}
                  cy={c.mapY}
                  r="14"
                  fill={fill}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                <text
                  x={c.mapX}
                  y={c.mapY + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#FFFFFF"
                  fontFamily="Figtree, sans-serif"
                >
                  {c.avatarInitials}
                </text>
                <rect
                  x={c.mapX - 31}
                  y={c.mapY - 34}
                  width="62"
                  height="16"
                  rx="4"
                  fill={isBusy ? '#B45309' : '#0F172A'}
                />
                <text
                  x={c.mapX}
                  y={c.mapY - 22.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#FFFFFF"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isBusy ? `BUSY ${c.trunk.volumeLiters}L` : `${c.trunk.volumeLiters}L`}
                </text>
              </g>
            );
          })}

          {/* Callout banner for selected busy courier's exact location */}
          {selectedCourier && selectedCourier.status === 'busy' && (() => {
            const label = `LIVE BUSY LOC (${selectedCourier.name}): ${selectedCourier.currentAddress}`;
            const displayLabel = label.length > 108 ? `${label.slice(0, 105)}...` : label;
            return (
              <g transform="translate(16, 356)" style={{ pointerEvents: 'none' }}>
                <rect
                  x="0"
                  y="0"
                  width="788"
                  height="28"
                  rx="8"
                  fill="#0F172A"
                  fillOpacity="0.94"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                />
                <text
                  x="12"
                  y="18"
                  fontSize="11.5"
                  fontWeight="600"
                  fill="#FBBF24"
                  fontFamily="Figtree, sans-serif"
                >
                  {displayLabel}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {onPinChange && (
        <p className={styles.mapHint}>
          {pinMode === 'pickup'
            ? 'Click anywhere on the corridor map to drop Pickup Pin (A), or type a Tricity street address.'
            : pinMode === 'dropoff'
              ? 'Click anywhere on the corridor map to drop Delivery Pin (B), or type a Tricity street address.'
              : 'Click any driver marker to inspect their profile, live location, and text chat.'}
        </p>
      )}
    </div>
  );
});
