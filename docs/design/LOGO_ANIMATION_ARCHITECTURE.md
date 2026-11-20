# NEON BREACH — Title Emblem Animation Architecture

> **Runtime Context:** Reference `960 × 541 px` (downscaled from `1671 × 941 px` key art); bleed canvas adds `128% × 131%` margins for particles and arcs; 60 FPS zero-GC particle pool inside `src/utils/titleEmblemVfx.ts` and `src/components/TitleEmblemStage.tsx`.

---

## 1. Current Production Pipeline

### 1.1 Resized Emblem Keyframes (`src/assets/sprites/`)

| Pose Index | Asset File (`src/assets/sprites/...`) | Narrative Beat | Size |
| :--- | :--- | :--- | :--- |
| **Frame 0** | `title_logo_0.png` | **Idle / Base Aim:** Kira aims plasma pistol (`>_<` visor); Mutant roars | ~935 KB |
| **Frame 1** | `title_logo_1.png` | **Beat 1 (Wink):** Kira winks (`^w^` smiling visor) | ~935 KB |
| **Frame 2** | `title_logo_2.png` | **Beat 2 (Shared Grin):** Kira tilts pistol; hearts appear; Mutant winks | ~948 KB |
| **Frame 3** | `title_logo_3.png` | **Beat 3 (Blown Kiss):** Kira blows neon magenta heart kiss toward Mutant | ~990 KB |
| **Frame 4** | `title_logo_4.png` | **Beat 4 (Climax `!!`):** Solid pixel heart visor (`♥`); Mutant reels back | ~988 KB |

### 1.2 Multi-Pass Procedural Alpha Extraction (`src/utils/spriteCutout.ts`)
All 5 PNGs ship with baked checkerboard backgrounds (including enclosed interior rings) removed deterministically across macrotasks via `yieldTick()`:
1. **Pass 1 — Exterior Border BFS:** Flood-fills near-white and low-chroma Lanczos edge ringing (`min >= 216, chroma <= 8`).
2. **Pass 2 — Checkerboard vs. Lettering Discriminator:** Strips interior pockets matching two-tone checkerboard signatures (`checkerGrayCount >= 12 && checkerWhiteCount >= 12`) while preserving single-tone white neon cores (`NEON`, `BREACH`, `XENO-PURGE PROTOCOL`).
3. **Pass 3 — 1px Edge Defringing (`defringeStrength: 0.82`)** and **Pass 4 — Exterior Light-Glow Unmixing (`unmixLightGlow: true`)**.

### 1.3 C2 Quintic Cross-Dissolve & Click Timeline (`titleEmblemVfx.ts`)
* **C2 Quintic Easing:** `6t^5 - 15t^4 + 10t^3` eliminates velocity/acceleration kinks across frame blends.
* **Solidity-Preserving Alpha Schedule (`computeSolidityAlphas`):** Holds outgoing Frame A at `1.0` until `u >= 0.55` while ramping incoming Frame B linearly (`u`), preventing 75% mid-blend transparency ghosting, composited onto an offscreen scratch canvas before drawing the stage drop-shadow and holographic sheen.
* **Click-Triggered Narrative Arc (`2.86 s`):** Locks cleanly on `Frame 0` while idle; clicking runs `0 → 1 → 2 → 3 → 4 → Hold → 4 → 3 → 2 → 1 → 0` with synced heart-kiss streams, electric `XENO-PURGE PROTOCOL` rim arcs, and zone particles (`bio_left`, `ember_center`, `plasma_right`). Re-clicking mid-reverse maps smoothly back into the forward arc.

---

## 2. Future Visual Upgrade Proposals (Not Yet Implemented)

The following four enhancements remain **unimplemented design proposals** for a future visual polish pass:
1. **Verlet Green Slime Drip Engine (`titleEmblemVfx.ts`):** Physics-driven hanging droplets from the 4 Mutant tentacle/jaw drip tips.
2. **`24 × 9` LED Visor Matrix Morphing (proposed `titleVisorMatrix.ts`):** Perspective-mapped pixel-walk/scanline transitions on Kira's visor goggles.
3. **Static Chrome Typography Mask Split:** Locking `NEON BREACH` typography to `Frame 0` while blending only upper character regions.
4. **16-Vertex Bidirectional Mesh Warp (proposed `titleMeshWarp.ts`):** Affine triangle warp to remove forearm/head translation ghosting between Poses 2↔3↔4.
