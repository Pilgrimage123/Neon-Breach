# Title Emblem Animation Pipeline (Paradigm 1)

> **Canonical Glossary & Decisions**: [GLOSSARY.md](../../../GLOSSARY.md) (`Title Emblem`, `Static Lockup Plane`, `Emblem Keyframe`, `Choreography Beat`, `Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`), [ADR-0006 (Canvas2D Affine Mesh Warp)](../../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md), [ADR-0011 (Universal Build-Time Sprite Baking)](../../adr/0011-universal-build-time-sprite-baking.md).
> - **Reference Canvas**: `960 × 541 px` (aspect `1.7745:1`).
> - **Normalized Space**: `(nx, ny) ∈ [0, 1] × [0, 1]` with stage bleed margins (`±14%` horizontal, `+16% / +15%` vertical desktop; `+12% / +12%` compact landscape).
> - **Frame Budget**: `~1.70 ms / 16.67 ms` (`60 FPS`, `DPR <= 2`, zero per-frame GC allocations).

---

## 1. Baked Assets & Offline Masks (`scripts/bakeSprites.ts`)

Five `960 × 541` `Emblem Keyframes` (`assets-src/title/title_logo_0..4.png`) bake into `src/assets/sprites/baked/k0..k4.png` and `lockup_plane0.png`, decoded off-main-thread via `createImageBitmap()` (`src/assets/titleEmblemPreloader.ts`):

| Keyframe | Baked Output | Narrative Beat |
| :--- | :--- | :--- |
| **`K0`** | `k0.png` + `lockup_plane0.png` | **Idle / Base Aim**: Kira aims plasma pistol; angry cat visor (`>_<`); Xeno roars |
| **`K1`** | `k1.png` | **Beat 1 (Wink)**: Kira winks right eye; visor morphs to smiling cat (`^w^`) |
| **`K2`** | `k2.png` | **Beat 2 (Shared Grin)**: Kira grins & tilts pistol; Xeno winks right eye |
| **`K3`** | `k3.png` | **Beat 3 (Blown Kiss)**: Kira blows neon magenta heart kiss from open palm |
| **`K4`** | `k4.png` | **Beat 4 (Climax `!!`)**: Pixel heart visor (`♥`); Xeno reels back with yellow `!!` |

Offline baking executes 4-pass procedural white/checkerboard alpha extraction (`isNearWhite`, two-tone checkerboard vs. neon core pocket guard `area >= 32 px`, `1 px` neutral defringing `0.82`, exterior light-glow unmixing) plus 3 static mask passes:
1. **Static Lockup Plane Split (`lockup_plane0.png` from `K0`)**: Extracts `NEON BREACH`, cat-`O`, and `XENO-PURGE PROTOCOL` (`ny ∈ [0.382, 0.98], nx ∈ [0.035, 0.788]`) with a `12 px` cosine-feathered seam so lettering never shimmers across `K0–K4`.
2. **Dark Visor Glass Inpainting (`K0–K4`)**: Replaces painted LEDs with opaque dark curved glass (`#0b132b` + diagonal glare) so the backdrop never bleeds through.
3. **Static Xeno Slime Tip Erasure (`K0–K4`)**: `14 px` radial soft erasure over the 3 frozen hanging droplet tips at `(30, 294)`, `(32, 192)`, `(28, 304)`.

---

## 2. Click Choreography, Solidity Blend & Per-Frame Z-Order (`TitleEmblemStage.tsx`, `titleEmblemVfx.ts`)

- **Timeline (`2.86 s`)**: `0.00` Click Burst → `0.36` Beat 1 (`K1`) → `0.78` Beat 2 (`K2`) → `1.24` Beat 3 (`K3`) → `1.66..2.06` Beat 4 Hold (`K4`, `0.40 s`) → `2.86` smooth reverse back to `K0`. Clicking mid-reverse (`t ∈ (2.06, 2.86]`) maps progress seamlessly back onto `[0, 1.66]` without snapping.
- **C2 Quintic Solidity Blend (`computeSolidityAlphas`)**: `u(t) = 6t^5 - 15t^4 + 10t^3`; `alphaA(u) = 1.0` for `u < 0.55` else `(1 - u) / 0.45`, `alphaB(u) = u`, guaranteeing `alphaA + alphaB >= 1` with zero mid-fade opacity dip.
- **Canonical Z-Order**:
  1. Dual-zone backdrop halo (`bio_left` `#84cc16`, center `#00f0ff`/`#ff2e7e`)
  2. Back-plane `PooledParticle`s
  3. Offscreen `960 × 541` `compositeCanvasRef`:
     - **3a — Plane 1**: `titleMeshWarp.ts` `Anatomical Warp Lattice`
     - **3b — Visor Matrix**: `titleVisorMatrix.ts` `24 × 9` LED grid
     - **3c — Xeno Slime**: `titleSlimeEngine.ts` `140 × 220` (`0.5×`) metaball buffer (Nozzle 4 tucks behind Plane 0's `NE` bevel)
     - **3d — Plane 0**: `lockup_plane0.png` at `100%` opacity
  4. Unified drop-shadow blit (`shadowBlur = 28 * dpr`)
  5. `512 × 289` `destination-in` holographic sheen (`screen`)
  6. Click shockwave & `XENO-PURGE PROTOCOL` rim arcs
  7. Front-plane particles (`bio_left` spores, `heart_kiss`, `xeno_shock`)
  8. Optional `?debugTitleMesh=1` calibration overlay (`34` triangles, `V0–V24`, visor quad, slime nozzles).

---

## 3. Subsystems (`Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`)

- **`24 × 9` Visor Matrix (`src/utils/titleVisorMatrix.ts`)**: `Uint8Array(216)` bitmaps (`ANGRY_CAT_24x9`, `HAPPY_CAT_24x9`, `HEART_CLIMAX_24x9`) projected onto calibrated curved 4-corner quads (`κ ≈ -0.014`). Beat 1 runs a `180 ms` cathode scanline + optimal-transport cell walk + `90 ms` white-hot phosphor overdrive; `K1–K3` holds `^w^` continuously; Beat 4 runs a `45 cells/s` radial Manhattan pulse + `2 Hz` heartbeat throb.
- **Metaball Xeno Slime (`src/utils/titleSlimeEngine.ts`)**: 4 staggered nozzles (3 left-tentacle + 1 jaw saliva, `2.2×` rate during Xeno shock) running 3-phase necking/capillary-snap/volume-preserving freefall (`scaleX² * scaleY ≈ 1`) on a `140 × 220` (`0.5×`) buffer with deterministic smoothstep `ImageData` alpha thresholding (`[0.42, 0.54]`), 3-stop acid shading, and `bio_left` splash spore emission.
- **Anatomical Warp Lattice (`src/utils/titleMeshWarp.ts`)**: `16` calibrated landmarks (`V0–V7` Xeno, `V8–V15` Kira) + `9` pinned perimeter/lockup-seam anchors (`V16–V24`) forming `34` triangles. `solveTriangleAffine` warps both `K_A` and `K_B` onto $P(u)$ with `0.6 px` outward centroid clip-dilation (closing Canvas2D `~0.5 px` anti-alias seams) and drives `±1.5 px` sinusoidal upper-body idle breathing behind the pinned `Static Lockup Plane`.
