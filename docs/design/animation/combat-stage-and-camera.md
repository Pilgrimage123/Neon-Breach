# Combat Stage, WebGL2 Mesh Pipeline & Action Camera v2

> **Related**: [ADR-0003 (Hybrid Canvas2D + WebGL2 Stage)](../../adr/0003-hybrid-canvas2d-webgl2-stage.md), [Shared Invariants](./shared-invariants-and-baking.md).

---

## 1. Three-Layer Synchronized Stage Compositor

`CombatStageCanvas.tsx`, `combatRenderer.ts`, `stageSpriteAdapter.ts`, and `webglMeshRenderer.ts` render combat across three `<canvas>` layers sharing identical pixel dimensions and camera projection (`ActionCameraController`):

1. **Layer 0 — Base (`canvasRef`, Canvas2D)**: Neo-Prague sky-bridge backdrop, glass deck geometry, persistent floor/cover blood decals, Carapace Brute fissures, Bile Spitter ground puddles, elliptical foot shadows, and cut-in obsidian stage dimmer (`dimmerAlpha ∈ [0, 0.75]`).
2. **Layer 1 — Actors & Reflections (`webglCanvasRef`, WebGL2 `#version 300 es`)**: Clipped planar deck reflections (`gl.SCISSOR_TEST`), sprint afterimages, the active Hero (`Kira`, `Auraline`, `Zuri`), Zuri's `Tri-Drone Sync` drones, and all Mutants rendered via `MeshSprite`.
3. **Layer 2 — Foreground & Telemetry (`fgCanvasRef`, Canvas2D)**: Shield dome, on-stage lifebars, intent trajectory arcs, drop-pod holograms, blood droplets, projectiles, slash/Overdrive beams, particles, floating damage numbers, screen-visor blood drops, and `DEV`-only wireframe overlays.

---

## 2. `4 × 6` Deformable `MeshSprite` & GLSL `#version 300 es`

- **Grid Topology**: Every actor renders onto a unified **`4 × 6` cell grid (`35` vertices, `48` triangles, `144` indices)** stored in a pre-allocated zero-GC `Float32Array(280)` (`[xWorld, yWorld, u0, v0, u1, v1, hWeight, alpha]`, `hWeight ∈ [0, 1]` from feet to head).
- **4-Knot Anatomical Spine (`FourKnotSpine`)**: Control knots (`feet` `0.00`, `pelvis` `0.33`, `waist` `0.67`, `head` `1.00`) apply `(dx, dy, rotRad, scaleX)` via cubic Hermite interpolation (`evaluateAnatomicalSplineRow`), keeping `feet` pinned (`dx = 0, dy = 0`).
- **Dual-Frame Independent UVs**: `u1, v1` project using the secondary frame's own dimensions and foot anchor (`secondaryAnchorOffsetXPx`, `secondaryAnchorOffsetYPx`) for the two allowlisted cross-dissolve cases.
- **Shaders & `StageTextureSource` Cache**: Vertex shader applies foot-anchored squash/stretch, height-weighted harmonic sway (`u_sway`), shear, and column-major `u_viewProjMatrix`. Fragment shader samples `u_tex0`/`u_tex1` in premultiplied-alpha space (`gl.ONE, gl.ONE_MINUS_SRC_ALPHA`) with optional edge-tapered `u_uvDistort`, `u_tintColor`, and additive `u_flashColor`. `WebGL2CharacterStageRenderer` caches `StageTextureSource` (`HTMLCanvasElement | ImageBitmap`) in a bounded LRU map (`maxCachedTextures = 192`) and handles `webglcontextlost`/`webglcontextrestored` cleanly.

---

## 3. Dynamic 2D Action Camera System v2

