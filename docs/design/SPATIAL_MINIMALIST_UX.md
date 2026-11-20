# NEON BREACH — Spatial Minimalist UX & Anti-Wordiness Specification

> **Design North Star (*Into the Breach* · *Mini Metro*):** Let the Board and sky-bridge tell the tactical story, replace wordy paragraphs with `[Icon + Number]` formulas, enforce concise ≤ 8-word copy on micro-tooltips and item descriptions, and render high-contrast **AAA (`#F4F4F6` on `#181A20`)** numerals.

---

## 1. Anti-Wordiness & Keyword System

1. **The 8-Word Rule (`src/utils/tacticalCopySpecs.ts`):**
   * Enforced by unit tests across all **AI Skill Chip** descriptions, **Cyber Implant** descriptions, Hero passive/Overdrive summaries, Node descriptions, Cyber/Dynasty Event prompts, facility notices, and `KEYWORD_NESTED_TOOLTIPS`.
   * *Format:* `[Icon] +[Value] [Stat]` (e.g. `⚔ +5 ATK ×2 · 🛡 +7 SHD`).
2. **Inline Bold + Nested Keyword Tooltips:**
   * Primary mechanics are bolded via `FormattedText.tsx` (`**Push**`, `**Shield**`, `**Pierce**`, `**Shred**`, `**Corrode**`, `**Spike Retaliation**`, `**Surge**`, `**Aegis Pip**`, `**Bio-Rupture**`, `**Jammed**`, `**Held**`, `**UpCharge**`).
   * Accurate keyword rules in `KEYWORD_NESTED_TOOLTIPS`:
     * **Push:** `"Swaps front 2 mutants. Costs 0 AP."` (zero free collision damage)
     * **UpCharge:** `"+1 next-turn Board draw (up to 9)."`
     * **Defense Surge:** `"Deals 8 direct DMG to front mutant."`

---

## 2. Spatial Stage Telemetry

* **Direct On-Board Intent Vectors:** `combatTacticalOverlayRenderer.ts` draws crimson/amber intent arcs from each acting Mutant toward the Hero along with numeric badges (`⚔ 6`, `☣ 5`, `🛡 +4`).
* **Live What-If Previews:** Hovering or selecting `[1] Attack`, `[2] Defense`, or `[3] TECH` flashes exact Armor/HP chunk loss, `PIP CRACK`, `ARMOR BREAK`, `PHASE GATE`, `⚡ STAGGER`, and `☠ LETHAL` skull badges directly on stage units and HUD bars.
* **Right-Click Inspection vs. Undo (`CombatStageCanvas.tsx`):** Right-clicking directly on a Mutant sprite hitbox opens its **Enemy Intel Panel** inspection; right-clicking empty canvas triggers **Undo Turn (`[U]`)**.

---

## 3. One-Screen Combat Layout

1. **Top Bar (`TopHud`):** Stage progress, Turn counter, 1-line Objective stars, core vitals, `↶ Undo`, `⟲ Reset`, Codex, and Pause/Settings (`Tactical View`, `Semantic Zoom`, `Quantized Scale`, `Two-Step Confirm`).
2. **Center Stage (`CombatStageCanvas`):** 3-layer Canvas2D + WebGL2 sky-bridge arena with inline compact unit pods and `EnemyIntelPanel`.
3. **Bottom Dock (`TacticalDock`):** Fixed `TacticalIntelStrip`, `ActionTriggerCluster` (`[1] Attack`, `[2] Defense`, `[3] TECH`, `Overdrive`, `Push`), and the `TileBoardGrid` (6–9 Tiles with bold tabular numbers and status tags).
