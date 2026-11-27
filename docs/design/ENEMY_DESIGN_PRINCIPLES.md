# NEON BREACH — Enemy Design & Tactical Rework Principles

> **Purpose:** Codifies turn-based puzzle enemy design in **NEON BREACH** around a **6-slot Board (`BOARD_CAPACITY = 6`)**, **1-color resolution per Turn (`1 AP`)**, **Stack Surges (`4+` / `3+`)**, **Overdrive (`0 AP`)**, **Spatial Push (`[R]`)**, and **4-slot Tactical Modules (`MAX_IMPLANTS = 4`)**.

---

## 1. Telegraphed Intent & Counterplay

1. **Three Tiers of Actionable Telegraphs:**
   * **Direct Telegraphs:** `"5 DMG"` or `"+6 Armor"` — deterministic output updated live on hover.
   * **Conditional & Property Telegraphs:**
     * *Pierce:* Bypasses Hero `Shield` while still mitigated by persistent `Armor` (`Chitin Stalker`, `Feral Nurse`).
     * *Overwhelm (`×2`):* Multiplies unblocked post-`Shield` damage before `Armor`/HP absorption; full `Shield` deflects it for `0` (`Pyre Stinger`, `Rabid MutDog`, `Carapace Brute`).
   * **Delayed Telegraphs (`charge`):** **Pyre Stinger** counts down `Charge 2T → Charge 1T → Overwhelm 7 (×2)`, and **Feral Nurse** telegraphs `Charge 1T → Pierce 7`.
2. **Full Intent Inspection:** Clicking any Mutant opens the Bio-Scanner Intel Panel with its complete `intentCycle` (subject to Difficulty Tier information-horizon settings).

---

## 2. The 9 Mutant Archetypes & Roles

Per [ADR-0008](../adr/0008-threat-rating-and-passive-minimal-mutants.md), standard non-boss Mutants keep `passive: 'none'` (only **Spore Mite** and **Xenomorph Matriarch** carry passives), keeping combat readable via `intentCycle` and `Threat Rating`.

| Archetype | Question Asked | Key Mechanics | Counterplay |
| :--- | :--- | :--- | :--- |
| **Spore Mite** (`larva`, `9 HP`) | *"Can you use my death burst against my squad?"* | **Bio-Rupture:** On KO, deals `6` Pierce DMG to all living Mutants. | Pop early to crack backline Aegis Pips and soften armored Mutants. |
| **Cobalt Skitter** (`skitter`, `14 HP / 2 ARM / 1 Pip`) | *"Can you break my barrier before I armor the squad?"* | **Aegis Projection:** `Bolster +4` Armor All → `Attack 5` → `Pause`. | Crack Pip (`Bio-Rupture`, `Riposte`, `Pierce`, `OD`, or light hit), then burst or **Push (`[R]`)**. |
| **Pyre Stinger** (`stinger`, `16 HP`) | *"Can you burst or Stagger me before detonation?"* | **Thermal Detonation:** `Charge 2T → 1T → Overwhelm 7 (×2)` Heavy. | **Push (`[R]`)** to Slot 0 to focus fire, full-block with Shield, or land `16+` single-Turn DMG to **Stagger**. |
| **Chitin Stalker** (`stalker`, `24 HP`) | *"Can you handle Shield-piercing strikes after a Turn-1 Windup?"* | **Windup → Pierce:** `Pause` → `Pierce 5` → `Attack 7`. | Use Turn-1 `Pause` to set up `4+` Attack Surge or burst before Beat 2 `Pierce 5`. |
| **Bile Spitter** (`spitter`, `22 HP`) | *"Can you block acid pollution and purge Caustic Slag?"* | **Acid Cycle:** `Pause` → `Acid 5 (+2 COR)` → `Acid 6 (+2 COR, Top-Draw Slag)`. | Full-block Acid with Shield to stop **Jammed** + **Caustic Slag**; purge Slag with `TECH` or `Overdrive`. |
| **Rabid MutDog** (`mutdog`, `20 HP`) | *"Can you stop my Turn-2 Maul before it crushes your guard?"* | **Feral Rush:** `Attack 5 (Claw Rend)` → `Overwhelm 6 (×2)` Heavy Maul → `Pause`. | Full-block Beat 2 with Shield or land `16+` single-Turn DMG to **Stagger** the Maul. |
| **Feral Nurse** (`feral_nurse`, `17 HP`) | *"Can you work around Turn-1 Optical Cloak and Stagger my Pierce?"* | **Optical Cloak:** Turn-1 stealth passes `90%` of frontline DMG through to the Mutant behind her; `Charge 1T` → `Pierce 7 (Claw Rend)`. | Use Turn 1 to snipe the Mutant behind her or build setup, then Stagger Beat 2 `Charge`. |
| **Carapace Brute** (`brute`, `38 HP / 6 ARM / 1 Pip`) | *"Can you sequence Pip crack, Armor shatter, and Stagger?"* | Occupies **2 bridge slots**; Beat 1 **Mutagen Vial Brace** (`+6 ARM`); Beat 2 **Seismic Carapace Crush** (`Overwhelm 6 (×2)` Heavy); Beat 3 `Pause`. | Crack `1` Pip first, strip Armor (`Attack Surge` or `Armor Shred`), and Stagger Beat 2 with `16+` burst. |
| **Xenomorph Matriarch** (`boss`, `104 HP / 8 ARM / 1 Pip`) | *"Can you pace two phases cleanly?"* | **50% Phase Gate** (`+1 Pip`, `+10 ARM` at `50% HP`); `Armor +8` → `Attack 12` → `Acid 8 (+2 COR, Top-Draw Slag)` → `Heavy 16`; casts `⬡ Tile Hex` and spawns **Bio-Husks** on fallen allies. | Pace Overdrive across the Phase Gate, clear `⬡ Tile Hex` via Overdrive or timing, and crush `Bio-Husks` within `2` Turns. |

