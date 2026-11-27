# NEON BREACH — Cross-Platform Accessibility & Touch-First UI Architecture

> **Purpose:** Ensures deterministic, readable tactical play across `27"` desktop monitors, `6"` phones, outdoor sunlight glare, and `Night Shift / TrueTone` color filters without relying on desktop mouse hover.

---

## 1. Hover-Free Inspection Patterns

| Pattern | Desktop | Mobile / Touch | Implementation |
| :--- | :--- | :--- | :--- |
| **Select-Then-Confirm** | Hover previews outcomes; click executes (or two clicks when Two-Step Confirm is toggled in Pause/Settings). | **Tap 1:** Selects color group or Node and locks deterministic preview. **Tap 2:** Commits action. | Prevents accidental misclicks on the 6-slot Board and 12-Stage map. |
| **Tap-to-Inspect Telemetry** | Hover or click any Board Tile or Mutant sprite to inspect details. | **Tap any Tile or Mutant:** Updates the fixed `tactical-intel-strip` or opens `EnemyIntelPanel`. | Never spawns obscuring floating popovers under the player's finger. |
| **Fixed Info Dock** | Docked `tactical-intel-strip` in `TacticalDock` + briefing drawer in `SectorMapView`. | Dedicated `10–15%` strip showing exact math, Surge thresholds, and outcome tags. | Keeps 100% of the Board and sky-bridge sprites unobstructed. |

---

## 2. Dynamic Level of Detail & Physical Scaling

### A. Semantic Zoom (`overview` · `standard` · `closeup`)
Cycle via `[Z]` or inside the Pause/Settings modal (`data-testid="semantic-zoom-toggle"`):
* **`overview`:** Strips secondary prose, surfacing geometric corner suit pips, colors, and bold tabular numerals.
* **`standard`:** Balanced 1-line AI Skill Chip / squad titles and core status badges.
* **`closeup`:** Enlarged typography and detailed status/keyword breakdowns for low-vision play.

### B. Auto-Framing Camera & Physical DPI Scale (`detectPhysicalScreenProfile`)
* **`autoFocusCamera`:** Smoothly frames active combat exchanges on compact/touch viewports (`computeAutoFocusTarget` in `combatRenderer.ts`) and resets cleanly to `1.0×` when idle.
* **Physical Scale (`--ui-physical-scale`):** Computes `physicalScaleFactor` from `1.00` up to **`1.16`** (`1.00, 1.06, 1.08, 1.16`) based on CSS viewport dimensions, `devicePixelRatio`, coarse pointer detection, and estimated diagonal inches, defaulting `highContrastBorders` and `autoFocusCamera` to `true` on compact screens.

---

## 3. Colorblind Double-Coding, Haptics & Tactical View

* **High-Contrast Outlines:** `.tactical-hc-border` (`2px` white inner + `#020617` outer stroke) and `.tactical-numeral-stroke` keep numerals legible under direct glare.
* **Corner Suit Pips (`CornerPipBadge` in `src/utils/accessibilityAndScale.ts`):**
  * **Tile Suits:** **`◆` Attack (`#FF2E7E`)**, **`●` Defense (`#00F0FF`)**, **`▲` TECH (`#FFC700`)**.
  * **Map Node Pips:** **`◆` Combat**, **`★` Elite**, **`⬡` Restorative Clinic**, **`◈` Chip Dealer**, **`✚` Family Hearth**, **`▲` Anomaly Event**, **`◉` Boss**.
* **Haptics & Audio (`soundEngine.ts`):** Pairs Web Audio cues with `navigator.vibrate` (`select`: `12ms`, `surge`: `[14, 32, 24]ms`, `invalid`: `[38, 24, 48]ms`, `commit`: `[24, 28, 52]ms`).
* **Tactical High-Contrast View (`[Alt]` / `[Tab]` / Pause Modal `data-testid="tactical-view-toggle"`):**
  1. Dims decorative stage vistas and sets `document.body.dataset.tacticalView = "true"`.
  2. Freezes decorative idle bobbing, motes, and blood undulation.
  3. Renders oversized high-contrast callout plaques directly over units and Tiles.
