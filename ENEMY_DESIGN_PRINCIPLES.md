# NEON BREACH — Enemy Design & Tactical Rework Principles

> **Purpose:** This specification codifies modern turn-based deckbuilder enemy design principles directly into **NEON BREACH**—a cyber-tactical roguelite built around a **6-tile hold-and-draw board (`BOARD_CAPACITY = 6`)**, **1-color resolution per turn (`1 AP`)**, **Stack Surges (`4+` / `3+` matching tiles)**, **Overdrive (`0 AP` action-cheating)**, **Spatial Push (`[R]`)**, and **4-socket Cybernetic Implants (`MAX_IMPLANTS = 4`)**.

---

## 1. The Core Loop: Telegraphed Intent & Counterplay

Unlike opaque RPGs where enemy moves are hidden, modern deckbuilders thrive on **exposed intent** because draw variance already provides tactical tension. When enemy actions are visible, every 6-tile hand becomes a solvable tactical puzzle:

1. **Three Tiers of Actionable Telegraphs:**
   * **Direct Telegraphs:** *"Enemy will deal 6 DMG"* or *"Enemy will gain +6 Armor."* Tests immediate block output or Armor-break conversion.
   * **Conditional Telegraphs (`condition` + `conditionBonus`):** Intents that dynamically react to the operative's turn and update **live on hover** in the HUD lifebar and enemy telemetry pods:
     * *Opportunistic Predator (`if_no_shield`):* **Chitin Stalker** Beat 2 deals **`7 DMG`**, or **`11 DMG (+4)`** if you end your turn with `0 Shield`—rewarding Shield retention or Defense weaves.
     * *Combat Tax (`if_play_attack`):* **Xenomorph Matriarch** Beat 2 deals **`11 DMG`**, or **`15 DMG (+4)`** if you commit an **Attack** color stack into her guard—rewarding **TECH** setup, Defense walls, or **Overdrive (`0 AP`)** bursts.
   * **Delayed Telegraphs (`charge`):** **Pyre Stinger** broadcasts a 2-turn countdown (`Charge 2T -> Charge 1T -> 16 Heavy`), testing race potential, **Push (`[R]`)** target manipulation, or **Broken Stance Stagger**.
2. **Controlled Fuzziness vs. Deterministic Readability:**
   * Full intent cycles (`intentCycle`) are inspectable in the Bio-Scanner Intel Panel, while dynamic triggers (Tile Hex targeting, Conditional bonuses, and Reinforcements) keep each round fresh without turning turns into blind coin flips.

---

## 2. The 6 Essential Enemy Archetypes in NEON BREACH

Every encounter asks a distinct strategic question so no single hyper-specialized tile loop solves every fight automatically:

| Framework Archetype | The Question Asked | NEON BREACH Enemy & Mechanics | Counterplay / "Judo" Solution |
| :--- | :--- | :--- | :--- |
| **1. The Time Bomb (Scaler)** | *"Can you burst or stagger me before detonation?"* | **Pyre Stinger** (`stinger`, `16 HP`)<br>Cycle: `Charge (2T)` → `Charge (1T)` → **`16 Heavy`** | Use Turn-1 breathing room to assemble an Attack Surge, **Push (`[R]`)** it to Slot 0, or land **`16+` burst** to **Stagger** its Charge. |
| **2. The Deck & Board Polluter** | *"Can you function when your hand & draw pile are clogged?"* | **Bile Spitter** (`spitter`, `22 HP`) & **Matriarch**<br>Unblocked `Acid` **Jams 1 board tile** AND injects **`1 Caustic Slag`** (`0` value) into discard (`2 DMG` if kept at round end). | Full-block `Acid` with Shield to negate both Jam and Slag; purge Slag cleanly by resolving **TECH** or firing **Overdrive** (exhausts Slag permanently). |
| **3. The Tax Collector** | *"Can you adapt when your favorite line is punished?"* | **Chitin Stalker** (`stalker`, `24 HP`) & **Matriarch** (`boss`)<br>*Stalker:* `Spike Retaliate (3 DMG)` on non-Surge Attacks + `+4 DMG` if `0 Shield`.<br>*Matriarch:* `+4 DMG` if you play an `Attack` stack on Beat 2. | Bypass Retaliation with **`4+`/`3+` Attack Surge**, 1-hit KO, **TECH Pierce**, **Riposte**, or **Bio-Rupture**. Answer Conditional Taxes by holding Shield or setting up **TECH**. |
| **4. The Armor / Hit-Count Check** | *"Do you have multi-hit pings or heavy Armor-break?"* | **Carapace Brute** (`brute`, `38 HP / 8 ARM / 1 Pip`) & **Cobalt Skitter** (`skitter`, `14 HP / 2 ARM / 1 Pip`) | Two-step solve: crack the **`1 Aegis Pip`** first (`Bio-Rupture`, `Riposte`, `ARC Shred/Pierce`, `Overdrive`, or light Attack), then shatter Armor with **Attack Surge** or **Armor Shred**. |
| **5. The Resource Thief (Board Hex)** | *"Can you play around a cursed high-value tile?"* | **Bile Spitter** & **Matriarch** *(Turn 2+)*<br>Casts **Targeted Tile Hex (`⬡ HEX`)** on your highest-value `Attack`/`Defense` tile: *"If resolved while caster lives, caster heals **+4 HP** & gains **+3 ARM**."* | Kill the caster first (death instantly shatters the Hex!), hold that color 1 turn, cleanse all Hexes with **Overdrive**, or out-burst the heal. |
| **6. The Positional / Target Puzzle** | *"Can you disrupt formation & manipulate target order?"* | **Spore Mite** (`larva`, `9 HP`, `Bio-Rupture 6 Pierce`) + **Skitter/Brute** protecting backline **Stinger/Spitter** | Pop frontline *Mite* to crack backline Shield Pips via **Bio-Rupture**, OR hit **Push (`[R]`)** (`0 AP`, pure positioning) to yank a fragile backliner (`Stinger`/`Spitter`) straight into Slot 0! |

