# Exceed-Style Turn-Based Fighting Game: Character Standee Animation Architecture & Pipeline

> **Expert Assumptions & Scope Boundary**
> 1. **Board Topology**: A 1D linear 9-slot dueling track (`Slots 1..9`, akin to *Exceed Fighting System* / *BattleCON*), where discrete board movement (`Advance`, `Retreat`, `Close`, `Cross-Up`, `Push`, `Pull`) and Strike resolution (`Range`, `Speed`, `Power`, `Armor`, `Guard`, `Stun`) must bridge discrete integer grid indices with continuous `60 FPS` sub-frame kinematics.
> 2. **Asset Budget**: 2D illustrated character standees authored either as **Single-Pose / Low-Pose Key Art** (`1–5` illustrated keyframes per fighter) or **Compact Multi-Pose Sheets** (`8–16` frames on a `4×4` `1024×1024` or `2048×2048` atlas), running in a browser/WebGL2 + Canvas2D hybrid runtime at `16.67 ms/frame` with zero per-frame garbage collection (`Zero-GC`).
> 3. **Dual-Paradigm Authority**: All standee motion obeys the **Two-Paradigm Animation Law** established in `ADR-0012` and `docs/design/ANIMATION_ARCHITECTURE.md` — never cross-dissolving unwarped sprite poses.

---

## 1. First-Principles Decomposition of the Exceed Standee Problem

In an *Exceed*-derived tactical fighter, a "standee" is simultaneously a **board token occupying an integer slot $S \in \{1..9\}$** and a **fighting-game combatant executing high-impact Strikes**. Treating a standee as a static cardboard cutout makes combat feel lifeless; treating it as a 60-frame traditional fighting-game sprite sheet causes combinatorial asset explosion and breaks discrete slot readability.

The problem decomposes into five orthogonal atomic layers:

| Layer | Responsibility | Mathematical / Runtime Primitive |
| :--- | :--- | :--- |
| **L0 — Offline Asset Baking** | Background removal, pelvis-centroid anchoring, landmark scanning, tight bounding boxes | Build-time Node/`sharp` pipeline (`npm run bake:sprites`) → lossless RGBA PNGs + `bake-manifest.json` |
| **L1 — Frame & Pose Authority** | Choosing which illustrated pose is active without double-exposure ghosting | **Paradigm 1** (34-triangle affine warp + C2 solidity blend) or **Paradigm 2** (`blendDuration = 0` crisp cuts) |
| **L2 — Board-Slot & Strike Kinematics** | Bridging integer slot deltas ($\Delta S$) and Cross-Ups at `60 FPS` | Monotone cubic Hermite splines + `2.5D` Paper-Mario cosine flip + horizontal velocity shear |
| **L3 — Anatomical Rig & Spring Physics** | Sub-frame breathing, anticipation, impact squash/stretch, and guard bracing | 2-sub-step Symplectic Euler spring + `4×6` WebGL2 `MeshSprite` with `4-Knot` Hermite spine (`feet`, `pelvis`, `waist`, `head`) |
| **L4 — Strike Exchange Choreography** | Synchronizing `Speed` clash, `Range` check, `Armor/Guard` absorption, `Hitstop`, and camera cut-ins | `ActionCameraController` (`zoom`, `dutchDeg`, `dimmerAlpha`) + freeze-frame hitstop (`dt = 0` on rig, active shake) |

---

## 2. Paradigm Selection Matrix: Which Pipeline to Use Per Standee

Before authoring assets, classify every character standee or close-up bust into one of two mathematical paradigms. **Never mix unwarped alpha cross-dissolves with limb motion.**

