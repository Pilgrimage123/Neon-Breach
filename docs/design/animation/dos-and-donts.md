# Animation Do's & Don'ts (Canonical Lessons)

> **Canonical Vocabulary & Decisions**: [GLOSSARY.md](../../../GLOSSARY.md) · [ADR-0003](../../adr/0003-hybrid-canvas2d-webgl2-stage.md) · [ADR-0006](../../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md) · [ADR-0011](../../adr/0011-universal-build-time-sprite-baking.md) · [ADR-0012](../../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md)
> **Implementation Playbooks**: [Shared Invariants & Baking](./shared-invariants-and-baking.md) · [Combat Stage & Camera](./combat-stage-and-camera.md) · [Hero Playbook](./hero-animation-playbook.md) · [Mutant Playbook](./mutant-animation-playbook.md) · [Title Emblem Pipeline](./title-emblem-pipeline.md)

Read this checklist before authoring, baking, or coding any new animation in Neon Breach.

---

## 0. Production Reference Benchmarks (What Worked vs. What Didn't)

Use these real project outcomes as your compass before choosing an approach:

- **✅ Gold Standard — Tier A Mutants & Heroes (`Rabid MutDog`, `Bile Spitter`, `Carapace Brute`, `Feral Nurse`, `Kira`, `Auraline`)**: Crisp `4×4` multi-frame sheets (`blendDuration = 0`) paired with the 4-Layer `proceduralJuiceCore` (symplectic springs, `FourKnotSpine`, and algorithmically scanned VFX landmarks). Delivers the highest visual clarity, weight, and maintainability.
- **⚠️ Early-Phase Legacy — Hero (`Zuri`)**: Functional, but rooted in an early-phase multi-sheet architecture (`HeroAnimator` + per-row `rowScale` stitching). Do not copy these workarounds for new characters; converge new work on the Tier A `proceduralJuiceCore` standard.
- **❌ Cautionary / Unsuccessful — Restorative Clinic Nurse (`NurseStageCanvas`)**: Unwarped `4.2 fps` cross-dissolve + `trajectoryWarp` ping-pong caused persistent double-exposure ghosting. Formally banned.
- **❌ Cautionary / Low-ROI — Title Emblem (`TitleEmblemStage`)**: Even with `9` keyframes and a `42`-triangle `Anatomical Warp Lattice`, warping disparate illustrated key-art poses in Canvas2D carries heavy calibration cost and still feels less cohesive than crisp Tier A sprite-sheet + rig-physics animation. Avoid Paradigm 1 key-art morphing for future characters or showcases unless strictly justified.

---

## 1. Source Assets & AI Sprite Sheet Authoring

- **✅ Do** author sprites on a solid, high-contrast background — specifically `#00D856` chroma-green (`cleanChromaGreenData`) for characters wearing white garments.
  - **❌ Don't** use a white background for white-uniformed characters.
  - **Why**: White-background BFS eats into bright white uniforms (`Feral Nurse` required switching to `#00D856` chroma-green).
- **✅ Do** keep pose heights consistent within continuous loops (`Δh <= 8px` for idle breathing) and isolate deep crouches (`< 215px`) or tall alerts (`> 250px`) into explicit state transitions.
  - **❌ Don't** mix incompatible posture heights inside a single idle or walk cycle.
  - **Why**: Mixed heights cause jarring vertical popping even when `bottomY` is pinned.
- **✅ Do** keep transient VFX (bile jets, muzzle flashes, slime drips) separate from body frames; if source artifacts must be stripped via `excludeRects`, verify the rects with a pixel scan.
  - **❌ Don't** eyeball `excludeRects` or paint permanent projectile beams into body poses.
  - **Why**: Unverified `excludeRects` clip extended anatomy (snouts, teeth, talons); only isolated artifacts (e.g., `Bile Spitter` `F5`/`F6` horizontal jets) should be masked.
- **✅ Do** calibrate multi-phase bosses on rigid anatomical spans (eye-to-pelvis / head-to-claw) sharing one `CANONICAL_HEIGHT` across phases.
  - **❌ Don't** normalize each boss phase independently to its own bounding-box height.
  - **Why**: `Xenomorph Matriarch` (`585×640` intact → `640×427` crouched/ruptured) shares `MATRIARCH_CANONICAL_HEIGHT = 560` so her head and claws never rescale on the 50% carapace rupture.
