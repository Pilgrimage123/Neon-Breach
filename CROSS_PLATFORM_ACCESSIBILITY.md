# NEON BREACH — Cross-Platform Accessibility, Touch-First Inspection & Tactical UI Architecture

> **Purpose:** Designing for both desktop (`27-inch` monitor) and mobile (`6-inch` phone) eliminates **hover states** as a reliable crutch and forces the interface to adapt across wildly different physical screen sizes, outdoor sunlight glare, and `Night Shift / TrueTone` color shifts. This document specifies the exact architecture implemented in **NEON BREACH** to keep our turn-based strategy puzzle accessible to low-vision, colorblind, and touch-first players without adding visual clutter for sighted desktop players.

---

## 1. Replacing "Hover" Without Adding Screen Clutter

On PC, players hover their mouse to read tooltips. On mobile, there is no hover—and a player's thumb physically blocks the tile or node they are touching. **NEON BREACH** replaces floating hover tooltips with three deterministic, zero-clutter inspection patterns:

| Interaction Pattern | How it Works on Desktop | How it Works on Mobile / Touch | Implementation in NEON BREACH |
| :--- | :--- | :--- | :--- |
| **Select-Then-Confirm (Two-Step Action)** | Hover previews the move (`previewColorResolution`); single-click executes it (or click once to select when Two-Step Confirm is enabled in Settings, click again to execute). | **Tap 1:** Selects the tile group (`attack`, `defense`, `tech`) or Sector Map node, previews the exact damage/armor/pip/route outcome on the board, and updates the Fixed Info Dock. **Tap 2:** Confirms and executes the move. | Eliminates accidental fat-finger misclicks on the 6-tile board and 5×3 Sector Map while giving low-vision players infinite time to inspect enemy HP/Armor/Pip projections before committing `1 AP`. |
| **Tap-to-Inspect Tile & Enemy Telemetry** | Hover or click any board tile to inspect its source equipment and exact effective math in the Dock's `tactical-intel-strip`, or click an enemy pod to open the Codex / Bio-Scanner readout. | **Tap any tile or unit:** Updates the Dock's `tactical-intel-strip` or Enemy Intel Panel cleanly without spawning floating hover popovers under your thumb. | Replaces heavy floating popovers with a single streamlined dock readout that never obscures adjacent puzzle tiles. |
| **Fixed Info Dock vs. Floating Tooltips** | Docked `tactical-intel-strip` at the top of `TacticalDock` + bottom briefing bar in `SectorMapView`. | **Dedicated 10–15% Strip:** Dynamically displays the currently selected tile's source equipment, effective math, Stack Surge threshold (`4+` / `3+`), and lock outcomes (`CRACKS PIP`, `50% PHASE LOCK`, `BIO-BURST`) in large tabular numerals. | Never covers adjacent puzzle pieces or sky-bridge enemy sprites. Keeps 100% of the puzzle grid unobstructed while respecting the **15% Mobile Sticky Cap**. |

---

## 2. Dynamic Level of Detail (Semantic Zoom, Auto-Framing Camera & Physical DPI Scaling)

Shrinking a desktop strategy interface onto a 6-inch phone turns intricate cards into microscopic postage stamps. **NEON BREACH** adapts *what* is rendered—and how the camera frames the action—based on physical device metrics and zoom state:

### A. Semantic Zoom (`overview` · `standard` · `closeup`)
Instead of uniformly scaling the same dense component up and down, players can cycle **Semantic Zoom** (`[Z]` on keyboard or the HUD zoom control `data-testid="semantic-zoom-toggle"`):
1. **Zoomed Out (`overview` — Tactical Silhouette Map):**
   * Hides secondary prose descriptions, flavor text, and micro-labels on both the **5×3 Sector Route Map** and **Tactical Dock**.
   * Renders bold **high-contrast geometric silhouettes, primary role colors, corner suit pips (`◆`, `●`, `▲`), and giant tabular numbers** (`ATK 6`, `DEF 8`, `-15% HP`, `+45 CR`).
2. **Standard (`standard`):**
   * Balanced tactical readout with 1-line equipment/squad titles and core status badges.
3. **Zoomed In (`closeup` — Magnified Inspection):**
   * Enlarges tile height, typography scale, and secondary status breakdown badges (`flatBonus`, `damageBoostPct`, `opportunityCost`, `threatTraits`) for effortless low-vision reading.

### B. Auto-Framing Camera ("Auto-Focus Active Area")
* Controlled via `autoFocusCamera` (**enabled by default on mobile/touch devices**, optional toggle on PC).
* When a player previews or executes a puzzle interaction on the combat stage (e.g., aiming an `Attack` stack at the front mutant, raising a `Defense` Aegis dome, or inspecting a specific enemy slot), the Canvas2D camera (`computeAutoFocusCameraTransform`) smoothly interpolates a **`+18%` (`1.18×`) zoom and subtle focal pan** toward the active quadrant on the sky-bridge, then smoothly damps back to `1.0×` full-bridge framing when idle.

