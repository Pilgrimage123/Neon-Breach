# Feral Nurse (`feral_nurse`) — 32-Frame Dual-Sheet Animation Pipeline, Post-Mortem & Anti-Pitfall Spec

---

## 1. End-to-End Architecture & Correct Pipeline

### 1.1 Dual-Sheet 32-Frame Asset Generation & Chroma-Green Cutout
* **Why White/Dark Flood-Fill Fails on Feral Nurse:** Feral Nurse wears a **bright white medical uniform** (`R>235, G>235, B>235`), a **white nurse cap with a red cross**, and **white stiletto heels**, alongside **dark purple-black necrotic limbs and stockings**. Standard white-background BFS flood-fill (`cleanWhiteBackgroundData`) eats into her white skirt, collar, and cap where outlines thin out, leaving ragged "white-spot" holes or background islands inside enclosed loops (between arms, ponytail, and thighs).
* **Correct Asset Pipeline:**
  1. Generate two `1024 × 1024` `4 × 4` grids (**32 frames total**: `feral_nurse_sheet_a.png` for frames `0..15`, `feral_nurse_sheet_b.png` for frames `16..31`) on a **solid flat chroma-green (`#00D856`) backdrop** — a hue completely absent from her white/crimson/magenta/violet palette.
  2. Run a **build-time chroma-green alpha keyer + green-spill desaturation pass** before saving lossless RGBA PNGs into `src/assets/sprites/`:
     * Pixels with `G - max(R, B) > 28` become `alpha = 0`.
     * 1–2px edge fringe pixels with `G > max(R, B)` have green clamped to `G = max(R, B)` and alpha scaled proportionally (`preserveExistingAlpha: true` at runtime).
  3. Slice both sheets at boot via `loadDualSpriteSheetFrames(SHEET_A_URL, FERAL_NURSE_SHEET_A_FRAMES, SHEET_B_URL, FERAL_NURSE_SHEET_B_FRAMES, { preserveExistingAlpha: true })` into a unified 32-element `HTMLCanvasElement[]`.

### 1.2 Anatomical Frame Map (32 Frames)
| Range | Sheet / Row | Frames & Purpose |
| :--- | :---: | :--- |
| `0..3` | Sheet A · Row 0 | `0`: Deep ambush crouch (transition-only), `1`: Upright crouched inhale, `2`: Upright crouched exhale sway, `3`: Bared-fang predatory hiss |
| `4..9` | Sheet A · Rows 1–2 | `4`: Hand-on-floor ambush crouch (cloak/transition-only), `5`: Front stiletto contact, `6`: Mid-stride weight pass, `7`: Airborne push-off bound, `8`: Opposite-leg reach, `9`: Cushioned heel land |
| `10..11` | Sheet A · Row 2 | `10`: Poised upright alert (`254px` tall), `11`: Crossed-forearm feral guard |
| `12..15` | Sheet A · Row 3 | **Move 1 — Optical Cloak:** `12`: Tapping magenta cyber-headset, `13`: Phase-vanish compression crouch, `14`: Ultra-low phantom hover, `15`: Snap-up decloak |
| `16..19` | Sheet B · Row 0 | **Move 2 — Prepare Telegraph Coil:** `16`: Coil start, `17`: Deep hunter coil, `18`: Apex fangs-bared tension, `19`: Explosive launch push-off |
| `20..27` | Sheet B · Rows 1–2 | **Move 3 — 7-Pierce Surgical Lunge:** `20`: High claw windup, `21`: Airborne pounce, `22`: Horizontal torpedo spear thrust, `23`: Plunging diagonal pierce rend, `24`: Wide X-slash follow-through, `25`: Heel-slide brake, `26`: Snarling spring-up, `27`: Backstep reset |
| `28..31` | Sheet B · Row 3 | **Hit / Stagger / KO:** `28`: Pain whip recoil, `29`: Heavy stagger hunch, `30`: Knee collapse, `31`: Defeated prone sprawl |

---

## 2. Errors Fixed During Implementation (Root-Cause Analysis)