---

## 3. Controls & Combat Color Key

* **`[1]` Attack (Crimson):** Resolves all unjammed Attack Tiles.
* **`[2]` Defense (Cyan):** Resolves all unjammed Defense Tiles.
* **`[3]` TECH (Gold):** Resolves all unjammed TECH Tiles (and purges **Caustic Slag**).
* **`[Space]` / Overdrive:** Unleashes `100%` Overdrive (`0 AP`).
* **`[R]` Push:** Swaps front 2 living Mutants (`0 AP`, 1/Turn).
* **`[G]` Codex:** Opens the Hero & Glossary Codex.

---

## 4. Six-Slot Sky-Bridge & Queued Future Encounter Mechanics

> **Implementation Note:** The engine (`src/engine/`) and UI badges (`TacticalDock.tsx`, `CombatStageCanvas.tsx`) already implement and unit-test all mechanics in Sections 4.1–4.3 below, while standard run encounter generators (`buildEncounterSpec`) currently spawn the core 9 Mutant roster and Boss `Bio-Husks`. See [ADR-0001](../adr/0001-retain-unspawned-combat-mechanics.md).

### 4.1 Advanced Board Manipulation
* **Hot Potato (`isHotPotato` / `💣 PASS 8`):** Unresolved at Turn end = `6` DMG to Hero; resolved = `8` Pierce DMG to front Mutant.
* **Positional Contagion (`isContagion` / `🦠 TRAP`):** Resolving its color also discards adjacent non-matching Board slots (`idx ± 1`) before refill.
* **Cryo Edge Lock (`edgeLockActive`):** Reserves edge slot lock state on the Board for upcoming encounter hazards.
* **Temptation Bargain (`isTemptation` / `⚡ +14 ALL`):** Adds `+14` Bonus Cleave DMG while injecting `2` **Caustic Slag** Tiles into the pool.
* **Top-Draw Sabotage (`TOP DRAW`):** Places **Caustic Slag** directly at `drawPile[0]`, previewed in Upcoming Draws.

### 4.2 Dynamic Objectives & Fairness Guardrails
* **Loot Runner (`isLootRunner` / `💰 ESCAPE`):** `3T` warp timer (`0` DMG); destroying before warp grants `+25 CR`.
* **Mercy Target (`isMercyTarget` / `🕊 MERCY`):** Sparing a hijacked Med-Drone until all hostiles fall awards `+6 HP` & `+15 CR`.
* **Tug-of-War Meter (`tugOfWarMeter`):** `50%` start; reaching `100%` triggers **Neural Purge** (Staggers all Mutants, `+25%` OD, `+10 CR`).
* **Sleepwalker (`sleepCounter`):** Dormant (`0` DMG); wakes only after repeated damaging `Attack` hits (`Defense [2]` and `TECH [3]` do not wake it).
* **Fairness Guardrails:** Turn-1 Grace Period and Symmetrical Battlefield Rules (`volatile_atmosphere`, `magnetic_surge`).

### 4.3 Bridge Props (`propKind`)
* **Plasma Barrel (`plasma_barrel`, `10 HP`):** Destruction deals `10` Pierce DMG to all living Mutants + `+20%` Overdrive.
* **Decoy Totem (`decoy_totem`, `5 HP`, `1 Pip`):** Frontline blocker intercepting single-target hits until **Pushed** (`[R]`) or pierced.
* **Bio-Husk (`bio_husk`, `8 HP`, `reviveTimer: 2`):** Spawned when an ally falls while **Xenomorph Matriarch (`boss`)** lives; resurrects at `50% HP` if not cleared in `2` Turns (does *not* trigger Bio-Rupture).
