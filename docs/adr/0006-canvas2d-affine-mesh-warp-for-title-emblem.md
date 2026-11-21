---
status: accepted
---

# 0006. Canvas2D Affine Triangle Mesh Warp for Title Emblem

Eliminating spatial ghosting during Title Emblem keyframe transitions (`K2 ↔ K3 ↔ K4`) and adding `60 FPS` idle anatomical breathing requires deforming the five Emblem Keyframes in real time across a control mesh. We decided to implement the Anatomical Warp Lattice in `src/utils/titleMeshWarp.ts` using Canvas2D `ctx.setTransform` affine triangle clipping with `0.6 px` outward centroid clip-dilation inside the existing stage canvas, rather than reusing the combat stage's `WebGL2` renderer (`src/components/combat/webglMeshRenderer.ts`).

## Considered Options

- **Reuse `WebGL2` `webglMeshRenderer.ts` on the Title Screen**: Rejected because spinning up a WebGL2 context on initial page load adds context creation/loss lifecycle complexity, consumes a browser WebGL context slot before entering combat, and complicates compositing with the Canvas2D Visor Matrix, Xeno Slime metaball buffer, `destination-in` holographic sheen sweep, and unified drop-shadow.
- **Dedicated Canvas2D affine triangle warper (`src/utils/titleMeshWarp.ts`) (Chosen)**: Renders ~32–36 triangles in `~0.45 ms/frame` directly inside the existing offscreen `compositeCanvasRef`, keeping zero GPU context overhead and single-buffer alpha compositing.

## Consequences

- Adjacent clipped triangles in Canvas2D anti-alias along shared edges and exhibit `~0.5 px` hairline seams unless expanded; every triangle clip path must be dilated outward by `0.6 px` from its centroid prior to `ctx.clip()`.
- The Anatomical Warp Lattice must stay compact (`16` animated anatomical landmarks plus `8–10` pinned perimeter and Static Lockup Plane seam anchors = `~32–36` triangles) so CPU affine solves and Canvas2D clip/draw calls remain comfortably under the `16.67 ms` frame budget.
