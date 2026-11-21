# NEON BREACH — Title Emblem Creation Pipeline & 60 FPS Animation Architecture

> **Architectural Context, Canonical Glossary & Decisions**
> - **Domain Language**: Canonical terms follow [GLOSSARY.md](../../GLOSSARY.md) (`Title Emblem`, `Static Lockup Plane`, `Emblem Keyframe`, `Choreography Beat`, `Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`).
> - **Architecture Decisions**: [ADR-0001 (Build-Time Baked Title Emblem Sprites)](../adr/0005-build-time-baked-title-emblem-sprites.md) and [ADR-0002 (Canvas2D Affine Triangle Mesh Warp)](../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md).
> - **Reference Canvas Resolution**: `960 × 541 px` (aspect ratio `1.7745:1`, downscaled from `1671 × 941 px` illustrations).
> - **Normalized Coordinate Space**: `(nx, ny) ∈ [0, 1] × [0, 1]` mapped to the Title Emblem bounding box; stage bleed margins add `±14%` horizontally and `+16% / +15%` vertically (`128% × 131%` desktop; `+12% / +12%` vertical in `compact` landscape) so particles, slime drops, and shockwaves never clip at rectangular container edges.
> - **Display & Budget Invariants**: `60 FPS` (`16.67 ms/frame`), DPR capped at `Math.min(window.devicePixelRatio || 1, 2)`, zero per-frame React state updates, zero garbage-collector allocations inside `requestAnimationFrame`, `dt <= 0.05 s` clamp, `document.hidden` pause, mid-reverse click recovery, and `prefers-reduced-motion: reduce` calm fallback.

---

## Stage Rollout Status

| Stage | Subsystem | Current Baseline (`main`) | Target Architecture |
| :--- | :--- | :--- | :--- |
| **Baseline (v1)** | Core choreography, C2 quintic solidity blend, zone particles, rim arcs, sheen (`TitleEmblemStage.tsx`, `titleEmblemVfx.ts`) | Active in production; runtime BFS cutout in `spriteCutout.ts` | Retained as choreography/VFX backbone, with hot-path GC allocations eliminated |
| **Stage 1** | Build-Time Cutout Baking & Static Lockup Plane Split (`scripts/bakeTitleSprites.ts`, `assetPreloader.ts`) | Runtime BFS decoding of 5 unbaked PNGs in `src/assets/sprites/` | Offline `sharp` bake + offline masks + `createImageBitmap()` decode of `src/assets/sprites/baked/`; Static Lockup Plane split |
| **Stage 2** | Perspective-Mapped `24 × 9` Visor Matrix Engine (`src/utils/titleVisorMatrix.ts`) | Painted LED graphics cross-dissolved with whole sprite | Offline dark visor glass inpainting + procedural `24 × 9` curved LED grid with Beat 1 scanline/cell-walk + Beat 4 radial heart pulse |
| **Stage 3** | Metaball Surface-Tension Xeno Slime Engine (`src/utils/titleSlimeEngine.ts`) | Static painted droplet tips cross-faded between keyframes | Offline `14 px` radial tip erasure + 4 staggered physics nozzles on `140 × 220` (`0.5×`) metaball buffer feeding `bio_left` |
| **Stage 4** | Anatomical Warp Lattice & Idle Breathing (`src/utils/titleMeshWarp.ts`) | Whole-sprite cross-dissolve + uniform `breathScale` | 16 animated anatomical landmarks + pinned seam/perimeter anchors (`~32–36` triangles) with bidirectional Canvas2D affine warp + `±1.5 px` idle breathing |

---

## 1. Asset Pipeline, Build-Time Cutout Baking & Static Lockup Plane Split (Stage 1)

### 1.1 Emblem Keyframes (`K0–K4`) & Source Relocation
The five illustrated Emblem Keyframes (`1671 × 941 px` raw illustrations, `~6.29 MB` decoded RGBA per frame) are already normalized on disk to `960 × 541 px` opaque RGB PNGs (`colorType=2`). Because `TitleScreen.tsx` renders the Title Emblem at `h-[clamp(250px,47dvh,455px)]` on desktop (`~808 × 455 CSS px`), `w-[104%] max-w-[392px] max-h-[32dvh]` in narrow portrait, and `max-w-[325px] max-h-[205px]` in compact landscape, `960 × 541 px` preserves native Retina crispness at `DPR = 2` while cutting decoded RGBA memory by **67.0%** (`2.07 MB/frame`, `10.38 MB` total across five frames).

Under Stage 1 ([ADR-0001](../adr/0005-build-time-baked-title-emblem-sprites.md)), the five unbaked checkerboard PNGs are relocated out of `src/assets/sprites/` into `assets-src/title/` so `vite build` does not copy ~5 MB of unused originals into `dist/`. Baked runtime sprites live in `src/assets/sprites/baked/` and are referenced via `src/assets/gameAssets.ts`.

| Keyframe | Unbaked Source (`assets-src/title/...`) | Baked Target (`src/assets/sprites/baked/...`) | Narrative Beat | Current Size (`960×541` RGB) |
| :--- | :--- | :--- | :--- | :--- |
| **`K0`** | `title_logo_0.png` | `k0.png` + `lockup_plane0.png` | **Idle / Base Aim**: Kira aims plasma pistol; angry cat visor (`>_<`); Xeno roars | `957,041 B` |
| **`K1`** | `title_logo_1.png` | `k1.png` | **Beat 1 (Wink)**: Kira winks right eye; visor morphs to smiling cat (`^w^`) | `957,796 B` |
| **`K2`** | `title_logo_2.png` | `k2.png` | **Beat 2 (Shared Grin)**: Kira grins & tilts pistol; Xeno winks right eye | `970,819 B` |
| **`K3`** | `title_logo_3.png` | `k3.png` | **Beat 3 (Blown Kiss)**: Kira blows neon magenta heart kiss from open palm | `1,013,307 B` |
| **`K4`** | `title_logo_4.png` | `k4.png` | **Beat 4 (Climax `!!`)**: Pixel heart visor (`♥`); Xeno reels back with yellow `!!` | `1,011,355 B` |