### Error 1 — Frame Crossfade Double-Exposure ("Two Heads / Four Legs" Ghosting)
* **Symptom:** During Prowl Stalk and fast Idle transitions, Feral Nurse appeared with two overlapping heads or four legs.
* **Root Cause (2 compounding bugs):**
  1. **Order-of-Execution Bug in `feralNurseJuiceStepper.ts`:** `state.blendTimer = Math.min(state.blendDuration, state.blendTimer + dt)` was executed at the **top** of `stepFeralNurseJuice()` *before* `stepFeralNurseLabTriggerBranch()` called `setFeralNurseFrame(state, nextFrame, blendDuration)` (which resets `state.blendTimer = 0`). Consequently, every frame transition returned `blendAlpha = 0 / Math.max(0.01, blendDuration) = 0` on the frame it switched, forcing the renderer to draw `100%` of `prevFrame` on top of `currentFrame`.
  2. **Minimum Divisor Clamp (`Math.max(0.01, state.blendDuration)`):** Even when `blendDuration` was lowered to `0.006s` (less than one `16.6ms` 60fps tick), clamping the denominator to `0.01s` together with pre-branch timer advancement kept `blendAlpha < 1` for 1–2 ticks.
* **Fix:**
  * Moved `state.blendTimer` advancement **after** `stepFeralNurseCombatSyncBranch` / `stepFeralNurseLabTriggerBranch`.
  * Set `blendDuration = 0` for discrete pose swaps (`idle`, `prowl_stalk`, `pierce_strike`) and explicitly evaluated `const blendAlpha = state.blendDuration <= 0 ? 1 : clamp01(state.blendTimer / state.blendDuration)`. Cross-dissolve (`blendDuration = 0.04s`) is now used **only** during `optical_cloak` holographic phase transitions where spectral afterimages are desirable.

### Error 2 — Jarring Vertical & Postural Snaps in Idle and Prowl
* **Symptom:** Both Idle and Prowl felt jerky and jarring, popping vertically by `25–55px` mid-loop.
* **Root Cause:**
  1. **Incompatible Silhouette Heights Mixed in Loops:**
     * `IDLE_EIGHT_STEP_SEQ = [0, 1, 2, 3, 2, 1, 10, 0]` mixed Frame `0` (`h = 211px` deep squat), Frames `1–3` (`h = 231–237px` crouched ready), and Frame `10` (`h = 254px` upright stand) at `5.55 fps` (`180ms`/step). Her head snapped down `25px` on Frame `0` and popped up `20px` on Frame `10` every `1.44s`.
     * `PROWL_SIX_FRAME_SEQ = [4, 5, 6, 7, 8, 9]` included Frame `4` (`h = 199px`, low hand-on-floor ambush crouch) inside an upright running stride (`5..9`, `h = 231–248px`). Every stride cycle slammed her torso `49px` down onto the floor for `75ms`.
  2. **Over-Driven Prowl Cadence (`2.2 Hz`) & Out-of-Phase Hop Curve:**
     * At `2.2 Hz`, 6 frames fired at `13.2 fps` with aspring squash impulse (`1.12 × 0.88`) triggering `4.4 times/sec`.
     * `hopArc = Math.abs(Math.sin(prowlPhase))` lifted her twice per cycle without locking the airborne peak to Frame `7` (`prowl_bound_7`), making grounded contact frames (`5` and `9`) float above the deck.
* **Fix:**
  * **Idle (`1 ↔ 2` + periodic `3` hiss):** Restricted continuous breathing to anatomically matched upright frames `1` (`h = 235`) and `2` (`h = 237`) at a calm `2.6 rad/s` sine wave (`~0.56s` per phase), with a `0.44s` predatory hiss on Frame `3` (`h = 231`) once every `3.0s`.
  * **Prowl (`[5, 6, 7, 8, 9]` at `1.35 Hz`):** Removed Frame `4` from the upright stride loop and locked the vertical bound arc (`boundArc = sin(((strideU - 0.22) / 0.56) * PI)`) strictly to the airborne window (`strideU ∈ [0.22, 0.78]`, peaking on Frame `7`), keeping contact frames `5` and `9` planted at `hopYPx = 0`.

### Error 3 — Foot-Midpoint `anchorX` Jitter ("Hip Teleportation")
* **Symptom:** When stepping between Idle frames `1 → 2 → 3` or Prowl frames `5 → 6 → 8 → 9`, her entire torso snapped sideways by `8–19px`.
* **Root Cause:** `anchorX` was initially computed as the **bounding-box midpoint between her front and back foot pixels** (`(footMinX + footMaxX) / 2`). Whenever she extended a front claw or stretched her trailing leg back (e.g., Frame `3` hiss or Frame `8` reach), the foot bounding-box center shifted relative to her pelvis/torso centroid (`hipMidX`):
  * Frame `1`: `footMid = 85`, `hipMid = 95` (`10px` discrepancy)
  * Frame `3`: `footMid = 90`, `hipMid = 109` (`19px` discrepancy)
  * Frame `8`: `footMid = 96`, `hipMid = 106` (`10px` discrepancy)
  * Frame `9`: `footMid = 85`, `hipMid = 96` (`11px` discrepancy)