### Paradigm 1: Anatomical Mesh-Warped Keyframes (1–5 Keyframes / Character or Close-Up Finisher)
Use when a standee has **1 base illustration + 2–4 expression/torsion variants** targeting the same silhouette.
- **Geometric Registration**: Build an `Anatomical Warp Lattice` (`25` vertices, `34` triangles: `16` interior anatomical landmarks + `9` pinned perimeter/base anchors).
- **Affine Triangle Solve**: For each triangle $(A, B, C)$ on keyframe $K_A$ and $K_B$, compute the exact affine transform mapping source UVs onto the interpolated vertex position $P(u) = (1 - u)P_A + u P_B$, expanding each clip triangle outward from its centroid by `0.6 px` to eliminate Canvas2D `~0.5 px` anti-alias seams.
- **C2 Quintic Solidity Blend (`computeSolidityAlphas`)**:
  $$u(t) = 6t^5 - 15t^4 + 10t^3$$
  $$\alpha_A(u) = \begin{cases} 1.0 & u < 0.55 \\ \frac{1 - u}{0.45} & u \ge 0.55 \end{cases}, \quad \alpha_B(u) = u$$
  This guarantees $\alpha_A(u) + \alpha_B(u) \ge 1.0$ across the entire transition, eliminating the `50%` mid-dissolve transparency dip where the arena background bleeds through the standee's chest.

### Paradigm 2: Crisp-Cut Multi-Frame Sheet + Continuous 4-Layer Rig Physics (8–16 Frames / Fighter)
Use for full-stage tactical standees executing discrete fighting postures (`Idle`, `Advance/Dash`, `Strike Windup`, `Strike Active`, `Guard/Armor Brace`, `Hit/Stun`, `Exceed Overdrive`).
- **Strict Crisp-Cut Law (`blendDuration = 0`)**: Whenever limb or torso silhouettes change between frames, enforce `blendDuration = 0` (`frameBlendAlpha = 1.0`). All `60 FPS` smoothness comes from the WebGL2 `4×6` Hermite mesh deformation, symplectic scale springs, and sprint afterimages—never from opacity cross-fading.
- **2-Item Cross-Dissolve Allowlist**: `blendDuration > 0` (`0.04s–0.065s`) is permitted **only** for:
  1. **Identical-silhouette sub-features** (e.g., 2-frame eyelid blink or visor LED swap where body pixels are `100%` stationary).
  2. **Intentional holographic/spectral phase cloaks** (`Optical Cloak` / Exceed Astral Dash).

---

## 3. Step-by-Step Build & Runtime Pipeline

### Phase 1: Offline Sprite Sheet Baking (`scripts/bakeSprites.ts`)
Never perform flood-fill background removal, bounding-box scanning, or `getImageData` readbacks in the browser at runtime.

1. **Chroma & Background Keying Selection**:
   - **Dark/Colorful Costumes**: Author on pure white (`#FFFFFF`) and run per-cell BFS border flood-fill + exterior glow unmixing + `1 px` neutral edge defringing (`0.82`).
   - **White/Silver Costumes**: Author on `#00D856` chroma-green and run `cleanChromaGreenData` (spill suppression $G \leftarrow \min(G, \max(R, B))$ on edge pixels) so white capes, collars, or armor plates are never eaten by BFS flood-fill.
2. **Pelvis-Centroid `anchorX` Calibration (Anti-Teleportation Law)**:
   - Compute `anchorX` as the horizontal opaque center-of-mass within the **pelvis/torso vertical band (`35%..65%` of frame height)**:
     $$\text{anchorX} = \frac{\sum_{y = 0.35H}^{0.65H} \sum_{x} x \cdot \mathbb{I}(\alpha(x,y) > 128)}{\sum_{y = 0.35H}^{0.65H} \sum_{x} \mathbb{I}(\alpha(x,y) > 128)}$$
   - **Why**: Using the bounding-box midpoint between front and back feet shifts the standee's hips horizontally by `8–19 px` whenever a character steps a foot forward or extends a weapon, causing jarring horizontal hip-teleportation on frame cuts.
