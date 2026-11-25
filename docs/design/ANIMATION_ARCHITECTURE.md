# NEON BREACH — Unified Animation Architecture

> **Canonical Domain Vocabulary & Architecture Decisions**
> - **Domain Language**: [GLOSSARY.md](../../GLOSSARY.md) (`Title Emblem`, `Static Lockup Plane`, `Emblem Keyframe`, `Choreography Beat`, `Visor Matrix`, `Xeno Slime`, `Anatomical Warp Lattice`, `Hero`, `Mutant`, `Evasive Dodge`, `Tri-Drone Sync`, `Optical Cloak`).
> - **Architecture Decisions**:
>   - [ADR-0003: Three-Layer Hybrid Canvas2D + WebGL2 Stage](../adr/0003-hybrid-canvas2d-webgl2-stage.md)
>   - [ADR-0006: Canvas2D Affine Mesh Warp for Title Emblem](../adr/0006-canvas2d-affine-mesh-warp-for-title-emblem.md)
>   - [ADR-0011: Universal Build-Time Sprite Baking](../adr/0011-universal-build-time-sprite-baking.md) *(supersedes ADR-0005)*
>   - [ADR-0012: Two-Paradigm Animation Architecture & Tier A Mutant Convergence](../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md)

---

## Two-Paradigm Model

All real-time character and emblem animation in Neon Breach follows one of **two paradigms**, both fed by offline-baked RGBA PNGs (`npm run bake:sprites`) and governed by strict `60 FPS` (`16.67 ms`) zero-GC invariants:

| Domain | Paradigm | Renderer | Transition Policy | Authority |
| :--- | :--- | :--- | :--- | :--- |
| **Title Emblem** | **Paradigm 1 — Anatomical Mesh-Warped Keyframes** | Canvas2D (`TitleEmblemStage.tsx`, `titleMeshWarp.ts`) | `34`-triangle affine warp + C2 quintic solidity blend (`alphaA + alphaB >= 1`) | `titleEmblemVfx.ts` |
| **Heroes** (`Kira`, `Auraline`, `Zuri`) | **Paradigm 2 — Crisp-Cut Multi-Frame Sheets + Rig Physics** | WebGL2 `4×6` Hermite `MeshSprite` (`combatHeroSpritePass.ts`) | Instant `blendDuration = 0` pose cuts + spline/hover physics | `HeroAnimator` (`characterAnimator.ts`) |
| **Mutants** (9 `EnemyArchetype`s) | **Paradigm 2 — Crisp-Cut Multi-Frame Sheets + Rig Physics** | WebGL2 `4×6` Hermite `MeshSprite` (`combatEnemyMainSpritePass.ts`) | Instant `blendDuration = 0` cuts *(2-item spectral/eyelid allowlist only)* + 4-Layer `proceduralJuiceCore` | `*JuiceController` + `MUTANT_ANIMATION_REGISTRY` |
| **Portraits** (`HeroPortraitCanvas`, `EnemyBioScanPortrait`) | Static cropped frame / portrait | Canvas2D | Static (`BAKED_ENEMY_PORTRAIT_BOUNDS`) | `assetPreloader.ts` |
| **Clinic Nurse** (`NurseStageCanvas`) | **Deprecated Legacy** | Canvas2D | *Banned anti-pattern* (`4.2 fps` unwarped cross-dissolve + `trajectoryWarp`) — slated for future rework | Legacy `nurseSpriteSheet.ts` |

---

## Domain Playbooks

1. [Shared Invariants, Baking & Transition Laws](./animation/shared-invariants-and-baking.md) — `60 FPS` zero-GC budgets, `npm run bake:sprites` (`assets-src/` → `src/assets/sprites/baked/`), zero-readback decoding, pelvis-centroid `anchorX`, and the Two-Paradigm Transition Law.
2. [Combat Stage & Action Camera v2](./animation/combat-stage-and-camera.md) — Three-layer Canvas2D + WebGL2 `#version 300 es` compositor, `4×6` Hermite `MeshSprite`, `ActionCameraController`, and Unified `DEV` Animation Lab.
3. [Title Emblem Pipeline](./animation/title-emblem-pipeline.md) — `960 × 541` `K0–K4` keyframes, `Static Lockup Plane`, `2.86 s` `Choreography Beat` arc, `24 × 9` `Visor Matrix`, `0.5×` metaball `Xeno Slime`, and `34`-triangle `Anatomical Warp Lattice`.
4. [Hero Animation Playbook](./animation/hero-animation-playbook.md) — `HeroAnimator`, `214.0 px` `rowScale` multi-sheet stitching, `muzzleRel`/`kickTipRel`, Kira's `Evasive Dodge`, Auraline's scattergun recoil, and Zuri's hover + `Tri-Drone Sync`.
5. [Mutant Animation Playbook](./animation/mutant-animation-playbook.md) — Tier A convergence for all 9 Mutants, 4-Layer `proceduralJuiceCore`, `#00D856` chroma-green baking, landmark scanning, and transitional status of legacy archetypes.
6. [Exceed-Style Standee Animation Guide & Pipeline](./animation/exceed-standee-animation-guide.md) — First-principles pipeline for animating character standees in an *Exceed*-based turn-based fighting game (1D slot kinematics, Strike clash choreography, Paradigm 1 vs. Paradigm 2 selection, and failure-mode mitigations).