### 3.1 Safety & Accessibility Overrides
- **Draw Priority**: `0` Reflections · `1` Dimmed Bystanders · `2` Neutral · `3` Active Target(s) · `4` Active Attacker (`fgCtx` VFX always draw above Layer 1).
- **World-Space UI Fade (`worldUiAlpha`)**: Smoothly hides on-stage lifebars and badges during focal cut-ins (`hideWorldUiDuringCutIn: true`).
- **`tacticalViewActive === true`**: Immediately flushes the sequencer via `cleanupActiveState()` (`zoom = 1`, `dimmerAlpha = 0`, `worldUiAlpha = 1`).
- **`reducedMotion === true`**: Preserves soft framing while zeroing Dutch tilt, trauma shake, invert flashes, and speed lines.

### 3.2 Staging Modes & Production Defaults (`DEFAULT_COMBAT_PRESENTATION_CONFIG`)
- **Heroes (`classifyHeroAttackStaging`)**: `Auraline` (`100%` `scattergun` → `ranged_fast`/`ranged_aoe`), `Zuri` (`100%` `drone_plasma` → `ranged_fast`/`ranged_aoe`), `Kira` (hybrid `melee` Dash-Kick when `isSurge || damageValue >= 12 || attackToggle % 2 === 1`, otherwise `ranged_fast`/`ranged_aoe` `pistol_bolt`).
- **Mutants (`classifyEnemyAttackStaging`)**: `Bile Spitter` (`acid_bile` `ranged_fast`, `clawRend` `melee`), `Pyre Stinger` (`stinger_dart` `ranged_fast`), and `Spore Mite`, `Cobalt Skitter`, `Chitin Stalker`, `Rabid MutDog`, `Feral Nurse`, `Carapace Brute`, `Xenomorph Matriarch` (`melee` nose-to-nose clash).
- **Defaults**: `windupSec = 0.15s`, `rangedBeat1Sec = 0.24s`, `rangedWhipPanSec = 0.13s`, `holdNormalSec = 0.60s`, `holdCritSec = 1.00s`, `resetSec = 0.25s`, `hitstopNormal/Aoe/Crit = 0.12s/0.16s/0.25s`, `zoomNormal = 1.52×`, `zoomCrit = 1.80×`, `zoomRangedShooter = 1.42×`, `zoomAoeMin/Max = 1.22×/1.30×`, `dutchDegNormal/Crit = 2.2°/3.5°`, `attackerScalePunch = 1.28×`, `meleeClashGapVw = 12.5%`, `meleeForegroundScale = 1.07×`, `dimmerAlpha = 0.75`.
- **Adaptive Pack Tempo & Overscan Clamp**: `computePackTempoScale` (`1.0×` for `1–2` Mutants, `0.80×` for `3–4`, `0.64×` for `5+`); `computeMinZoomForRotation` and `clampPanForRotationBounds` keep rotated corners within `BACKDROP_BLEED_X = 32`, `BACKDROP_BLEED_Y = 16`.

---

## 4. Unified `DEV` Animation Lab (`?devLabs=1`)

`CombatDevLabsPanel.tsx` (lazy-loaded strictly when `import.meta.env.DEV === true`) exposes a single compact `⚗ ANIM LAB` toggle and `<select>` tab switcher (`?devLabTab=hero|spitter|brute|mutdog|feral_nurse|camera`):
- **`★ HERO` (`CombatHeroLabPanel.tsx`)**: Switch active Hero (`Kira`, `Auraline`, `Zuri`) and fire `HeroAnimMode` clips via `Keys 1–9, 0` (+ `Defeat`/`Victory`).
- **Registered Tier A Mutant Labs (`TIER_A_LAB_ARCHETYPES`)**: Live parameter tuning + `Keys 1–6` triggers for `Spitter`, `Brute`, `MutDog`, and `Feral Nurse` (and any future Mutant promoted to Tier A).
- **`◎ CAMERA`**: Tune `DEFAULT_COMBAT_PRESENTATION_CONFIG` and fire `Keys 1–5` (`melee_normal`, `melee_crit`, `ranged_single`, `ranged_aoe`, `kira_dodge`).
