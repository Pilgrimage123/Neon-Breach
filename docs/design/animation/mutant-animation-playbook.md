# Mutant Animation Playbook (Paradigm 2 — Tier A Standard)

> **Related**: [GLOSSARY.md](../../../GLOSSARY.md), [ADR-0011](../../adr/0011-universal-build-time-sprite-baking.md), [ADR-0012](../../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md), [Shared Invariants](./shared-invariants-and-baking.md).

---

## 1. Tier A Convergence & 4-Layer `proceduralJuiceCore`

All 9 `EnemyArchetype`s are registered in `src/utils/mutantAnimationRegistry.ts` (`MUTANT_ANIMATION_REGISTRY`, `getMutantArchScale`, `computeEnemyCrowdScale`, `computeBaseEnemySize`) and converge on **Tier A** (4-Layer `proceduralJuiceCore.ts` + multi-frame sheet + `DEV` Lab tab). Every combat consumer (rendering, hitboxes, Action Camera bounds, tactical plaques, and `ANIM LAB`) must read `getMutantArchScale` and `computeBaseEnemySize` (`crowdScale`: `0.92` for 4 slots, `0.86` for 5+ slots) instead of hardcoding scale literals. Legacy `sample*Frame` double-sampling is retired on all Juice-driven Mutants — the `*JuiceController` is the sole authority over `frameIndex`, `prevFrameIndex`, `frameBlendAlpha`, `offsetX`, `hopYPx`, `springScaleX/Y`, `rotationRad`, `deform`, and shader uniforms.

1. **Layer 1 — Crisp Frame Authority**: Instant `blendDuration = 0` cuts (`frameBlendAlpha = 1`), except for the 2-item allowlist (`Feral Nurse` `Optical Cloak` `0.04s`, `Chitin Stalker` 2-frame eyelid blink `0.04–0.065s`).
2. **Layer 2 — Symplectic Euler Spring & 2.5D Kinematics**: Sub-stepped (`2×`, `dt <= 0.05s`) `stepSymplecticSpringScale`, `stepHorizontalFlip` (cosine `facingScale` + clamped `-sin(π * u) * hopPx`), and `stepHorizontalVelocityShear`.
3. **Layer 3 — 4-Knot Spine Deformation (`FourKnotSpine`)**: `feet (0.00)` pinned, `pelvis (0.33)`, `waist (0.67)`, `head (1.00)`.
4. **Layer 4 — Selective Shader Uniforms & Landmark Bio-VFX**: Keep `u_uvDistort` strictly `[0, 0]` in idle/locomotion (restricted to charge/rupture/cloak/pain/KO states); project all ballistic/melee/bio-VFX landmarks (`mouthOriginRel`, `pustuleOriginRel`, `vialOriginRel`, `shellOriginRel`, `impactOriginRel`, `lureOriginRel`, `mawOriginRel`, `headsetOriginRel`, `clawOriginRel`, `quillOriginRel`, `eyeOriginRel`, slime nozzles) through `projectSpriteLandmarkToStage` (`src/components/combat/stageMeshMath.ts`).

---

## 2. Complete 9-Mutant Roster & Bake Matrix

