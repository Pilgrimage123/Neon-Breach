# Dynamic 2D Combat Presentation & Action Camera System v2

This document describes the production cut-in camera and choreography layer (`combatPresentationConfig.ts`, `combatPresentationMath.ts`, `ActionCameraController.ts`, `SpriteJuiceFeedbackHandler.ts`, `CombatActionSequencer.ts`, and `combatStagingClassifier.ts`).

---

## 1. Pipeline Integration & Safety Overrides

* **Stage Dimmer (`dimmerAlpha ∈ [0, 0.75]`):** Draws over Layer 0 backdrop/reflections before foreground actors (`EaseOutExpo` over `0.15s`).
* **Draw Priority:** `0` Reflections · `1` Dimmed Bystanders · `2` Neutral · `3` Active Target(s) · `4` Active Attacker (`fgCtx` VFX always draw above Layer 1).
* **World-Space UI Fade (`worldUiAlpha`):** Smoothly hides on-stage lifebars and badges during focal cut-ins (`hideWorldUiDuringCutIn: true`).
* **Accessibility Overrides:**
  * `tacticalViewActive === true` immediately flushes the sequencer via `cleanupActiveState()` (`zoom = 1`, `dimmerAlpha = 0`, `worldUiAlpha = 1`).
  * `reducedMotion === true` preserves soft framing while zeroing Dutch tilt, trauma shake, invert flashes, and speed lines.

---

## 2. Staging Modes (`CutInStagingMode`) & Hero/Mutant Classification

* **Heroes (`classifyHeroAttackStaging`):**
  * **Auraline:** `100%` ranged (`scattergun` → `ranged_fast` / `ranged_aoe`).
  * **Zuri:** `100%` ranged (`drone_plasma` → `ranged_fast` / `ranged_aoe`).
  * **Kira:** Hybrid — close-quarters **`melee`** Dash-Kick when `isSurge || damageValue >= 12 || attackToggle % 2 === 1` (odd toggle or `12+` DMG), otherwise Two-Beat **`ranged_fast`** / **`ranged_aoe`** (`pistol_bolt`).
* **Mutants (`classifyEnemyAttackStaging`):**
  * **Bile Spitter (`enemy_acid`):** `ranged_fast` (`acid_bile`); **`clawRend`:** `melee` nose-to-nose clash.
  * **Pyre Stinger:** `ranged_fast` (`stinger_dart`).
  * **Spore Mite, Cobalt Skitter, Chitin Stalker, Carapace Brute, Xenomorph Matriarch:** `melee` nose-to-nose clash.

---

## 3. Verified Production Defaults (`DEFAULT_COMBAT_PRESENTATION_CONFIG`)

| Parameter | Value | Parameter | Value |
| :--- | :---: | :--- | :---: |
| `windupSec` | `0.15s` | `zoomNormal` | **`1.52×`** |
| `rangedBeat1Sec` | `0.24s` | `zoomCrit` | **`1.80×`** |
| `rangedWhipPanSec` | `0.13s` | `zoomRangedShooter` | **`1.42×`** |
| `holdNormalSec` / `holdCritSec` | `0.60s` / `1.00s` | `zoomAoeMin` / `zoomAoeMax` | `1.22×` / `1.30×` |
| `resetSec` | `0.25s` | `holdZoomCreepPct` | `+8%` (`0.08`) |
| `hitstopNormalSec` / `Aoe` / `Crit` | `0.12s` / `0.16s` / `0.25s` | `dutchDegNormal` / `Crit` | **`2.2°`** / **`3.5°`** |
| `whiteFlashFrames` | `3` raw frames | `attackerScalePunch` | **`1.28×`** |
| `meleeClashGapVw` | `12.5% VW` (`0.125`) | `meleeForegroundScale` | **`1.07×`** |
| `knockbackNormalVw` / `CritVw` | `4.5%` / `6.0% VW` | `aoeCascadeStepMs` | `40 ms` |
| `shakeNormalVw` / `CritVw` | `1.1%` / `2.2% VW` | `dimmerAlpha` | `0.75` |

* **Adaptive Pack Speedup (`computePackTempoScale`):** `1.0×` (`1–2` Mutants), `0.80×` (`3–4`), `0.64×` (`5+`).
* **Rotation-Aware Overscan Clamp (`ActionCameraController.ts`):** `computeMinZoomForRotation` and `clampPanForRotationBounds` guarantee rotated corners stay within backdrop bleed (`BACKDROP_BLEED_X = 32`, `BACKDROP_BLEED_Y = 16`).

---

## 4. `DEV`-Only Camera & Juice Labs (`CombatDevLabsPanel.tsx`)

The **Spitter Lab**, **Brute Lab**, and **Action Camera Lab** (toggled via the `DEV`-mode header buttons in `CombatStageCanvas.tsx`; zero keyboard shortcut `Shift+C` exists) are lazy-loaded strictly when `import.meta.env.DEV` is `true` and excluded from production bundles. When open, Keys `1–4` trigger `melee_normal`, `melee_crit`, `ranged_single`, and `ranged_aoe` cut-in tests.
