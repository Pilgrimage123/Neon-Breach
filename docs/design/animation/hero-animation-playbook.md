# Hero Animation Playbook (Paradigm 2)

> **Related**: [GLOSSARY.md](../../../GLOSSARY.md) (`Hero`, `Kira`, `Auraline`, `Zuri`, `Evasive Dodge`, `Tri-Drone Sync`), [Shared Invariants](./shared-invariants-and-baking.md), [Combat Stage & Camera](./combat-stage-and-camera.md).

> [!NOTE]
> **Early-Phase Legacy Architecture**: `HeroAnimator` is maintained for the existing `Kira`, `Auraline`, and `Zuri` rigs. For any new Hero or full Hero rework, converge on the Tier A `proceduralJuiceCore` standard rather than copying `HeroAnimator` multi-sheet `rowScale` workarounds (see [Animation Do's & Don'ts](./dos-and-donts.md)).

---

## 1. Why Heroes Use `HeroAnimator`

Heroes (`Kira`, `Auraline`, `Zuri`) share the `4 × 6` WebGL2 `MeshSprite` stage with Mutants, but have distinct structural requirements handled by `src/utils/heroAnimator.ts`, `src/utils/characterAnimator.ts`, and `src/components/combat/combatHeroSpritePass.ts`:
- **Heterogeneous Multi-Sheet Stitching**: Heroes combine `combat` sheets, `emote` sheets, Kira's 4 standalone `dodge` PNGs, and Zuri's `zuri_drones_sheet` into one unified frame index array (`getPreloadedHeroFrames`).
- **Per-Row `rowScale` Normalization (`214.0 px`)**: Because Hero rows vary in raw illustration height (e.g., Auraline Row 0 is `498 px` tall vs. Row 3 `355 px`), every `HeroFrameDef` carries an explicit `rowScale` so standing height normalizes strictly to `214.0 px` across all modes.
- **Crisp Frame Cuts (`blendDuration = 0`)**: `kiraSpriteSheet.ts`, `auralineSpriteSheet.ts`, and `zuriSpriteSheet.ts` all pass `blendDuration = 0` to `computeFrameTransitionState`, relying on `sampleSequence` (`interpolateMonotoneHermite` trajectories) + `deriveHeroDeformAndUniforms` (`4`-knot spine & sway) + cyan sprint afterimages for `60 FPS` fluidity.
- **Action Camera Cut-In Overrides**: `resolveHeroCutInFrameIndex` maps `attack_pose` (melee vs. ranged), `brace_pose`, and `recoil_pose` onto each Hero's canonical frames during cut-in holds.

---

## 2. Hero Roster & Special Mechanics

| Hero | Sheets (`assets-src/heroes/`) | Canonical Height | Staging & Foot Behavior | Special Attachment / Subsystem |
| :--- | :--- | :---: | :--- | :--- |
| **Kira** (`kira`) | `kira_spritesheet` (`2115×1189`) + `kira_emote_sheet` (`2095×1007`) + 4 `kira_dodge_*` RGBA PNGs | `214 px` | Hybrid `melee` (`dash_kick`) & `ranged` (`pistol_bolt`); planted dual-foot shadows | `muzzleRel` (Row 1), `kickTipRel` (Row 2 `r2_f4`), `0.96 s` **Evasive Dodge** (`shouldKiraDodgeAttack` on `0` HP + `0` Armor damage) |
| **Auraline** (`auraline`) | `auraline_spritesheet` (`3545×1703`, white + bottom floor shadow bake) | `214 px` | `100%` `ranged` (`scattergun`); planted dual-foot shadows | `muzzleRel` & `kickTipRel` on Row 1; spliced `aurelia_r0_f9` curtsy return frame |
| **Zuri** (`zuri`) | `zuri_spritesheet` (`2172×724`, dark bake) + `zuri_emote_sheet` (`2170×725`, dark bake) + `zuri_drones_sheet` (`2172×724`, white bake) | `214 px` | `100%` `ranged` (`drone_plasma`); **hover altitude** (`yHopPx`) with dynamic cyan thruster ellipse shadow | `zuriDroneFormation.ts` renders 3 autonomous drones (`Solar Hawk`, `Aegis Walker`, `Med-Rotor`) synced to **Tri-Drone Sync** priming |

---

## 3. Verification & `DEV` Hero Lab

- Open `?devLabs=1&devLabTab=hero` in `DEV` mode to switch between `Kira`, `Auraline`, and `Zuri` and trigger `idle`, `idle1`, `idle2`, `shoot`, `dash_kick`, `overdrive`, `guard`, `dodge`, `upgrade`, `hit`, `defeat`, and `victory` (`Keys 1–9, 0`).
- Automated tests: `kiraSpriteSheet.test.ts`, `auralineSpriteSheet.test.ts`, `zuriSpriteSheet.test.ts`.