---

### 1.2 Build-Time Baking Pipeline (`scripts/bakeTitleSprites.ts`)
An explicit Node script (`scripts/bakeTitleSprites.ts`, run via `npm run bake:title` using `tsx`) uses `sharp` (`devDependency`) to produce committed transparent PNGs in `src/assets/sprites/baked/` along with `bake-manifest.json` (recording SHA-256 hashes of inputs and baking parameters for freshness checks).

If any source illustration exceeds `960 × 541`, the script conditionally applies Lanczos3 resampling before extraction; inputs already at `960 × 541` skip resampling to avoid unnecessary generation loss:

```bash
# Equivalent Lanczos normalization geometry when source > 960x541
resize(960, 541, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
```

The baking script then executes the **4-pass procedural alpha extraction** followed by **3 offline static mask/inpaint passes**:

#### Four-Pass Procedural Alpha Extraction
All five illustrations carry a baked-in opaque white/gray checkerboard background (`RGB ≈ 252,252,252` and `RGB ≈ 228..239`), including trapped interior checkerboard islands inside the central neon ring (`nx: 0.39..0.52, ny: 0.24..0.38`) and between Kira's hair strands.

1. **Pass 1 — Exterior Border Flood-Fill (BFS)**:
   Seeds all 4 image edges and floods inward across pixels matching `isNearWhite`:
   $$\text{isNearWhite}(R,G,B) \iff (\min(R,G,B) > 224 \land \max - \min < 24) \lor (\min(R,G,B) \ge 216 \land \max - \min \le 8)$$
   The second clause (`min >= 216, chroma <= 8`) absorbs Lanczos resampling ringing along high-frequency checkerboard tile boundaries (`RGB ≈ 219..223`).
2. **Pass 2 — Two-Tone Checkerboard vs. Neon Core Pocket Discriminator (`area >= 32 px`)**:
   Scans unvisited interior near-white connected components. For each pocket, it counts neutral gray checkerboard pixels (`216 <= min <= max <= 243, chroma <= 6`) and pure white checkerboard pixels (`min >= 247, chroma <= 6`), plus vibrant neon boundary neighbors (`max >= 145, chroma >= 42`):
   - **Rule**: If `checkerGrayCount >= 12 && checkerWhiteCount >= 12`, the pocket is a trapped checkerboard island and is cleared to `alpha = 0` regardless of surrounding neon hair or ring glow.
   - **Protection**: Single-tone pure-white pockets (`isTwoToneCheckerboard === false`) bordered by vibrant glow (`vibrantGlowBorderCount / borderCount >= 0.35`) are preserved at `alpha = 255` (protecting the white-hot cores of `NEON`, `BREACH`, and `XENO-PURGE PROTOCOL` lettering).
3. **Pass 3 — 1px Neutral Halo Defringing (`defringeStrength: 0.82`)**:
   Attenuates 1-pixel neutral anti-aliased edge pixels (`luminance > 188, chroma < 34`) adjacent to newly transparent pixels by `alpha *= (1 - 0.82)`.
4. **Pass 4 — Exterior Light-Glow Unmixing (`unmixLightGlow: true`)**:
   Floods inward from cleared background pixels across light-mixed neon halo pixels (`min(R,G,B) > 138`) and analytically subtracts the white background contribution:
   $$\alpha_{\text{new}} = \text{clamp}\!\left(\frac{255 - \min(R,G,B)}{255 - 138},\, 0,\, 1\right)^{0.85}, \quad C_{\text{unmixed}} = \text{clamp}\!\left(\frac{C - 255(1 - \alpha_{\text{new}})}{\alpha_{\text{new}}},\, 0,\, 255\right)$$
   converting opaque pastel fringes into clean translucent neon glow over the dark Neo-Prague twilight backdrop.

#### Three Offline Static Mask & Inpaint Passes
Because `createImageBitmap()` produces an immutable GPU texture with zero runtime canvas readback, all static per-pixel edits are baked into `k0.png`–`k4.png` and `lockup_plane0.png` once offline:

1. **Static Lockup Plane Split (`lockup_plane0.png` from `K0`)**:
   Extracts **Plane 0** strictly from `K0` over `ny ∈ [0.38, 0.98], nx ∈ [0.04, 0.79]` covering the `NEON BREACH` beveled lettering, cat-`O` mark, `XENO-PURGE PROTOCOL` hexagonal badge, and lower skull medallion. A `12 px` cosine-feathered seam along the top `NEON` bevel (`ny ≈ 0.37..0.41`) and around Kira's overlapping right arm/torso (`nx ≈ 0.75..0.80`) blends cleanly onto Plane 1 so metallic lettering never shimmers from AI-generation variance (`1–3 px` highlight shifts between `K0–K4`) during keyframe blends.
2. **Visor Glass Inpainting (`K0–K4`)**:
   Within Kira's curved goggle glass aperture (`nx: 0.745..0.892, ny: 0.082..0.212`), the baked script overwrites the painted red/pink LED graphics with **opaque dark curved visor glass** (`#0b132b` radial vignette + subtle diagonal glass glare) while leaving the surrounding metallic goggle frame and flanking glowing cyan side bars intact. *Note*: Do **not** alpha-erase the visor interior to `0`, because the sky-plaza backdrop behind the Title Emblem would bleed through Kira's goggles.
3. **Static Xeno Slime Tip Erasure (`K0–K4`)**:
   Applies a `14 px` radial soft alpha erasure mask over the 3 static hanging droplet tips below Xeno's left tentacles at `(30, 294)`, `(32, 192)`, and `(28, 304)` so live metaball droplets in Stage 3 replace frozen painted drips without double-tip artifacts.

---

