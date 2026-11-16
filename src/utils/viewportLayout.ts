export interface ViewportMetrics {
  innerWidth: number;
  innerHeight: number;
  effectiveWidth: number;
  effectiveHeight: number;
  isLandscapeRotated: boolean;
  canOfferLandscapeToggle: boolean;
  isCompactLandscape: boolean;
  isNarrowPortrait: boolean;
  isDesktop: boolean;
}

export function computeViewportMetrics(
  innerWidth: number,
  innerHeight: number,
  landscapeLocked: boolean,
): ViewportMetrics {
  const safeW = Math.max(240, Math.round(innerWidth));
  const safeH = Math.max(240, Math.round(innerHeight));
  const isPortraitViewport = safeH > safeW;
  const canOfferLandscapeToggle = safeW < 768 && isPortraitViewport;
  const isLandscapeRotated = landscapeLocked && isPortraitViewport && safeW < 768;

  const effectiveWidth = isLandscapeRotated ? safeH : safeW;
  const effectiveHeight = isLandscapeRotated ? safeW : safeH;

  const isCompactLandscape = effectiveHeight <= 520 && effectiveWidth >= effectiveHeight;
  const isNarrowPortrait = effectiveWidth < 640 && effectiveHeight > effectiveWidth;
  const isDesktop = effectiveWidth >= 1024 && effectiveHeight >= 600;

  return {
    innerWidth: safeW,
    innerHeight: safeH,
    effectiveWidth,
    effectiveHeight,
    isLandscapeRotated,
    canOfferLandscapeToggle,
    isCompactLandscape,
    isNarrowPortrait,
    isDesktop,
  };
}
