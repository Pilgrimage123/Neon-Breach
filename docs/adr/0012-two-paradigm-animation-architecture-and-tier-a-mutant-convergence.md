---
status: accepted
---

# 0012. Two-Paradigm Animation Architecture and Tier A Mutant Convergence

Independent iterations across the Title Emblem, Heroes, Mutants, and Restorative Clinic produced conflicting transition, anchor, and controller models — causing *"two heads / four legs"* ghosting from unwarped `blendDuration > 0` cross-dissolves, horizontal hip-teleportation from foot-midpoint `anchorX`, `NurseStageCanvas` 8-pose continuous cross-dissolve double-exposure, and duplicated `sample*Frame` + `*JuiceController` execution in `combatEnemyAnimationSim.ts`. We decided to unify all character and emblem animation around **two paradigms** sharing `60 FPS` zero-GC budgets and pelvis/torso-centroid `anchorX` (`35%–65%` height) + sole `bottomY` anchoring:

1. **Anatomical Mesh-Warped Keyframes** (`Title Emblem` and future close-up key-art scenes): Curated illustrated poses geometrically registered via an `Anatomical Warp Lattice` (`titleMeshWarp.ts` affine triangles per `ADR-0006`) prior to C2 quintic solidity blending (`alphaA + alphaB >= 1`).
2. **Crisp-Cut Multi-Frame Sprite Sheets + Continuous Rig Physics** (`Heroes` and `Mutants` on the `4×6` WebGL2 Hermite-spline `MeshSprite`): Instant `blendDuration = 0` pose cuts across all physical motion (permitting `blendDuration > 0` strictly for `Feral Nurse` `Optical Cloak` spectral afterimages and `Chitin Stalker`'s transitional identical-silhouette eyelid blink), with `60 FPS` fluidity driven by symplectic springs and 4-knot spine deformation.

## Consequences

- **Heroes** retain their dedicated `HeroAnimator` architecture (`rowScale` `214.0px` normalization across heterogeneous multi-sheets, `combat`/`emote`/`dodge` stitching, Zuri's hover altitude + 3 `Tri-Drone Sync` drones, and Action Camera cut-in pose overrides).
- **Mutants** converge all 9 `EnemyArchetype`s onto **Tier A** (registered 4-Layer `proceduralJuiceCore` adapter + multi-frame sheet + unified `DEV` Animation Lab switcher), isolating the 5 pre-Tier-A Mutants (`larva`, `skitter`, `stinger`, `stalker`, `boss`) behind transitional adapters until their Tier A sheets are authored and stripping redundant `sample*Frame` double-sampling.
- **Deprecated Anti-Pattern**: Unwarped whole-sprite cross-dissolve / `trajectoryWarp` ping-pong (`NurseStageCanvas`) is formally deprecated and banned as a model for future facility/NPC stages.
- **Post-Production Amendment (Tier A Standard)**: **Paradigm 1 (`Title Emblem` mesh-warp)** is now **frozen legacy** (retained only for the existing `Title Emblem`; do not use for new scenes or NPC reworks). **Tier A (`proceduralJuiceCore` + crisp `4×4` multi-frame sheet)** is the sole recommended standard for all future characters, NPCs (including any `NurseStageCanvas` rework), and Hero reworks.
