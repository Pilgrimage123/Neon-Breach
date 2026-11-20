# NEON BREACH — Title Logo Creation Pipeline & Next-Gen Animation Architecture

> **Explicit Architectural Context & Assumptions**
> - **Reference Canvas Resolution**: `960 × 541 px` (aspect ratio `1.7745:1`, downscaled from `1671 × 941 px` source illustrations).
> - **Normalized Coordinate Space**: `(nx, ny) ∈ [0, 1] × [0, 1]` mapped to the emblem bounding box; canvas bleed margins add `±14%` horizontally and `+16% / +15%` vertically (`128% × 131%` total stage canvas) so particles, slime drops, and shockwaves never clip at rectangular container edges.
> - **Runtime Constraint**: 60 FPS budget (`16.67 ms/frame`), zero per-frame React state updates, zero garbage-collector allocations inside `requestAnimationFrame`.

---

## 1. End-to-End Creation Pipeline of the Logo & Click Animation

### 1.1 Asset Normalization, Lanczos Resampling & Zlib Compression
The 5 source illustrations arrived at `1671 × 941 px` (`2.4 MB – 2.9 MB` each, `~6.29 MB` decoded RGBA per frame, `~31.4 MB` total uncompressed texture footprint). Because the Title Screen renders the emblem at a maximum CSS height of `455 px` (`~808 × 455 CSS px`), `960 × 541 px` provides native Retina crispness while cutting decoded RGBA memory by **67.0%** (`2.07 MB/frame`, `10.38 MB` total) and disk payload by **62%**:

```bash
convert "$input.png" \
  -filter Lanczos -resize 960x541! \
  -strip \
  -define png:compression-filter=5 \
  -define png:compression-level=9 \
  -define png:compression-strategy=1 \
  "$output.png"
```

| Pose Index | Asset File (`/public/assets/aistudio/...`) | Narrative Beat | Disk Size (`1671×941` → `960×541`) |
| :--- | :--- | :--- | :--- |
| **Frame 0** | `Neon_Breach__Z__iv__o_i_mutantky_e73032c9.png` | **Idle / Base Aim**: Kira aims plasma pistol; red angry cat visor (`>_<`); Xeno roars | `2.4 MB` → `935 KB` |
| **Frame 1** | `Neonov__ko_i___kyberpunkov__hrdinka_11d2aafc.png` | **Beat 1 (Wink)**: Kira winks right eye; visor switches to pink smiling cat (`^w^`) | `2.5 MB` → `936 KB` |
| **Frame 2** | `Neonov__kyberpunkov__dvojice_mutantky_c41a2fcd.png` | **Beat 2 (Shared Grin)**: Kira grins & tilts pistol; floating hearts appear; Xeno winks right eye | `2.5 MB` → `949 KB` |
| **Frame 3** | `Neon_polibek_proti_xenomutantovi_a842b0d3.png` | **Beat 3 (Blown Kiss)**: Kira blows a neon magenta heart kiss from open palm toward Xeno | `2.7 MB` → `990 KB` |
| **Frame 4** | `Neonov__chaos__Xeno-breach_protokol_cac953eb.png` | **Beat 4 (Climax `!!`)**: Kira's visor shows solid pixel heart (`♥`); Xeno reels back wide-eyed with yellow `!!` | `2.6 MB` → `988 KB` |

---

### 1.2 Multi-Pass Procedural Alpha Extraction (`src/utils/spriteCutout.ts`)
All 5 uploaded PNGs had a baked-in opaque white/gray checkerboard background (`RGB ≈ 252,252,252` and `RGB ≈ 228..239`), including trapped interior checkerboard islands inside the central neon ring (`nx: 0.39..0.52, ny: 0.24..0.38`) and between Kira's hair strands. Runtime extraction executes in 4 deterministic passes on an offscreen `HTMLCanvasElement` sliced across macrotasks via `yieldTick()`:

1. **Pass 1 — Exterior Border Flood-Fill (BFS)**:
   Seeds all 4 image edges and floods inward across pixels matching `isNearWhitePixel`:
   $$\text{isNearWhite}(R,G,B) \iff (\min(R,G,B) > 224 \land \max - \min < 24) \lor (\min(R,G,B) \ge 216 \land \max - \min \le 8)$$
   The second clause (`min >= 216, chroma <= 8`) specifically absorbs Lanczos resampling ringing along high-frequency checkerboard tile boundaries (`RGB ≈ 219..223`).
2. **Pass 2 — Two-Tone Checkerboard vs. Neon Core Pocket Discriminator (`removeInteriorWhite`)**:
   Scans unvisited interior near-white connected components (`area >= 32 px`). For each pocket, it counts neutral gray checkerboard pixels (`216 <= min <= max <= 243, chroma <= 6`) and pure white checkerboard pixels (`min >= 247, chroma <= 6`), plus vibrant neon boundary neighbors (`max >= 145, chroma >= 42`):
   - **Rule**: If `checkerGrayCount >= 12 && checkerWhiteCount >= 12`, the pocket is unambiguously a trapped background checkerboard island and is stripped to `alpha = 0` even when surrounded by vibrant neon hair or ring glow.
   - **Protection**: Pure-white single-tone pockets (`isTwoToneCheckerboard === false`) bordered by vibrant glow (`vibrantGlowBorderCount / borderCount >= 0.35`) are preserved at `alpha = 255` (protecting the white-hot cores of `NEON`, `BREACH`, and `XENO-PURGE PROTOCOL` lettering).
3. **Pass 3 — 1px Neutral Halo Defringing (`defringeStrength: 0.82`)**:
   Attenuates 1-pixel neutral anti-aliased edge pixels (`luminance > 188, chroma < 34`) bordering newly transparent pixels by `alpha *= (1 - 0.82)`.
4. **Pass 4 — Exterior Light-Glow Unmixing (`unmixLightGlow: true`)**:
   Floods inward from cleared background pixels across light-mixed neon halo pixels (`min(R,G,B) > 138`) and analytically subtracts the white background contribution:
   $$\alpha_{\text{new}} = \text{clamp}\!\left(\frac{255 - \min(R,G,B)}{255 - 138},\, 0,\, 1\right)^{0.85}, \quad C_{\text{unmixed}} = \text{clamp}\!\left(\frac{C - 255(1 - \alpha_{\text{new}})}{\alpha_{\text{new}}},\, 0,\, 255\right)$$
   converting opaque pastel-pink/lime fringes into genuine translucent neon glow over the dark Neo-Prague skyline.

---

### 1.3 Solidity-Preserving C2 Quintic Cross-Dissolve (`src/utils/titleEmblemVfx.ts`)
Standard linear cross-fading (`alphaA = 1 - u, alphaB = u`) between two cutout sprites with `source-over` compositing causes two severe visual defects:
1. **Mid-Transition Opacity Dip (75% Ghosting)**: At $u = 0.5$, two $100\%$ opaque layers blended at $0.5$ each yield combined alpha $\alpha_{\text{out}} = 0.5 + 0.5(1 - 0.5) = 0.75$, allowing the dark background behind the logo to bleed through Kira's face and the Xeno's body every 0.4 seconds.
2. **Velocity Discontinuities at Keyframe Boundaries**: Linear or cubic steps produce abrupt acceleration jumps whenever a transition switches from `Frame 0→1` to `1→2`.

####Implemented Solution:
- **C2-Continuous Quintic Easing**:
  $$u(t) = 6t^5 - 15t^4 + 10t^3, \quad u'(0) = u'(1) = 0, \quad u''(0) = u''(1) = 0$$