### 1.3 Off-Main-Thread Runtime Decoding (`src/assets/assetPreloader.ts`)
`src/assets/assetPreloader.ts` eliminates runtime flood-fill loops and `yieldTick()` pixel-processing stalls on the Title Screen:

- Fetches `src/assets/sprites/baked/lockup_plane0.png` and `src/assets/sprites/baked/k0.png`–`k4.png` and decodes them off-main-thread via `createImageBitmap(blob)` (falling back cleanly to `loadDecodedImage()` / `HTMLImageElement` if `createImageBitmap` is unavailable in an environment).
- Decodes and exposes `K0` (`getPreloadedTitleLogo()`) and `lockup_plane0` (`getPreloadedTitleLockup()`) first for immediate first-paint reveal, then streams `K1–K4` into the frame cache (`getPreloadedTitleLogoFrames()` / `loadTitleLogoFrames(onFrameReady)`).
- Existing combat hero and enemy cutouts remain on runtime `src/utils/spriteCutout.ts` ([ADR-0001](../adr/0005-build-time-baked-title-emblem-sprites.md)).

---

## 2. Unified Compositing Pipeline & Click Choreography (`TitleEmblemStage.tsx`, `titleEmblemVfx.ts`)

### 2.1 Click-Only Narrative Timeline (`2.86 s`) & Mid-Reverse Recovery
During idle (`sequenceActive = false`), the Title Emblem remains anchored on `K0` with zero click-sequence cross-dissolve, running ambient zone particles (`bio_left`, `ember_center`, `plasma_right`), `XENO-PURGE PROTOCOL` rim arcs, continuous Xeno Slime drips (Stage 3), and `±1.5 px` upper-body anatomical breathing (Stage 4). Clicking inside the emblem hitbox triggers a `2.86 s` forward-hold-reverse story arc:

```
Time (s):  0.00      0.36       0.78        1.24       1.66      2.06               2.86
Keyframe:   [K0]  ->  [K1]  ->   [K2]   ->   [K3]  ->   [K4]  ==HOLD==> [K4->K3->K2->K1->K0]
Beat:       Click     Beat 1     Beat 2      Beat 3     Beat 4  0.40s     Smooth Reverse
            Burst     Kira Wink  Xeno Wink   Heart Kiss Shock!! +2Hz♥     Back to Idle K0
            (28p)     Visor ^w^  Shared Grin Stream(14p)Burst(18p)+Shake
```

- **Mid-Reverse Click Recovery**: If the user clicks while reversing (`t ∈ (2.06, 2.86]`), `triggerEmblemClickBurst` maps reverse progress cleanly back onto the forward timeline without a frame snap:
  $$t_{\text{new}} = \left(1 - \frac{t - 2.06}{2.86 - 2.06}\right) \times 1.66$$

### 2.2 Solidity-Preserving C2 Quintic Blend Schedule
Linear alpha cross-fading (`alphaA = 1 - u, alphaB = u`) causes a 75% mid-transition opacity dip ($0.5 + 0.5(1 - 0.5) = 0.75$) and velocity jumps across Choreography Beat boundaries. `titleEmblemVfx.ts` preserves:

- **C2-Continuous Quintic Easing (`quinticEase`)**:
  $$u(t) = 6t^5 - 15t^4 + 10t^3, \quad u'(0) = u'(1) = 0, \quad u''(0) = u''(1) = 0$$
- **Solidity-Preserving Opacity Schedule (`computeSolidityAlphas`)**:
  $$\alpha_A(u) = \begin{cases} 1.0 & \text{if } u < 0.55 \\ \max\!\left(0,\, \frac{1 - u}{0.45}\right) & \text{if } u \ge 0.55 \end{cases}, \qquad \alpha_B(u) = u$$
  guaranteeing $\alpha_A(u) + \alpha_B(u) \ge 1.0$ across $[0, 1]$ so shared opaque regions never drop below $255$ alpha.

### 2.3 Canonical Per-Frame Z-Order (`compositeCanvasRef` → Stage Canvas)
`TitleEmblemStage.tsx` renders all layers in strict sequence each frame:

1. **Ambient Dual-Zone Backdrop Halo**: Left bio-lime radial glow (`#84cc16`) and center cyan/magenta glow (`#00f0ff` / `#ff2e7e`) on the main stage canvas.
2. **Back-Plane Ambient Particles**: Pooled particles with `p.behind === true`.
3. **Offscreen Unified `960 × 541` Composite (`compositeCanvasRef`)**:
   - **Layer 3a — Plane 1 (Anatomical Warp Lattice)**: `titleMeshWarp.ts` draws `K0` with sinusoidal idle breathing (`sequenceActive === false`), or bidirectionally warps `K_A` and `K_B` onto intermediate vertices $P(u)$ with `computeSolidityAlphas(u)`.
   - **Layer 3b — Visor Matrix**: `titleVisorMatrix.ts` projects the `24 × 9` LED matrix over Kira's inpainted dark visor glass using the interpolated 4-corner quad.
   - **Layer 3c — Xeno Slime**: `titleSlimeEngine.ts` composites its `140 × 220 px` (`0.5×` scale) metaball acid-slime canvas onto `x ∈ [0, 280], y ∈ [90, 530]` inside `compositeCanvasRef` — placing left-tentacle drips in the open while Nozzle 4 jaw saliva tucks naturally **behind** Plane 0's `NE` bevel.
   - **Layer 3d — Plane 0 (Static Lockup Plane)**: Draws `lockup_plane0.png` (`K0` typography + `12 px` feathered seam) at `100%` opacity on top so lettering stays rock-solid and participates in the unified silhouette.
