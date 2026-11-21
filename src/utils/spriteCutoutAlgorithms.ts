export {
  type SpriteCutoutOptions,
  type SpriteRect,
  type SpriteBounds,
  DEFAULT_SPRITE_BOUNDS,
  type ScratchBuffers,
  createScratchBuffers,
  prepareScratchBuffers,
  computeSpriteBoundsFromData,
  applyColorGradingData,
} from './spriteCutoutBounds';
export { cleanWhiteBackgroundData } from './spriteCutoutWhitePass';
export { cleanDarkBackgroundData } from './spriteCutoutDarkPass';
