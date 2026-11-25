---
status: superseded by ADR-0011
---

# 0005. Build-Time Baked Title Emblem Sprites and Offline Static Masks

The Title Emblem displays five `960 × 541` keyframe illustrations (`K0–K4`) immediately on the Title Screen, where runtime multi-pass BFS alpha extraction previously cost ~180 ms of main-thread work and forced mutable `HTMLCanvasElement` pixel buffers. We decided to bake all five Emblem Keyframes and the Static Lockup Plane (`lockup_plane0.png`) offline via `scripts/bakeTitleSprites.ts` using `sharp` (invoked explicitly via `npm run bake:title`), commit the baked PNGs to `src/assets/sprites/baked/` alongside a hash manifest, move the unbaked checkerboard originals to `assets-src/title/`, and decode baked PNGs at runtime via off-main-thread `createImageBitmap()`, while leaving combat hero and enemy sprite sheets on runtime `src/utils/spriteCutout.ts`.

## Considered Options

- **Runtime BFS extraction + runtime canvas masking (`src/utils/spriteCutout.ts`)**: Rejected because running 5× BFS flood-fills on load blocks or delays readiness on the Title Screen, runtime visor/slime/lockup masking requires mutable pixel readback incompatible with immutable `ImageBitmap` decoding, and bundling unbaked PNGs from `src/assets/sprites/` ships ~5 MB of unoptimized originals into `dist/`.
- **Gitignore baked outputs and run baking in `prebuild`**: Rejected because regenerating PNGs on every `npm run build` slows CI/local builds and requires native image tooling during pure frontend builds.
- **Offline `sharp` baking via `npm run bake:title` + committed outputs + `createImageBitmap()` (Chosen)**: Eliminates runtime extraction loops, enables single-pass offline masking, and keeps `vite build` fast and deterministic.

## Consequences

- All four static pixel operations happen once offline: 4-pass procedural alpha extraction, Static Lockup Plane extraction (`lockup_plane0.png` from `K0`), opaque dark curved visor glass inpainting on `K0–K4`, and `14 px` radial erasure of the 3 static hanging Xeno Slime tips on `K0–K4`.
- Relocating the unbaked checkerboard originals from `src/assets/sprites/` to `assets-src/title/` keeps source inputs versioned without Vite bundling ~5 MB of unbaked originals into `dist/`.
- Combat hero and enemy sheets intentionally remain on runtime `spriteCutout.ts` for now; future contributors should preserve this intentional split rather than re-introducing runtime flood-fill on the Title Emblem or prematurely rewriting combat sheets.