4. **Unified Drop-Shadow Blit**: Draws `compositeCanvasRef` once onto the stage canvas (`shadowColor = 'rgba(2, 6, 23, 0.9)'`, `shadowBlur = 28 * dpr`, `shadowOffsetY = 12 * dpr`), avoiding double-shadow darkening.
5. **Silhouette-Masked Holographic Sheen**: `sheenCanvasRef` (`512 × 289`) masks a diagonal cyan-white-magenta gradient via `destination-in` using `compositeCanvasRef` as the alpha mask, then composites onto the stage with `screen`.
6. **Click Shockwave & Electric Rim Arcs**: Expanding shockwave ring and jagged `XENO-PURGE PROTOCOL` rim arcs.
7. **Front-Plane Particles**: Pooled particles with `p.behind === false`, including `bio_left` spores spawned on Xeno Slime splashes, `heart_kiss` hearts, and `xeno_shock` sparks.
8. **Optional Dev Calibration Overlay (`?debugTitleMesh=1`)**: Wireframe triangles, 16 landmarks, pinned seam anchors, visor quad corners, and slime nozzle markers.

---

## 3. Perspective-Mapped `24 × 9` Visor Matrix Engine (`src/utils/titleVisorMatrix.ts` — Stage 2)

### 3.1 Canonical `24 × 9` LED Bitmaps & Narrative Continuity
Three canonical `24 × 9` LED matrices are stored as static `Uint8Array(216)` bitmaps (`0 = off #0b132b`, `1 = primary neon LED`, `2 = white-hot LED core`):

| Bitmap Constant | Expression | Primary Neon (`1`) | White-Hot Core (`2`) | Off Cell (`0`) |
| :--- | :--- | :--- | :--- | :--- |
| **`ANGRY_CAT_24x9`** | `>_<` angry cat with pointed ears & jagged mouth | `#ff2a2a` / `#ff7b00` | `#ffd166` / `#ffffff` | `#0b132b` |
| **`HAPPY_CAT_24x9`** | `^w^` smiling cat with curved joyful eyes | `#ff2e93` | `#ff9de2` / `#ffffff` | `#0b132b` |
| **`HEART_CLIMAX_24x9`** | `♥` center pixel heart flanked by mini-hearts | `#ff2e93` | `#ffffff` | `#0b132b` |

**Expression Continuity Rule (`K1–K3`)**: While the raw AI illustrations depict `^w^` on `K1` and revert to `>_<` on `K2–K3`, Stage 1's offline dark-glass inpainting hands full control to `titleVisorMatrix.ts`, enforcing a coherent emotional arc:
- **`K0` (Idle)**: `ANGRY_CAT_24x9` (`>_<`).
- **Beat 1 (`K0 → K1`, `0.00–0.36 s`)**: Transitions into `HAPPY_CAT_24x9` (`^w^`).
- **`K1 → K2 → K3` (`0.36–1.24 s`)**: Holds `HAPPY_CAT_24x9` (`^w^`) continuously as Kira grins and blows the kiss.
- **Beat 4 (`K3 → K4`, `1.24–1.66 s`) + Climax Hold (`1.66–2.06 s`)**: Expands into `HEART_CLIMAX_24x9` (`♥`) with a `2 Hz` heartbeat pulse.
- **Reverse (`2.06–2.86 s`)**: Reverses back (`HEART_CLIMAX_24x9 → HAPPY_CAT_24x9` during `K4 → K3`, holding `^w^` through `K3 → K1`, then sweeping back to `ANGRY_CAT_24x9` on `K1 → K0`).

### 3.2 Curved Visor Quad Calibration & Corner Interpolation
Each Emblem Keyframe (`K0–K4`) specifies normalized 4-corner goggle glass anchors $(P_{00}, P_{10}, P_{01}, P_{11})$ with vertical barrel curvature $\kappa = -0.014$:

- **`K0` & `K1`**: Top-Left `(0.802, 0.091)`, Top-Right `(0.878, 0.088)`, Bottom-Right `(0.885, 0.148)`, Bottom-Left `(0.808, 0.154)`.
- **`K2`**: Tilted `+6°` clockwise matching Kira's playful head tilt.
- **`K3` & `K4`**: Shifted left & tilted with head lean (`(0.768, 0.086)` to `(0.848, 0.168)`).

During transitions, `interpolateVisorQuad(frameA, frameB, blendU, outQuad)` linearly interpolates all four corners into a pre-allocated mutable `VisorQuad` struct. During idle breathing (`sequenceActive === false`), the quad applies the same vertical breathing offset as Kira's visor anatomical landmark (`V8`) so the LED cells stay locked to the goggle frame.

For matrix cell $(c, r)$ ($u_c = (c + 0.5) / 24, v_r = (r + 0.5) / 9$), bilinear projection plus curved-glass barrel bow gives exact `960 × 541` coordinates:
$$P(u_c, v_r) = \text{bilerp}(P_{00}, P_{10}, P_{01}, P_{11}, u_c, v_r) + \bigl(0,\, \kappa \cdot 4 u_c (1 - u_c)\bigr)$$

### 3.3 Choreography Beat Transitions & Pre-Allocated Buffers
- **Beat 1 (`K0 → K1`, Forward `0.00–0.36 s` / Reverse `K1 → K0`)**:
  - **Cathode Scanline Sweep (`180 ms`)**: A crisp white-cyan refresh bar sweeps down rows `r = 0..8` over `180 ms` (or upward `r = 8..0` on reverse). Rows already crossed read `HAPPY_CAT_24x9`; uncrossed rows show `ANGRY_CAT_24x9`.
  - **Discrete Grid-Cell Walk**: Precomputed static 1-to-1 optimal-transport index pairs map lit cells in `ANGRY_CAT_24x9` to `HAPPY_CAT_24x9` across integer matrix steps $(c(u), r(u)) = (\text{round}(\text{lerp}(c_i, c'_i, u)), \text{round}(\text{lerp}(r_i, r'_i, u)))$ with a `60 ms` phosphor afterglow decay on vacated cells.
  - **Phosphor Overdrive Flash (`90 ms`)**: Cells switching state emit a `90 ms` white-hot (`#ffffff`) glow burst at `1.35×` cell scale before settling into `#ff2e93`.
