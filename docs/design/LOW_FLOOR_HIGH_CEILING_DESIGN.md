# NEON BREACH — Low Floor, High Ceiling Tactical Design

Balancing accessibility with deep tactical gameplay relies on transparent deterministic previews, **Quantized Scale** readability, an optimal-move Hint Solver, and a 5-tier Difficulty Matrix (`src/engine/difficulty.ts`).

---

## 1. Emergent Complexity Over Rule Bloat

| Principle | Implementation | Low-Floor Benefit | High-Ceiling Benefit |
| :--- | :--- | :--- | :--- |
| **Quantized Scale** | Optional **Quantized Scale (`1 Unit = 5 HP/DMG`)** simplifies HP and damage arithmetic alongside exact numbers. | Fast mental math (`2` units vs `2` units = lethal). | Combines Held `+1` bonuses, `4+` Stack Surges, and `50%` Phase Gate breakpoints. |
| **Spatial Push (`[R]`)** | Free once-per-Turn `0 AP` **Push** swaps the front 2 living Mutants with zero collision damage. | Pull fragile backliners (`Stinger`, `Spitter`) to Slot 0 or position `Spore Mite` next to armored units. | Sets up `6`-Pierce **Bio-Rupture** cascades and breaks **Aegis Projection** formation coverage. |
| **3 Core Actions** | Every Turn commits `1` of `3` colors (`[1] Attack`, `[2] Defense`, `[3] TECH`) plus optional `0 AP` **Overdrive** / **Push**. | Clear 3-choice decision loop with zero cluttered action bars. | Unplayed Tiles stay **Held** on the Board for Surge chaining and Kira's `+1` passive. |

---

## 2. Deterministic Previews & 5-Tier Difficulty Matrix

* **Deterministic Previews:** Hovering or selecting a color shows exact net incoming Hero HP change, Shield gained/blocked, Mutant HP/Armor damage, `ARMOR BREAK`, `PIP CRACK`, `PHASE GATE`, `BIO-RUPTURE`, and `☠ LETHAL`.
* **Difficulty Tiers (`DEFAULT_DIFFICULTY_TIER = 3`, Tactical):**
  - **Tier 1 · Story:** Unlimited Undo & Battle/Run Resets, auto-Skip after `2` defeats, full intel + Hints, `-15%` Mutant HP, `+10` Hero Max HP, `100%` post-combat heal.
  - **Tier 2 · Casual:** Unlimited Undo/Resets, full drop intel + Hints, `+2` Par turns, `-8%` non-chaff Mutant HP (`Spore Mite` stays `9 HP`), `+5` Max HP, `25%` heal, `+4 CR` secondary bonus.
  - **Tier 3 · Tactical (Default):** `1` Committed Undo & `1` Battle Reset per fight, free Push undo, Hints enabled, baseline `100%` HP, concealed drop archetype, **`+8 CR`** secondary bonus, `failForwardAllowed: false`.
  - **Tier 4 · Strategist:** `0` Committed Undo (Push undo only), `1` Run Reset, no Hints, `+12%` standard / `+15%` Heavy & Boss HP (chaff sacred), `+14 CR` secondary bonus.
  - **Tier 5 · Grandmaster (Ironman):** `0` Undo/Reset/Push-Undo, concealed drops & future cycles, `+20%` standard / `+25%` Heavy & Boss HP (chaff sacred), mandatory 2-Star Par/No-Hit (`-12 HP` & loot confiscation on miss), `+16 CR` secondary bonus.

*(See [ADR-0004](../adr/0004-sacred-chaff-difficulty-matrix.md) for why Mutant attack damage never scales across tiers.)*

---

## 3. Tiered Combat Objectives

| Objective Tier | Criteria | Reward |
| :--- | :--- | :--- |
| **★ Primary** | Defeat all hostile Mutants. | Unlocks next Stage Nodes, Credits, and AI Skill Chip loot choice. |
| **★★ Secondary (Blitz / Flawless)** | Clear within dynamic Par turn limit (`5 + nodeOffset + max(0, parTurnDelta)`) **OR** take `0` hull HP loss. | **`+1` Meta Nanite**, `+75` Score, and tier bonus Credits (`+0 / +4 / +8 / +14 / +16 CR`). |
| **★★★ Mastery** | Clear within `(Par - 1)` turns with `0` Undo/Reset/Hints and at least `1` **Stack Surge**. | **`+2` Meta Nanites** and `+150` Score. |

---

## 4. Onboarding, Hints & Fail-Forward

* **Contextual Micro-Prompts:** Stage 01 surfaces single-line Board prompts for **Stack Surge (`4+`)**, **Held Momentum**, and **Spatial Push (`⇄`)** until practiced.
* **Modular AI Skill Chips:** Starter chips (*Predictive Aim.AI*, *Auto-Suture.AI*, *Impact Solver.AI*, *Sovereign Ward.AI*, *Swarm Vector.AI*, *Sanctuary Mesh.AI*) transition into droppable build-around chips (*Armor Crack.AI*, *Flux Rebalance.AI*, *Adaptive Guard.AI*, *Hyper-Thread.AI*) without mandatory deck bloat.
* **Tactical Hint Solver (`[?]`):** Evaluates legal lines and recommends the highest-EV play (`Overdrive` at `100%` or highest-scoring color/Push line) on Tiers 1–3.
* **Fail-Forward Protocol (Tiers 1–2):** Upon defeat on Story/Casual, the Game Over modal offers both Clean Turn-1 Retry and **Fail-Forward Retry (`+15 HP, +10 Shield, +40% Overdrive`)**.