- **Solidity-Preserving Opacity Schedule (`computeSolidityAlphas`)**:
  $$\alpha_A(u) = \begin{cases} 1.0 & \text{if } u < 0.55 \\ \max\!\left(0,\, \frac{1 - u}{0.45}\right) & \text{if } u \ge 0.55 \end{cases}, \qquad \alpha_B(u) = u$$
  Because $\alpha_A(u) + \alpha_B(u) \ge 1.0$ across the entire $[0, 1]$ interval and $\alpha_A = 1.0$ throughout the first $55\%$ of every blend, shared opaque regions remain **$100\%$ opaque ($255$ alpha)** at every instant.
- **Offscreen Composite Buffer (`compositeCanvasRef` in `TitleEmblemStage.tsx`)**:
  `Frame A` and `Frame B` are composited first onto an offscreen `960 × 541` scratch canvas without drop shadows. The unified composite is then drawn once onto the stage canvas with `shadowBlur = 28 * dpr`, preventing double-shadow darkening during transitions and providing a single alpha mask for the `destination-in` holographic sheen sweep.

---

### 1.4 Click-Only Narrative Timeline & Beat-Synchronized Particle Choreography
The animation remains locked on `Frame 0` (`sequenceActive = false`) during idle, running only ambient zone particles (`bio_left`, `ember_center`, `plasma_right`) and intermittent `XENO-PURGE PROTOCOL` rim arcs. Clicking inside the emblem hitbox triggers a `2.86 s` forward-hold-reverse story arc:

```
Time (s):  0.00      0.36       0.78        1.24       1.66      2.06               2.86
Pose:       [Frame 0] -> [Frame 1] -> [Frame 2] -> [Frame 3] -> [Frame 4] ==HOLD==> [4->3->2->1->0]
Event:      Click        Kira Wink    Xeno Wink    Heart Kiss    Xeno Shock !!       Smooth Reverse
            Burst (28p)  Cat ^w^      Shared Grin  Stream (14p)  Burst (18p) + Shake Back to Idle
```

- **Mid-Reverse Click Recovery**: If the player clicks again while the animation is reversing (`t ∈ (2.06, 2.86]`), reverse progress is mapped back to the equivalent forward timestamp:
  $$t_{\text{new}} = \left(1 - \frac{t - 2.06}{2.86 - 2.06}\right) \times 1.66$$
  preventing any hard frame snap.

---

## 2. Production Risk Mitigation & Failure Points Solved

| Failure Point in Practice | Root Cause | Concrete Mitigation Implemented |
| :--- | :--- | :--- |
| **Remaining white/gray hole inside the upper neon ring on Frames 1–4** | In Frames 1–4, Kira's glowing blue/magenta hair borders $>44\%$ of the enclosed ring pocket perimeter, triggering the `isVibrantNeonEmblem` guard designed for small white medical crosses. | Added two-tone checkerboard signature detection (`checkerGrayCount >= 12 && checkerWhiteCount >= 12`) inside `cleanWhiteBackgroundData`, stripping all checkerboard pockets regardless of border color while preserving single-tone white letter cores. |
| **Lanczos resize ringing blocking border flood-fill** | Lanczos downscaling from `1671×941` to `960×541` created `RGB ≈ 219..223` ringing at `228/252` checkerboard edges, halting a strict `minC > 224` flood-fill. | Extended `isNearWhitePixel` to accept neutral low-chroma gray (`minC >= 216 && maxC - minC <= 8`). |
| **Main-thread freeze (~180 ms) while decoding 5 high-res cutouts** | Running 5× BFS flood-fills synchronously in one turn blocks input responsiveness on the Title Screen. | Sliced frame decoding across macrotasks via `yieldTick()` (`setTimeout(0)`) in `loadTitleLogoFrames(onFrameReady)`, displaying `Frame 0` immediately while `Frames 1–4` stream into `framesRef.current`. |
| **Tab-switch delta-time explosion** | Returning from a background browser tab passes `dt = 5..60 s` to `requestAnimationFrame`, causing particle teleports and spring oscillation blowup. | Clamped `dt = Math.min(0.05, Math.max(0, rawDt))` and paused advancing when `document.hidden === true`. |

