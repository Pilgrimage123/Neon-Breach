# NEON BREACH — Spatial Minimalist UX & Anti-Wordiness Design Specification

> **Design North Star (*Into the Breach* · *Mini Metro*):** Make the puzzle board itself the primary user interface, replace multi-sentence paragraphs with `[Icon + Number]` math, enforce a strict **8-Word Rule**, render **AAA 7:1 (`#F4F4F6` on `#181A20`)** high-contrast big-text typography, and telegraph every enemy intent, knockback vector, health-chunk loss, and lethal skull (`☠`) directly on the sky-bridge stage.

---

## 1. Kill the Text (Anti-Wordiness Rules)

Strategy puzzle players scan the board dozens of times per minute. Lore-heavy tooltips and 3-sentence explanations create cognitive friction and visual clutter. **NEON BREACH** enforces three deterministic text constraints across all cards, tooltips, and micro-prompts (implemented and validated in `src/utils/spatialMinimalistUi.ts`):

### 1.1 The 8-Word Rule
* **Hard Cap:** No tooltip, card description, or tutorial micro-prompt may exceed **8 words** (and core ability lines target **≤ 6 words**).
* *Bad (Wordy — 23 words):* `"This unit attacks the enemy directly in front of it, dealing 2 points of physical damage and pushing them back by one tile."`
* *Good (Streamlined — 6 words):* `"**Deal 2 damage.** **Push** 1 tile."`

### 1.2 Keyword + Nested Tooltip System
* **Bold Core Mechanics:** Primary mechanics are bolded inline (**Push**, **Shield**, **Pierce**, **Shred**, **Corrode**, **Retaliate**, **Surge**, **Pip**, **Bio-Burst**, **Jammed**, **Held**).
* **Nested Side-Box Only on Hover / Hold:** The main card description never explains what **Push**, **Retaliate**, or **Pip** means inline. Instead, when the player hovers, inspects, or press-and-holds (`Loupe`) on a unit or tile, a compact **Nested Keyword Side-Box** (`data-testid="nested-keyword-sidebox"`) docks beside the card with a ≤ 8-word definition for each active keyword:
  * **Push:** `"Swap 2 units. Deal 2 collision DMG."`
  * **Shield:** `"Blocks incoming DMG before HP drops."`
  * **Pierce:** `"Ignores enemy Armor. Hits HP directly."`
  * **Retaliate:** `"Deals 3 DMG back on non-Surge hit."`
  * **Pip:** `"Negates the next 1 damaging hit."`
  * **Corrode:** `"Reduces Shield gained from Defense tiles."`
  * **Surge:** `"Match 4+ tiles for bonus effect."`
  * **Bio-Burst:** `"Deals 6 Pierce DMG to all on death."`

### 1.3 Math Over Prose
* Replace prose sentences (`[Increases attack power by forty-two percent]`) with compact `[Icon + Signed Number]` formulas:
  * `◆ +5 ATK` · `● +7 SHD` · `▲ +42% ATK` · `⚡ -8 ARM ALL` · `✚ +3 HP` · `⇄ PUSH 1 TILE`

---

## 2. High-Contrast, Big-Text Typography

Strategy puzzles require scanning the board for hours. Small, low-contrast text causes immediate eye strain and halation blur.

| UI Element | Target Scale (1080p / Closeup) | Implementation in NEON BREACH |
| :--- | :--- | :--- |
| **Board Numbers (HP, AP, Turns, Primary Tile Values)** | **28px – 36px (Bold)** | Heavy `2px–3px` dark outline (`.tactical-numeral-stroke`, `paint-order: stroke fill`) and solid charcoal pill backgrounds (`#181A20`) so numbers pop over any tile or sprite color. |
| **Card / Unit Titles** | **24px – 28px** | High x-height geometric display/sans typography (`--font-display` / `--font-sans`) with crisp weight hierarchy. |
| **Tooltip / Rule Body** | **20px – 22px (Floor ≥ 18px)** | Left-aligned (`text-left`), `1.3×` line spacing (`leading-[1.3]`), and capped at **max 40 characters per line (`max-w-[40ch]`)** for effortless saccadic reading. |
| **Contrast Ratio** | **7:1+ (WCAG AAA Standard)** | Off-white text (`#F4F4F6`) on deep charcoal (`#181A20`) achieves a **14.8:1 contrast ratio** (exceeding the 7:1 AAA requirement) while eliminating pure-white-on-pure-black halation/astigmatism blur. |

