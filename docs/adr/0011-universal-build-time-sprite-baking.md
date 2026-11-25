---
status: accepted
---

# 0011. Universal Build-Time Sprite Baking and Zero-Readback Runtime Decoding

`ADR-0005` moved the Title Emblem onto offline `sharp` baking while leaving Hero, Mutant, Portrait, and Restorative Clinic sheets on runtime `spriteCutout.ts` BFS flood-fill (`getImageData` / `willReadFrequently: true`) and leaving ~8 MB of unbaked `public/assets/aistudio/` originals copied into `dist/`. We decided to supersede `ADR-0005` and bake **all** character, Mutant, Title Emblem, Clinic, and portrait sprites offline via `npm run bake:sprites` (`scripts/bakeSprites.ts` using `sharp`), relocating raw source rasters into `assets-src/{title,heroes,mutants,clinic,portraits}/` and committing whole-sheet lossless RGBA PNGs (`1:1` sheet dimensions so calibrated `SpriteRect` coordinates stay intact; `512px` max for dedicated portraits) plus `bake-manifest.json` (including precomputed `{ centerXRatio, bottomRatio }` portrait bounds) under `src/assets/sprites/baked/`.

## Considered Options

- **Keep combat sheets on runtime `spriteCutout.ts` (`ADR-0005` status quo)**: Rejected due to main-thread `getImageData` stalls, `willReadFrequently` CPU canvas backing, ad-hoc unscripted chroma-green keying on Feral Nurse, and unbaked asset bloat in `dist/`.
- **Explode baked sheets into 250+ per-frame PNGs or run `sharp` in `prebuild`**: Rejected due to HTTP/repo file explosion and `ADR-0002` Google AI Studio pure-`vite build` compatibility.
- **Explicit offline `sharp` whole-sheet baking + `createImageBitmap` / `TexImageSource` sub-rect slicing (Chosen)**: Preserves all calibrated `SpriteRect` coordinates, eliminates runtime pixel readback, and keeps `vite build` fast and native-binary-free.

## Consequences

- Zero runtime BFS flood-fill or `getImageData` pixel readbacks remain in browser code; pixel extraction algorithms (`white`, `dark`, `#00D856` chroma-green, `excludeRects`, glow unmixing, color dampening) live in build-time `scripts/` + tests.
- `vite build` stays fast and native-binary-free in Cloud Run / Google AI Studio, while `npm run bake:sprites` (with `npm run bake:title` preserved as an alias/subset) regenerates committed baked assets deterministically whenever `assets-src/` changes.
