# Shared Invariants, Offline Baking & Transition Laws

> **Decisions**: [ADR-0011 (Universal Build-Time Sprite Baking)](../../adr/0011-universal-build-time-sprite-baking.md), [ADR-0012 (Two-Paradigm Animation Architecture)](../../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md), and [ADR-0002 (AI Studio Compatibility)](../../adr/0002-ai-studio-compatibility.md).

---

## 1. Frame Budget, Zero-GC & Accessibility Invariants

Every animation loop (`TitleEmblemStage`, `CombatStageCanvas`) obeys:
- **Frame Budget**: `60 FPS` (`16.67 ms/frame`), DPR capped at `Math.min(window.devicePixelRatio || 1, 2)`.
- **Zero Per-Frame React State**: All animation clocks, springs, particles, and camera state mutate inside refs/sim objects; React state updates only on discrete UI events.
- **Zero-GC Hot Paths**: Pre-allocate `Float32Array`, `Uint8Array`, and pooled particle/decal/bolt structs outside `requestAnimationFrame`.
- **Time-Step Safety**: Clamp `dt <= 0.05 s` (`safeDt = Math.min(Math.max(dt, 0), 0.05)`) and pause simulation when `document.hidden === true`.
- **`prefers-reduced-motion: reduce`**: Freeze idle breathing, slime drips, camera shake, Dutch tilt, invert flashes, holographic sheen, and rim arcs; keep crisp static framing and gentle opacity-only transitions.

---

## 2. Universal Offline Sprite Baking (`npm run bake:sprites`)

### 2.1 Directory Layout & AI Studio Purity
- **Raw Sources (`assets-src/`)**:
  - `assets-src/title/` — `title_logo_0.png`..`title_logo_4.png`
  - `assets-src/heroes/` — `kira_spritesheet.png`, `kira_emote_sheet.png`, `kira_dodge_0..3.png`, `auraline_spritesheet.png`, `zuri_spritesheet.png`, `zuri_emote_sheet.png`, `zuri_drones_sheet.png`
  - `assets-src/mutants/` — `crawler_spritesheet.png`, `stalker_open.png`, `stalker_blink.png`, `spitter_spritesheet.jpg`, `mutdog_spritesheet.jpg`, `feral_nurse_sheet_a.png`, `feral_nurse_sheet_b.png`, `brute_spritesheet.jpg`, `matriarch_intact.png`, `matriarch_exploded.png`
  - `assets-src/clinic/` — `nurse_spritesheet.png`
  - `assets-src/portraits/` — `spitter_portrait.jpg`, `mutdog_portrait.png`, `feral_nurse_portrait.png`, `brute_portrait.jpg`, `boss_portrait.jpg`
- **Committed Baked Outputs (`src/assets/sprites/baked/`)**:
  - Whole-sheet lossless RGBA PNGs (`1:1` dimensions preserved so calibrated `SpriteRect` coordinates stay exact; `640px` max for 2-phase `matriarch_intact.png`/`matriarch_exploded.png`; `512px` max for dedicated portraits; `960×541` for Title Emblem `k0..k4.png` + `lockup_plane0.png`).
  - `bake-manifest.json` (version `2`, SHA-256 input/output hashes, dimensions, parameters, bounds).
  - `bakedBounds.ts` (`BAKED_ENEMY_CUTOUT_BOUNDS` and `BAKED_ENEMY_PORTRAIT_BOUNDS` for `HeroPortraitCanvas` / `EnemyBioScanPortrait` / `combatEnemyUi`).
- **Build Isolation**: `vite build` never invokes `sharp` and never copies `assets-src/` or unbaked `public/assets/` originals into `dist/`. Run `npm run bake:sprites` (or `npm run bake:title` for Title Emblem only) whenever `assets-src/` changes.

