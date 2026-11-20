# NEON BREACH — Tactical Balance & Tile Valuation Guide

> **Core Philosophy:** Balancing a single-player turn-based roguelite like **NEON BREACH** is about managing the tension between **player agency** (assembling Held-Tile combos, Stack Surges, UpCharge draws, and Overdrive chains) and **systemic challenge** (keeping bio-trauma real from Stage 01's *Chitin Stalker* to Stage 12's *Xenomorph Matriarch*). Single-player balance gives each **Hero** distinct **Answers** and **Blind Spots** while preventing late-game upgrades from trivializing Mutant puzzles.
> **Code Sources:** `src/engine/data.ts`, `src/engine/combatRules.ts`, `src/engine/combatTurnEngine.ts`, `src/engine/mapGenerator.ts`

---

## 1. Establishing the Baseline Math (The Anchor)

Every mechanic in NEON BREACH anchors to **Action Economy (`1` Color Resolution = `1 AP`)** and **Tactical Power Units (`1.0 TPU = 1 Effective HP Swing`)**.

### A. Action Economy (`AP`) as the Ultimate Currency
The Hero draws to a **6-slot Board (`BOARD_CAPACITY = 6`, expandable up to `9` via UpCharge)** and spends her Turn (`1 AP`) to resolve **one color** (`attack`, `defense`, or `tech`), while unresolved Tiles stay **Held** (`isHeldFromPrevTurn = true`).
* **Value of 1 Standard Turn (`1 AP ≈ 22 – 28 TPU`):**
  * An un-upgraded Turn typically resolves `2.0 – 3.0` matching Tiles on the Board.
  * **Alpha-Strike = `+1 AP` Saved:** Dealing `22–24+` damage on Turn 1–2 to eliminate a `Chitin Stalker` (`24 HP`) or `Bile Spitter` (`22 HP`) before it acts is equivalent to gaining `+1` free AP and negating `6–9` incoming damage.
  * **Overdrive (`0 AP` Free Action):** Reaching `100%` Overdrive unlocks the Hero's signature ultimate during `PLAYER_IDLE` *without ending the Turn*. Because it deals `16–20` Armor-piercing DMG to **all** Mutants plus utility for `0 AP`, `100%` Overdrive is worth **`~1.5 – 2.0 AP` (`35 – 55 TPU`)**.
  * **Slot Opportunity Cost (`7.5 TPU` Dilution Line):** Adding weak Tiles to `masterPool` dilutes color density on the 6-slot Board. Any Tile worth `< 7.5 TPU` dilutes Turn efficiency unless it enables a `4+` Stack Surge or UpCharge draw chain.

### B. Time-to-Kill (`TTK`) & Time-to-Die (`TTD`) Targets
NEON BREACH runs on a **Hybrid Tactical Curve**: **Fast/Lethal (`2–3` Turns)** against unarmored Mutants (`Stalker`, `Spitter`), shifting to **Attrition/Puzzle (`4–6` Turns)** against armored heavyweights (`Carapace Brute`, `Xenomorph Matriarch`).

| Encounter Stage | Mutant Roster & Defense (`HP / Start ARM / Aegis Pips`) | Target Player TTK | Player TTD (Unblocked) | Core Tactical Test |
| :--- | :--- | :---: | :---: | :--- |
| **Stage 01 (`Layer 0`)** | `Spore Mite (9 HP) + Chitin Stalker (24 HP, -4 bonus = 20 HP)` | **2 – 3 Turns** | `6 – 8 Turns` (`3 DMG` Turn 1) | Hold-and-Draw rhythm; pop Mite to trigger **`6` Pierce Bio-Rupture** onto Stalker and bypass **Spike Retaliation**. |
| **Stages 02–11 Patrol** | `Mite/Skitter/Stinger` or `Skitter/Spitter` | **3 – 4 Turns** | `4 – 5 Turns` (`3–5 DMG` Turn 1) | Crack `Skitter`'s `1` Aegis Pip, stop `Stinger`'s `Charge → 16 Heavy` countdown, full-block `Spitter` Acid to stop **Tile Jam** + **Caustic Slag**. |
| **Mid-Run Elite** | `Carapace Brute (38 HP, 8 ARM, 1 Pip, 2 Slots)` + support | **4 – 5 Turns** | `3 – 4 Turns` (`14` Heavy Turn 2) | Two-step **Aegis Pip + Armor** sequence before Brute's `14` Heavy slam, or Stagger with `16+` burst. |
| **Stage 12 Boss** | `Xenomorph Matriarch (110 HP, 10 ARM, 1 Pip, 50% Phase Gate)` | **5 – 7 Turns** | `4 – 5 Turns` (`0 DMG` Turn 1 → `11–18 DMG`) | Pace TECH boosts & Overdrives across Phase 1, manage the **50% Phase Gate (`+1 Pip`, `+10 ARM`)**, and full-block Acid. |

