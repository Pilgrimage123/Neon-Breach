import { useCallback, useEffect, useState } from 'react';
import { computeViewportMetrics, type ViewportMetrics } from './viewportLayout';

export function useViewportMetrics() {
  const [landscapeLocked, setLandscapeLocked] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === 'undefined') {
      return { w: 1280, h: 720 };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  });

  useEffect(() => {
    const update = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const toggleLandscapeLock = useCallback(() => {
    setLandscapeLocked((prev) => !prev);
  }, []);

  const metrics: ViewportMetrics = computeViewportMetrics(size.w, size.h, landscapeLocked);

  return {
    ...metrics,
    landscapeLocked,
    toggleLandscapeLock,
  };
}