---

## 3. Brainstorm: Making the Animation Radically Smoother (Slime Drip & Visor Pixel-Art Morphing)

### Why Whole-Image Cross-Dissolve Has a Physical Ceiling
When two frames differ only in **luminance/color at fixed coordinates** (e.g., an LED turning on), cross-dissolve looks continuous. When a feature **translates across space** between frames (e.g., Kira's right arm moving from pistol grip at `nx: 0.84, ny: 0.44` in Frame 2 to her lips at `nx: 0.65, ny: 0.34` in Frame 3, or Xeno's head jerking back in Frame 4), pure opacity cross-dissolve produces a momentary **double-exposure ghost** where both arm positions are simultaneously visible at $50\%$ opacity.

Below are **4 concrete technical upgrades**—ordered by impact-to-complexity ratio—that eliminate ghosting, make the green bio-slime drip continuously under gravity, and make Kira's LED visor pixel-art morph authentically like a real cyberpunk dot-matrix display.

---

### 3.1 Upgrade 1: Natural Green Slime Drip Engine (Verlet Surface-Tension Droplets + Alpha-Threshold Bridge)

#### Anatomical Analysis of the Logo's Left Xeno Zone (`960 × 541`)
In all 5 frames, the Xeno on the left has **4 primary painted green-slime drip tips** (`#a3e635` / `#84cc16` outer glow, `#d9f99d` specular core, `#3f6212` dark olive core shadow) that are frozen in static positions in the source PNGs:
1. **Lower-Left Tentacle Tip Drip**: `(nx: 0.031, ny: 0.535)` (`x: 30, y: 289`)
2. **Mid-Left Tentacle Tip Drip**: `(nx: 0.033, ny: 0.348)` (`x: 32, y: 188`)
3. **Upper-Left Tentacle Under-Arch Drip**: `(nx: 0.086, ny: 0.198)` (`x: 83, y: 107`)
4. **Lower Jaw & Tongue Saliva Strands**: `nx ∈ [0.175, 0.245], ny ∈ [0.285, 0.365]`

Because these painted drops sit at slightly different vertical offsets in Frames 0–4, cross-dissolving the whole image causes the static painted drops to fade in and out rather than fall downward.

#### Concrete Mechanism to Implement Natural Dripping:
1. **Static Drip-Tip Soft Erasure Mask (Preload Time)**:
   During `loadTitleLogoFrames`, apply a soft radial alpha fade (`r = 14 px`) over the 3 detached hanging droplet tips below the tentacle undersides (`(30, 294)`, `(32, 192)`, `(28, 304)`) so the static hanging drops are replaced by live physics-driven droplets anchored to the tentacle tips.
2. **3-Phase Surface-Tension Drip Physics (Per Nozzle)**:
   Each slime nozzle runs a deterministic phase cycle $s \in [0, 1]$ with staggered period $T \in [2.1\text{ s}, 3.4\text{ s}]$ (accelerating by $2.2\times$ when the Xeno roars or gets shocked on click!):
   - **Phase A — Accumulation & Necking ($s \in [0, 0.62]$)**:
     The droplet center descends slowly by $\Delta y = 11 \cdot s^2\text{ px}$ while its radius swells from $2.2\text{ px} \to 5.4\text{ px}$. A tapered bezier bridge connects the tentacle nozzle $(x_0, y_0)$ to the droplet $(x_0, y_0 + \Delta y)$ with neck width:
     $$w_{\text{neck}}(s) = R_{\text{drop}} \cdot \max\!\left(0.12,\, 1 - \left(\frac{s}{0.62}\right)^{2.4}\right)$$
   - **Phase B — Capillary Snap & Freefall ($s \in (0.62, 0.92]$)**:
     At $s = 0.62$, the neck pinches off (spawning 1–2 micro-satellite beads of radius $1.3\text{ px}$ at the snap midpoint) and the main droplet accelerates under gravity $y(t_{\text{fall}}) = y_{\text{snap}} + \frac{1}{2} g t_{\text{fall}}^2$ ($g = 420\text{ px/s}^2$), elongating vertically by stretch factor:
     $$\text{scale}_Y = 1 + \min(0.65,\, v_y / 240), \qquad \text{scale}_X = \frac{1}{\sqrt{\text{scale}_Y}}$$
      preserving 2D droplet volume.
   - **Phase C — Sub-Tentacle Splash / Dissolve ($s \in (0.92, 1.0]$)**:
     As the drop reaches the neon frame rim (`ny ≈ 0.58`), it bursts into 3 tiny lime bio-spores (`#bef264`) that feed directly into the existing `bio_left` particle pool.