### C. Linear vs. Percentage Scaling
* **Flat/Linear Scaling:** Base Tile values (`ATK 3–9`, `DEF 6–10`, `Heal 2–5`) and Implants (*Plasma Amplifier* `+2 ATK`, *Nano-Weave* `+2 DEF`) use small integers so Starter AI Skill Chips stay relevant into Stage 12.
* **Controlled Percentage Scaling (`damageBoostPct`):** TECH boosters (`+42% DMG`) **stack additively** (`42% + 42% = +84%`) and decay by `-10%` at each Turn end.

### D. Baseline TPU Conversion Table

| Mechanic | Conversion Rate | Engine Rationale |
| :--- | :--- | :--- |
| **1 Base Attack DMG** | **`1.00 TPU`** | Scales with `damageBoostPct`, Surge Cleave, and Held/Implant bonuses. |
| **1 Base Defense Shield** | **`0.85 TPU`** | Expires at Turn end (unless retained by *Aegis Capacitor*), reduced flatly by `corrode`. |
| **1 Direct HP Heal** | **`1.65 TPU`** | Permanent across Stages, ignores `corrode`. |
| **1% Damage Boost** | **`0.24 – 0.35 TPU`** | Additive buff (`-10%/Turn` decay). |
| **1% Overdrive Charge** | **`0.30 – 0.50 TPU`** | Charges the `0-AP` Overdrive ultimate (`16–20` Pierce AoE + utility). |
| **Overdrive per Tile** | **ATK/DEF:** `+4%` · **TECH:** `+15%` (`+20%` Kira, `+25%` Zuri) | TECH Tiles drive Overdrive cadence (`3.75×–6.25×` faster than ATK/DEF). |
| **Stack Surge (`4+` Tiles, `3+` w/ Resonator)** | **ATK:** `100%` Armor Break + `50%` Cleave<br>**DEF:** `8` direct DMG to front Mutant<br>**TECH:** `+15%` OD + `6` Shield | Rewards holding Tiles across Turns to hit the `4+` threshold. |

---

## 2. AI Skill Chips & Tile Catalog (`src/engine/data.ts`)

### A. Innate Core Tiles (Per Hero)
* **Kira (`5` Innate Tiles):** `ATK 3`, `DEF 8`, `TECH Boost +42% ×2`, `TECH Heal 2`.
* **Auraline (`6` Innate Tiles, `3` Duds):** `ATK 5`, `ATK Dud 0`, `DEF 8`, `DEF Dud 0`, `TECH Boost +42%`, `TECH Dud 0`.
* **Zuri (`5` Innate Tiles):** `ATK 4`, `DEF 7`, `DEF 6`, `TECH Tactical Shield (+4 SHD / +24% DMG)`, `TECH Armor Shred (-8 ARM / 3 Pierce)`.

### B. AI Skill Chip Efficiency (`SKILL_CHIP_CATALOG`)
Equipped **AI Skill Chips** inject specialized Tiles into `masterPool` up to the Hero's **Memory** capacity (`12` Kira / `14` Auraline / `13` Zuri):

