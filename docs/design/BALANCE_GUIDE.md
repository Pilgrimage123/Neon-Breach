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
NEON BREACH runs on a **Hybrid Tactical Curve**: **Fast/Lethal (`2–3` Turns)** against unarmored Mutants (`Stalker`, `Spitter`, `MutDog`, `Feral Nurse`), shifting to **Attrition/Puzzle (`4–6` Turns)** against armored heavyweights (`Carapace Brute`, `Xenomorph Matriarch`).

| Encounter Stage | Mutant Roster & Defense (`HP / Start ARM / Aegis Pips`) | Target Player TTK | Player TTD (Unblocked) | Core Tactical Test |
| :--- | :--- | :---: | :---: | :--- |
| **Stage 01** | `Spore Mite (9 HP)` + `Chitin Stalker (24 HP)` | **2 – 3 Turns** | `6 – 8 Turns` (`3 DMG` Turn 1) | Hold-and-Draw rhythm; pop `Spore Mite` to trigger **`6` Pierce Bio-Rupture** onto `Chitin Stalker`. |
| **Stages 02–11 Patrol** | `Mite/Skitter/Stinger`, `MutDog`, `Feral Nurse`, or `Spitter` | **3 – 4 Turns** | `4 – 5 Turns` (`3–5 DMG` Turn 1) | Crack `Skitter`'s `1` Aegis Pip, stop `Stinger`'s `Charge → Overwhelm 7 (×2)` countdown, Stagger `MutDog`'s `Overwhelm 6 (×2)` Maul, wait out `Feral Nurse`'s Turn-1 `Optical Cloak`, and full-block `Spitter` Acid to stop **Jammed** + **Caustic Slag**. |
| **Mid-Run Elite** | `Carapace Brute (38 HP, 6 ARM, 1 Pip, 2 Slots)` + support | **4 – 5 Turns** | `3 – 4 Turns` (`Overwhelm 6 (×2)` Turn 2) | Two-step **Aegis Pip + Armor** sequence before Brute's `Overwhelm 6 (×2)` Heavy slam, or Stagger with `16+` burst. |
| **Stage 12 Boss** | `Xenomorph Matriarch (104 HP, 8 ARM, 1 Pip, 50% Phase Gate)` | **5 – 7 Turns** | `4 – 5 Turns` (`0 DMG` Turn 1 → `12–16 DMG`) | Pace TECH boosts & Overdrives across Phase 1, manage the **50% Phase Gate (`+1 Pip`, `+10 ARM`)**, and full-block Acid. |

### C. Linear vs. Percentage Scaling
* **Flat/Linear Scaling:** Base Tile values (`ATK 2–9`, `DEF 3–10`, `Heal 3–5`) and Tactical Modules (*Plasma Amplifier* `+2 ATK`, *Nano-Weave* `+2 DEF`) use small integers so Starter AI Skill Chips stay relevant into Stage 12.
* **Controlled Percentage Scaling (`damageBoostPct`):** TECH boosters (`+42%` / `+45%` DMG) **stack additively** (`42% + 42% = +84%`) and decay by `-10%` at each Turn end.

### D. Baseline TPU Conversion Table

| Mechanic | Conversion Rate | Engine Rationale |
| :--- | :--- | :--- |
| **1 Base Attack DMG** | **`1.00 TPU`** | Scales with `damageBoostPct`, Surge Cleave, and Held/Tactical Module bonuses. |
| **1 Base Defense Shield** | **`0.85 TPU`** | Expires at Turn end (unless retained by *Aegis Capacitor*), reduced flatly by `corrode`. |
| **1 Direct HP Heal** | **`1.65 TPU`** | Permanent across Stages, ignores `corrode`. |
| **1% Damage Boost** | **`0.24 – 0.35 TPU`** | Additive buff (`-10%/Turn` decay). |
| **1% Overdrive Charge** | **`0.30 – 0.50 TPU`** | Charges the `0-AP` Overdrive ultimate (`16–20` Pierce AoE + utility). |
| **Overdrive per Tile** | **Kira:** `+10%` ATK / `+4%` DEF / `+12%` TECH<br>**Auraline:** `+5%` ATK·DEF / `+15%` Dud·Reactor·TECH<br>**Zuri:** `+4%` ATK·DEF / `+20%` TECH | Aligns Overdrive cadence with each Hero's core engine (Attack tempo, Reactor malfunctions, or TECH cycling). |
| **Stack Surge (`4+` Tiles, `3+` w/ Resonator)** | **ATK:** `100%` Armor Break + `50%` Cleave<br>**DEF:** `8` direct DMG to front Mutant<br>**TECH:** `+15%` OD + `6` Shield | Rewards holding Tiles across Turns to hit the `4+` threshold. |

