export interface FullscreenDocumentLike {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  documentElement?: {
    requestFullscreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: () => Promise<void> | void;
  } | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export interface TouchEnvironmentSnapshot {
  hasCoarsePointer: boolean;
  hasAnyCoarsePointer: boolean;
  maxTouchPoints: number;
  hasOnTouchStart: boolean;
}

export function detectTouchscreenDevice(env: TouchEnvironmentSnapshot): boolean {
  return (
    env.hasCoarsePointer ||
    env.hasAnyCoarsePointer ||
    env.maxTouchPoints > 0 ||
    env.hasOnTouchStart
  );
}

export function isFullscreenActive(doc: FullscreenDocumentLike | null | undefined): boolean {
  if (!doc) return false;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function isFullscreenSupported(doc: FullscreenDocumentLike | null | undefined): boolean {
  if (!doc || !doc.documentElement) return false;
  const el = doc.documentElement;
  const hasRequest =
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function';
  if (!hasRequest) return false;
  if (doc.fullscreenEnabled === false && doc.webkitFullscreenEnabled !== true) {
    return false;
  }
  return true;
}

export async function toggleDocumentFullscreen(
  doc: FullscreenDocumentLike | null | undefined,
): Promise<boolean> {
  if (!doc) return false;

  try {
    if (isFullscreenActive(doc)) {
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
      return isFullscreenActive(doc);
    }

    const root = doc.documentElement;
    if (!root) return false;

    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen();
    } else if (typeof root.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
    }
    return isFullscreenActive(doc);
  } catch {
    return isFullscreenActive(doc);
  }
}