---

## 3. Making Enemy AI Feel "Smart": Structured State Machines & Reactive Triggers

Rather than opaque minimax math, enemies use readable **state cycles** paired with **reactive triggers**:

1. **Structured Intent Cycles (Patterned Variety):**
   * Enemies follow legible 3–4 beat state machines (`armor -> heavy -> attack`, `charge -> charge -> heavy`, `bolster -> attack -> leech`) that prevent two consecutive oppressive Heavy turns while maintaining rhythmic tension.
2. **Reactive State Shifts (Phases & Triggers):**
   * **Broken Stance (`Staggered`):** Dealing **`>= 16` single-turn damage (`HP + Armor`)** to a surviving enemy that is priming `charge` or `heavy` (`Pyre Stinger`, `Carapace Brute`, `Matriarch`) **Staggers** it (`⚡ STAGGERED`): its queued heavy strike/charge turns into a **`0 DMG`** recovery beat (and `Stinger`'s Charge resets to `2T`!). Hover previews show `⚡ STAGGER!` live before you commit.
   * **Enrage on Alone:** If a multi-enemy squad loses all allies leaving a **Cobalt Skitter** (`anchor_aegis`) as the lone survivor, it drops passive team shielding, gains **`+2 ATK`** (`enragedAlone = true`), and immediately shifts from `bolster` into aggressive Attack beats.
   * **50% Phase Gate (`boss`):** First drop across `50% HP` (`55 HP`) locks **Xenomorph Matriarch** at `55 HP`, deploying **`+10 Armor`** and **`+1 Aegis Pip`**, preventing single-turn cheese while rewarding paced two-phase planning.
   * **Opportunistic AI (`stalker`):** Exploits unshielded operatives on Beat 2 (`7 -> 11 DMG` if `0 Shield` remains before its strike).
3. **Direct Tile & Board Interaction:**
   * **Targeted Tile Hex (`hexedByEnemyId`):** Caster locks a reticle onto a key board tile before the player acts, forcing a genuine tactical choice between bursting the caster, dodging the color, or purging via Overdrive.
   * **Caustic Slag (`isBlight`):** Exhaustible `0`-value pollution tiles injected into `discardPile` on unblocked Acid hits (capped at `2` active Slags per fight so hands never brick). Keeping a Slag unresolved at round end burns for **`2` Caustic DMG**; resolving **TECH** or **Overdrive** permanently exhausts it.

---

## 4. Encounter Design: Synergistic Combos & Target Priority

Single enemies are checks; paired enemies create **Target Priority Dilemmas**:

* **The Buffer + The Scaler (`Cobalt Skitter` + `Pyre Stinger`):** `Skitter` projects `+4 Armor` across the squad while `Stinger` counts down `2T -> 16 DMG`. Do you **Push (`[R]`)** `Stinger` to the front to kill/stagger it early, or crack `Skitter`'s Shield Pip first?
* **The Volatile Blocker + The Punisher (`Spore Mite` + `Chitin Stalker`):** Frontline `Mite` soaks single-target Attacks, yet killing it detonates **`6 Pierce Bio-Rupture`** straight into `Stalker` without triggering `Spike Retaliation`!
* **The Protector + The Disrupter (`Carapace Brute` + `Bile Spitter`):** `Brute`'s `8 ARM + 1 Pip` shields backline `Spitter`, who pollutes your board with `Acid Jam`, `Caustic Slag`, and `Tile Hexes`. **Push (`[R]`)**, **Cleave Surge**, and **Overdrive** cleanly crack the duo.
* **Rule of Three & Turn-1 Breathing Room (`buildEncounterSpec`):** Encounters never exceed **3 active enemies**, and Turn-1 incoming damage stays capped (`3 DMG` in Layer 0, `3–5 DMG` in Layers 1–3, `0 DMG` on Boss Turn 1) so players always have agency to inspect, hold, or Push.

---

## 5. Golden Rules: "Fun" vs. "Frustrating"

1. **Always Use Soft Counters, Never Hard Immunities:**
   * Shield Pips crack to *any* hit (`Riposte`, `Bio-Rupture`, `ARC Pierce`, `Push`-assisted follow-up, light Attack). Spike Retaliation is bypassed by Surges, `TECH Pierce`, `Riposte`, or 1-hit KOs. Tile Hexes shatter instantly when the caster dies or when Overdrive fires.
2. **Reward Disruption Generously:**
   * Full-blocking `Acid` completely prevents both **Tile Jam** and **Caustic Slag** injection; full-blocking `Leech` denies enemy healing; dealing `16+` burst **Staggers** `Charge`/`Heavy` attacks to `0 DMG`; popping `Spore Mite` damages every enemy behind it.
3. **Prevent Infinite Stalling (`reinforcementDirector`):**
   * `Par Caches` reward fast clears (`T3/T4/T5+`), `Tempo Streaks` pay `+2 CR` per aggressive turn, and Overtime Heat escalates gently if players stall indefinitely.
4. **Visual & Telemetry Cohesion:**
   * Every mechanic (`Conditional +4`, `⚡ STAGGER`, `⬡ HEX`, `☣ SLAG`, `Aegis Pip`, `Phase Gate`) surfaces directly via high-contrast icons, color-coded stage rings, and live **What-If Hover Previews** on both player and enemy lifebars before a single tile is committed.