---

## 3. Make the Board Tell the Story (Spatial UX)

Every time a player has to look at a corner stat panel or open a modal to understand what will happen next turn, tactical flow is broken.

### 3.1 Telegraph Enemy Intent Directly on the Board
* Players never need to click an enemy to read its next action.
* `combatRenderer.ts` draws a **glowing crimson/amber intent vector arrow** directly across the sky-bridge from each attacking enemy to its target, paired with a bold dark-outlined intent badge (`⚔ 3`, `☣ 4`, `🛡 +4`) directly over the unit and trajectory.

### 3.2 Hover Previews (The "What-If" State)
Before committing to a move (`[1] Attack`, `[2] Defense`, `[3] TECH`, or `⇄ Push / Swap`), hovering or selecting the action previews the exact deterministic outcome directly on the combat board:
1. **Flashing Health & Armor Chunks:** Unit lifebars and gold armor bars flash the exact segment that will be lost (`-5 HP`, `BREAK`, `PIP CRACK`).
2. **Knockback / Swap Trajectory Arrows:** Hovering `⇄ Push / Swap` (or an Attack action) draws bidirectional **swap trajectory arcs (`⇄ SWAP SLOTS · 0 AP`)** between enemy slots showing exactly where each unit will land.
3. **Lethal Skull Icon (`☠`):** Any unit (enemy or operative) that will die from the previewed action displays a high-contrast **`☠` Skull Badge** directly over its sprite and lifebar.

### 3.3 Free Undo for Movement & Turn Experimentation
* Players can execute **`⇄ Push / Swap`** (or play a turn), inspect the updated spatial board state, and immediately press **`↶ Undo`** in the Top Bar, press **`[U]`**, or **right-click empty board space** to revert before locking in their next sequence.
* Experimentation on the live board teaches mechanics faster than reading tutorials.

---

## 4. One-Screen, Zero-Submenu Navigation

During active combat gameplay, **NEON BREACH** uses a strict **3-Zone One-Screen Layout** with zero nested submenus:

1. **Top Bar (~5% of screen — `TopHud`):**
   * Displays the **Turn Counter (`T1`)**, **1-line Tiered Objective Tracker (`★ 1–3`)**, core vitals, and direct **`↶ Undo` (`[U]`)** + **`⟲ Reset` (`Reset Turn 1`)** buttons.
2. **Center Stage (~80% of screen — `CombatStageCanvas`):**
   * The sky-bridge tactical arena, zoomed in as large as possible with on-board enemy intent arrows, knockback previews, flashing health chunks, and `☠` lethal indicators.
3. **Bottom Bar (~15% of screen — `TacticalDock`):**
   * Large, clickable action triggers (`[1] ◆ ATK`, `[2] ● DEF`, `[3] ▲ TECH`), the 6-tile puzzle board with `28px+` bold stroked numerals, `⇄ Push`, and a prominent **Resolve / End Turn** confirmation button.
* **Max 2 Clicks per Action:** Single-click (desktop) or Tap-Select $\rightarrow$ Tap-Confirm (touch/2-step mode). Zero nested action lists.

---

## 5. AI Prompt Constraint Block for Minimalist Strategy UI

When authoring or extending ability descriptions, tutorials, or UI layouts in **NEON BREACH**, all copy must obey the following system constraint:

> **System Constraint:** Write UI text for a minimalist strategy game.
> * Maximum 6–8 words per ability description or tooltip.
> * Use `[Icon: Name]` + numbers instead of sentences.
> * No flavor text, no passive voice, no lore.
> * Format: **[Action] [Value]** (e.g., `"**Deal 3 damage.** **Push** 1 tile."`).