| Chip ID | UI Name | Rarity | Cat. | Mem | Price | Injected Tiles |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `predictive_aim` | Predictive Aim.AI | Starter | Weapon | 2 | 30 | `ATK 5, ATK 5, DEF 7` |
| `auto_suture` | Auto-Suture.AI | Starter | Med | 1 | 22 | `TECH Heal 3` |
| `impact_solver` | Impact Solver.AI | Starter | Weapon | 3 | 36 | `ATK 6, ATK 6` |
| `sovereign_ward` | Sovereign Ward.AI | Starter | Armor | 1 | 24 | `DEF 7` |
| `swarm_vector` | Swarm Vector.AI | Starter | Weapon | 2 | 34 | `ATK 6, ATK 5` |
| `sanctuary_mesh` | Sanctuary Mesh.AI | Starter | Tech | 2 | 28 | `DEF 8, TECH Heal 4` |
| `volley_matrix` | Volley Matrix.AI | Standard | Weapon | 4 | 45 | `ATK 7, ATK 7, ATK 5` |
| `zero_trust_wall` | Zero-Trust Wall.AI | Standard | Armor | 3 | 35 | `DEF 9, DEF 9` |
| `trauma_patch` | Trauma Patch.AI | Standard | Med | 2 | 30 | `TECH Heal 5, DEF 6` |
| `surgical_cut` | Surgical Cut.AI | Standard | Weapon | 2 | 34 | `ATK 7, ATK 6` |
| `system_scrub` | System Scrub.AI | Standard | Tech | 2 | 32 | `TECH +15% OD / -2 COR, DEF 6` |
| `tempo_feed` | Tempo Feed.AI | Standard | Tech | 2 | 34 | `ATK 5 (⚡1), DEF 6` |
| `synapse_loop` | Synapse Loop.AI | Standard | Tech | 2 | 38 | `TECH Heal 3 (⚡1), ATK 6` |
| `kill_chain_amp` | Kill-Chain Amp.AI | Prototype | Tech | 2 | 40 | `TECH Boost +42%, ATK 5` |
| `apex_overwhelm` | Apex Overwhelm.AI | Prototype | Weapon | 5 | 55 | `ATK 9, ATK 9, DEF 7` |
| `armor_crack` | Armor Crack.AI | Prototype | Weapon | 3 | 46 | `ATK 8, ATK 6, TECH (-10 ARM / 4 Pierce)` |
| `flux_rebalance` | Flux Rebalance.AI | Prototype | Tech | 2 | 38 | `TECH (+5 SHD / +22% DMG), ATK 5` |
| `adaptive_guard` | Adaptive Guard.AI | Prototype | Armor | 4 | 48 | `DEF 10, DEF 8, ATK 6` |
| `hyper_thread` | Hyper-Thread.AI | Prototype | Tech | 3 | 48 | `TECH (+10% OD / -1 COR, ⚡2), DEF 8 (⚡1)` |

---

## 3. Asymmetric Hero Comparison

| Dimension | **Kira (`KIRA-09`)**<br>*Agile Tempo Striker* | **Auraline (`AURALINE-07`)**<br>*Armored Juggernaut* | **Zuri (`ZURI-03`)**<br>*Solar Swarm Commander* |
| :--- | :--- | :--- | :--- |
| **Base Stats & Memory** | `58 HP` · `0` Armor · `45 CR` · `12 Mem` | `78 HP` · **`18` Armor** · `35 CR` · **`14 Mem`** | `62 HP` · `0` Armor · **`50 CR`** · `13 Mem` |
| **Signature Passive** | **Cyber-Momentum:** **Held** Tiles gain `+1 ATK / +1 DEF`. TECH Tiles grant `+20%` OD. | **Juggernaut Core:** Starts every combat with `18` persistent Armor. Gains **`+1` UpCharge** per **Dud** resolved. | **Swarm Uplink:** TECH Tiles grant **`+25%` OD** (fastest Overdrive cycle). |
| **Overdrive (`0 AP`)** | **Plasma Blitz:** `20` Pierce All · `+30%` DMG · `+6` Shield | **Sovereign Broadside:** `20` Pierce All · `+10` Armor · `+2` UpCharge | **Solar Swarm Protocol:** `16` Pierce All · `-12` Armor All · `+8` Shield · `-2` Corrode |
| **Starting Pool** | `9` Tiles (`3 ATK / 2 DEF / 4 TECH`) | `9` Tiles (`3 ATK + 1 Dud / 2 DEF + 1 Dud / 1 TECH + 1 Dud`) | `9` Tiles (`3 ATK / 3 DEF / 3 TECH`) |
| **Core Strength** | Turn-1 TECH Surge & rapid *Plasma Blitz* chains into Held Attacks. | Persistent `18` Armor tanks attrition while Duds feed `7–9` slot UpCharge Boards. | Built-in AoE Armor Shred (`-8` / `-12`) and rapid `+25%/Tile` Overdrive tempo. |
| **Blind Spot** | Only `3` starting ATK Tiles and `58 HP` / `12` Mem ceiling. | `3` zero-value Duds dilute early raw output without UpCharge or Prodigy conversion. | Even `3/3/3` split cannot hit `4+` Stack Surge at start without drafting. |

---

## 4. Persistent Upgrade Rules

1. **Cyber Implants (`MAX_IMPLANTS = 4`):** Rule-changers capped at `4` sockets (*Surge Resonator* `3+` Surge, *Aegis Capacitor* `50%` Shield retain, *Mono-Wire Edge* `+2` Held ATK, etc.).
2. **Additive Stacking Only:** Multiple `damage_boost` buffs sum additively; flat Implant/Held bonuses add to `baseDamage` before applying `(1 + damageBoostPct / 100)`.
3. **Bounded Bio-Med Overclock:** `tile_overclock` is hard-capped at `MAX_OVERCLOCK_STACKS = 2` (`+1` ATK per stack to the first 2 Attack Tiles, `+20%` OD, full Corrode cleanse).
4. **Tiered Objective Credit Rewards (`difficulty.ts`):** `2★` Secondary Objectives grant **`+4 CR` (Tier 2)**, **`+8 CR` (Tier 3 default)**, **`+14 CR` (Tier 4)**, and **`+16 CR` (Tier 5)** (`0 CR` on Tier 1 Story), plus `+1` Meta Nanite (`+2` Nanites for `3★`).