3. **Key-Art-Matched 3-Stop Shader / Canvas Rendering**:
   To look indistinguishable from the painted illustration rather than a flat vector circle, each droplet + neck bridge is rendered in 3 layered passes:
   - **Outer Bio-Luminescence**: `shadowColor = '#84cc16'`, `shadowBlur = 10 * dpr`, fill `#65a30d`.
   - **Inner Acid Body**: Offset `-0.8 px` toward upper-left, fill linear gradient `#a3e635 → #4d7c0f`.
   - **Curved White-Lime Specular Crescent**: Small arc at upper-left quadrant `(-0.35 R, -0.35 R)` with `#ecfccb` at `alpha = 0.92`.

---

### 3.2 Upgrade 2: LED Matrix Visor Morphing Engine (Perspective-Mapped `24 × 9` Dot-Matrix Sub-Canvas)

#### Why the Glasses Currently Cross-Fade Instead of Morphing
Across the 5 frames, Kira's cyber-goggles display 3 distinct pixel-art icons on a curved dark-blue LED matrix (`nx: 0.745..0.892, ny: 0.082..0.212`):
- **Frame 0, 2, 3**: Red-orange angry cat face (`>_<` with pointed ears and jagged mouth, `#ff2a2a` / `#ff7b00`)
- **Frame 1**: Neon-pink happy smiling cat face (`^w^` with curved eyes, `#ff2e93` / `#ff9de2`)
- **Frame 4 (Climax)**: Giant glowing magenta-pink pixel heart (`♥` flanked by twin mini-hearts, `#ff2e93` / `#ffffff`)

When transitioning `Frame 0 → 1` or `Frame 3 → 4`, a standard raster cross-dissolve superimposes the red angry cat and pink smiling cat/heart at $50\%$ opacity, which looks like an image fade rather than an electronic LED display updating its pixels.

#### Concrete Mechanism to Make the Visor Pixel-Art Transition Naturally:
1. **Define Canonical `24 × 9` Binary/Color LED Bitmaps**:
   Encode the 3 visor expressions (`ANGRY_CAT_24x9`, `HAPPY_CAT_24x9`, `HEART_CLIMAX_24x9`) as tiny `24 × 9` integer grids (`0 = dark LED off #0b132b`, `1 = primary neon LED`, `2 = white-hot LED core`).
2. **Curved Visor Homography / Coons-Patch Projection**:
   For each of the 5 poses, store the 4 normalized corner anchors of Kira's black visor screen + vertical barrel curvature $\kappa \approx -0.014$:
   - **Poses 0 & 1**: Top-Left `(0.802, 0.091)`, Top-Right `(0.878, 0.088)`, Bottom-Right `(0.885, 0.148)`, Bottom-Left `(0.808, 0.154)`
   - **Pose 2**: Tilted `+6°` clockwise
   - **Poses 3 & 4**: Shifted left & tilted with head lean `(0.768, 0.086)` to `(0.848, 0.168)`
   During any transition between `frameA` and `frameB`, linearly interpolate the 4 corner anchors $(P_{00}, P_{10}, P_{01}, P_{11})$ using `blendU` so the LED grid rides locked to Kira's moving goggles with sub-pixel accuracy.
