# Enemy Sprite Sheet & Procedural Cutout Specification

---

## 1. Production Sheet Layouts

Neon Breach uses uniform grid layouts tailored to each Mutant class:

| Archetype(s) | Sheet Layout | Dimensions | Frame Count | Source Asset |
| :--- | :--- | :---: | :---: | :--- |
| **Spore Mite / Cobalt Skitter / Pyre Stinger** (`larva`, `skitter`, `stinger`) | **3 rows × 16 columns** (`crawlerSpriteSheet.ts`) | `2172 × 724` | `48` (`16` per variant) | `src/assets/sprites/crawler_spritesheet.png` |
| **Chitin Stalker** (`stalker`) | **4 × 4 uniform grid** (`stalkerSpriteSheet.ts`) | `1024 × 1024` | `16` | `src/assets/images/stalker_spritesheet_1794927639433.jpg` |
| **Bile Spitter** (`spitter`) | **4 × 4 uniform grid** (`spitterSpriteSheet.ts`) | `1024 × 1024` | `16` | `src/assets/images/spitter_spritesheet_1794935806587.jpg` |
| **Carapace Brute** (`brute`) | **4 × 4 uniform grid** (`bruteSpriteSheet.ts`) | `1024 × 1024` | `16` | `src/assets/images/brute_spritesheet_1794946123451.jpg` |
| **Feral Nurse** (`feral_nurse`) | **Dual 4 × 4 uniform grids** (`feralNurseSpriteSheet.ts`) | `2 × (1024 × 1024)` | `32` (`16` per sheet) | `src/assets/sprites/feral_nurse_sheet_a.png`, `src/assets/sprites/feral_nurse_sheet_b.png` |
| **Xenomorph Matriarch** (`boss`) | Single static portrait | `1024 × 1024` | `1` | `src/assets/images/mutant_boss_1794546443418.jpg` |

*(Hero sheets follow `kiraSpriteSheet.ts`, `auralineSpriteSheet.ts`, `zuriSpriteSheet.ts`, and `nurseSpriteSheet.ts`.)*

---

## 2. Frame Anchors, Facing & Cell Isolation

Every Mutant frame record (`SpriteRect` + anchors) defines:
* **`anchorX` / `bottomY`:** Local foot-center anchor pinned to `enemyGroundY` on the glass sky-bridge deck so breathing, flinches, and deaths never slide or hover.
* **`excludeRects`:** Optional cell sub-rects masked out during slicing to prevent neighbor-cell bleeding or baked-in floor splashes.
* **Orientation:** Native left-facing sprites (`larva`, `skitter`, `stinger`, `boss`) render at `facingSign = +1`; right-facing sheets (`stalker`, `spitter`, `brute`) mirror via `facingSign = -1` to face the Hero on the left.

### State Machine & Cross-Dissolve (`spriteSheetAnim.ts`)
* Evaluation priority: `Death` → `Brace / Guard` → `Pain / Hurt` → `Attack` → `Staggered` → `Primed Telegraph` → `Idle`.
* Smoothstep cross-dissolve blends outgoing and incoming frames (`primarySource` + `secondarySource`), paired with `interpolateMonotoneHermite` for strike/recoil trajectories.
* Collapse animation steps uniformly through the 4 death poses (`collapseNorm = min(1, p / 0.8)`) before alpha fadeout.

---

## 3. Procedural Alpha Cutout Pipeline (`spriteCutout.ts` & `spriteCutoutAlgorithms.ts`)

Instead of `#FF00FF` magenta keying, sheets ship as white/checkerboard or dark-backdrop rasters cleaned deterministically at load time:
1. **White / Checkerboard Cutout (`cleanWhiteBackgroundData`):** Edge-seeded BFS flood-fill over near-white pixels, floor-shadow neutralization, two-tone checkerboard island discrimination (protecting single-tone white highlights such as claws, teeth, medical crosses, and neon lettering), 1px neutral halo defringing, and exterior light-glow unmixing.
2. **Dark Cutout (`cleanDarkBackgroundData`):** Edge-seeded flood-fill for dark-backdrop sheets (`Zuri`, `Nurse`, `Crawler`), preserving dark interior silhouettes (suits, hair, armor) and bright highlights.

---

## 4. Verification Checklist

1. Every frame rect stays inside canvas bounds with valid `(anchorX, bottomY)`.
2. Cutout tests (`spriteCutout.test.ts`) assert interior eyes/highlights/uniforms stay opaque while background/checkerboard pockets clear cleanly.
3. Ground contact stays pinned to `enemyGroundY` across idle, hit, and collapse frames.
