# NEON BREACH — Low Floor, High Ceiling Tactical Design Specification

Balancing casual accessibility with deep tactical gameplay in **NEON BREACH** relies on a **"Low Floor, High Ceiling"** philosophy combined with **Cross-Platform Touch & Low-Vision Accessibility**. Casual players get transparent rules, small-number pip math, an optimal-move hint solver, and unlimited turn undo, while hardcore strategists get spatial chain reactions, held-tile momentum math, and 3-star constraint mastery challenges.

---

## 1. Mechanical Design: Emergent Complexity over Rule Bloat

Depth comes from how rules interact on the sky-bridge, not how many obscure modifiers exist.

| Principle | Implementation in NEON BREACH | Casual Benefit (Low Floor) | Veteran Benefit (High Ceiling) |
| --- | --- | --- | --- |
| **Keep Numbers Small (`Discrete Pip Math`)** | Toggleable **Pip Math Mode (`1 Pip = 5 HP/DMG`)** converts raw values into discrete integer pips (`1–5 Pips`) alongside exact integers. Enemy Shield Pips (`1–2 Pips`) and Held Tile bonuses (`+1` / `+2`) use tiny discrete integers. | Instant mental arithmetic (`2 DMG Pips` vs `2 HP Pips = KO`) without calculating percentages in your head. | Veterans can combine Held Tile `+1` bonuses, Stack Surge thresholds (`4+`), and Phase Gate caps for multi-turn lethal setups. |
| **Spatial Positioning over Stat Checks (`⇄ Reposition / Swap`)** | Free once-per-turn **Spatial Swap (`[R]` / `⇄ Push`)** pulls the #2 enemy to the #1 frontline slot (or pushes the frontline enemy back) for `0 AP` with no free collision damage. | Viscerally intuitive: pull a fragile support unit into the front to blast it, or position a volatile **Spore Mite** next to an armored brute so its death explosion (`Volatile Burst`) chains into the squad. | Enables multi-step spatial combos: pull an **Aegis Skitter** to the front to stop its shield bolstering, or line up cleave + death-burst cascades. |
| **Limited Action Economy (`3 Core Actions`)** | Every turn boils down to choosing **1 of 3 color groups (`[1] Attack`, `[2] Defense`, `[3] TECH`)** plus optional free maneuvers (`Overdrive`, `⇄ Swap`). | Choosing the best move out of 3 clear options eliminates analysis paralysis on both desktop and mobile. | Unplayed tiles remain on the board (`HELD`) and gain `+1` power next turn, turning a 3-choice action into a deep multi-turn resource management puzzle. |

---

## 2. Information Clarity & UI Friction

Casual players rarely quit strategy games because puzzles are too hard; they quit because they do not understand *why* they lost.

### 2.1 Telegraphed Enemy Intentions
- Every enemy displays its exact next-turn action (`3 DMG`, `ACID +1`, `+4 ARM`, `CHARGE`) both in the top-right telemetry pod and on overhead high-contrast plaques in **Tactical View**.
- Inbound reinforcements telegraph their exact arrival slot and countdown (`T-1`) one full round in advance, and deal `0 DMG` on the turn they land.

### 2.2 Deterministic Previews
- Selecting or hovering any color group previews the **exact deterministic outcome** before commitment:
  - Heroine lifebar flashes with exact incoming net damage (`58 → 55 HP`) or `0 DMG (BLOCKED)`.
  - Enemy lifebars and armor plates show exact HP/Armor loss, `ARMOR BREAK`, `PIP CRACK`, `PHASE GATE`, `💥 BIO-BURST`, and `☠ LETHAL`.
- Zero hidden accuracy rolls or random crit percentages exist in combat resolution.

### 2.3 Unlimited Undo / Turn Reset (`Chrono-Undo`)
- **Undo Turn (`[U]` / `↶ Undo`)**: Restores the exact board, enemy state, and HP from the start of the previous player turn. Players can freely experiment with tile combinations and spatial swaps without fear of a misclick.
- **Reset Encounter (`⟲ Reset`)**: Resets the current combat node back to Turn 1 at any time so players can test entirely different opening lines.

---

## 3. Tiered Objectives (Opt-In 3-Star Difficulty)

Every combat encounter evaluates three opt-in tiers simultaneously so players self-select how hard to push the systems:

| Player Tier | Objective Structure | In-Game Criteria | Reward Type |
| --- | --- | --- | --- |
| **★ Casual (The Floor)** | **Primary Objective: Survive & Clear** | Defeat all enemies in any number of turns. | Unlocks the next Sector node, base Credits, and Equipment choice. |
| **★★ Intermediate** | **Secondary Objective (2-Star Blitz / Flawless)** | Clear the node in **≤ 5 turns** OR take **0 hull HP damage** *(locked out if Fail-Forward Retry is used)*. | Grants **+1 Meta Nanite** & **+75 Score** (`0` bonus Credits to preserve shop scarcity). |
| **★★★ Hardcore (The Ceiling)** | **Mastery Constraint Challenge (3-Star)** | Clear in **≤ 4 turns with 0 Undo/Reset and 0 Hints used** AND trigger at least **1 Stack Surge (4+)**. | Grants **★★★ Mastery Badge**, **+2 Meta Nanites**, and **+150 Score** (`totalNanites` prestige). |

---

## 4. Onboarding and Pacing

### 4.1 Invisible Tutorials (Nintendo Style)
- Instead of multi-page modal walls of text, Sector 1 uses a single-line **Contextual Micro-Prompt** in the Tactical Dock that introduces one mechanic at a time based on the live board state:
  1. **Prompt 1 (Stack Surge):** Highlights a `4+` tile group when available (*"Match 4+ tiles of one color to trigger a STACK SURGE"*). Disappears permanently once the player triggers their first Surge.
  2. **Prompt 2 (Held Momentum):** Highlights `HELD` tiles on Turn 2 (*"Unplayed tiles stay on the board and gain +1 HELD power"*).
  3. **Prompt 3 (Spatial Swap):** Highlights `⇄ Swap` when 2+ enemies are alive (*"Use ⇄ Swap to pull backline threats into your frontline line-of-fire"*).

### 4.2 Modular Progression
- Starter kits provide reliable direct damage and shields (`Aretta Pistol`, `Kevlar Vest`, `Mini Medkit`), while Cyber-Clinic implants and droppable sidegrade weapons (`Acid Shredder`, `Aegis Projector`, `Overclock Stim`) unlock specialized combo archetypes without mandatory stat inflation.

### 4.3 Fail-Forward Mechanics & Optimal Move Hint Solver
- **Tactical Hint Solver (`[? Hint]` button in Tactical Dock)**: Evaluates all legal actions (`Attack`, `Defense`, `TECH`, `Overdrive`, `⇄ Swap`) and highlights the **#1 Optimal Move** with a clear 1-sentence tactical rationale (e.g., *"★ HINT: Play TECH ×4 to trigger Stack Surge (+42% DMG + Heal) while holding Attack tiles for +1 bonus"*).
- **Fail-Forward Second-Wind Retry**: If a player is defeated in combat, the End-Run modal offers two immediate non-patronizing recovery paths before ending the run:
  1. **Retry Encounter Cleanly (Turn 1)**: Replays the current node from Turn 1 with full knowledge of the enemy pattern.
  2. **Fail-Forward Protocol (`+15 HP & +10 Aegis Shield`)**: Replays the node from Turn 1 with a temporary tactical Vanguard Aegis boost so the player still executes and earns the victory themselves.