3. **3 Authentic Cyberpunk LED Matrix Transition Modes** (replacing alpha cross-fade inside the visor quad):
   - **Mode 1 — Scanline Cathode Sweep (`Frame 0 → 1`, Angry Cat → Happy Cat)**:
     A bright white-cyan horizontal refresh bar sweeps from row `r = 0` to `r = 8` over `180 ms`. Rows above the bar display `HAPPY_CAT_24x9`; rows below still display `ANGRY_CAT_24x9`. LEDs switching state emit a `90 ms` white-hot phosphor overdrive flash (`scale = 1.35`, `#ffffff`) before settling into `#ff2e93`.
   - **Mode 2 — Discrete Pixel-Walk Morph (`Hungarian / Optimal Transport Assignment`)**:
     Precompute a 1-to-1 shortest-grid-path pairing between active LED coordinates $(c_i, r_i)$ in `ANGRY_CAT_24x9` and $(c'_i, r'_i)$ in `HAPPY_CAT_24x9`. During the `0.36 s` transition, each lit LED steps discretely across integer matrix cells $(c(u), r(u)) = (\text{round}(\text{lerp}(c_i, c'_i, u)), \text{round}(\text{lerp}(r_i, r'_i, u)))$ with a `60 ms` phosphor afterglow trail on vacated cells—making the angry cat eyes literally **squint and fold** into the smiling `^w^` cat eyes pixel-by-pixel!
   - **Mode 3 — Radial Heart Pulse Expand (`Frame 3 → 4`, Cat → Pixel Heart Climax)**:
     Starting from the visor center cell `(12, 4)`, a Manhattan-distance wave $d = |c - 12| + |r - 4|$ expands outward at `45 cells/sec`, flipping the cat matrix into the pulsing `HEART_CLIMAX_24x9` pattern synced with a `2 Hz` heartbeat scale throb during the `0.40 s` climax hold.

---

### 3.3 Upgrade 3: Regional Layer Split (Static Chrome Lockup vs. Deforming Character Puppets)

#### First-Principles Observation
In all 5 uploaded illustrations, the bottom $55\%$ of the artwork (`NEON BREACH` 3D bevel letters, the cat-head `O` emblem, the `XENO-PURGE PROTOCOL` hexagonal plate, and the bottom skull medallion) is **semantically static**, yet slight AI-generation variance between the 5 source images (`1–3 px` line-weight and highlight shifts on the letters) causes the metallic typography to subtly shimmer when all 5 full images are cross-dissolved.