3. **Sole-Locked `bottomY` & Per-Row `rowScale` Normalization**:
   - Pin `bottomY` to the lowest non-shadow sole contact pixel (`groundY`).
   - Normalize every character's standing height to a canonical pixel reference (`CANONICAL_HEIGHT = 214.0 px` for standard fighters, multiplied by per-character `archScale`, e.g., `1.32` for Juggernauts / Grapplers).
4. **Algorithmic Landmark Scanning (`*OriginRel`)**:
   - Scan each baked cell offline for projectile/VFX emitters (`muzzleRel`, `slashArcOriginRel`, `hitSparkOriginRel`, `eyeFlashOriginRel`) and store them in **post-flip stage space** relative to `(anchorX, bottomY)`.
   - **Co-Adjustment Invariant**: If `anchorX` is re-centered by $\Delta x$, shift every relative landmark `dx` by $-\Delta x$ in the same build step.

---

### Phase 2: WebGL2 `4×6` Deformable Standee Mesh (`MeshSprite`)
Render every standee on a unified WebGL2 `#version 300 es` **`4 × 6` quad grid (`35` vertices, `48` triangles, `144` indices)** backed by a pre-allocated `Float32Array(280)` (`8` floats/vertex: `[xWorld, yWorld, u0, v0, u1, v1, hWeight, alpha]`).

#### 1. The 4-Knot Anatomical Spine (`FourKnotSpine`)
Instead of a rigid quad or a heavy 30-bone skeletal rig, deform the standee vertically via 4 cubic Hermite knots parameterized by normalized height $h \in [0, 1]$ from sole to crown:
- **`feet` ($h = 0.00$)**: Strictly pinned (`dx = 0, dy = 0, rotRad = 0, scaleX = 1.0`) so the standee's base never slides on the board slot.
- **`pelvis` ($h = 0.33$)**: Drives weight transfer during `Advance`/`Retreat` and crouch compression during `Guard`.
- **`waist` ($h = 0.67$)**: Drives torso lean into Strikes, chest breathing expansion, and hit-recoil bucking.
- **`head` ($h = 1.00$)**: Drives secondary follow-throughwhip and forward intimidation lean.

#### 2. Symplectic Euler Squash & Stretch Spring (`2×` Sub-Stepped)
Drive impact punch, landing compression, and Exceed transformation pops with a 2-sub-stepped symplectic Euler harmonic oscillator around `(1.0, 1.0)`:
```ts
// subDt = Math.min(dt, 0.05) * 0.5; stiffness = 320..420; damping = 18..26
for (let step = 0; step < 2; step++) {
  const accX = -stiffness * (springScaleX - 1) - damping * springVelX;
  const accY = -stiffness * (springScaleY - 1) - damping * springVelY;
  springVelX += accX * subDt;
  springVelY += accY * subDt;
  springScaleX += springVelX * subDt;
  springScaleY += springVelY * subDt;
}
```
- **Volume-Preserving Impulse Table**:
  - **Landing / Guard Brace**: `(targetScaleX = 1.14, targetScaleY = 0.88)`
  - **Strike Launch / Uppercut**: `(targetScaleX = 0.86, targetScaleY = 1.18)`
  - **Heavy Hit Taken (`Power >= 5`)**: `(targetScaleX = 1.22, targetScaleY = 0.82, velImpulseX = +3.5, velImpulseY = -3.5)`

---

### Phase 3: Mapping *Exceed* Board & Strike Mechanics to Standee Motion

Every *Exceed* turn consists of either **Preparation** (`Move`, `Change Cards`, `Boost`, `Exceed`) or a **Strike** (`Initiate` → `Reveal` → `Fastest Striker Resolves` → `Slower Striker Resolves / Stun Check` → `Cleanup`). Here is the exact mapping from tabletop mechanics to `60 FPS` standee kinematics:

#### 1. Board Movement (`Advance`, `Retreat`, `Close`, `Push`, `Pull`)
Let slot center $X(S)$ map slot index $S \in \{1..9\}$ to stage pixels.
- **Velocity-Driven Horizontal Shear (`stepHorizontalVelocityShear`)**:
  As the standee translates toward $X(S_{\text{target}})$, compute horizontal velocity $v_x$ and apply top-weighted horizontal shear:
  $$\text{skewPx}(h) = \text{clamp}(v_x \cdot k_{\text{skew}}, -22\text{ px}, +22\text{ px}) \cdot h^{1.35}$$
  - **Voluntary `Advance` / `Close`**: Positive forward lean ($\text{waist.dx} = +10\text{ px}, \text{head.dx} = +16\text{ px}$) + 3 additive cyan/magenta sprint afterimages spaced at `28 ms` intervals.
  - **Forced `Push` / Knockback**: Reverse the shear sign so the feet slide backward while the head/chest lag forward ($\text{waist.dx} = +12\text{ px}$ against backward travel), combined with floor skid sparks at `feet`.
- **Phase-Locked Stride Hop (`hopYPx`)**:
  Never apply a continuous sine wave to vertical position across grounded frames. Confine vertical lift strictly to the airborne travel window $u \in [0.22, 0.78]$:
  $$\text{hopYPx}(u) = \begin{cases} 0 & u \notin [0.22, 0.78] \\ -H_{\text{hop}} \sin\left(\frac{u - 0.22}{0.56}\pi\right) & u \in [0.22, 0.78] \end{cases}$$

#### 2. Cross-Up Movement (Moving Past the Opponent)
When an `Advance N` moves a fighter across the opponent's slot, flip facing orientation via a **2.5D Paper-Mario Cosine Flip (`stepHorizontalFlip`)**:
- Duration: `0.18 s` (`minFlipDurationSec = 0.12 s`).
- Horizontal scale:
  $$s_{\text{facing}}(u) = s_{\text{start}} + (s_{\text{target}} - s_{\text{start}}) \cdot \frac{1 - \cos(\pi u)}{2}, \quad |s_{\text{facing}}| \ge 0.04$$
- Non-negative vertical hop: $\text{hopYPx}(u) = -\max(0, \sin(\pi u) \cdot 18\text{ px})$ (guaranteed never to sink below the board track).

#### 3. Strike Resolution (`Speed`, `Range`, `Power`, `Armor`, `Guard`)

| Exceed Strike Phase | Standee Rig & Shader Choreography | Camera & Stage Parameters (`ActionCameraController`) |
| :--- | :--- | :--- |
| **1. Strike Reveal & Speed Check** (`0.00s – 0.15s`) | Both standees snap to `windup` frame (`blendDuration = 0`). Faster striker (`Speed_A > Speed_B`) emits a high-contrast speed-initiative ring and compresses spring `(1.10, 0.91)`. | Stage dimmer ramps to `dimmerAlpha = 0.75`; non-striking UI fades (`worldUiAlpha -> 0`); zoom to `1.42×`. |
| **2. Whiff (Out of `Range`)** | Attacker lunges `+38 px` toward target slot, slices empty air at peak extension (`u = 0.45`), and recovers with a `0.14 s` over-extension wobble (`waist.rotRad = +0.09 rad`). Defender holds `Idle` or triggers `0.96 s` `Evasive Dodge` vault if evading at `Range`. | Camera pans `35%` toward midpoint without hitstop or shake. |
| **3. Hit vs. `Armor` / `Guard` Absorption** | Defender snaps to `brace_pose`, pins `feet (0,0)`, compresses `pelvis.dy = +6 px`, and flashes an hexagonal Aegis barrier. If `Damage <= Armor`, defender takes `0` knockback and emits an amber/cyan deflection shockwave. | `hitstop = 0.12 s`, low-frequency thud shake (`amp = 4 px`), `attackerScalePunch = 1.15×`. |
| **4. Clean Hit & `Guard` Break (`Damage > Guard`)** | Attacker freezes on active impact frame at `1.28×` `attackerScalePunch`. Defender snaps to `recoil_pose`, receives `u_flashColor = [1, 1, 1]` additive white-out for `65 ms`, spine buckles backward (`waist.dx = -16 px, head.rotRad = -0.18 rad`), and directional hit-sparks/blood emit from `impactOriginRel`. | **Normal Hit**: `hitstop = 0.12 s`, `zoom = 1.52×`, `dutchDeg = 2.2°`. **Crit / Ultra (`Power >= 6`)**: `hitstop = 0.25 s`, `zoom = 1.80×`, `dutchDeg = 3.5°`, `holdCritSec = 1.00 s`. |
| **5. `Stun` (Slower Striker Interrupted)** | Slower striker's pending Strike animation aborts immediately; standee enters a `24 Hz` horizontal micro-shudder (`offsetX = ±4.5 px * exp(-4t)`) with `u_tintColor` desaturated for `0.45 s`. | Immediate cut-in priority transfer; cancelled intent arc shatters in Foreground Layer 2. |