- **Beat 4 (`K3 → K4` & `0.40 s` Climax Hold)**:
  - **Radial Manhattan-Distance Pulse**: Expanding outward from center cell `(12, 4)` by Manhattan distance $d = |c - 12| + |r - 4|$ at `45 cells/sec`, flipping cells from `HAPPY_CAT_24x9` into `HEART_CLIMAX_24x9`.
  - **`2 Hz` Climax Heartbeat Throb**: During the `0.40 s` climax hold (`1.66–2.06 s`), lit heart LEDs modulate scale and glow radius by a `2 Hz` heartbeat wave (`1 + 0.16 * max(0, sin(2 * π * 2 * t))²`).

**Zero-GC Module Contracts (`src/utils/titleVisorMatrix.ts`)**:
- `VisorQuad`: `{ p00x, p00y, p10x, p10y, p01x, p01y, p11x, p11y }`
- `VisorMatrixState`: pre-allocated `cellFlashRemaining: Float32Array(216)`, `cellTrailRemaining: Float32Array(216)`, `lastCellState: Uint8Array(216)`, and scratch `workingQuad: VisorQuad`.
- `stepVisorMatrix(state, seqSample, dt, reducedMotion)` and `renderVisorMatrix(ctx, state, targetW, targetH, breathOffsetNormY, reducedMotion)`.

---

## 4. Metaball Surface-Tension Xeno Slime Engine (`src/utils/titleSlimeEngine.ts` — Stage 3)

### 4.1 Staggered Tentacle & Jaw Nozzles
After Stage 1 erases the 3 static hanging droplet tips (`(30, 294)`, `(32, 192)`, `(28, 304)`), four procedural slime nozzles drive continuous organic drips:

| Nozzle | Region (`960 × 541`) | Normalized Anchor `(nx, ny)` | Staggered Period `T` | Layer Relationship |
| :--- | :--- | :--- | :--- | :--- |
| **Nozzle 1** | Lower-Left Tentacle Tip | `(0.031, 0.535)` (`30, 289 px`) | `2.35 s` | Clear on left edge |
| **Nozzle 2** | Mid-Left Tentacle Tip | `(0.033, 0.348)` (`32, 188 px`) | `2.85 s` | Clear on left edge |
| **Nozzle 3** | Upper-Left Tentacle Under-Arch | `(0.086, 0.198)` (`83, 107 px`) | `3.40 s` | Clear on upper-left tentacle |
| **Nozzle 4** | Lower Jaw & Tongue Saliva | `(0.210, 0.315)` inside `nx ∈ [0.175, 0.245], ny ∈ [0.285, 0.365]` | `2.10 s` | Drawn behind Plane 0 (`NE` letter bevel) |

During Xeno roar / shock states (`sequenceActive && (frameA >= 3 || frameB >= 3)`), nozzle cycle time advances at **`2.2×` speed** (`dt * 2.2`), making slime visibly surge when the Xeno panics.

### 4.2 Three-Phase Surface-Tension & Capillary Freefall Physics
Each nozzle maintains deterministic phase $s \in [0, 1)$ plus a fixed pool of pre-allocated satellite droplets:

1. **Phase A — Accumulation & Bezier Neck Thinning ($s \in [0, 0.62]$)**:
   The droplet center descends $\Delta y = 11 \cdot (s / 0.62)^2\text{ px}$ while swelling from $R_{\min} = 2.2\text{ px} \to R_{\max} = 5.4\text{ px}$. A tapered bezier neck bridges the nozzle $(x_0, y_0)$ to the bulb $(x_0, y_0 + \Delta y)$ with waist width:
   $$w_{\text{neck}}(s) = R_{\text{drop}}(s) \cdot \max\!\left(0.12,\, 1 - \left(\frac{s}{0.62}\right)^{2.4}\right)$$
2. **Phase B — Capillary Snap & Volume-Preserving Freefall ($s \in (0.62, 0.92]$)**:
   Crossing $s = 0.62$ triggers capillary snap, spawning 1–2 micro-satellite beads ($r = 1.3\text{ px}$) at the neck midpoint while the primary bulb accelerates downward under $g = 420\text{ px/s}^2$:
   $$y(t_{\text{fall}}) = y_{\text{snap}} + \frac{1}{2} g t_{\text{fall}}^2, \qquad \text{scale}_Y = 1 + \min\!\left(0.65,\, \frac{v_y}{240}\right), \qquad \text{scale}_X = \frac{1}{\sqrt{\text{scale}_Y}}$$
3. **Phase C — Splash Dissolution into `bio_left` ($ny \approx 0.58$ / $s > 0.92$)**:
   Reaching the splash threshold (`ny ≈ 0.58`) dissolves the drop and emits **3 lime bio-spores (`#bef264`)** directly into the existing `bio_left` particle pool via `spawnSlimeSplashSpores(vfxState, nx, ny)` using the existing zero-GC `PooledParticle` ring.

### 4.3 `0.5×` Resolution (`140 × 220 px`) Metaball Threshold & 3-Stop Key-Art Shading
To cover all four nozzles (`x ∈ [0, 280]`, enclosing Nozzle 4 at `x ≈ 202` and left tentacles down past `ny ≈ 0.58` / `y ≈ 314`), the slime scratch canvas is sized **`140 × 220 px` at `0.5×` emblem resolution** (covering the `280 × 440 px` rectangle `x ∈ [0, 280], y ∈ [90, 530]` inside `960 × 541`):