### 2.2 Per-Cell Sheet Baking & Zero-Readback Runtime Decoding
- **Per-Cell Cutout Rule**: `scripts/bakeSprites.ts` crops each `SpriteRect`, clears `excludeRects`, runs its cutout pass (`cleanWhiteBackgroundData`, `cleanDarkBackgroundData`, `cleanChromaGreenData` for `#00D856` green, or `preserveExistingAlpha`), and blits non-excluded opaque pixels back into the `1:1` sheet buffer. This preserves per-row `removeBottomFloorShadow` (`auraline`), overlapping `excludeRects` columns (`zuri`), opt-in neutral floor-shadow stripping (`removeNeutralFloorShadow` in ` floorMinY = Math.floor(h * 0.80)`), and dark-outline-guarded baked checkerboard stripping (`removeSubtleCheckerboard` requiring `>= 38%` dark-ink border perimeter so glossy internal specular highlights on chitin/eggs remain 100% solid).
- **Runtime Decoding (`src/utils/spriteCutout.ts`)**: Browser code contains **zero** BFS flood-fills, **zero** `getImageData`/`putImageData` calls, and **zero** `willReadFrequently: true` canvases. Baked sheets decode via `createImageBitmap(blob)` (with `HTMLImageElement` fallback) and slice via `ctx.drawImage` + `ctx.clearRect` for `excludeRects`.

---

## 3. Universal Anchor, Scale & Landmark Laws

1. **Pelvis-Centroid `anchorX`**: For all upright/striding Heroes and Mutants, calibrate `anchorX` to the horizontal center-of-mass of the **pelvis/torso band (`35%..65%` of frame height)** — never the bounding-box midpoint between front and back feet (which causes `8–19px` horizontal hip-teleportation during asymmetric strides).
2. **Sole-Locked `bottomY`**: Pin `bottomY` to ground-sole contact (`enemyGroundY` / `groundY`) or calibrated hover deck-reference (`Zuri`) so breathing and flinches never slide or float.
3. **Co-Adjusted Relative Landmarks (`*Rel`)**: When `anchorX` shifts by `Δx` and post-flip landmarks use `rel.dx = anchorX - rawX` (mirrored right-facing sheets), co-shift `*OriginRel.dx` by `+Δx` so world landmark positions remain pixel-locked.
4. **Post-Flip Stage-Space Coordinates & Unified Landmark Projection**: All combat `*Rel` offsets are stored in **stage space** relative to `(anchorX, bottomY)` where `-dx` = left (toward Hero for Mutants), `+dx` = right (toward Mutants for Heroes), and `-dy` = upward. Derive origins via deterministic pixel-landmark scanning, and project them to screen/world coordinates exclusively through `projectSpriteLandmarkToStage` (`stageMeshMath.ts`, passing `nativeFacingSign: 1` for native left-facing sheets such as `Chitin Stalker`).

---

## 4. Two-Paradigm Frame Transition Law & Deprecated Anti-Patterns

- **Paradigm 1 (Mesh-Warped Keyframes)**: Cross-dissolving (`computeSolidityAlphas`: `alphaA + alphaB >= 1`) is valid **only** when vertices are geometrically registered onto $P(u)$ via an `Anatomical Warp Lattice` before blending (`TitleEmblemStage`).
- **Paradigm 2 (Crisp-Cut Multi-Frame Sheets)**: Unwarped sprite sheets must use **instant crisp cuts (`blendDuration = 0`, `frameBlendAlpha = 1`)** in `computeFrameTransitionState` (which guards `blendDuration <= 0` before division to prevent `0 / 0 = NaN` on `dt = 0` hitstop ticks). Sub-frame fluidity comes from symplectic springs and the `4×6` Hermite spine.
  - **2-Item Combat Allowlist** *(the only permitted `blendDuration > 0` combat cases)*:
    1. **Feral Nurse `Optical Cloak`** (`frames 12..15`, `0.04s`) — intentional holographic phase afterimage.
    2. **Chitin Stalker transitional 2-frame eye blink** (`0.04–0.065s`) — identical body silhouette where only the eyelid moves.
- **Deprecated Anti-Pattern (`NurseStageCanvas`)**: Looping disparate arm/head poses at `4.2 fps` under a continuous `100%`-duty-cycle unwarped cross-dissolve + `trajectoryWarp` (`src/components/medbay/NurseStageCanvas.tsx`, `src/utils/nurseSpriteSheet.ts`) produces persistent double-exposure ghosting. **Do not use `NurseStageCanvas` as a model for any future facility or NPC stage**; future reworks must use Paradigm 1 (mesh-warped bust) or Paradigm 2 (crisp-cut rig).