---

## 4. Architecture of the 3-Layer Standee Stage Compositor

To preserve crisp card/slot UI typography while deforming standees in WebGL2, split the stage into three synchronized `<canvas>` layers sharing the same `ActionCameraController` view-projection matrix:

1. **Layer 0 — Board & Ground Canvas2D (`canvasRef`)**:
   - Renders the 9-slot track tiles, active `Range` brackets (highlighting valid target slots in cyan/crimson), planar ground puddles/fissures, soft elliptical standee base shadows, and the `dimmerAlpha ∈ [0, 0.75]` obsidian cut-in spotlight mask.
2. **Layer 1 — WebGL2 Standee & Reflection Stage (`webglCanvasRef`, `#version 300 es`)**:
   - **Pass 1A (Planar Deck Reflections)**: Inverted vertical render (`scaleY = -0.45`, `alpha = 0.22`) clipped via `gl.SCISSOR_TEST` to the board track surface.
   - **Pass 1B (Afterimages & Standees)**: Sorted strictly by draw priority:
     `0` Reflections → `1` Dimmed Assist/Bystanders → `2` Neutral → `3` Defender (`z = 3`) → `4` Active Striker (`z = 4`).
   - Uses premultiplied alpha blending (`gl.ONE, gl.ONE_MINUS_SRC_ALPHA`) and a bounded LRU texture cache (`maxCachedTextures = 192`) accepting pre-decoded `ImageBitmap` sources.
3. **Layer 2 — Foreground VFX & Telemetry Canvas2D (`fgCanvasRef`)**:
   - Renders `Speed / Power / Guard` clash badges, projectile beams, slash arcs anchored to `muzzleRel`/`clawOriginRel`, hit sparks, floating damage numbers, and `DEV` wireframe overlays.

---

## 5. High-Probability Failure Modes & Concrete Mitigations

