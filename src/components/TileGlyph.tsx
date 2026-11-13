import type { TileType } from '../engine/types';

interface TileGlyphProps {
  type: TileType;
  size?: number;
  className?: string;
}

export function TileGlyph({ type, size = 34, className = '' }: TileGlyphProps) {
  if (type === 'attack') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M18 3L32 18L18 33L4 18L18 3Z"
          fill="#F43F5E"
          fillOpacity="0.22"
          stroke="#FB7185"
          strokeWidth="2"
        />
        <path
          d="M11 25L24 10M24 10H16M24 10V18"
          stroke="#FFE4E6"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === 'defense') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M18 3L30 8.5V17.5C30 24.8 24.8 30.8 18 33C11.2 30.8 6 24.8 6 17.5V8.5L18 3Z"
          fill="#06B6D4"
          fillOpacity="0.22"
          stroke="#22D3EE"
          strokeWidth="2"
        />
        <path
          d="M18 9V26M12 15.5H24"
          stroke="#ECFEFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // TECH tile glyph
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12.5 4H23.5L32 12.5V23.5L23.5 32H12.5L4 23.5V12.5L12.5 4Z"
        fill="#F59E0B"
        fillOpacity="0.22"
        stroke="#FBBF24"
        strokeWidth="2"
      />
      <path
        d="M19.5 8.5L13 19H18.5L16.5 27.5L23 17H17.5L19.5 8.5Z"
        fill="#FEF3C7"
      />
    </svg>
  );
}