---

## 2. AI Skill Chips & Tile Catalog (`src/engine/data.ts`)

### A. Innate Core Tiles (Per Hero)
* **Kira (`5` Innate Tiles):** `ATK 4`, `ATK 3`, `DEF 6`, `DEF 5`, `TECH Boost +42%`.
* **Auraline (`6` Innate Tiles, `3` Reactor Core Duds):** `ATK 5`, `ATK 2 (Dud · Reactor Core)`, `DEF 8`, `DEF 3 (Dud · Reactor Core)`, `TECH Boost +42%`, `TECH Boost +15% (Dud · Reactor Core)`.
* **Zuri (`5` Innate Tiles):** `ATK 6 (⚡1)`, `DEF 10 (⚡1)`, `TECH Tactical Shield (+7 SHD / +24% DMG)`, `TECH Armor Shred (-8 ARM / 3 Pierce)`, `TECH Boost +45% (⚡1)`.

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
| `apex_overwhelm` | Apex Overwhelm.AI | Prototype | Weapon | 5 | 48 | `ATK 9, ATK 9, DEF 7` |
| `armor_crack` | Armor Crack.AI | Prototype | Weapon | 3 | 46 | `ATK 8, ATK 6, TECH (-10 ARM / 4 Pierce)` |
| `flux_rebalance` | Flux Rebalance.AI | Prototype | Tech | 2 | 38 | `TECH (+5 SHD / +22% DMG), ATK 5` |
| `adaptive_guard` | Adaptive Guard.AI | Prototype | Armor | 4 | 48 | `DEF 10, DEF 8, ATK 6` |
| `hyper_thread` | Hyper-Thread.AI | Prototype | Tech | 3 | 42 | `TECH (+10% OD / -1 COR, ⚡2), DEF 8 (⚡1)` |

---

## 3. Asymmetric Hero Comparison

| Dimension | **Kira (`KIRA-09`)**<br>*Agile Tempo Striker* | **Auraline (`AURALINE-07`)**<br>*Armored Juggernaut* | **Zuri (`ZURI-03`)**<br>*Solar Swarm Commander* |
| :--- | :--- | :--- | :--- |
| **Base Stats & Memory** | `62 HP` · `0` Armor · `45 CR` · `12 Mem` | `68 HP` · **`2` Armor** · `35 CR` · **`14 Mem`** | `64 HP` · `0` Armor · **`50 CR`** · `13 Mem` |
| **Signature Passive** | **Blitz Reflex & Momentum:** Resolving `ATK` grants **`+1` Free Turn** (`3`-Turn CD, instant Board refill). Full-Shield **Evasive Dodge** reduces Blitz CD by `-1`. **Held** Tiles gain `+1 ATK / +1 DEF`. | **Juggernaut Reactor Core:** Starts every combat with `2` persistent Armor. Each **Dud** (or upgraded **Reactor Core** tile) resolved grants **`+1` UpCharge**, **`+1` Armor**, and `+15%` Overdrive. | **Tri-Drone Sync & Swarm Uplink:** Resolving a color primes that Drone (`ATK` Hawk `+4 Pierce`, `DEF` Aegis `+7 Shield`, `TECH` Med-Rotor `+4 HP`); switching colors fires the primed Drone. TECH Tiles grant **`+20%` OD**. |
| **Overdrive (`0 AP`)** | **Energy Dropkick:** `12` Frontline Kick + Knockback + `10` All Shockwave (`22` Front) · `+8` Shield | **Sovereign Broadside:** `20` DMG All · `+4` Armor · `+2` UpCharge | **Solar Swarm Protocol:** `-12` Armor All · `16` DMG All · `+8` Shield · `-2` Corrode |
| **Starting Pool** | `9` Tiles | `9` Tiles (incl. `3` Reactor Core Duds) | `9` Tiles |
| **Core Strength** | Turn-1 `ATK` free-turn chain (`ATK → DEF/TECH`), `4-ATK` Stack Surge threat, and Dodge cooldown resets. | Persistent Armor + `+1` Armor / `+1` UpCharge per Reactor tile tanks attrition while feeding `7–9` slot UpCharge Boards even after Prodigy/Guild Apprenticeship upgrades. | Turn-1 `4-TECH` Stack Surge, continuous `+4 Pierce / +7 SHD / +4 HP` Tri-Drone color-weaving, and `+20%/Tile` Overdrive tempo. |
| **Blind Spot** | `62 HP` and `12` Mem ceiling demand using Blitz follow-ups and Shield dodges cleanly. | `3` low-output Duds require UpCharge cycling or Dynasty upgrades to hit peak tile density. | Staying on the same color consecutively skips Tri-Drone Sync pulses; `0` starting Armor. |