| # | Real-World Failure Mode | Root Cause | Exact Engineering Fix |
| :--- | :--- | :--- | :--- |
| **1** | **"Two Heads / Four Legs" Ghosting** | Enabling `blendDuration > 0` opacity cross-dissolve between two unwarped poses where arms, legs, or weapons moved. | Set `blendDuration = 0` (`frameBlendAlpha = 1.0`) for all physical pose cuts in `computeFrameTransitionState`. Guard `if (blendDuration <= 0) return 1.0;` before dividing to prevent `0 / 0 = NaN` during `dt = 0` hitstop frames. |
| **2** | **Horizontal Hip-Teleportation on Strike Cuts** | Setting `anchorX` to the horizontal midpoint of each frame's bounding box (`(minX + maxX) / 2`). Extending a sword or front kick shifts the midpoint forward, snapping the character's torso back. | Calculate `anchorX` exclusively from the opaque pixel centroid of the `35%..65%` vertical pelvis/torso band during `npm run bake:sprites`, and co-shift all `*OriginRel.dx` offsets by $-\Delta x$. |
| **3** | **Idle Breathing Vertical Popping** | Mixing deep crouch frames (`h = 205 px`) and tall upright frames (`h = 252 px`) inside a continuous Idle loop. | Enforce $\Delta h \le 8\text{ px}$ across all frames in an Idle loop. Isolate deep crouch/ambush poses to explicit `windup` or `guard_brace` transitions. |
| **4** | **Eaten White Capes / Highlights** | Running white-background BFS flood-fill on a character with white hair, white gloves, or bright rim lighting that touches the cell border. | Author white-clad characters on `#00D856` chroma-green and bake with `cleanChromaGreenData`, or define explicit `excludeRects` + interior pocket area guards (`minPocketArea >= 32 px`). |
| **5** | **First-Strike Main-Thread Frame Drop (`40–90 ms` freeze)** | Lazy decoding of PNG sheets or runtime canvas flood-fill when a character executes their first Strike or Exceed transformation. | Pre-bake all sheets offline into `src/assets/sprites/baked/` and decode every frame at boot via off-main-thread `createImageBitmap(blob)` before entering combat. |
| **6** | **Rotated Camera Cut-In Corner Bleed** | Applying `dutchDeg = 3.5°` camera roll at low zoom exposes empty black canvas triangles outside the stage backdrop. | Enforce minimum zoom clamp for rotation: `minZoom = 1 + Math.tan(Math.abs(rotRad)) * (aspect + 1 / aspect)` and clamp pan within `BACKDROP_BLEED_X = 32 px, BACKDROP_BLEED_Y = 16 px`. |

---

## 6. Verification & Interactive `DEV` Animation Lab Checklist

Never tune standee timings blind in full combat matches. Expose a deterministic URL-driven lab (`?devLabs=1&devLabTab=hero|camera`):
1. **Pose & Anchor Audit**: Toggle the WebGL2 `4×6` wireframe + pelvis-centroid crosshair (`anchorX, bottomY`) + scanned `*OriginRel` markers. Cycle `Keys 1–9` (`Idle`, `Advance`, `Retreat`, `Strike Melee`, `Strike Ranged`, `Guard Brace`, `Hit/Stun`, `Exceed Overdrive`, `Cross-Up Flip`) and verify zero horizontal hip shift and zero foot sliding.
2. **Strike Exchange Camera Audit (`?devLabTab=camera`)**: Fire deterministic synthetic exchanges (`Melee Normal`, `Melee Crit`, `Ranged Single`, `Cross-Up Punish`, `Out-of-Range Whiff`) and verify `hitstop` freeze duration, `attackerScalePunch`, and `worldUiAlpha` restoration on reset.
3. **Automated Invariant Tests (`node:test`)**:
   - Assert every baked frame's `anchorX` lies within `[0.30 * width, 0.70 * width]` and `rowScale` normalizes standing height within `±0.5 px` of `CANONICAL_HEIGHT`.
   - Assert `computeFrameTransitionState` returns `frameBlendAlpha === 1` when `blendDuration === 0` even when `dt === 0` (hitstop safety).
   - Assert `stepHorizontalFlip` produces `hopYPx <= 0` for all $u \in [0, 1]$ (never clips below the board floor).

---

## 7. Variables to Clarify for Further Tailoring

If you want to specialize this pipeline further for a specific build, specify:
1. **Asset Source Format**: Are your character standees **single static card illustrations** (requiring Paradigm 1 `34`-triangle anatomical warp lattices + acrylic standee base plinths) or **multi-pose sprite sheets** (`4×4` / `8–16` frames per fighter under Paradigm 2)?
2. **Board Perspective**: Is the 9-slot *Exceed* track rendered as a **flat 2D side-view duel lane** (like *Street Fighter* with discrete slot ticks below the feet) or a **tilted `2.5D` tabletop diorama** where standees sit in physical slotted acrylic bases?
3. **Strike Reveal UX**: Do both players' chosen Strike cards reveal simultaneously on-stage next to the standees before the faster `Speed` animation triggers, or does the card UI dismiss immediately into the `ActionCameraController` cut-in?
