# NEON BREACH — Enemy Animation & Combat Stage Specs

The combat visual pipeline is organized into five focused specifications:

1. [Sprite Sheet & Alpha Cutout Specification](./combat/sprite-sheet-spec.md) — Actual grid geometries (`4×4` 16-frame `1024×1024` Mutant sheets, dual `4×4` 32-frame Feral Nurse sheets, `3×16` 48-frame Crawler sheet, static Boss portrait) and procedural/chroma-key cutout rules.
2. [WebGL2 Deformable Mesh Pipeline](./combat/webgl-mesh-pipeline.md) — Three-layer Canvas2D + raw WebGL2 `#version 300 es` stage compositor, `4×6` Hermite-spline `MeshSprite`, and premultiplied-alpha shaders.
3. [4-Layer Procedural Juice System](./combat/procedural-juice-system.md) — Damped harmonic springs, 2.5D Paper-Mario flips, `proceduralJuiceCore.ts`, Spitter/Brute/MutDog/Feral Nurse choreography, and ballistic hand-off rules.
4. [Dynamic 2D Action Camera System v2](./combat/action-camera-v2.md) — *Darkest Dungeon*–inspired melee clashes, two-beat ranged cuts, AoE cascades, `CombatActionSequencer`, and `DEV`-only labs.
5. [Feral Nurse 32-Frame Dual-Sheet Animation Pipeline & Post-Mortem](./combat/feral-nurse-animation-pipeline.md) — Chroma-green alpha keying for white uniforms, hip-centroid `anchorX` stabilization, zero-ghosting frame transitions, phase-locked prowl kinematics, and landmark-scanned VFX origins.
