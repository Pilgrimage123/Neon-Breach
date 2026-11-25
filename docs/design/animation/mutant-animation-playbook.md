# Mutant Animation Playbook (Paradigm 2 — Tier A Standard)

> **Related**: [GLOSSARY.md](../../../GLOSSARY.md), [ADR-0011](../../adr/0011-universal-build-time-sprite-baking.md), [ADR-0012](../../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md), [Shared Invariants](./shared-invariants-and-baking.md).

---

## 1. Tier A Convergence & 4-Layer `proceduralJuiceCore`

All 9 `EnemyArchetype`s are registered in `src/utils/mutantAnimationRegistry.ts` (`MUTANT_ANIMATION_REGISTRY`, `getMutantArchScale`) and converge on **Tier A** (4-Layer `proceduralJuiceCore.ts` + multi-frame sheet + `DEV` Lab tab). Legacy `sample*Frame` double-sampling is retired on all Juice-driven Mutants — the `*JuiceController` is the sole authority over `frameIndex`, `prevFrameIndex`, `frameBlendAlpha`, `offsetX`, `hopYPx`, `springScaleX/Y`, `rotationRad`, `deform`, and shader uniforms.

1. **Layer 1 — Crisp Frame Authority**: Instant `blendDuration = 0` cuts (`frameBlendAlpha = 1`), except for the 2-item allowlist (`Feral Nurse` `Optical Cloak` `0.04s`, `Chitin Stalker` 2-frame eyelid blink `0.04–0.065s`).
2. **Layer 2 — Symplectic Euler Spring & 2.5D Kinematics**: Sub-stepped (`2×`, `dt <= 0.05s`) `stepSymplecticSpringScale`, `stepHorizontalFlip` (cosine `facingScale` + clamped `-sin(π * u) * hopPx`), and `stepHorizontalVelocityShear`.
3. **Layer 3 — 4-Knot Spine Deformation (`FourKnotSpine`)**: `feet (0.00)` pinned, `pelvis (0.33)`, `waist (0.67)`, `head (1.00)`.
4. **Layer 4 — Selective Shader Uniforms & Landmark Bio-VFX**: `u_uvDistort` restricted to charge/rupture/KO states; ballistic/melee VFX anchored to scanned post-flip `*Rel` landmarks (`mouthOriginRel`, `pustuleOriginRel`, `vialOriginRel`, `shellOriginRel`, `impactOriginRel`, `lureOriginRel`, `mawOriginRel`, `headsetOriginRel`, `clawOriginRel`).

---

## 2. Complete 9-Mutant Roster & Bake Matrix

| Archetype | Tier | Sheet Geometry | Bake Mode (`scripts/bakeSprites.ts`) | `CANONICAL_HEIGHT` | `archScale` | Native Facing (`facingSign`) | Notes |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **Bile Spitter** (`spitter`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + `excludeRects` | `246` | `0.94` | Right (`-1`) | `spitterJuiceController.ts`, Bezier bile stream, ground puddle |
| **Carapace Brute** (`brute`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + glow unmix + Frame 10 `excludeRects` | `234` | `1.32` | Right (`-1`) | `bruteJuiceController.ts`, 5 intent/hover postures, chest vials, dorsal plumes, fissures |
| **Rabid MutDog** (`mutdog`) | **Tier A** | `4×4` (`1024×1024`, 16f) | White BFS + glow unmix | `182` | `0.94` | Right (`-1`) | `mutdogJuiceController.ts`, twin amber lures, foaming drool, maul slam |
| **Feral Nurse** (`feral_nurse`) | **Tier A** | Dual `4×4` (`2×1024×1024`, 32f) | `#00D856` chroma-green pre-keyed (`preserveExistingAlpha`) | `248` | `1.02` | Right (`-1`) | `feralNurseJuiceController.ts`, **Optical Cloak** (`0.04s` allowlist), cap-cross scanned `headsetOriginRel` |
| **Chitin Stalker** (`stalker`) | *Transitional* | `2 × 512×512` PNGs | Passthrough (`preserveExistingAlpha`) | `460` | `0.98` | Left (`+1`) | `stalkerJuiceController.ts`, eyelid blink allowlist, **7 bone-weighted slime nozzles** *(must be preserved when upgraded to Tier A)* |
| **Spore Mite** (`larva`) | *Transitional* | `3×16` shared (`2172×724`, Row 0) | White BFS (`minPocketArea: 24`) | `180` | `0.62` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Cobalt Skitter** (`skitter`) | *Transitional* | `3×16` shared (`2172×724`, Row 1) | White BFS (`minPocketArea: 24`) | `180` | `0.68` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Pyre Stinger** (`stinger`) | *Transitional* | `3×16` shared (`2172×724`, Row 2) | White BFS (`minPocketArea: 24`) | `180` | `0.74` | Left (`+1`) | `crawlerSpriteSheet.ts` stateless sampler until Tier A sheet |
| **Xenomorph Matriarch** (`boss`) | *Transitional* | Static portrait (`512×512`) | White BFS (`maxDimension: 512`) | `null` | `1.24` | Left (`+1`) | Static cutout + WebGL2 mesh sway until Tier A sheet |

---

## 3. Six Mandatory Anti-Pitfall Rules (Learned from Feral Nurse & Brute)

1. **White Uniforms Require `#00D856` Chroma-Green Keying (`cleanChromaGreenData`)**: Never run white-background BFS on Mutants wearing bright white garments (`Feral Nurse`).
2. **Pelvis-Centroid `anchorX`**: Compute `anchorX` from the torso/pelvis opaque mass (`35%–65%` height), never foot-midpoint, and co-shift all `*OriginRel.dx` values by `-Δx`.
3. **Never Mix Incompatible Posture Heights in Continuous Loops**: Keep `Δh <= 8px` for Idle breathing and isolate deep ambush crouches (`h < 215px`) or tall alert poses (`h > 250px`) to explicit state transitions.
4. **Crisp Cuts (`blendDuration = 0`) Across Limb Motion**: Reserve `blendDuration > 0` strictly for `Optical Cloak` spectral states; advance `blendTimer` *after* branch frame selection.
5. **Scan VFX Origins Algorithmically**: Locate unique color landmarks (e.g., red nurse-cap cross, glowing eyes, leading claw tip) via Node PNG inspection rather than eyeballing.
6. **Phase-Lock Procedural Hop Arcs**: Keep `hopYPx = 0` on grounded heel-contact/landing frames and confine `sin(...)` lift to airborne stride windows (`strideU ∈ [0.22, 0.78]`).
