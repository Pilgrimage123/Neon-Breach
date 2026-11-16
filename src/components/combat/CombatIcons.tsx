import type { IntentKind } from '../../engine/types';

interface ArmorCrestIconProps {
  size?: number;
  broken?: boolean;
  className?: string;
}

export function ArmorCrestIcon({
  size = 14,
  broken = false,
  className = '',
}: ArmorCrestIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 2.2L20 5.6V11.8C20 16.7 16.5 20.5 12 22C7.5 20.5 4 16.7 4 11.8V5.6L12 2.2Z"
        fill={broken ? '#3F1224' : '#3B2808'}
        stroke={broken ? '#FF2E7E' : '#FFC700'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 4.8L17.4 7.1V11.6C17.4 15.1 15 17.9 12 19.2C9 17.9 6.6 15.1 6.6 11.6V7.1L12 4.8Z"
        fill={broken ? 'rgba(255,46,126,0.22)' : 'rgba(255,199,0,0.28)'}
        stroke={broken ? '#FDA4AF' : '#FEF08A'}
        strokeWidth="1"
        strokeOpacity="0.65"
      />
      {broken ? (
        <path
          d="M7 17L17 7M12 6.5L10.5 11.5L13.5 12.5L12 17.5"
          stroke="#FFE4E6"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M12 7.5V16.5M8.5 10.5H15.5"
          stroke="#FEF08A"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

interface ShieldPipIconProps {
  size?: number;
  cracked?: boolean;
  className?: string;
}

export function ShieldPipIcon({
  size = 13,
  cracked = false,
  className = '',
}: ShieldPipIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 2.2L21.8 12L12 21.8L2.2 12L12 2.2Z"
        fill={cracked ? '#3B0A1E' : '#082F49'}
        stroke={cracked ? '#FF2E7E' : '#38BDF8'}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.2L17.8 12L12 17.8L6.2 12L12 6.2Z"
        fill={cracked ? 'rgba(255,46,126,0.28)' : 'rgba(56,189,248,0.42)'}
      />
      {cracked ? (
        <path
          d="M7.5 16.5L16.5 7.5"
          stroke="#FFE4E6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

interface IntentIconProps {
  kind: IntentKind;
  size?: number;
  className?: string;
}

export function IntentIcon({ kind, size = 14, className = '' }: IntentIconProps) {
  if (kind === 'armor') {
    return <ArmorCrestIcon size={size} className={className} />;
  }

  if (kind === 'bolster') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M12 2.5L19.5 5.8V11.6C19.5 16.3 16.2 19.9 12 21.5C7.8 19.9 4.5 16.3 4.5 11.6V5.8L12 2.5Z"
          fill="#082F49"
          stroke="#38BDF8"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M12 7.5V15.5M8 11.5H16"
          stroke="#BAE6FD"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === 'charge') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="rgba(249,115,22,0.2)"
          stroke="#FB923C"
          strokeWidth="2"
        />
        <path
          d="M13 5.5L8.5 13H12.5L11 18.5L15.5 11H11.5L13 5.5Z"
          fill="#FDBA74"
          stroke="#FFF7ED"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'acid') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M12 2.5C15.8 7.6 18.5 10.9 18.5 14.6A6.5 6.5 0 0 1 5.5 14.6C5.5 10.9 8.2 7.6 12 2.5Z"
          fill="#1A2E05"
          stroke="#A3E635"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9.6 15.4A2.6 2.6 0 0 0 12.8 18"
          stroke="#ECFCCB"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="14" cy="11.5" r="1.2" fill="#BEF264" />
      </svg>
    );
  }

  if (kind === 'leech') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M6.5 4.5L9.5 15.5L12 10.5L14.5 15.5L17.5 4.5"
          fill="rgba(244,63,94,0.22)"
          stroke="#FB7185"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 14.5C14.1 16.9 15.4 18.4 15.4 19.9A3.4 3.4 0 0 1 8.6 19.9C8.6 18.4 9.9 16.9 12 14.5Z"
          fill="#10B981"
          stroke="#A7F3D0"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (kind === 'heavy') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M4.5 19.5L18.5 5.5M13.5 4.5H19.5V10.5"
          stroke="#FF2E7E"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 12.5L12.5 4.5M8.5 19.5L19.5 8.5"
          stroke="#FFC700"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 19L19 5M13.5 5H19V10.5"
        stroke="#FB7185"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.5 14.5L9.5 18.5" stroke="#FECDD3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