1. **Soft Radial Field Pass**: Draws soft white radial alpha gradients for all nozzle necks, bulbs, and freefalling droplets onto the `140 × 220` scratch canvas (`ctx.globalCompositeOperation = 'source-over'`).
2. **Deterministic Smoothstep Alpha Thresholding (`~0.15 ms`, zero GC)**: Iterates the pre-allocated `ImageData` (`30,800` pixels) in place, mapping smoothstep alpha across `[0.42, 0.54]` (`a < 107 → 0`, `a > 138 → 255`) so approaching bulbs and thinning necks merge and pinch authentically across every browser without relying on inconsistent `ctx.filter = contrast(...)` implementations.
3. **Key-Art 3-Stop Acid Shading**: Shades the thresholded liquid silhouette with `#65a30d` (`shadowColor = '#84cc16'`, `10 px` outer glow), `#a3e635 → #4d7c0f` vertical acid body gradient (offset `-0.8 px` upper-left), and `#ecfccb` specular crescent at `alpha = 0.92` in the upper-left quadrant `(-0.35 R, -0.35 R)`, then blits the `140 × 220` canvas onto `compositeCanvasRef` over `(0, 90, 280, 440)` behind Plane 0.

**Zero-GC Module Contracts (`src/utils/titleSlimeEngine.ts`)**:
- `SlimeNozzle`, `SlimeDroplet`, and `SlimeEngineState` (pre-allocated fixed nozzle/satellite pools plus reusable `140 × 220` scratch canvas and `ImageData` pixel buffer).
- `createSlimeEngineState()`, `stepSlimeEngine(state, vfxState, dt, isXenoShocked, reducedMotion)`, and `renderSlimeEngine(ctx, state, targetW, targetH, reducedMotion)`.

---

## 5. Anatomical Warp Lattice & Idle Breathing (`src/utils/titleMeshWarp.ts` — Stage 4)

### 5.1 Lattice Topology: 16 Animated Landmarks + Pinned Boundary Anchors
By planar triangulation topology ($T = 2V - 2 - B$), `16` vertices alone yield at most `26` triangles and leave corners unanchored. To cover the dynamic stage seamlessly without clipping outer hair/tentacles and without shifting the **Static Lockup Plane** seam (`ny ≈ 0.37..0.41`), `titleMeshWarp.ts` defines:
- **16 Animated Anatomical Landmarks (`V0–V15`)** calibrated per Emblem Keyframe (`K0–K4`):
  - **Xeno (`V0–V7`)**: `V0` Upper-Left Tentacle `(0.09, 0.11)`, `V1` Mid-Left Tentacle `(0.06, 0.31)`, `V2` Lower-Left Tentacle `(0.06, 0.49)`, `V3` Right Eye / Brow `(0.21, 0.16)`, `V4` Left Eye `(0.32, 0.21)`, `V5` Upper Snout / Bridge `(0.24, 0.19)`, `V6` Lower Jaw / Tongue Tip `(0.28, 0.38)`, `V7` Cheek / Right Jaw Corner `(0.17, 0.34)`.
  - **Kira (`V8–V15`)**: `V8` Visor Center `(0.83, 0.12) → (0.80, 0.13)`, `V9` Hair Crown `(0.73, 0.05)`, `V10` Hair Tail Tip `(0.48, 0.22)`, `V11` Chin / Lips `(0.84, 0.31) → (0.74, 0.28)`, `V12` Right Shoulder `(0.73, 0.42)`, `V13` Right Forearm / Palm `(0.85, 0.43) → (0.66, 0.34)`, `V14` Torso / Belt `(0.83, 0.68)`, `V15` Plasma Pistol Muzzle `(0.96, 0.35) → (0.94, 0.28)`.
- **9 Pinned Outer-Perimeter & Static Lockup Plane Seam Anchors (`V16–V24`, zero displacement across `K0–K4` and idle)**:
  Four canvas corners `(0,0)`, `(1,0)`, `(1,1)`, `(0,1)`, top-center ring anchor `(0.50, 0.00)`, and four lockup-seam anchors (`(0.04, 0.40)`, `(0.42, 0.39)`, `(0.74, 0.40)`, `(0.76, 0.96)`), producing **`34` non-overlapping triangles** across Xeno, central ring, and Kira.

### 5.2 Bidirectional Affine Warp & `0.6 px` Seam Elimination
During any transition `u ∈ [0, 1]` between `K_A` and `K_B`, each vertex interpolates linearly into a pre-allocated `Float32Array`:
$$P_i(u) = (1 - u) P_{A,i} + u P_{B,i}$$

For every triangle $\triangle_{ijk}$:
1. **Degeneracy Guard**: Skip any triangle whose source or destination signed area determinant satisfies $|\det| < 10^{-6}$.
2. **Affine Matrix Solver (`solveTriangleAffine`)**: Computes the exact $2 \times 3$ Canvas2D transform $[a, b, c, d, e, f]$ mapping $(x_{0}, y_{0}, x_{1}, y_{1}, x_{2}, y_{2}) \mapsto (x'_{0}, y'_{0}, x'_{1}, y'_{1}, x'_{2}, y'_{2})$.
3. **`0.6 px` Outward Centroid Clip-Dilation** ([ADR-0002](../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md)): Expands each destination clip vertex outward by `0.6 px` along the normalized vector from the triangle centroid $(c_x, c_y)$ before calling `ctx.clip()`. This closes Canvas2D's `~0.5 px` anti-aliased hairline seams between adjacent triangles without visible double-blending artifacts.
4. **Solidity-Preserving Two-Pass Draw**: Draws `K_A` warped $P_A \to P(u)$ at `alphaA(u)`, then `K_B` warped $P_B \to P(u)$ onto the exact same destination triangle $P(u)$ at `alphaB(u)`. Because features are geometrically registered onto $P(u)$ prior to blending, Kira's raised kiss-arm (`~140 px` travel between `K2` and `K3`), head lean, and Xeno's recoiling jaw translate smoothly with zero double-exposure ghosting.

