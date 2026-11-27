# Title Emblem Animation Pipeline (Paradigm 1)

> **Canonical Glossary & Decisions**: [GLOSSARY.md](../../../GLOSSARY.md) (`Title Emblem`, `Static Lockup Plane`, `Emblem Keyframe`, `Choreography Beat`, `Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`), [ADR-0006 (Canvas2D Affine Mesh Warp)](../../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md), [ADR-0011 (Universal Build-Time Sprite Baking)](../../adr/0011-universal-build-time-sprite-baking.md).
> - **Reference Canvas**: `960 × 541 px` (aspect `1.7745:1`).
> - **Normalized Space**: `(nx, ny) ∈ [0, 1] × [0, 1]` with stage bleed margins (`±14%` horizontal, `+16% / +15%` vertical desktop; `+12% / +12%` compact landscape).
> - **Frame Budget**: `~1.70 ms / 16.67 ms` (`60 FPS`, `DPR <= 2`, zero per-frame GC allocations).

---

## 1. Baked Assets & Offline Masks (`scripts/bakeSprites.ts`)

Nine `960 × 541` `Emblem Keyframes` (five primary poses `title_logo_0..4.png` plus four calibrated in-between poses `title_logo_1_5.jpg`, `title_logo_2_3.jpg`, `title_logo_2_7.jpg`, `title_logo_3_5.jpg`) bake into `src/assets/sprites/baked/k0.png .. k4.png` (`k0, k1, k1_5, k2, k2_3, k2_7, k3, k3_5, k4`) and `lockup_plane0.png`, decoded off-main-thread via `createImageBitmap()` (`src/assets/titleEmblemPreloader.ts`):

| Keyframe | Baked Output | Narrative Beat |
| :--- | :--- | :--- |
| **`K0`** | `k0.png` + `lockup_plane0.png` | **Idle / Base Aim**: Kira aims plasma pistol; angry cat visor (`>_<`); Xeno roars |
| **`K1`** | `k1.png` | **Beat 1 (Wink)**: Kira winks right eye; visor morphs to smiling cat (`^w^`) |
| **`K1_5`** | `k1_5.png` | **In-Between 1→2**: Kira opens grin and lowers muzzle smoothly; Xeno begins squinting |
| **`K2`** | `k2.png` | **Beat 2 (Shared Grin)**: Kira grins & tilts pistol; Xeno winks right eye |
| **`K2_3`** | `k2_3.png` | **In-Between 2→3a**: Kira lifts left hand off pistol grip toward lips |
| **`K2_7`** | `k2_7.png` | **In-Between 2→3b**: Kira brings open palm to lips, charging magenta heart kiss |
| **`K3`** | `k3.png` | **Beat 3 (Blown Kiss)**: Kira blows neon magenta heart kiss from open palm |
| **`K3_5`** | `k3_5.png` | **In-Between 3→4**: Heart flies mid-air toward Xeno; Xeno startles back |
| **`K4`** | `k4.png` | **Beat 4 (Climax `!!`)**: Pixel heart visor (`♥`); Xeno reels back with yellow `!!` |