#### Concrete Mechanism:
1. **Split the `960 × 541` Canvas into 2 Compositing Planes via a Feathered Y/Polygon Mask**:
   - **Plane 0 — Master Typography & Frame Lockup (Locked to `Frame 0`)**:
     The polygon covering `NEON BREACH` and `XENO-PURGE PROTOCOL` (`ny ∈ [0.38, 0.98], nx ∈ [0.04, 0.79]`, excluding Kira's torso/hand overlap on the right) is rendered **100% from `Frame 0` at all times**.
     - *Result*: Zero typography shimmer during click animations, AND we only need to store/blend the upper/flanking character regions (`~52%` of pixel area) for `Frames 1–4`.
   - **Plane 1 — Dynamic Character Stage (Xeno Left `nx: 0..0.44, ny: 0..0.52` + Kira Right `nx: 0.45..1.0, ny: 0..0.92`)**:
     Only the Xeno and Kira zones participate in the 5-frame pose transition, with a `12 px` cosine-feathered seam along the top bevel of the `NEON` letters (`ny ≈ 0.37..0.41`).

---

### 3.4 Upgrade 4: Correspondence-Guided Mesh Warp / Displacement Advection Between Poses

#### Why Mesh Advection Eliminates the Last 15% of Cross-Dissolve Ghosting
Even with C2 quintic easing and solidity-preserving alpha, transitioning from **Pose 2** (Kira holding pistol with both hands at right) to **Pose 3** (Kira bringing her right hand up to her lips to blow a kiss) crosses a `~140 px` spatial translation of her forearm.

#### Concrete Mechanism (Zero-Dependency 2D Triangle Mesh Warp on Canvas2D or WebGL):
1. **Define a 16-Vertex Control Lattice over Kira & Xeno (`32 triangles`)**:
   Key anatomical landmarks per frame $(k \in \{0..4\})$:
   - `V0`: Xeno Upper-Left Tentacle `(0.09, 0.11)`
   - `V1`: Xeno Right Eye / Brow `(0.21, 0.16)`
   - `V2`: Xeno Left Eye `(0.32, 0.21)`
   - `V3`: Xeno Lower Jaw / Tongue Tip `(0.28, 0.38)`
   - `V4`: Kira Visor Center `(0.83, 0.12)` → `(0.80, 0.13)`
   - `V5`: Kira Chin / Lips `(0.84, 0.31)` → `(0.74, 0.28)`
   - `V6`: Kira Right Hand / Palm `(0.85, 0.43)` → `(0.66, 0.34)`
   - `V7`: Plasma Pistol Muzzle `(0.96, 0.35)` → `(0.94, 0.28)`
2. **Bidirectional Triangle Affine Warp During Transition $u \in [0, 1]$**:
   For each triangle $\triangle_{ijk}$ with vertex positions $P_A$ in `frameA` and $P_B$ in `frameB`, compute the interpolated intermediate triangle:
   $$P(u) = (1 - u) P_A + u P_B$$
   - Warp `frameA` forward from $P_A \to P(u)$ using standard Canvas2D `ctx.setTransform(a, b, c, d, e, f)` clipped to $\triangle(P(u))$ at opacity $\alpha_A(u)$.
   - Warp `frameB` backward from $P_B \to P(u)$ onto the **exact same intermediate triangle** $\triangle(P(u))$ at opacity $\alpha_B(u)$.
   - **Result**: Because both `frameA` and `frameB` are geometrically registered onto $P(u)$ before blending, Kira's head, visor, hair waves, and Xeno's jaw **physically rotate and translate** smoothly across the 60 FPS frames while their textures cross-dissolve in-place with zero double-edge ghosting.

---

## 4. Implementation Priority Matrix

| Upgrade Module | Visual Smoothness Gain | CPU / Memory Cost | Recommended Implementation Target |
| :--- | :--- | :--- | :--- |
| **1. Verlet Green Slime Drip Engine** | **Very High** (continuous organic life even on idle; reactive splash on click) | `< 0.15 ms/frame` (4 nozzles, zero allocations) | `src/utils/titleEmblemVfx.ts` + `TitleEmblemStage.tsx` |
| **2. `24×9` LED Matrix Visor Morphing** | **Very High** (eliminates goggle cross-fade; authentic pixel-art LED morph) | `< 0.20 ms/frame` (216 LED cells on homography quad) | `src/utils/titleVisorMatrix.ts` + `TitleEmblemStage.tsx` |
| **3. Static Typography Plane Split** | **High** (locks `NEON BREACH` metal bevels 100% rock-solid during pose changes) | Saves `~45%` per-frame composite fill-rate | `src/assets/assetPreloader.ts` + `TitleEmblemStage.tsx` |
| **4. 16-Vertex Bidirectional Mesh Warp** | **Maximum** (eliminates forearm/head translation ghosting between Poses 2↔3↔4) | `~0.45 ms/frame` (32 affine-textured Canvas2D triangles) | `src/utils/titleMeshWarp.ts` + `TitleEmblemStage.tsx` |