### 5.3 Idle `60 FPS` Sinusoidal Breathing
When `sequenceActive === false` and `reducedMotion === false`:
- Upper-body anatomical landmarks (`V0–V13`, `V15`, weighted `1.0` on Xeno brow/tentacles/Kira head and tapering smoothly to `0.0` along the pinned lockup seam `V16–V24` and waist `V14`) receive a sinusoidal vertical displacement of **`±1.5 px`** (`dy = Math.sin(timeSec * 2.15 + phaseOffset) * 1.5`) rendered over `K0`.
- During idle, this anatomical breathing **replaces** whole-emblem `breathScale` (`1.0` scale on idle, preserving gentle whole-stage levitation `bobNormY` and cursor 3D parallax) so Xeno and Kira breathe organically **behind** a rock-solid `NEON BREACH` Static Lockup Plane.

**Zero-GC Module Contracts (`src/utils/titleMeshWarp.ts`)**:
- `NormalizedVertex`, `TriangleIndices`, `AffineMatrix2D`, and `MeshWarpScratch` (pre-allocated `Float32Array` vertex coordinates and reusable 6-element transform output).
- `solveTriangleAffine(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2, outMatrix)`, `interpolateLattice(frameA, frameB, blendU, idleTimeSec, idleBreathingActive, outVertices)`, and `renderWarpedFramePair(ctx, frameAImg, frameBImg, frameAIdx, frameBIdx, blendU, alphaA, alphaB, scratch, w, h)`.

---

## 6. Performance Budget, Zero-GC Retrofits, Accessibility & Risk Mitigation

### 6.1 Frame Time & Memory Budget (`960 × 541`, DPR ≤ 2)

| Budget Category | Stage 1–4 Target | Notes |
| :--- | :--- | :--- |
| **Decoded Sprite Memory** | `~12.4 MB` GPU/RAM | `5 × 2.07 MB` (`k0–k4`) + `~1.1 MB` (`lockup_plane0`) + `2.07 MB` (`compositeCanvasRef`) |
| **Main-Thread Preload Cost** | `< 8 ms` | Off-main-thread `createImageBitmap()`; eliminates `~180 ms` runtime BFS flood-fill |
| **Stage 4 Mesh Warp (`34` tris)** | `~0.45 ms/frame` | 2×34 affine draws during transition (1×34 during idle breathing); pre-allocated `Float32Array` |
| **Stage 2 Visor Matrix (`24 × 9`)** | `< 0.20 ms/frame` | 216 LED cells + curved quad projection; pre-allocated `Float32Array(216)` overdrive/trail |
| **Stage 3 Xeno Slime (`140 × 220`)** | `~0.20 ms/frame` | `30,800`-pixel smoothstep alpha threshold (`~0.15 ms`) + 4 nozzles + 3-stop composite |
| **Plane 0 + Shadow + Sheen + VFX** | `~0.85 ms/frame` | `lockup_plane0` blit, unified shadow blit, `512×289` sheen, 128 pooled particles, 4 arcs |
| **Total Frame CPU Time** | **`~1.70 ms / 16.67 ms`** | Leaves >89% headroom under a strict `60 FPS` mobile/desktop frame budget |

### 6.2 Zero-GC Hot-Path Retrofits (`titleEmblemVfx.ts` & `TitleEmblemStage.tsx`)
Along with pre-allocating all vertex buffers (`Float32Array`), visor cell buffers (`Float32Array(216)` / `Uint8Array(216)`), and scratch canvases outside `requestAnimationFrame`, the Stage 4 polish pass also eliminates three minor per-frame allocations present in the v1 baseline:
- **`sampleLogoSequence()` & `stepTitleEmblemVfx()`**: Write into reusable pre-allocated mutable `LogoSequenceSample` and `EmblemTransformSample` structs stored inside `TitleEmblemVfxState` (instead of allocating fresh objects and spreading `{ ...sequence }` every frame).
- **`spawnRimArc()`**: Pre-allocate fixed-capacity `RimArcPoint` arrays on initialization and overwrite coordinates in place with an `activeLength` counter (instead of allocating `points = []` and new point objects per arc).
- **`TitleEmblemStage.tsx` DOM dataset writes**: Track cached integers `(lastSeqFrameA, lastSeqFrameB, lastSeqBlendPct)` in refs so template strings for `dataset.seqFrame` are formatted **only** on discrete changes rather than every animation frame.

### 6.3 Accessibility (`prefers-reduced-motion: reduce`) & Responsive DPR
- When `prefers-reduced-motion: reduce` is active:
  - Idle `±1.5 px` anatomical breathing, Xeno Slime drips, `90 ms` phosphor overdrive flashes, `2 Hz` climax throb, holographic sheen, shockwaves, electric rim arcs, and 3D perspective cursor tilt are all frozen.
  - Idle displays crisp static `K0` + `lockup_plane0` + static `ANGRY_CAT_24x9` visor.
  - Click choreography still advances the story timeline, stepping cleanly with gentle opacity-only transitions (`alphaA / alphaB`) and zero strobe/shake/warp motion.
- Canvas internal pixel size obeys `dpr = Math.min(window.devicePixelRatio || 1, 2)` across desktop (`<= 455 CSS px` height), narrow portrait (`<= 392 CSS px` width), and compact landscape (`<= 325 × 205 CSS px`).

### 6.4 Production Risk Mitigation Matrix