---

## 4. Persistent Upgrade Rules

1. **Tactical Modules (`MAX_IMPLANTS = 4`):** Rule-changers capped at `4` harness/visor slots (*Surge Resonator* `3+` Surge, *Aegis Capacitor* `50%` Shield retain, *Mono-Wire Edge* `+2` Held ATK, etc.).
2. **Additive Stacking Only:** Multiple `damage_boost` buffs sum additively; flat Tactical Module/Held bonuses add to `baseDamage` before applying `(1 + damageBoostPct / 100)`.
3. **Bounded Family Hearth Overclock:** `tile_overclock` is hard-capped at `MAX_OVERCLOCK_STACKS = 2` (`+1` ATK per stack to the first 2 Attack Tiles, `+20%` OD, full Corrode cleanse).
4. **Tiered Objective Credit Rewards (`difficulty.ts`):** `2★` Secondary Objectives grant **`+4 CR` (Tier 2)**, **`+8 CR` (Tier 3 default)**, **`+14 CR` (Tier 4)**, and **`+16 CR` (Tier 5)** (`0 CR` on Tier 1 Story), plus `+1` Meta Nanite (`+2` Nanites for `3★`).

---

## 5. Mutants & Encounter Puzzles (`ENEMY_TEMPLATES`)

Per [ADR-0008](../adr/0008-threat-rating-and-passive-minimal-mutants.md), standard non-boss Mutants keep `passive: 'none'` (except `Spore Mite` and `Xenomorph Matriarch`), communicating all tactical identity through `intentCycle` and `Threat Rating`.