- **✅ Do** use **Heroic Keyframe Splicing & `2×2` batch authoring** for extreme signature poses (e.g., Kira's arched-back visor-down **Surge Blast** `F11`, and Auraline's wide-stance recoil roar **Artillery Surge Blast** `F11` cropped cleanly at the gun barrel tip) and render massive shockwave halos/beams at runtime via `projectSpriteLandmarkToStage` (`combatForegroundFxRenderer.ts`, including Auraline's muzzle-anchored `auraline_surge_blast_vfx.png` cyber-ring plasma beam).
  - **❌ Don't** rely solely on `4×4` cell-packed AI generation for extreme recoil/flying poses or bake wide horizontal blast beams inside a `256×256` character cell (which would shrink the character to `< 40%` height).
  - **Why**: Packing 16 poses into one `4×4` sheet pressures image models toward conservative upright silhouettes, and keeping the beam inside a square character cell destroys scale parity; splicing the clean full-scale character pose into the cell while anchoring the beam texture at `muzzleRel` in Canvas2D delivers maximum impact without clipping or shrinking.
- **✅ Do** store all raw source rasters under `assets-src/{title,heroes,mutants,clinic,portraits}/`.
  - **❌ Don't** commit unbaked originals into `public/assets/`.
  - **Why**: `public/assets/` copies raw megabytes straight into `dist/` (`ADR-0011`).

---

## 2. Offline Baking, Anchoring & Landmarks

- **✅ Do** bake all sheets offline via `npm run bake:sprites` (`scripts/bakeSprites.ts`) into `src/assets/sprites/baked/` and decode at runtime via `createImageBitmap`.
  - **❌ Don't** run `getImageData`, `putImageData`, BFS flood-fill, or `willReadFrequently: true` canvases in browser code, and never invoke `sharp` inside `vite build`.
  - **Why**: Runtime pixel readback stalls the main thread and breaks `ADR-0002` pure-`vite build` compatibility (`ADR-0011`).
- **✅ Do** calibrate `anchorX` to the horizontal center-of-mass of the **pelvis/torso band (`35%–65%` of frame height)**.
  - **❌ Don't** anchor `anchorX` to the bounding-box midpoint between front and back feet.
  - **Why**: Foot-midpoint anchoring causes `8–19px` horizontal hip-teleportation during asymmetric strides.
- **✅ Do** lock `bottomY` to ground-sole contact (`groundY` / `enemyGroundY`, or `Zuri`'s calibrated hover deck reference).
  - **❌ Don't** let breathing or flinch frames drift off the ground line.
  - **Why**: Unpinned `bottomY` makes characters slide or float during idle and hit reactions.
- **✅ Do** co-shift post-flip `*OriginRel.dx` offsets by `+Δx` whenever `anchorX` shifts by `Δx`.
  - **❌ Don't** recalibrate `anchorX` without updating relative landmarks.
  - **Why**: Post-flip landmarks (`rel.dx = anchorX - rawX`) immediately desync from mouths, muzzles, and claws if not co-shifted.
- **✅ Do** derive VFX origins (`muzzleRel`, `mouthOriginRel`, `headsetOriginRel`, slime nozzles) via deterministic Node PNG pixel scanning.
  - **❌ Don't** eyeball landmark coordinates in code.
  - **Why**: Algorithmic scanning locks emitters onto exact features (e.g., `Feral Nurse` cap cross, `Rabid MutDog` lures, `Bile Spitter` mouth).

---

## 3. Runtime Transitions, Rig Physics & Shaders (Two-Paradigm Law)

- **✅ Do** use **instant crisp frame cuts (`blendDuration = 0`, `frameBlendAlpha = 1`)** for all combat `Hero` and `Mutant` sprite sheets, driving `60 FPS` fluidity through symplectic springs and the 4-knot Hermite spine (`FourKnotSpine`).
  - **❌ Don't** cross-dissolve unwarped sprite frames across limb or head motion.
  - **Why**: Unwarped cross-dissolves produce *"two heads / four legs"* double-exposure ghosting (`ADR-0012`).
- **✅ Do** respect the strict **2-item combat allowlist** for `blendDuration > 0`:
  1. `Feral Nurse` `Optical Cloak` (`0.04s`) — intentional spectral phase afterimage.
  2. `Chitin Stalker` 2-frame eyelid blink (`0.04–0.065s`) — identical body silhouette.
  - **❌ Don't** add new `blendDuration > 0` combat transitions or copy `NurseStageCanvas` (`4.2 fps` unwarped cross-dissolve + `trajectoryWarp`).
  - **Why**: Every other pose change shifts silhouette geometry and ghosts immediately.
- **✅ Do** follow the **Tier A Modular Recipe**: split each new controller into `*JuiceState` + `*JuiceBranches` + `*JuiceStepper` + a thin `*JuiceController` barrel, register it in `MUTANT_ANIMATION_REGISTRY` and `TIER_A_LAB_ARCHETYPES` (`DEV` Animation Lab), and use `stepHorizontalFlip` from `proceduralJuiceCore.ts` for 2.5D turns.
  - **❌ Don't** cram state, branch selection, and physics stepping into a single monolithic controller or reimplement spring/flip math ad-hoc.
  - **Why**: This exact 4-file structure + `proceduralJuiceCore.ts` powers `Rabid MutDog`, `Carapace Brute`, and `Feral Nurse`, keeping each file small, testable, and immediately tunable in `?devLabs=1`.
- **✅ Do** keep a single state authority per actor (`*JuiceController` for Mutants, `HeroAnimator` for Heroes), advance `blendTimer` *after* branch frame selection, and guard `blendDuration <= 0` before division.
  - **❌ Don't** double-sample legacy `sample*Frame` alongside a `*JuiceController`, or divide `blendTimer / blendDuration` without guarding `<= 0`.
  - **Why**: Duplicate sampling causes conflicting pose state, and `0 / 0 = NaN` breaks rendering on `dt = 0` hitstop ticks.
- **✅ Do** phase-lock procedural hop arcs (`hopYPx = 0` on grounded contact/landing frames) and keep `u_uvDistort` strictly `[0, 0]` during idle and locomotion.
  - **❌ Don't** apply continuous sinusoidal hops over grounded frames or idle UV wobble.
  - **Why**: Unsynced hops make planted feet hover (`Bile Spitter` `F1`, `Rabid MutDog` `F3`/`F5`), and idle UV distortion makes line art swim.
- **✅ Do** project all anatomical VFX exclusively through `projectSpriteLandmarkToStage` (`stageMeshMath.ts`), respecting `facingSign` polarity (`-1` mirrored right-facing vs. `+1` native left-facing like `Chitin Stalker` and `Xenomorph Matriarch`).
  - **❌ Don't** approximate deformed VFX origins with `deform.head.dx * drawScale * facingSign` or omit `rotationRad`/`squashStretch`/`swayAmpPx`/`shearPx`.
  - **Why**: `deform.*.dx/dy` are already world-pixel offsets (not multiplied by `drawScale`), and sign errors invert lunges and recoils.

---

## 4. Action Camera, VFX & UI / Tile Micro-Animations

- **✅ Do** fade world-space UI (`worldUiAlpha`) during focal cut-ins, flush camera state immediately when `tacticalViewActive === true` (`cleanupActiveState`), and clamp pan/zoom for rotation overscan (`computeMinZoomForRotation`).
  - **❌ Don't** leave lifebars cluttering close-up cut-ins or allow Dutch tilt to expose empty backdrop corners.
  - **Why**: Keeps tactical readability crisp and prevents visual tearing at the stage edges.
- **✅ Do** scale combat animation tempo with enemy pack size (`computePackTempoScale`).
  - **❌ Don't** run full-length solo attack timings across 5+ Mutants.
  - **Why**: Prevents enemy turns from dragging in large encounters.
- **✅ Do** keep UI and `Tile` micro-animations short, interruptible, and non-blocking, and isolate all tuning tools (`ANIM LAB`) behind `import.meta.env.DEV`.
  - **❌ Don't** gate player clicks/hotkeys behind decorative UI transitions or ship debug labs in production bundles.
  - **Why**: Responsive tactical input always beats decorative motion, and production builds must carry zero debug overhead (`ADR-0003`).

---

## 5. Frame Budget, Zero-GC & Accessibility

- **✅ Do** target `60 FPS` (`16.67 ms/frame`) with `DPR <= 2`, pre-allocated typed arrays (`Float32Array`, `Uint8Array`) and object pools outside `requestAnimationFrame`, `dt <= 0.05s` clamping, and simulation pause when `document.hidden === true`.
  - **❌ Don't** allocate per-frame objects/arrays or drive `requestAnimationFrame` clocks through React `useState`.
  - **Why**: GC pauses and React re-renders cause frame-time spikes on the combat stage.
- **✅ Do** honor `prefers-reduced-motion: reduce` across Canvas2D, WebGL2, and CSS UI animations.
  - **❌ Don't** leave idle breathing, slime drips, camera shake, Dutch tilt, invert flashes, or sheen running when reduced motion is enabled.
  - **Why**: Accessibility invariant across every stage (`shared-invariants-and-baking.md`).

---

## 6. Pre-Flight Checklist (Before Merging Any New Animation)

1. **Baked Offline**: Raw source is in `assets-src/`, `npm run bake:sprites` succeeded, and zero `getImageData` / `willReadFrequently` calls exist in runtime code.
2. **Anchored Properly**: `anchorX` is pelvis-centroid (`35%–65%` height), `bottomY` is sole-locked, and `*OriginRel.dx` landmarks are scanned and co-shifted.
3. **Crisp Cuts**: `blendDuration = 0` everywhere outside the 2-item combat allowlist (no unwarped cross-dissolve).
4. **Unified Landmark Projection**: All anatomical VFX route through `projectSpriteLandmarkToStage` with verified `facingSign` polarity.
5. **Zero-GC & Safe Clocks**: No per-frame heap allocations or React state updates; `dt <= 0.05s` and `document.hidden` pause are respected.
6. **Reduced Motion**: `prefers-reduced-motion: reduce` freezes ambient motion, shake, tilt, and flashes cleanly.
7. **Verified in Lab & Tests**: Visually inspected in `?devLabs=1` (`ANIM LAB`) and covered by sprite-sheet / controller unit tests.