* **Fix:** Measured the opaque pixel centroid of the **pelvis/torso band (`35%..65%` of frame height)** across all Sheet A frames and re-anchored `anchorX` (plus `headsetOriginRel.dx` and `clawOriginRel.dx` deltas) to the hip center of mass:
  * `F1: 85 → 95`, `F2: 93 → 97`, `F3: 90 → 105`
  * `F5: 93 → 94`, `F6: 91 → 99`, `F7: 108`, `F8: 96 → 106`, `F9: 85 → 96`

### Error 4 — Eye/Headset VFX Anchors Drifting Behind the Face
* **Symptom:** In Round 1 visual verification, the glowing feral eye glints and magenta cyber-headset halo floated `25–40px` behind her head (or over her shoulder during lunges).
* **Root Cause:**
  1. `headsetOriginRel` was initially estimated as a fixed fraction of frame width/height rather than measured from the actual head position in each pose.
  2. In `combatFeralNurseSpritePass.ts`, eye offsets used `+ fwdDir * 4.2` (`fwdDir = -facingSign = +1` when facing left), which shifted the eye glints **rightward (backward toward her ponytail)** instead of **leftward (forward toward her nose/eyes, `+ facingSign * 2.0 / 8.2`)**.
* **Fix:**
  * Wrote a deterministic Node PNG scanner to locate the **red nurse-cap cross** (`R > 165, R - G > 55, R - B > 55`) in every frame `0..31` and placed `headsetOriginRel` exactly `22px` below the cap cross on her eyes/face.
  * Corrected the eye offset direction in `combatFeralNurseSpritePass.ts` to `faceX + facingSign * 2.0 * drawScale` and `faceX + facingSign * 8.2 * drawScale`, with the ear-mounted headset LED offset backward by `faceX - facingSign * 8.5 * drawScale`.

---

## 3. Pitfalls to Avoid Next Time (Mandatory Checklist for Future Multi-Sheet Enemies)

1. **Never Use Foot Bounding-Box Midpoint for `anchorX` on Asymmetric Strides:**
   * Always compute `anchorX` from the **pelvis/torso horizontal center of mass (`y ∈ [0.35h, 0.65h]`)** so extending a limb or trailing a foot never teleports the character's core body horizontally.
   * When adjusting `anchorX` by `Δx`, always shift all relative VFX origins (`headsetOriginRel.dx`, `clawOriginRel.dx`, `mouthOriginRel.dx`) by `-Δx` so world-space VFX alignment is preserved (`anchorX + originRel.dx === const`).
2. **Never Mix Incompatible Posture Heights in a Continuous Loop:**
   * Group loop frames by compatible head height (`Δh <= 8px` for Idle breathing; upright stride frames only for Walk/Prowl). Keep deep transition crouches (`h < 215px`) and tall alert poses (`h > 250px`) for explicit state transitions (`cloakCast`, `prepareCoil`, `turn_around`).
3. **Never Cross-Dissolve (`blendDuration > 0`) Across Wide Limb Displacements:**
   * Pixel-art / hand-inked 2D frames with fast limb movement look double-exposed ("two heads / four legs") even with a `10–40ms` alpha crossfade. Use **instant crisp frame cuts (`blendDuration = 0`, `blendAlpha = 1`)** for Idle, Walk/Prowl, and Strike sequences, and let **Layer 1 harmonic springs + Layer 3 4-knot spine mesh deformation** provide the continuous 60fps sub-pixel fluidity between frames. Reserve `blendDuration > 0` strictly for spectral/holographic states (`opticalCloak`).
4. **Always Advance `blendTimer` *After* Branch Frame Selection:**
   * In any procedural juice stepper, run `step*Branch()` first (which may call `set*Frame()` and reset `blendTimer = 0`), then advance `blendTimer`, and return `blendAlpha = blendDuration <= 0 ? 1 : clamp01(blendTimer / blendDuration)`.
5. **Measure VFX Origins Algorithmically from Landmark Pixels:**
   * Never eyeball `headsetOriginRel` / `mouthOriginRel` / `clawOriginRel` across 16–32 frames. Scan each cell's raw RGBA buffer for a unique color landmark (e.g., the red cross on the nurse cap, glowing cyan eye pixels, or leading non-transparent talon tip) and derive exact `(dx, dy)` offsets from `(anchorX, bottomY)`.
6. **Phase-Lock Procedural Hop Arcs to Airborne Frames Only:**
   * Walk/Prowl vertical lift (`hopYPx`) must be `0` during heel-contact and landing frames and follow a single half-sine window (`strideU ∈ [0.22, 0.78]`) centered on the airborne push-off frame.