| Mutant & Role | Base HP / ARM / Pips | Intent Cycle (`intentCycle`) | Core Rules & Counterplay |
| :--- | :---: | :--- | :--- |
| **Spore Mite** (`larva`)<br>*The Chaff · Volatile* | `9 HP` / `0 ARM` / `0 Pips` | `1.` Attack `3`<br>`2.` Pause<br>`3.` Attack `4` | **Bio-Rupture:** On death, deals `6` Pierce DMG to all living Mutants (sacred `9 HP` on Tiers 2–5). |
| **Cobalt Skitter** (`skitter`)<br>*The Anchor · Support* | `14 HP` / `2 ARM` / `1 Pip` | `1.` Bolster `+4 ARM All`<br>`2.` Attack `5`<br>`3.` Pause | **Aegis Projection:** Starts with `1` Aegis Pip and `2` Armor; prioritizes team-wide `+4 ARM` on Turn 1. |
| **Pyre Stinger** (`stinger`)<br>*The Time-Bomb · Scaler* | `16 HP` / `0 ARM` / `0 Pips` | `1.` Charge (`0 DMG`, 2T)<br>`2.` Charge (`0 DMG`, 1T)<br>`3.` Heavy `Overwhelm 7 (×2)` | **Thermal Detonation + Stagger:** `16+` single-Turn DMG cancels `Charge`/`Heavy` into `0 DMG` (`Charge` resets to `2T`). |
| **Chitin Stalker** (`stalker`)<br>*The Striker · Flanker* | `24 HP` / `0 ARM` / `0 Pips` | `1.` Pause<br>`2.` Attack `Pierce 5`<br>`3.` Attack `7` | **Safe Windup → Pierce:** Opens with a `0 DMG` `Pause` Turn before striking through `Shield` with `Pierce 5`. |
| **Bile Spitter** (`spitter`)<br>*The Disrupter · Polluter* | `22 HP` / `0 ARM` / `0 Pips` | `1.` Pause<br>`2.` Acid `5` (`+2 COR`)<br>`3.` Acid `6` (`+2 COR, Top-Draw Slag`) | **Acid Disruption:** Full-block Acid with `Shield` to prevent **Jammed** Tiles and **Caustic Slag** pollution. |
| **Rabid MutDog** (`mutdog`)<br>*The Rusher · Bruiser* | `20 HP` / `0 ARM` / `0 Pips` | `1.` Attack `5` (`Claw Rend`)<br>`2.` Heavy `Overwhelm 6 (×2)`<br>`3.` Pause | **Fast Rush + Staggerable Maul:** Opens immediately with `Attack 5`, followed by a staggerable `Overwhelm 6 (×2)` Heavy Maul and `Pause`. |
| **Feral Nurse** (`feral_nurse`)<br>*The Ambush · Phase* | `17 HP` / `0 ARM` / `0 Pips` | `1.` **Optical Cloak** (`0 DMG`)<br>`2.` Charge (`Pierce 7`, 1T)<br>`3.` Attack `Pierce 7` (`Claw Rend`) | **Optical Cloak:** Turn-1 stealth reduces frontline damage taken to `10%` while `90%` passes through to the Mutant behind her; Beat 2 `Charge` is staggerable. |
| **Carapace Brute** (`brute`)<br>*2-Slot Heavyweight* | `38 HP` / `6 ARM` / `1 Pip` | `1.` **Mutagen Vial Brace** (`+6 ARM`)<br>`2.` **Seismic Carapace Crush** (`Overwhelm 6 (×2)`)<br>`3.` Pause | **2-Slot Footprint + Stagger:** Occupies `2` bridge slots; `16+` single-Turn DMG Staggers `Seismic Carapace Crush`. |
| **Xenomorph Matriarch** (`boss`)<br>*Stage 12 Apex Boss* | `104 HP` / `8 ARM` / `1 Pip` | `1.` Armor `+8`<br>`2.` Attack `12`<br>`3.` Acid `8` (`+2 COR, Top-Draw Slag`)<br>`4.` Heavy `16 DMG` | **50% Phase Gate + Hex + Bio-Husk:** Locks at `50%` HP (`+1 Pip`, `+10 ARM`) on first crossing; casts `⬡ Tile Hex`; resurrects dead allies via `Bio-Husk` unless purged in `2` Turns. |

---

## 6. Six-Slot Sky-Bridge & Upcoming Encounter Mechanics

See [`ENEMY_DESIGN_PRINCIPLES.md`](./ENEMY_DESIGN_PRINCIPLES.md) and [ADR-0001](../adr/0001-retain-unspawned-combat-mechanics.md) for the full design of the 6-slot sky-bridge (`MAX_ACTIVE_BRIDGE_ENEMIES = 6`) and the 11+ implemented combat puzzle primitives (`isHotPotato`, `isContagion`, `isTemptation`, `edgeLockActive`, `Loot Runner`, `Mercy Target`, `tugOfWarMeter`, `Sleepwalker`, `battlefieldRule`, `plasma_barrel`, `decoy_totem`).