Offline baking executes 4-pass procedural white/checkerboard alpha extraction (`isNearWhite`, two-tone checkerboard vs. neon core pocket guard `area >= 32 px`, universal `stripEnclosedBackgroundWhitePockets` with border-darkness discrimination to strip trapped white pockets in Kira's hair curls, neon ring arch, and arm-torso gap across all 9 keyframes + 2-ring halo defringing, `1 px` neutral defringing `0.82`, exterior light-glow unmixing) plus 3 static mask passes:
1. **Static Lockup Plane Split (`lockup_plane0.png` from `K0`)**: Extracts `NEON BREACH`, cat-`O`, and `XENO-PURGE PROTOCOL` (`ny ∈ [0.382, 0.98], nx ∈ [0.035, 0.788]`) with a `12 px` cosine-feathered seam so lettering never shimmers across all 9 keyframes.
2. **Dark Visor Glass Inpainting (`K0–K4`)**: Imports `VISOR_KEYFRAME_QUADS` directly from `src/utils/titleVisorMatrix.ts` (single source of truth) and replaces painted LEDs with opaque dark curved glass (`#0b132b` + diagonal glare) so the backdrop never bleeds through and runtime LEDs never drift from the baked mask.
3. **Static Xeno Slime Tip Erasure (`K0–K4`)**: `15 px` radial soft erasure across 4 dual-circle anchors at `(32, 196)`, `(32, 207)`, `(27, 297)`, `(25, 309)` to cleanly remove static hanging droplets (including `K1`'s lower loop) before live `Xeno Slime` simulation.

---

## 2. Click Choreography, Solidity Blend & Per-Frame Z-Order (`TitleEmblemStage.tsx`, `titleEmblemVfx.ts`)

- **Timeline (`3.16 s`, continuous C∞ `easeInOutSine` phase curve)**: Single continuous forward arc `0.00..1.92 s` gliding smoothly through all 9 keyframes (`K0 → K1 → K1_5 → K2 → K2_3 → K2_7 → K3 → K3_5 → K4`) with zero velocity drops at intermediate frames (`BEAT1_END_SEC = 0.44`, heart burst `1.24 s`, Xeno shock burst/shake `1.50 s`), followed by a brief `0.28 s` living climax turnaround (`1.92..2.20 s`, retaining continuous anatomical breathing, sway, tilt follow-through, and shock tremor) and a single continuous `easeInOutSine` reverse glide (`2.20..3.16 s`) back to `K0`. Clicking mid-reverse (`t ∈ (2.20, 3.16]`) maps progress seamlessly back onto `[0, 1.92]` without snapping.
- **C2 Quintic Solidity Blend (`computeSolidityAlphas`)**: `u(t) = 6t^5 - 15t^4 + 10t^3`; `alphaA(u) = 1.0` for `u < 0.55` else `(1 - u) / 0.45`, `alphaB(u) = u`, guaranteeing `alphaA + alphaB >= 1` with zero mid-fade opacity dip.
- **Canonical Z-Order**:
  1. Dual-zone backdrop halo (`bio_left` `#84cc16`, center `#00f0ff`/`#ff2e7e`)
  2. Back-plane `PooledParticle`s
  3. Offscreen `960 × 541` `compositeCanvasRef`:
     - **3a — Plane 1**: `titleMeshWarp.ts` `Anatomical Warp Lattice`
     - **3b — Visor Matrix**: `titleVisorMatrix.ts` `24 × 9` LED grid
     - **3c — Xeno Slime (Background Layer)**: `titleSlimeEngine.ts` `312 × 440` (`1×` local region) metaball & intra-mouth drool buffer (tucks naturally behind Plane 0's `NEON` chrome bevel)
     - **3d — Plane 0**: `lockup_plane0.png` at `100%` opacity
     - **3e — Xeno Slime (Foreground Trickle Layer)**: Pooled viscous chrome-bevel oozing trickles & 3-bead impact crowns gliding down the `NEON` lettering
  4. Elliptical depth shadow + unified composite blit (avoiding expensive per-frame `shadowBlur` filters)
  5. `512 × 289` `destination-in` holographic sheen (`screen`)
  6. Click shockwave & `XENO-PURGE PROTOCOL` rim arcs
  7. Front-plane particles (`bio_left` spores, `heart_kiss`, `xeno_shock`)
  8. Optional `?debugTitleMesh=1` calibration overlay (`42` triangles, `V0–V24`, visor quad, 6 slime nozzles).

---

## 3. Subsystems (`Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`)

- **`24 × 9` Visor Matrix (`src/utils/titleVisorMatrix.ts`)**: High-contrast `Uint8Array(216)` bitmaps (`ANGRY_CAT_24x9`, `HAPPY_CAT_24x9`, `HEART_CLIMAX_24x9`) projected onto 9 calibrated curved 4-corner quads (`κ ≈ -0.014`, shared with offline baking). Beat 1 runs a `180 ms` cathode scanline + optimal-transport cell walk + `90 ms` white-hot phosphor overdrive; `K1–K3_5` holds `^w^` continuously; Beat 4 runs a `45 cells/s` radial Manhattan pulse + `2 Hz` heartbeat throb.
- **Metaball Xeno Slime (`src/utils/titleSlimeEngine.ts`)**: `6` staggered nozzles (`3` left-tentacle + `3` jaw/fang saliva nozzles, `2.2×` rate during Xeno shock) plus `2` elastic intra-mouth jaw drool strands (`XENO_JAW_STRANDS`) running 3-phase necking/capillary-snap/volume-preserving freefall (`scaleX² * scaleY ≈ 1`) on a `312 × 440` scratch buffer. Features Plateau-Rayleigh mid-strand bead necks, lateral tentacle-whip inertia, deterministic smoothstep `ImageData` alpha thresholding with a 5-stop comic-neon LUT + dark emerald outline (`#14532d`), wet specular sheen, rising internal micro-bubbles, pooled foreground chrome-bevel oozing trickles (`SlimeTrickle`), and `bio_left` splash spore emission.
- **Anatomical Warp Lattice (`src/utils/titleMeshWarp.ts`)**: `16` calibrated landmarks (`V0–V7` Xeno, `V8–V15` Kira) across all 9 keyframes + `9` pinned perimeter/lockup-seam anchors (`V16–V24`) forming `42` non-overlapping triangles. `solveTriangleAffine` warps both `K_A` and `K_B` onto $P(u)$ with `0.6 px` outward centroid clip-dilation (closing Canvas2D `~0.5 px` anti-alias seams) and drives `±1.5 px` vertical idle breathing plus `±1.4 px` organic horizontal tentacle/hair/weapon sway while keeping Kira's waist (`V14`) and the `Static Lockup Plane` seam (`V16–V24`) strictly invariant.
