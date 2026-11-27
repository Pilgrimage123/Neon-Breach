# Hero Animation Playbook (Paradigm 2)

> **Related**: [GLOSSARY.md](../../../GLOSSARY.md) (`Hero`, `Kira`, `Auraline`, `Zuri`, `Evasive Dodge`, `Tri-Drone Sync`), [Shared Invariants](./shared-invariants-and-baking.md), [Combat Stage & Camera](./combat-stage-and-camera.md).

> [!NOTE]
> **Tier A Convergence**: `Kira` (`KIRA-09`) and `Auraline` (`AURALINE-07`) have migrated to the Tier A `proceduralJuiceCore` standard (`kiraJuiceController.ts` + `kira_sheet_a`/`kira_sheet_b`, and `auralineJuiceController.ts` + `auraline_sheet_a`/`auraline_sheet_b`). `Zuri` remains on legacy `HeroAnimator` behind an adapter in `combatHeroSpritePass.ts` (see [Animation Do's & Don'ts](./dos-and-donts.md)).

---

## 1. Why Heroes Use `HeroAnimator` / Tier A `JuiceController`

Heroes (`Kira`, `Auraline`, `Zuri`) share the `4 × 6` WebGL2 `MeshSprite` stage with Mutants, handled by `src/utils/kiraJuiceController.ts`, `src/utils/auralineJuiceController.ts`, `src/utils/heroAnimator.ts`, `src/utils/characterAnimator.ts`, and `src/components/combat/combatHeroSpritePass.ts`:
- **Dual `4×4` 32-Frame Tier A Sheets (`Kira`, `Auraline`)**: `1024×1024` Sheet A (`F0..F15` combat) and Sheet B (`F16..F31` counter/overdrive/emotes/upgrade/victory) with uniform `256×256` cells, pelvis-centroid `anchorX`, and sole-locked `bottomY = 249`.
- **Uniform `rowScale` Normalization (`214.0 px`)**: Every `HeroFrameDef` carries an explicit `rowScale` (`0.8992` for `238 px` standing figures in `256×256` cells) so standing height normalizes strictly to `214.0 px` across all modes.
- **Crisp Frame Cuts (`blendDuration = 0`)**: `kiraJuiceController.ts`, `auralineJuiceController.ts`, and `zuriSpriteSheet.ts` all enforce `blendDuration = 0` (`frameBlendAlpha = 1`), relying on symplectic spring squash/stretch + `4`-knot Hermite spine (`FourKnotSpine`) + landmark-projected runtime VFX for `60 FPS` fluidity.
- **Action Camera Cut-In Overrides**: `resolveHeroCutInFrameIndex` delegates to `resolveKiraCutInFrameIndex` and `resolveAuralineCutInFrameIndex` to map `attack_pose`, `brace_pose`, and `recoil_pose` onto each Hero's canonical frames during cut-in holds.

---

## 2. Hero Roster & Special Mechanics

| Hero | Sheets (`assets-src/heroes/`) | Canonical Height | Staging & Foot Behavior | Special Attachment / Subsystem |
| :--- | :--- | :---: | :--- | :--- |
| **Kira** (`kira`) | `kira_sheet_a` (`1024×1024` 16f) + `kira_sheet_b` (`1024×1024` 16f) via `kiraJuiceController` | `214 px` | Ranged `pistol_bolt` (`shoot` & visor-down Attack **Stack Surge** blast); sole melee is flying double-footed **Energy Dropkick** (`overdrive`) | `muzzleRel` (`F6/F7/F10/F11`), `kickTipRel` (`F21`), `0.96 s` **Evasive Dodge** (`shouldKiraDodgeAttack`), runtime Surge Blast & Dropkick ring VFX |
| **Auraline** (`auraline`) | `auraline_sheet_a` (`1024×1024` 16f) + `auraline_sheet_b` (`1024×1024` 16f) via `auralineJuiceController` | `214 px` | `100%` planted ranged (`scattergun` across `shoot`, Attack Stack Surge **Artillery Surge Blast** `dash_kick`, and **Sovereign Broadside** `overdrive`) | `muzzleRel` (`F6/F7/F10/F11/F21`), muzzle-anchored `auraline_surge_blast_vfx.png` cyber-ring plasma beam on `F11` (`dash_kick`), twin-barrel scattergun blast cone, Sovereign Broadside multi-lane bombardment, Golden Reactor Core aura, and **Defensive Aegis** counter-brace (`shouldAuralineAegisCounter`, `F16..F19`) |
| **Zuri** (`zuri`) | `zuri_spritesheet` (`2172×724`, dark bake) + `zuri_emote_sheet` (`2170×725`, dark bake) + `zuri_drones_sheet` (`2172×724`, white bake) | `214 px` | `100%` `ranged` (`drone_plasma`); **hover altitude** (`yHopPx`) with dynamic cyan thruster ellipse shadow | `zuriDroneFormation.ts` renders 3 autonomous drones (`Solar Hawk`, `Aegis Walker`, `Med-Rotor`) synced to **Tri-Drone Sync** priming |

---

## 3. Verification & `DEV` Hero Lab

- Open `?devLabs=1&devLabTab=hero` in `DEV` mode to switch between `Kira`, `Auraline`, and `Zuri`, adjust live Tier A Rig Tuning sliders (`Spring Stiffness`, `Spring Damping`, `Spine Deform`, `Recoil Shear`), and trigger `idle`, `idle1`, `idle2`, `shoot`, `dash_kick` (`Surge Blast` / `Artillery Blast`), `overdrive`, `guard`, `dodge` (`Dodge` / `Aegis Counter`), `upgrade` (`Upgrade` / `Reactor Core`), `hit`, `defeat`, and `victory` (`Keys 1–9, 0`).
- Automated tests: `kiraSpriteSheet.test.ts`, `kiraJuiceController.test.ts`, `auralineSpriteSheet.test.ts`, `auralineJuiceController.test.ts`, `zuriSpriteSheet.test.ts`.