### C. Physical DPI & Screen-Diagonal Detection (`detectPhysicalScreenProfile`)
* Rather than relying solely on raw pixel count (where a 4K phone has more pixels than a 1080p desktop monitor despite being physically tiny), `detectPhysicalScreenProfile()` evaluates viewport CSS pixels, `devicePixelRatio`, pointer coarseness (`pointer: coarse`), and estimated physical diagonal inches (`diagonalInchesEst`) on first launch.
* Automatically computes a `physicalScaleFactor` (`1.00` to `1.20`, applied to `--ui-physical-scale` on `document.documentElement`) and defaults `highContrastBorders` and `autoFocusCamera` to `true` on compact physical screens so text and touch targets always meet readable physical millimeter standards ($\ge 44\times 44\text{px}$ CSS hitboxes / $\ge 7\text{mm}$ physical tap targets).

---

## 3. Cross-Platform Color & Contrast Solutions

Mobile screens are frequently played outdoors in harsh sunlight (where glare washes out low-contrast gradients) or with **Night Shift / TrueTone** warm filters enabled (which warps cyan/amber/rose palettes):

1. **High-Contrast `2px` Outlines & Borders by Default on Mobile & Tactical View:**
   * Interactive puzzle tiles, action triggers, and combat callouts use crisp `2px` high-contrast borders (**inner white specular stroke + outer `#020617` obsidian stroke**, class `.tactical-hc-border`) and double-stroked tabular numerals (`paint-order: stroke fill`).
   * On PC, this creates a crisp stylized board-game aesthetic (*Into the Breach* / *Dorfromantik*); on mobile, it prevents tiles from blending into the background under direct sunlight.
2. **Double-Coding with Geometric Corner Suit Pips (`CornerPipBadge`):**
   * Every colored tile, action trigger, enemy pod, and sector node carries a permanent, high-contrast **geometric corner pip** in its top corner—functioning like the suit and rank on playing cards:
     * **Attack (`#FF2E7E`):** **Diamond Pip (`◆`)** — Piercing / Strike suit
     * **Defense (`#00F0FF`):** **Hex-Circle Shield Pip (`●`)** — Aegis / Barrier suit
     * **TECH (`#FFC700`):** **Delta Triangle Pip (`▲`)** — Overclock / Utility suit
     * **Map & Enemy Roles:** **`▲` Combat**, **`◆` Elite**, **`⬡` Cyber-Clinic**, **`✚` Bio-Med Bay**, **`◉` Anomaly Event**, **`★` Hive Boss**.
   * Colorblind (`protanopia`, `deuteranopia`, `tritanopia`, `monochromacy`) and Night-Shift players can distinguish every tile group and node type **100% by corner geometry alone**.
3. **Haptic Feedback as a "Third Sense" (Mobile) + Synchronized Web Audio (PC/Mobile):**
   * `soundEngine.ts` pairs every procedural Web Audio synth cue with deterministic tactile vibration patterns via `navigator.vibrate` (and records the active pattern to `document.body.dataset.lastHaptic`):
     * **Single Crisp Tap (`12ms` — `'select'`):** Selecting a valid tile, map node, or HUD toggle.
     * **Synergy Double-Pulse (`[14, 32, 24]ms` — `'surge'`):** Selecting/hovering a tile group that reaches **Stack Surge (`4+` / `3+`)** or sliding the Loupe over a synergizing tile.
     * **Rough Warning Buzz (`[38, 24, 48]ms` — `'invalid'`):** Tapping a **Jammed (`isJammed`)** tile, an empty color group, or an unaffordable shop item.
     * **Heavy Commit Pulse (`[24, 28, 52]ms` — `'commit'`):** Resolving a turn action or unleashing **Overdrive**.

---

## 4. Input-Agnostic "Tactical View" (The "Eye" Toggle + `Alt` / `Tab`)

On PC, holding `Alt` or pressing `Tab` to strip away visual noise and highlight pure puzzle math is second nature. To make this equally effortless on mobile without cluttering the HUD:

* **The "Eye" Toggle Button (`data-testid="tophud-tactical-eye-button"`):**
  * Located directly in `TopHud` (and triggered via `Alt` or `Tab` on keyboard).
  * Optional **Pip Math Mode** and **Two-Step Confirm** toggles remain available in the Settings / Pause modal (`Modals.tsx`) so players can opt in without cluttering the combat HUD.
  * Toggling **Tactical / High-Contrast Mode (`document.body.dataset.tacticalView = "true"`)** immediately performs three transformations across the entire game:
    1. **Dims Background Art & Decorative Vista by 60%:** Applies a `60%` dark obsidian matte scrim over the sky-bridge backdrop canvas and sector vistas so foreground silhouettes pop with maximum contrast.
    2. **Turns Off Idle Animations & Decorative Particles:** Freezes ambient drifting light motes, floor bio-blood undulation, and idle sprite breathing/bobbing oscillations so low-vision players can inspect a completely still board.
    3. **Displays Bold Numbers & Geometric Symbols Directly Over Pieces & Units:** Renders oversized high-contrast callout plaques (`◆ ATK`, `● DEF`, `▲ TECH`, exact HP/Armor/Pip math, and next-turn intent numbers) directly over every combat unit on the `<canvas>` and every tile in the dock with `2px` white/black borders.