| Failure Point | Root Cause | Concrete Mitigation |
| :--- | :--- | :--- |
| **White/gray hole inside neon ring (`K1–K4`)** | Kira's glowing hair borders `> 44%` of the ring pocket, tripping the white medical-cross guard. | Two-tone checkerboard detector (`checkerGrayCount >= 12 && checkerWhiteCount >= 12`) strips islands while preserving single-tone white letter cores. |
| **Lanczos ringing halts BFS flood-fill** | Downscaling creates `RGB ≈ 219..223` edges along `228/252` checkerboard tiles. | `isNearWhite` accepts neutral low-chroma gray (`minC >= 216 && maxC - minC <= 8`). |
| **~180 ms title-load freeze & `createImageBitmap` incompatibility** | Runtime 5× BFS extraction runs on main thread and mutates canvas pixels directly. | Stage 1 bakes PNGs + all static masks offline (`scripts/bakeTitleSprites.ts`) and decodes via `createImageBitmap()`. |
| **Transparent hole behind Visor Matrix** | Erasing painted visor LEDs to `alpha = 0` exposes the background sky-plaza through Kira's visor. | Bake script inpaints opaque dark curved glass (`#0b132b` + glare), preserving cyan side bars and metallic bezel. |
| **Canvas2D triangle hairline seams** | Adjacent `ctx.clip()` triangles anti-alias shared edges (`~0.5 px` gaps). | Outward centroid clip-dilation (`0.6 px`) per triangle in `titleMeshWarp.ts` ([ADR-0002](../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md)). |
| **Cross-browser metaball threshold variance** | `ctx.filter = contrast()` differs across Safari/Firefox/Chrome and creates temporary filter layers. | Deterministic pre-allocated smoothstep `ImageData` threshold pass on `140 × 220` (`0.5×`) buffer (`~0.15 ms`). |
| **Tab-switch `dt` spike** | Returning from a background tab delivers `dt = 5..60 s`. | `dt = Math.min(0.05, Math.max(0, rawDt))` and skip advancing while `document.hidden === true`. |

---

## 7. Strict 4-Stage Execution Roadmap, Dev Calibration & Verification Gates

### 7.1 Ordered Implementation Sequence
Execute strictly in dependency order so each stage compiles, passes tests, and visually verifies before moving to the next:

1. **Stage 1 — Build-Time Cutout Baking & Static Lockup Plane Split**
   - Add `sharp` (`devDependency`) + `"bake:title": "tsx scripts/bakeTitleSprites.ts"` to `package.json`.
   - Move the 5 unbaked PNGs from `src/assets/sprites/` to `assets-src/title/`.
   - Implement `scripts/bakeTitleSprites.ts` (conditional Lanczos3, 4-pass alpha extraction, `lockup_plane0.png` split, opaque dark visor inpainting, `14 px` radial slime tip erasure, `bake-manifest.json`) and commit baked PNGs in `src/assets/sprites/baked/`.
   - Update `src/assets/gameAssets.ts`, `src/assets/assetPreloader.ts` (`createImageBitmap()` decoder + `getPreloadedTitleLockup`), and `TitleEmblemStage.tsx` (Plane 1 → Plane 0 composite).
2. **Stage 2 — Perspective-Mapped `24 × 9` Visor Matrix Engine**
   - Create `src/utils/titleVisorMatrix.ts` (bitmaps, per-keyframe curved quads, Beat 1 scanline + cell-walk + `90 ms` overdrive, Beat 4 Manhattan pulse + `2 Hz` climax throb, reverse collapse/wipe).
   - Integrate into `TitleEmblemStage.tsx` Layer 3b inside `compositeCanvasRef` and add `src/utils/titleVisorMatrix.test.ts`.
3. **Stage 3 — Metaball Surface-Tension Xeno Slime Engine**
   - Create `src/utils/titleSlimeEngine.ts` (4 staggered nozzles, `2.2×` shock boost, 3-phase physics, `140 × 220` `0.5×` scratch canvas, deterministic smoothstep alpha threshold + 3-stop shading, `bio_left` splash emission).
   - Integrate into `TitleEmblemStage.tsx` Layer 3c (between Plane 1 and Plane 0) and add `src/utils/titleSlimeEngine.test.ts`.
4. **Stage 4 — Anatomical Warp Lattice, Idle Breathing & Zero-GC Polish**
   - Create `src/utils/titleMeshWarp.ts` (16 landmarks + 9 pinned seam/perimeter anchors = `34` triangles, `solveTriangleAffine`, `0.6 px` clip-dilation, bidirectional `P(u)` warp with `computeSolidityAlphas`, `±1.5 px` idle breathing).
   - Complete zero-GC retrofits in `titleEmblemVfx.ts` and `TitleEmblemStage.tsx`, add `?debugTitleMesh=1` calibration overlay, replace idle `breathScale` with vertex breathing, and add `src/utils/titleMeshWarp.test.ts`.

### 7.2 Dev Calibration Overlay (`?debugTitleMesh=1`)
To inspect landmark alignment visually across `K0–K4` without guessing coordinates:
- Passing `?debugTitleMesh=1` on the Title Screen enables an unobtrusive overlay (Layer 8) displaying the `34` mesh triangles, numbered vertices (`V0–V15` landmarks in cyan, `V16–V24` pinned anchors in amber), the 4 interpolated Visor Matrix quad corners (`P00, P10, P01, P11`), and the 4 Xeno Slime nozzle origins.

### 7.3 Verification Gates
Every stage (and final completion) must pass:
- **Asset Freshness**: `npm run bake:title` generates/verifies `src/assets/sprites/baked/k0..k4.png`, `lockup_plane0.png`, and `bake-manifest.json` cleanly.
- **Automated Unit Tests (`node --experimental-strip-types --test` / `tsx --test` using `node:test` + `node:assert/strict`)**:
  - `src/utils/titleMeshWarp.test.ts`: affine transform solver exactness, degenerate determinant guards, `0.6 px` clip-dilation outward direction, `±1.5 px` idle breathing bounds & pinned seam invariance (`dy === 0` on `V16–V24`).
  - `src/utils/titleVisorMatrix.test.ts`: `24 × 9` bitmap validity, quad corner & curvature interpolation, Beat 1 scanline/cell-walk/overdrive durations, Beat 4 Manhattan expansion & `2 Hz` throb, reverse continuity.
  - `src/utils/titleSlimeEngine.test.ts`: 3-phase necking/snap/freefall volume conservation (`scaleX² * scaleY ≈ 1` preserving axisymmetric droplet volume), `2.2×` shock rate multiplier, splash emission into `bio_left`.
  - Existing `src/utils/titleEmblemVfx.test.ts` and `src/assets/assetPreloader.test.ts` continue passing with zero regressions.
- **Typecheck & Production Build**: `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) pass cleanly, with zero unbaked duplicates copied into `dist/`.
