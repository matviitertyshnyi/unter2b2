import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true as const,
});

export const OverviewIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const Box3dIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
    <path d="M12 12L20 7.5" />
    <path d="M12 12V21" />
    <path d="M12 12L4 7.5" />
  </svg>
);

export const FleetMapIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" />
    <path d="M9 3V18" />
    <path d="M15 6V21" />
  </svg>
);

export const LedgerIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M4 6H20" />
    <path d="M4 12H20" />
    <path d="M4 18H14" />
  </svg>
);

export const PromptIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M8 9L4 12L8 15" />
    <path d="M16 9L20 12L16 15" />
    <path d="M13 6L11 18" />
  </svg>
);

export const TruckIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M1 4H15V16H1V4Z" />
    <path d="M15 8H19L23 12V16H15V8Z" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18.5" cy="18" r="2" />
  </svg>
);

export const OutboundArrowIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M7 17L17 7" />
    <path d="M8 7H17V16" />
  </svg>
);

export const InboundArrowIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M17 7L7 17" />
    <path d="M16 17H7V8" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 21C15.5 17.4 19 14.1 19 10A7 7 0 1 0 5 10C5 14.1 8.5 17.4 12 21Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M5 12.5L9.5 17L19 7.5" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M4 7H20" />
    <path d="M10 11V17" />
    <path d="M14 11V17" />
    <path d="M6 7L7 19A2 2 0 0 0 9 21H15A2 2 0 0 0 17 19L18 7" />
    <path d="M9 7V4H15V7" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 12A9 9 0 1 1 18.36 5.64" />
    <path d="M21 3V8H16" />
  </svg>
);

export const ChartIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M4 19H20" />
    <path d="M7 15V10" />
    <path d="M12 15V6" />
    <path d="M17 15V12" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79Z" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2V4" />
    <path d="M12 20V22" />
    <path d="M4.93 4.93L6.34 6.34" />
    <path d="M17.66 17.66L19.07 19.07" />
    <path d="M2 12H4" />
    <path d="M20 12H22" />
    <path d="M6.34 17.66L4.93 19.07" />
    <path d="M19.07 4.93L17.66 6.34" />
  </svg>
);

export const MessageIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 15A2 2 0 0 1 19 17H7L3 21V5A2 2 0 0 1 5 3H19A2 2 0 0 1 21 5Z" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M22 16.92V20A2 2 0 0 1 19.82 22A19.8 19.8 0 0 1 2 4.18A2 2 0 0 1 4 2H7.09A2 2 0 0 1 9.09 3.72L9.8 7A2 2 0 0 1 9.23 8.91L7.9 10.24A16 16 0 0 0 13.76 16.1L15.09 14.77A2 2 0 0 1 17 14.2L20.28 14.91A2 2 0 0 1 22 16.92Z" />
  </svg>
);

export const CrosshairIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2V5" />
    <path d="M12 19V22" />
    <path d="M2 12H5" />
    <path d="M19 12H22" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
