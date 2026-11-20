# WebGL2 Deformable 2D Mesh & GLSL 300 es Stage Pipeline

To support GPU spline deformation and per-frame shader effects without rewriting canvas vector decals or HUD overlays, combat renders across a **three-layer synchronized compositor** (`CombatStageCanvas.tsx`, `stageSpriteAdapter.ts`, `webglMeshRenderer.ts`).

---

## 1. Three-Layer Hybrid Stage Compositor

All three `<canvas>` layers share identical pixel dimensions and camera projection (`ActionCameraController`):
1. **Layer 0 — Base (`canvasRef`, Canvas2D):** Neo-Prague sky-bridge backdrop, glass deck geometry, persistent floor/cover blood decals, brute fissures, spitter ground puddles, elliptical foot shadows, and cut-in obsidian stage dimmer.
2. **Layer 1 — Actors & Reflections (`webglCanvasRef`, WebGL2 `#version 300 es`):** Clipped planar deck reflections (`gl.SCISSOR_TEST`), sprint afterimages, the active Hero (`Kira`, `Auraline`, `Zuri`), Zuri's Tri-Drones, and all Mutants rendered via `MeshSprite`.
3. **Layer 2 — Foreground & Telemetry (`fgCanvasRef`, Canvas2D):** Shield dome, on-stage lifebars, intent trajectory arcs, drop-pod holograms, blood droplets, projectiles, slash/Overdrive beams, particles, floating damage numbers, screen-visor blood drops, and `DEV`-only wireframe overlays.

---

## 2. `4 × 6` Deformable `MeshSprite` & Hermite Spine

Every actor renders onto a unified **`4 × 6` cell grid (`35` vertices, `48` triangles, `144` indices)** stored in a pre-allocated zero-GC `Float32Array(280)`:
* **Vertex Attributes (`8` floats):** `[xWorld, yWorld, u0, v0, u1, v1, hWeight, alpha]`, where `hWeight` rises from `0` (feet) to `1` (head).
* **4-Knot Anatomical Spine (`FourKnotSpine`):** Four control knots (`feet` at `0.00`, `pelvis` at `0.33`, `waist` at `0.67`, `head` at `1.00`) apply `(dx, dy, rotRad, scaleX)` interpolated via cubic Hermite smoothing (`evaluateAnatomicalSplineRow`). Because `feet` stays pinned (`dx=0, dy=0`), the bottom vertex row never slides off its deck shadow.
* **Dual-Frame Independent UVs:** `u1, v1` project using the secondary frame's own dimensions and foot anchor (`secondaryAnchorOffsetXPx`, `secondaryAnchorOffsetYPx`), preventing horizontal stretch during cross-dissolve between differently sized poses.

---

## 3. Unified GLSL `#version 300 es` Shaders & Safeguards

* **Vertex Shader:** Applies foot-anchored squash/stretch, height-weighted harmonic sway (`u_sway.x`, `u_sway.y` frequency, `u_sway.z` phase), shear, and the column-major orthographic `mat3` camera matrix `u_viewProjMatrix`.
* **Fragment Shader:** Applies optional edge-tapered `u_uvDistort`, samples `u_tex0` and `u_tex1` in premultiplied-alpha space to blend cleanly without dark halos, applies `u_tintColor` and additive `u_flashColor`, and outputs premultiplied RGBA (`gl.ONE, gl.ONE_MINUS_SRC_ALPHA`).
* **Context & Pool Hygiene:** Handles `webglcontextlost`/`webglcontextrestored` cleanly with Canvas2D fallback clearing, deduplicates same-frame sprite IDs, and caches textures in a `WeakMap<HTMLCanvasElement, WebGLTexture>`.