| Archetype | Tier | Sheet Geometry | Bake Mode (`scripts/bakeSprites.ts`) | `CANONICAL_HEIGHT` | `archScale` | Native Facing (`facingSign`) | Notes |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **Bile Spitter** (`spitter`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + jet-only `excludeRects` | `246` | `0.96` | Right (`-1`) | 4-file `spitterJuice{State,Branches,Stepper,Controller}`, Bezier bile stream, F1-grounded waddle hop, ground puddle |
| **Carapace Brute** (`brute`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + glow unmix + Frame 10 `excludeRects` | `234` | `1.32` | Right (`-1`) | `bruteJuiceController.ts`, 5 intent/hover postures, chest vials, dorsal plumes, fissures |
| **Rabid MutDog** (`mutdog`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + glow unmix | `182` | `0.78` | Right (`-1`) | `mutdogJuiceController.ts`, per-frame `frameScale` for idle/howl/pounce normalization, twin amber lures, foaming drool, maul slam |
| **Feral Nurse** (`feral_nurse`) | **Tier A** | Dual `4×4` (`2×1024×1024`, 32f) | `#00D856` chroma-green pre-keyed (`preserveExistingAlpha`) | `248` | `1.00` | Right (`-1`) | `feralNurseJuiceController.ts`, per-frame `frameScale` on prowl `F5..F9`, **Optical Cloak** (`0.04s` allowlist), cap-cross scanned `headsetOriginRel` |
| **Chitin Stalker** (`stalker`) | *Transitional* | `2 × 512×512` PNGs | Passthrough (`preserveExistingAlpha`) | `460` | `1.04` | Left (`+1`) | `stalkerJuiceController.ts`, eyelid blink allowlist, **7 bone-weighted slime nozzles** *(must be preserved when upgraded to Tier A)* |
| **Spore Mite** (`larva`) | *Transitional* | `3×16` shared (`2172×724`, Row 0) | White BFS (`minPocketArea: 24`) | `180` | `0.79` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Cobalt Skitter** (`skitter`) | *Transitional* | `3×16` shared (`2172×724`, Row 1) | White BFS (`minPocketArea: 24`) | `180` | `0.60` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Pyre Stinger** (`stinger`) | *Transitional* | `3×16` shared (`2172×724`, Row 2) | White BFS (`minPocketArea: 24`) | `180` | `0.78` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Xenomorph Matriarch** (`boss`) | *Transitional* | `2` baked PNGs (`585×640` intact, `640×427` exploded) | White BFS + `removeNeutralFloorShadow` + `removeSubtleCheckerboard` | `560` | `1.36` | Left (`+1`) | `matriarchJuiceController.ts`, **half-HP (`hp <= maxHp * 0.5`) dorsal carapace explosion** (`rupture` state -> Phase 2 crouch), `14` bone-weighted slime/ember nozzles |

---

## 3. Mandatory Anti-Pitfall Rules

1. **White Uniforms Require `#00D856` Chroma-Green Keying (`cleanChromaGreenData`)**: Never run white-background BFS on Mutants wearing bright white garments (`Feral Nurse`).
2. **Pelvis-Centroid `anchorX`**: Compute `anchorX` from the torso/pelvis opaque mass (`35%–65%` height), never foot-midpoint, and co-shift all `*OriginRel.dx` values by `+Δx` when stored post-flip relative to `anchorX` (`rel.dx = anchorX - rawX`).
3. **Never Mix Incompatible Posture Heights in Continuous Loops**: Keep `Δh <= 8px` for Idle breathing and isolate deep ambush crouches (`h < 215px`) or tall alert poses (`h > 250px`) to explicit state transitions.
4. **Crisp Cuts (`blendDuration = 0`) Across Limb Motion**: Reserve `blendDuration > 0` strictly for `Optical Cloak` spectral states and `Chitin Stalker` identical-silhouette eyelid blinks; advance `blendTimer` *after* branch frame selection.
5. **Scan VFX Origins Algorithmically**: Locate unique color landmarks (e.g., red nurse-cap cross, glowing eyes, dorsal pustules, slime nozzles, leading claw tip) via Node PNG inspection rather than eyeballing.
6. **Phase-Lock Procedural Hop Arcs**: Keep `hopYPx = 0` on grounded contact/landing frames (`F1` on Spitter walk, `F3/F5` on MutDog prowl, etc.) and confine `sin(...)` lift to airborne stride windows.
7. **Project All Anatomical VFX via `projectSpriteLandmarkToStage`**: Never approximate deformed VFX origins with `deform.head.dx * drawScale * facingSign` or omit `rotationRad`/`squashStretch`/`swayAmpPx`/`shearPx`. `deform.*.dx/dy` are world-pixel offsets (not multiplied by `drawScale`). Derive `deform` and `uniforms` first and pass them to `projectSpriteLandmarkToStage` (`nativeFacingSign: 1` for native left-facing sprites like `Chitin Stalker` and `Xenomorph Matriarch`, default `-1` for mirrored right-facing sheets).
8. **Enforce Spline & Rotation Sign Polarity Under `facingSign = -1`**: Because `computeDeformedMeshVertices` computes `mirroredX = (rawLocalX * cos + deform.dx) * facingSign`, under `facingSign = -1` (facing LEFT toward Heroes), **positive** `deform.*.dx` bends **forward** (LEFT toward Hero) and **negative** `deform.*.dx` bends **backward** (RIGHT away from Hero). Under `facingSign = +1` (native left-facing `stalker`/`boss`), **negative** `deform.*.dx` lunges forward (LEFT) and **positive** `deform.*.dx` recoils backward (RIGHT). Keep idle `uvDistortAmp` strictly `[0, 0]`.
9. **Anatomy-Safe `excludeRects` Slicing**: Verify via pixel scanning that `excludeRects` never clip extended anatomy (snouts, teeth, talons, limbs); strip only isolated artifact regions (e.g., horizontal bile jets past teeth on Spitter `F5`/`F6`) and re-run `npm run bake:sprites`.
10. **Multi-Phase Boss Scale Invariance (`MATRIARCH_CANONICAL_HEIGHT = 560`)**: When a boss transitions between distinct upright (`585×640`) and crouched/ruptured (`640×427`) phase frames (e.g. `isMatriarchBackExploded(hp, maxHp)` at `hp <= maxHp * 0.5`), share a single `CANONICAL_HEIGHT` calibrated from rigid anatomical spans (eye-to-pelvis / head-to-claw) and keep `frameBlendAlpha = 1` so the carapace rupture cuts crisply without ghosting or head/claw rescaling.