---

## 5. Mutants & Encounter Puzzles (`ENEMY_TEMPLATES`)

| Mutant & Role | Base HP / ARM / Pips | Intent Cycle (`intentCycle`) | Core Rules & Reactive Triggers |
| :--- | :---: | :--- | :--- |
| **Spore Mite** (`larva`)<br>*The Chaff · Volatile* | `9 HP` / `0 ARM` / `0 Pips` | `1.` Attack `3`<br>`2.` Acid `3` (`+1 COR`)<br>`3.` Attack `4` | **Bio-Rupture:** On death, deals `6` Pierce DMG to all living Mutants (sacred `9 HP` on Tiers 2–5). |
| **Cobalt Skitter** (`skitter`)<br>*The Anchor · Support* | `14 HP` / `2 ARM` / `1 Pip` | `1.` Bolster `+4 ARM All`<br>`2.` Attack `5`<br>`3.` Leech `5` (`+3 HP`) | **Aegis Projection + Enrage Alone:** Starts with `1` Aegis Pip; if left as lone survivor, drops `bolster`, gains `+2 ATK`, and attacks. |
| **Pyre Stinger** (`stinger`)<br>*The Time-Bomb · Scaler* | `16 HP` / `0 ARM` / `0 Pips` | `1.` Charge (`0 DMG`, 2T)<br>`2.` Charge (`0 DMG`, 1T)<br>`3.` Heavy `16 DMG` | **Thermal Detonation + Stagger:** `16+` single-Turn DMG cancels `Charge`/`Heavy` into `0 DMG` (`Charge` resets to `2T`). |
| **Chitin Stalker** (`stalker`)<br>*The Punisher · Taxer* | `24 HP` / `0 ARM` / `0 Pips` | `1.` Attack `6`<br>`2.` Attack `7` (`+4` if `0 SHD`)<br>`3.` Armor `+4` | **Spike Retaliation:** Deals `3` counter-DMG (`+4` extra at `0` Shield) when surviving a non-Surge Attack. |
| **Bile Spitter** (`spitter`)<br>*The Disrupter · Polluter* | `22 HP` / `0 ARM` / `0 Pips` | `1.` Acid `5` (`+2 COR + Jam/Slag`)<br>`2.` Caustic Claw Rend `7` (`+2 COR, +3 ARM`)<br>`3.` Acid `6` (`+2 COR, Top-Draw Slag`) | **Pustule Rupture + Tile Hex:** Surviving non-Surge Attack sprays `+2` Corrode; Turn 2+ casts `⬡ HEX` (`+4 HP / +3 ARM` if cast Tile resolves while Spitter lives). |
| **Carapace Brute** (`brute`)<br>*2-Slot Heavyweight* | `38 HP` / `8 ARM` / `1 Pip` | `1.` Mutagen Brace (`+6 ARM, +3 HP`)<br>`2.` Heavy `14 DMG`<br>`3.` Attack `9` | **2-Slot Footprint + Stagger:** Occupies `2` bridge slots; `16+` single-Turn DMG Staggers `Heavy 14` (`22+` permanent `-3 DMG` Weapon Break). |
| **Xenomorph Matriarch** (`boss`)<br>*Stage 12 Apex Sovereign* | `110 HP` / `10 ARM` / `1 Pip` | `1.` Armor `+10`<br>`2.` Attack `11` (`+4` if `ATK`)<br>`3.` Acid `8` (`+2 COR, Top-Draw Slag`)<br>`4.` Heavy `18 DMG` | **50% Phase Gate + Hex + Bio-Husk:** Locks at `50%` HP (`+1 Pip`, `+10 ARM`) on first crossing; resurrects dead allies via `Bio-Husk` unless purged in `2` Turns. |

---

## 6. Six-Slot Sky-Bridge & Upcoming Encounter Mechanics

See [`ENEMY_DESIGN_PRINCIPLES.md`](./ENEMY_DESIGN_PRINCIPLES.md) and [ADR-0001](../adr/0001-retain-unspawned-combat-mechanics.md) for the full design of the 6-slot sky-bridge (`MAX_ACTIVE_BRIDGE_ENEMIES = 6`) and the 11+ implemented combat puzzle primitives (`isHotPotato`, `isContagion`, `isTemptation`, `edgeLockActive`, `Loot Runner`, `Mercy Target`, `tugOfWarMeter`, `Sleepwalker`, `battlefieldRule`, `plasma_barrel`, `decoy_totem`).
