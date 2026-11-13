import type { CyberImplantId } from '../engine/types';

interface ImplantIconProps {
  id: CyberImplantId;
  size?: number;
  className?: string;
}

const ACCENT_MAP: Record<CyberImplantId, string> = {
  monowire_edge: '#FF3B7F',
  plasma_amp: '#FF3B7F',
  piercing_katana: '#FF3B7F',
  aegis_capacitor: '#00E5FF',
  kinetic_reflector: '#00E5FF',
  nano_weave: '#00E5FF',
  synapse_overclock: '#FFB800',
  surge_resonator: '#FFB800',
  flux_injector: '#FFB800',
  bio_siphon: '#34D399',
};

export function ImplantIcon({ id, size = 20, className = '' }: ImplantIconProps) {
  const color = ACCENT_MAP[id];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#0B1120" stroke={color} strokeWidth="1.5" />
      {id === 'monowire_edge' && (
        <path d="M6 18L18 6M14 6H18V10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {id === 'plasma_amp' && (
        <path d="M12 5L18 12L12 19L6 12L12 5Z" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.8" />
      )}
      {id === 'piercing_katana' && (
        <path d="M6 17L17 6M10 17L18 9M6 12L12 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      )}
      {id === 'aegis_capacitor' && (
        <path d="M12 5L18 7.8V12.8C18 16.5 15.4 19 12 20C8.6 19 6 16.5 6 12.8V7.8L12 5Z" stroke={color} strokeWidth="1.8" fill={color} fillOpacity="0.22" />
      )}
      {id === 'kinetic_reflector' && (
        <>
          <path d="M8 6V18" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M17 8L11 12L17 16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === 'nano_weave' && (
        <path d="M7 7H17V17H7V7ZM7 12H17M12 7V17" stroke={color} strokeWidth="1.6" />
      )}
      {id === 'synapse_overclock' && (
        <path d="M13 5L8 13H12L11 19L16 11H12L13 5Z" fill={color} />
      )}
      {id === 'surge_resonator' && (
        <>
          <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2" fill={color} />
        </>
      )}
      {id === 'flux_injector' && (
        <path d="M7 15L12 6L17 15H7ZM12 15V19" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      )}
      {id === 'bio_siphon' && (
        <path d="M12 6C14.5 9.2 17 11.4 17 14A5 5 0 0 1 7 14C7 11.4 9.5 9.2 12 6Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.8" />
      )}
    </svg>
  );
}
