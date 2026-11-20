import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  detectTouchscreenDevice,
  isFullscreenActive,
  isFullscreenSupported,
  toggleDocumentFullscreen,
  type FullscreenDocumentLike,
} from './fullscreen';

function readTouchscreenFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return detectTouchscreenDevice({
    hasCoarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
    hasAnyCoarsePointer: Boolean(window.matchMedia?.('(any-pointer: coarse)').matches),
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
    hasOnTouchStart: 'ontouchstart' in window,
  });
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return isFullscreenActive(document as unknown as FullscreenDocumentLike);
  });

  const [isTouchscreen, setIsTouchscreen] = useState<boolean>(() => readTouchscreenFlag());

  const supported = useMemo(
    () =>
      typeof document !== 'undefined' &&
      isFullscreenSupported(document as unknown as FullscreenDocumentLike),
    [],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      setIsFullscreen(isFullscreenActive(document as unknown as FullscreenDocumentLike));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncTouch = () => {
      setIsTouchscreen((prev) => prev || readTouchscreenFlag());
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setIsTouchscreen(true);
      }
    };
    const onTouchStart = () => {
      setIsTouchscreen(true);
    };

    const coarseMq = window.matchMedia?.('(pointer: coarse)');
    const anyCoarseMq = window.matchMedia?.('(any-pointer: coarse)');
    coarseMq?.addEventListener?.('change', syncTouch);
    anyCoarseMq?.addEventListener?.('change', syncTouch);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      coarseMq?.removeEventListener?.('change', syncTouch);
      anyCoarseMq?.removeEventListener?.('change', syncTouch);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  const toggleFullscreen = useCallback((): void => {
    if (typeof document === 'undefined') return;
    void toggleDocumentFullscreen(document as unknown as FullscreenDocumentLike).then((next) => {
      setIsFullscreen(next);
    });
  }, []);

  return useMemo(
    () => ({
      isFullscreen,
      isFullscreenSupported: supported,
      isTouchscreen,
      toggleFullscreen,
    }),
    [isFullscreen, supported, isTouchscreen, toggleFullscreen],
  );
}
