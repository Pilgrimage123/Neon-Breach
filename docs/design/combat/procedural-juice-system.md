# 4-Layer Procedural Juice & Spring Physics System

`src/utils/proceduralJuiceCore.ts`, `src/utils/spitterJuiceController.ts`, and `src/utils/bruteJuiceController.ts` drive multi-layered procedural motion for heavy/reworked Mutants (`spitter` and `brute`) on top of the `4 × 6` WebGL2 mesh.

---

## 1. Shared 4-Layer Architecture (`proceduralJuiceCore.ts`)

1. **Layer 1 — Frame & Cross-Dissolve Authority:** When a Juice controller drives an enemy, it is the **sole authority** over `frameIndex`, `secondaryFrameIndex`, `secondaryWeight`, `offsetX`, `offsetY`, `scaleX`, `scaleY`, and `rotationRad` (no double-sampling alongside legacy samplers). Simulation stepping executes inside `stepCombatSimulation` (`combatVfx.ts`), keeping `combatRenderer.ts` pure read-only draw logic.
2. **Layer 2 — Symplectic Euler Spring & 2.5D Kinematics:**
   * **Damped Harmonic Spring (`stepJuiceSpring`):** Semi-implicit Euler integration sub-stepped (`2×`, `dt <= 0.05s`) driving `(scaleX, scaleY)` squash-and-stretch with clamped recovery bounds.
   * **2.5D Paper-Mario Flip (`stepJuiceFlip25D`):** Cosine `facingScale` transition through `0` paired with a parabolic `-sin(pi * u) * hopPx` lift (`u` strictly clamped to `[0, 1]` so pre-flip pauses never sink below the deck).
   * **Walk Waddle & Velocity Shear:** Sin-wave step wobble + clamped horizontal velocity shear (`velocitySkew`).
3. **Layer 3 — 4-Knot Spine Deformation (`FourKnotSpine`):** Shared `feet / pelvis / waist / head` control points driving subtle breathing, whip-recoil on `take_hit`, and charge posture expansion on the `4 × 6` mesh.
4. **Layer 4 — Selective Shader Uniforms & Ballistic VFX:**
   * Selective `u_uvDistort` during `cast_charge` / `death_knockback` (disabled during neutral idle, walking, and standard strikes to avoid jelly artifacts).
   * **Bile Spitter Tuned Parameters (`spitterJuiceController.ts`):** `16`-frame (`0..15`) sheet; idle jaw-snap blink every `2.4–3.5s`; charge tremor `16 rad/s` (`0.45px` amp) with `uvDistortAmp` `0.0035–0.0080` (`uvDistortFreq` `14–20`); `mouthOriginRel`-anchored `renderSpitterBileTorrent` Quadratic Bezier stream with particles emitted inside `stepCombatSimulation`.
   * **Carapace Brute Tuned Parameters (`bruteJuiceController.ts`):** `16`-frame (`0..15`) sheet; seismic slam fissures (`renderBruteGroundFissure`), kinetic armor shards, mutagen breath mist, and heavy step thud scale impulse.

---

## 2. Five Mandatory Enemy Visual Rules

1. **No Baked-In Floor Props:** Trim cell bounds to claw/foot soles (`bottomY`) and render persistent puddles/fissures procedurally on Layer 0 (`baseCtx`).
2. **Ballistic Hand-Off:** Crop baked projectile streaks from strike frames and drive ranged streams from `mouthOriginRel` using normalized animation progress (`spitStreamProgress`).
3. **Single Transform Authority:** Never stack legacy `sample*Frame` offsets/scales on top of a Juice controller.
4. **Pure Rendering (`combatRenderer.ts`):** Advance all juice clocks, springs, and particle emitters inside `stepCombatSimulation`, never inside `renderCombatStage`.
5. **Bounded Spring Integration:** Always clamp `dt` and sub-step springs (`SpriteJuiceFeedbackHandler` + `proceduralJuiceCore`) to prevent lag-spike divergence.
