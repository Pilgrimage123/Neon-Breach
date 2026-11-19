# NEON BREACH — Tactical Balance & Tile Valuation Guide

> **Core Philosophy:** Balancing a single-player turn-based rogue-lite like **NEON BREACH** is about managing the tension between **player agency** (feeling clever when assembling Held-tile combos, Stack Surges, and Overdrive chains) and **systemic challenge** (keeping the threat of bio-trauma real from Sector 1's *Chitin Stalker* to Sector 5's *Xenomorph Matriarch*). Unlike PvP games where strict symmetry matters, single-player balance exists to give each operative distinct **Answers** and **Blind Spots** while preventing late-game upgrades from trivializing enemy puzzles.
> **Code Sources:** `src/engine/data.ts`, `src/engine/gameEngine.ts`, `src/engine/mapGenerator.ts`

---

## 1. Establishing the Baseline Math (The Anchor)

Before tuning individual tiles, equipment weights, or implants, every mechanic in NEON BREACH is anchored to **Action Economy (1 Color Resolution = 1 AP)** and **Tactical Power Units (`1.0 TPU = 1 Effective HP Swing`)**.

### A. Action Economy (AP) as the Ultimate Currency
In NEON BREACH, the player draws to a **6-tile board (`BOARD_CAPACITY = 6`)** and spends their **entire turn (1 AP)** to resolve **one color** (`attack`, `defense`, or `tech`), while unresolved tiles stay held (`isHeldFromPrevTurn = true`).
* **The Value of 1 Standard Turn (`1 AP ≈ 22 – 28 TPU`):**
  * A standard un-upgraded turn resolves `2.0 – 3.0` matching tiles on the 6-slot board.
  * **Alpha-Strike = +1 AP Saved:** Dealing `28+` damage on Turn 1/2 to eliminate a `Chitin Stalker` (`28 HP`) or `Bile Spitter` (`24 HP`) before it acts is functionally identical to **gaining +1 free AP and negating `7–9` incoming damage**.
  * **Overdrive as an "Action Cheater" (`0 AP` Cost):** Reaching `100%` Overdrive unlocks **Plasma Blitz (Kira)** or **Sovereign Broadside (Aurelia)** during `PLAYER_IDLE` *without ending the turn*. Because it deals `20–24` armor-piercing damage to **all** enemies plus Shield/Boost for `0 AP`, `100%` Overdrive is worth **`~1.5 – 2.0 AP` (`35 – 55 TPU`)**.
  * **Slot Opportunity Cost (The `7.5 TPU` Dilution Line):** Because the board only holds 6 tiles, adding low-impact tiles to `masterPool` reduces the number of matching tiles you can resolve per `1 AP`. Any tile worth `< 7.5 TPU` actively dilutes your turn efficiency unless it completes a `4+` Stack Surge.

### B. Time-to-Kill (TTK) & Time-to-Die (TTD) Targets
NEON BREACH sits on a **Hybrid Tactical Curve**: **Fast/Lethal (2–3 turns)** against unarmored bio-mutants (`Stalker`, `Spitter`) to reward alpha-striking and Surge Cleave, shifting to **Attrition/Puzzle-Based (4–6 turns)** against armored heavyweights (`Carapace Brute`, `Xenomorph Matriarch`).

| Encounter Tier | Enemy Roster & Defense (`HP / Start ARM / Pips`) | Target Player TTK (Normal Build) | Player TTD (Unblocked Hits to Die) | Core Tactical Test |
| :--- | :--- | :---: | :---: | :--- |
| **Sector 1 (Layer 0)** | `Spore Mite (9 HP) + Chitin Stalker (24 HP)` (`33 EHP`) | **2 – 3 Turns** | `6 – 8 Turns` (`3 DMG` Turn 1) | Hold-and-Draw rhythm; pop Mite to trigger **6 Pierce Bio-Rupture** onto Stalker and bypass **Spike Retaliation**. |
| **Sectors 2–4 Patrol** | `Mite/Skitter/Stinger` or `Skitter/Spitter` *(capped Turn-1 threat)* (`40 – 65 EHP`) | **3 – 4 Turns** | `4 – 5 Rounds` (`3–5 DMG` Turn 1) | Crack `Skitter`'s `1 Shield Pip`, stop `Stinger`'s `Charge -> 16 Heavy` countdown, full-block `Spitter` Acid to prevent **Tile Jam**. |
| **Sector 3–4 Elite** | `Carapace Brute (38 HP, 8 ARM, 1 Pip) + Spitter/Mite+Stinger` (`80 – 95 EHP`) | **4 – 5 Turns** | `3 – 4 Rounds` (`3–5 DMG` Turn 1 → `13+` Turn 2) | Two-step **Pip + Armor** sequence (`Bio-Rupture`/`Riposte`/`Pierce`/`OD` → `Attack Surge` or `Armor Shred`) before Brute's `13 Heavy`. |
| **Sector 5 Boss** | `Xenomorph Matriarch` (`110 HP`, `10 ARM`, **`1 Pip`**, **`50% Phase Gate`**) | **5 – 7 Turns** | `4 – 5 Rounds` (`0 DMG` Turn 1 → `12–18 DMG`) | Pace TECH boosts & Overdrives across Phase 1, respect the **`55 HP` Phase Gate (`+1 Pip`, `+10 ARM`)**, and full-block Acid to prevent Tile Jams. |

### C. Linear vs. Percentage Scaling in NEON BREACH
* **Flat/Linear Scaling (Attack, Defense, Heal, Implants):** Base tile values (`ATK 3–9`, `DEF 6–9`, `Heal 2–5`) and implants (*Plasma Amplifier* `+2 ATK`, *Nano-Weave* `+2 DEF`) use compact flat integers. This keeps starter gear (`Aretta Pistol`, `Royal Twin-Barrel`) relevant all the way to Sector 5.
* **Controlled Percentage Scaling (`damageBoostPct`):** TECH boosters (`+42% DMG`) provide multiplicative excitement on big red turns, but **stack additively** with each other (`42% + 42% = +84%`, never `1.42 × 1.42`) and decay by `-10%` each round so the math stays bounded across a 5-sector run.

### D. Baseline TPU Conversion Table (`1.0 TPU = 1 Effective HP Swing`)

| Mechanic | Conversion Rate | Engine Rationale (`gameEngine.ts`) |
| :--- | :--- | :--- |
| **1 Base Attack DMG** | **`1.00 TPU`** | Baseline unit. Scales with `damageBoostPct`, Surge Cleave, and Held/Implant bonuses. |
| **1 Base Defense Shield** | **`0.85 TPU`** | Expires at round end (beyond Aurelia's `5` cap or *Aegis Capacitor*), can over-block unused intent, does nothing on enemy `armor` turns, and is reduced flatly by `corrode`. |
| **1 Direct HP Heal** | **`1.65 TPU`** | Permanent across sectors, ignores `corrode`, and yields full value even on enemy `armor` turns. |
| **1% Damage Boost** (`damage_boost`) | **`0.24 – 0.35 TPU`** | Additive buff (`-10%/round` decay). A `+42%` tile stays active for 5 rounds (`42% → 32% → 22% → 12% → 2%`), amplifying multiple Attack turns and `50%` Surge Cleave. |
| **1% Overdrive Charge** | **`0.30 TPU`** *(1 target)*<br>**`0.50 TPU`** *(2 targets)* | Charges the `0-AP` Overdrive ultimate (`20–24` AoE true damage + utility). |
| **Overdrive per Tile** | **ATK / DEF:** `+4%` (`+1.2 TPU`)<br>**TECH:** `+15%` (`+20%` on Kira) | TECH tiles are the primary Overdrive engine (`3.75×` to `5.0×` faster charge than red/blue tiles). |
| **Stack Surge (`4+` tiles, `3+` w/ Resonator)** | **ATK:** `100%` Armor Break + `50%` Cleave<br>**DEF:** `+8` Reflect DMG<br>**TECH:** `+15%` OD + `+6` Shield | Rewards holding tiles on the 6-slot board across turns to hit the `4+` threshold. |

---

## 2. Master Tile Power Table (All Player Tile Specs)

* **Raw TPU:** Intrinsic effect + Overdrive charge + average Surge contribution.
* **Implant-Scaled TPU:** Power when paired with core Common/Rare implants (*Plasma Amplifier* `+2`, *Mono-Wire Edge* `+2` held, *Nano-Weave* `+2`, *Synapse Overclock* `+3 SHD`, *Flux Injector* `+10% OD`).
* **Net Deck Impact:** `Raw TPU - 7.5` (slot opportunity cost on the 6-tile board).

### A. Attack Tiles (`attack`)

| Tile Spec | Base Value | Sources | Raw TPU | Implant-Scaled TPU | Net Deck Impact | Balance Verdict |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **`ATK 3`** | 3 DMG | Kira Innate (×1), Aurelia Innate (×1) | **4.9** | 8.0 | **`-2.6` (Starter Filler)** | Baseline innate jab; reaches `6.1 TPU` when held by Kira (`+1` passive) and `10+ TPU` with implants. |
| **`ATK 4`** | 4 DMG | Aurelia Innate (×1) | **6.1** | 9.3 | **`-1.4` (Surge Enabler)** | Gives Aurelia her 4th starting red tile for Turn-1/2 Attack Surges. |
| **`ATK 5`** | 5 DMG | Aretta Pistol (×2), VX Carbine (×1), Overclock Amp (×1) | **7.3** | 10.5 | **`-0.2` (Neutral Benchmark)** | Clean starter/secondary weapon strike that never clogs the board. |
| **`ATK 6`** | 6 DMG | Royal Twin-Barrel (×2) | **8.5** | 11.7 | **`+1.0` (Good)** | Aurelia's signature scattergun salvo; 2 tiles deal `12` base DMG (`17` with `+42%` boost). |
| **`ATK 7`** | 7 DMG | VX Assault Carbine (×2) | **9.7** | 12.9 | **`+2.2` (Strong)** | Reliable mid-game workhorse payload. |
| **`ATK 9`** | 9 DMG | Breacher Shotgun (×2) | **12.2** | 15.4 | **`+4.7` (Elite Payload)** | Premier red tile; two `ATK 9` tiles under `+84%` boost deal `33` front DMG + `16` cleave. |

### B. Defense Tiles (`defense`)

| Tile Spec | Base Value | Sources | Raw TPU | Implant-Scaled TPU | Net Deck Impact | Balance Verdict |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **`DEF 6`** | 6 SHD | Aurelia Innate (×1), Royal Twin-Barrel (×1), Bio-Stim Injector (×1) | **7.1** | 9.5 | **`-0.4` (Solid Guard)** | Resilient against early `corrode`; on Aurelia, each `DEF 6` also deals `+2` Riposte DMG (`9.1 TPU`). |
| **`DEF 7`** | 7 SHD | Aurelia Innate (×1), Aretta Pistol (×1), Breacher Shotgun (×1) | **8.0** | 10.4 | **`+0.5` (Reliable Block)** | Two `DEF 7` tiles (`14 SHD`) full-block a Brute's `13` Heavy Rend. |
| **`DEF 8`** | 8 SHD | Kira Innate (×1) | **8.8** | 11.2 | **`+1.3` (Strong Anchor)** | Kira's high-density defensive tile (`9 SHD` when held via *Cyber-Momentum*). |
| **`DEF 9`** | 9 SHD | Ballistic Buckler (×2) | **9.7** | 12.1 | **`+2.2` (Fortress Plating)** | Two `DEF 9` tiles (`18 SHD`) effortlessly absorb the Matriarch's `16` Heavy attack. |

### C. Tech Tiles (`tech`)

| Tile Spec | Effect | Sources | Raw TPU | Implant-Scaled TPU | Net Deck Impact | Balance Verdict |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **`TECH: Heal 2`** | `+2 HP`, `+15–20% OD` | Kira Innate (×1) | **9.6** | 13.2 | **`+2.1` (Combo Fuel)** | Enables Kira's 4-tile Turn-1 Tech Surge while chipping in permanent sustain and `+20%` Overdrive. |
| **`TECH: Heal 3`** | `+3 HP`, `+15–20% OD` | Mini Medkit (×1) | **11.3** | 14.9 | **`+3.8` (Strong Sustain)** | Compact Size-1 field sustain for Kira (`+5 HP` total when resolved alongside her innate `Heal 2`). |
| **`TECH: Heal 4`** | `+4 HP`, `+15% OD` | Sovereign Diadem (×1) | **12.9** | 16.5 | **`+5.4` (Royal Regen)** | High-density single-tile sustain for Aurelia without bloating her TECH count. |
| **`TECH: Heal 5`** | `+5 HP`, `+15–20% OD` | Bio-Stim Injector (×1) | **14.6** | 18.2 | **`+7.1` (Elite Sustain)** | Premier mid-run recovery tile; two cycles restore `10 HP` + `30–40%` Overdrive. |
| **`TECH: Boost +42%`** | `+42% DMG` (`-10%/t`), `+15–20% OD` | Kira Innate (×2), Aurelia Innate (×1), Overclock Amp (×1) | **18.0** | 21.6 | **`+10.5` (Build-Around)** | Balanced sweet spot: two resolved together grant `+84%` damage (`42% → 32% → 22% → 12% → 2%`) without runaway 6-turn immortality. |
| **`TECH: Armor Shred`** | `-10 Armor All`, `4 Pierce DMG`, `+15–20% OD` | ARC Rail-Carbine (×1) | **15.7** | 19.3 | **`+8.2` (Anti-Armor)** | Strips `10` Chitin Armor across all enemies while pinging front HP, solving Brute/Matriarch armor walls via green tiles. |
| **`TECH: Overdrive Surge`** | `+15% Bonus OD`, `-2 Corrode`, `+15–20% OD` | Cryo-Purge Module (×1) | **14.5** | 18.1 | **`+7.0` (OD + Cleanse)** | Grants `+30–35%` total Overdrive from a single tile and strips `Acid Spit` Corrode stacks. |
| **`TECH: Tactical Shield`** | `+5 SHD`, `+22% DMG` (`-10%/t`), `+15–20% OD` | Aegis Converter (×1) | **17.6** | 21.2 | **`+10.1` (Tempo Hybrid)** | Bridges offense and defense in one TECH resolution without suffering `Corrode` Shield loss. |

---

## 3. Balancing Asymmetric Starting Stats & Operatives

In a single-player tactical game, asymmetric operatives must balance **distinct playstyles, Answers, and Blind Spots**, not identical stat lines. All three operatives start with a **9-tile pool**, embodying distinct tactical archetypes:

| Archetype Dimension | **Kira (`KIRA-09 · Plasma Vanguard`)**<br>*Glass-Cannon Tech / Combo Assassin* | **Auraline (`AURALINE-07 · Slow Juggernaut`)**<br>*Armored Juggernaut / Dud-UpCharge Engine* | **Zuri (`ZURI-03 · Solar Swarm Commander`)**<br>*Armor-Shred Tactician / TECH Specialist* |
| :--- | :--- | :--- | :--- |
| **Base Stats & Loadout Budget** | `58 HP` · `0` Armor · **`45 CR`** · `12` Chip Memory | **`78 HP` · `18` Combat Armor** · `35 CR` · **`14` Chip Memory** | `62 HP` · `0` Armor · **`50 CR`** · `13` Chip Memory |
| **Signature Passive** | **Cyber-Momentum:**<br>• **Held** tiles gain **`+1` ATK / `+1` DEF** when resolved.<br>• **TECH** tiles grant **`+20%` Overdrive** (`+5%` bonus). | **Juggernaut Core:**<br>• Starts every combat with **`18` persistent Armor** (beneath Shield).<br>• Gains **`+1` UpCharge** (+1 drawn tile next turn) per **Dud** resolved. | **Swarm Uplink:**<br>• **TECH** tiles grant **`+25%` Overdrive** (`+10%` bonus—fastest OD engine).<br>• **`0` Held Bonus · `0` Shield Retain · `0` Riposte**. |
| **Unique Overdrive (`0 AP`)** | **Plasma Blitz (`100% OD`):**<br>`20` Pierce DMG All · **`+30%` DMG Boost** · `+6` Shield | **Sovereign Broadside (`100% OD`):**<br>`20` Pierce DMG All · **`+10` Armor** · **`+2` UpCharge** | **Solar Swarm Protocol (`100% OD`):**<br>`16` Pierce DMG All · **`-12` Armor All** · `+8` Shield · `-2` Corrode |
| **9-Tile Starting Pool** | **`3 ATK · 2 DEF · 4 TECH`**<br>• **ATK (3):** `5, 5, 3`<br>• **DEF (2):** `8, 7`<br>• **TECH (4):** `Boost 42%, Boost 42%, Heal 3, Heal 2` | **`4 ATK · 3 DEF · 2 TECH`** *(includes 1 Dud per color)*<br>• **ATK (4):** `6, 6, 5, Dud 0`<br>• **DEF (3):** `8, 7, Dud 0`<br>• **TECH (2):** `Boost 42%, Dud 0` | **`3 ATK · 3 DEF · 3 TECH`**<br>• **ATK (3):** `6, 5, 4`<br>• **DEF (3):** `8, 7, 6`<br>• **TECH (3):** `Tactical Shield (+4 SHD/+24% DMG), Armor Shred (-8 ARM/3 Pierce), Heal 4` |
| **Built-In "Answer" (Core Strength)** | • **Native Turn-1 Tech Surge:** Starts with `4` TECH tiles.<br>• **Action Cheating:** Reaches `100%` Overdrive quickly and chains *Plasma Blitz* (`+30%` DMG) into Held Attacks. | • **Persistent Armor + Dud Tempo:** `18` starting Armor shrugs off early attrition, while resolving 0-effect Duds yields `+1` UpCharge (drawing larger `7–9` tile boards next turn) and still counts for Surges/OD. | • **Innate Anti-Armor & Tempo:** Strips `-8` Armor All via innate TECH and `-12` Armor All via Overdrive (`16` Pierce), plus `+25%` OD per TECH tile.<br>• **Hybrid Tech Utility:** *Tactical Shield* grants Block + DMG Boost simultaneously. |
| **Built-In "Blind Spot" (Weakness)** | • **Cannot Attack Surge at Start (`3` ATK tiles):** Must draft an Attack Chip or *Surge Resonator* for red Armor-Break/Cleave.<br>• **Setup Vulnerability:** Lower HP (`58`) and only `2` DEF tiles. | • **Dud Dilution & Low Starting Tech:** 3 of her 9 tiles are Duds (`0` base value without flat Implants), and only 2 TECH tiles slow her Overdrive ramp unless she feeds Duds into UpCharge draws. | • **No Native Turn-1 Surge (`3/3/3` split):** Cannot trigger any `4+` Stack Surge at start without drafting color-matching Chips or *Surge Resonator*.<br>• **No Passive Shield Carry or Held Scaling.** |
| **Balancing Levers** | Tight `12` Chip Memory forces Kira to **swap out starter Chips** when installing heavy AI Skill Chips. | `14` Chip Memory + Dud UpCharge lets Auraline keep her innate Duds or selectively purge 1 at Cyber-Clinic (`30 CR`) while running heavy Chips. | Balanced `13` Chip Memory encourages drafting targeted AI Skill Chips (*ARC Rail.AI*, *Aegis Converter.AI*, or *Pulse Capacitor.AI*). |

---

## 4. Managing Persistent Upgrades (Preventing the Snowball Problem)

To prevent the **Inverse Difficulty Curve** (where Sector 1 feels tense but Sector 5's Matriarch melts effortlessly), NEON BREACH separates progression into bounded **Vertical** and **Horizontal** channels:

### A. Equipment Efficiency & Carry Capacity Budget (`EQUIPMENT_CATALOG`)
Equipment provides **Vertical + Deck-Composition progression**, bounded by **Carry Capacity (`12` Kira / `14` Aurelia)** and **Deck Dilution (every tile added slows draw cycle)**:

| Equipment ID | Name | Rarity | Cat. | Size | Price | Tiles | Total TPU | Avg TPU / Tile | TPU / Size | Role & Balance Verdict |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :--- |
| `takticky_zesilovac` | Overclock Amp | Rare | Tech | **2** | 40 | `Boost +42%`, `ATK 5` | **25.3** | **12.65** | **12.65** | **S (Combo Scaler):** Unlocks Kira's 4th ATK tile AND adds a 3rd `+42%` booster (`12.65 TPU/Size`). |
| `kralovsky_diadem` | Sovereign Diadem | Starter | Tech | **1** | 24 | `Heal 4` | **12.9** | **12.90** | **12.90** | **A+ (Aurelia Starter):** Concentrated 1-tile royal sustain; zero deck bloat. |
| `pistole_aretta` | Aretta Pistol | Starter | Weapon | **2** | 30 | `ATK 5, 5, DEF 7` | **22.6** | **7.53** | **11.30** | **A (Kira Starter):** High weight efficiency (`11.30 TPU/Size`). |
| `minilekarnicka` | Mini Medkit | Starter | Med | **1** | 22 | `Heal 3` | **11.3** | **11.30** | **11.30** | **A (Kira Starter):** Lean 1-tile Tech Surge enabler + sustain (`+20% OD` on Kira). |
| `stim_injektor` | Bio-Stim Injector | Common | Med | **2** | 30 | `Heal 5, DEF 6` | **21.7** | **10.85** | **10.85** | **A- (Sustain/Guard):** Bridges Tech and Defense decks cleanly after the `DEF 4 → 6` buff. |
| `dvojita_brokovnice` | Royal Twin-Barrel | Starter | Weapon | **3** | 36 | `ATK 6, 6, DEF 6` | **24.1** | **8.03** | **8.03** | **B+ (Aurelia Starter):** Solid front-loaded brawler weapon. |
| `karabin_vx` | VX Assault Carbine | Common | Weapon | **4** | 45 | `ATK 7, 7, 5` | **26.7** | **8.90** | **6.68** | **B+ (Mono-Red Enabler):** Adds 3 pure Attack tiles (`19` total DMG) to guarantee frequent Attack Surges. |
| `tezka_brokovnice` | Breacher Shotgun | Rare | Weapon | **5** | 55 | `ATK 9, 9, DEF 7` | **32.4** | **10.80** | **6.48** | **A (Heavy Payload):** Heavy `Size 5` cost forces unequipping a starter item on Kira (`3 + 5 + 4 = 12/12`), trading weight for elite per-tile density. |
| `takticky_stit` | Ballistic Buckler | Common | Armor | **3** | 35 | `DEF 9, 9` | **19.4** | **9.70** | **6.47** | **B (Fortress Enabler):** Gives Aurelia `5` total DEF tiles (`DEF 9, 9, 7, 6, 6`) for near-guaranteed Defense Surges (`+8` Surge + `8` Riposte = `16` counter DMG!). |
| `nano_ostri` | Mono-Blade Pair | Common | Weapon | **2** | 34 | `ATK 7, 6` | **19.9** | **9.93** | **9.93** | **A (Compact Strike):** Lean Size-2 dual-attack package that reaches Attack Surge without board bloat. |
| `kryo_kondenzator` | Cryo-Purge Module | Common | Tech | **2** | 32 | `OD +15%/-2 COR`, `DEF 6` | **21.6** | **10.80** | **10.80** | **A (Cleanse & Charge):** Counters Corrode stacks while fueling fast Overdrives. |
| `pulzni_kuse` | ARC Rail-Carbine | Rare | Weapon | **3** | 46 | `ATK 8, 6`, `Shred 10 + 4` | **36.8** | **12.25** | **12.25** | **S (Anti-Armor Hybrid):** Pairs punchy red tiles with AoE armor shred on TECH turns. |
| `energeticky_konvertor` | Aegis Converter | Rare | Tech | **2** | 38 | `SHD 5 + 22% DMG`, `ATK 5` | **25.7** | **12.85** | **12.85** | **S (Tempo Catalyst):** Compact Size-2 upgrade adding both Shielding and DMG Boost on TECH turns. |
| `reaktivni_pancir` | Reactive Exo-Plate | Rare | Armor | **4** | 48 | `DEF 10, 8`, `ATK 6` | **28.6** | **9.54** | **7.16** | **A- (Fortress Plate):** Anchor defensive plating with a punchy counter-attack tile. |

### B. Horizontal vs. Vertical Progression Rules
1. **Implants Are Horizontal Rule-Changers (Hard-Capped at `MAX_IMPLANTS = 4`):**
   * Implants like *Surge Resonator* (`3+` Surge threshold), *Synapse Overclock* (`+3 SHD` per TECH tile), *Mono-Wire Edge* (`+2 DMG` on Held ATK), and *Aegis Capacitor* (`50%` Shield retention) change **how you play the 6-slot board**.
   * Because sockets are capped at `4`, acquiring a 5th implant at a later Cyber-Clinic requires **replacing an existing socket**, bounding the player's maximum simultaneous triggers.
2. **Additive Stacking Only:**
   * Multiple `damage_boost` tiles stack **additively** (`42% + 42% = +84%`), and flat bonuses (*Plasma Amplifier* `+2`, *Mono-Wire Edge* `+2`, Kira's *Cyber-Momentum* `+1`) add to `baseDamage` **before** the single `(1 + damageBoostPct / 100)` multiplier is applied.
3. **No Infinite Action Loops & Capped Bio-Med Overclock:**
   * Overdrive (`0 AP` free action) resets `overdrive` to `0` immediately on use and **cannot generate Overdrive from its own resolution**, ensuring at least 1 full tile-resolution turn between Overdrives.
   * Bio-Med Bay `tile_overclock` is hard-capped at **`MAX_OVERCLOCK_STACKS = 2`** (`+1 ATK` per stack to the first 2 Attack tiles, `+20%` Overdrive, Corrode cleanse), preventing runaway multi-Med-Bay Attack scaling.
   * Encounter `2★`/`3★` mastery objectives award prestige Score & Nanites (`totalNanites` is tracked as a prestige trophy counter) with **`0` bonus Credits** so single-run shop scarcity remains tight.

---

## 5. Designing Enemies & Encounters as Tactical Puzzles

In NEON BREACH, enemies act as **deterministic "Moving Locks"** governed by the full specification in [`ENEMY_DESIGN_PRINCIPLES.md`](./ENEMY_DESIGN_PRINCIPLES.md): **Direct / Conditional / Delayed Intent Telegraphs**, **Reactive AI Triggers (`Stagger`, `Enrage-on-Alone`, `Phase Gate`)**, **Board Interaction (`Tile Hex`, `Caustic Slag`)**, and **Turn-1 Breathing Room (Rule of Three + Threat Cap)**.

| Enemy Archetype & Role | Base HP / ARM / Pips | Intent Cycle (`intentCycle`) | Core Rules & Reactive Triggers | How the Player Solves the Lock |
| :--- | :---: | :--- | :--- | :--- |
| **Spore Mite** (`larva`)<br>*The Chaff · Positional* | `9 HP` / `0 ARM` / `0 Pips` | `1.` Attack `3`<br>`2.` Acid `3` (`+1 COR`)<br>`3.` Attack `4` | **Bio-Rupture:** On KO, deals **6 Pierce DMG** to all other living enemies. | Pop it early to detonate `6` Pierce onto backliners and crack ally Shield Pips without triggering Retaliation. |
| **Cobalt Skitter** (`skitter`)<br>*The Anchor · Support* | `14 HP` / `2 ARM` / **`1 Pip`** | `1.` Bolster **`+4 ARM (All)`**<br>`2.` Attack `5`<br>`3.` Leech `5` (`+3 HP`) | **Aegis Shell + Enrage on Alone:** Starts with `1 Pip`. If left as the lone survivor of a multi-unit squad, drops `bolster`, gains **`+2 ATK`**, and attacks. | Strip its `1` Shield Pip first (`Bio-Rupture`, `Riposte`, `Tech Pierce`, `Cleave`, `OD`), or **Push (`[R]`)** past it. |
| **Pyre Stinger** (`stinger`)<br>*The Time-Bomb · Scaler* | `16 HP` / `0 ARM` / `0 Pips` | `1.` Charge (`0 DMG`, 2T)<br>`2.` Charge (`0 DMG`, 1T)<br>`3.` Heavy **`16 DMG`** | **Thermal Countdown + Broken Stance:** Dealing **`>= 16` single-turn DMG** **Staggers** `Charge`/`Heavy` to **`0 DMG`** (`Charge` resets to `2T`). | **Push (`[R]`)** it to Slot 0, burst it down before Beat 3, or land `16+` DMG to Stagger its detonation. |
| **Chitin Stalker** (`stalker`)<br>*The Punisher · Taxer* | `24 HP` / `0 ARM` / `0 Pips` | `1.` Attack `6`<br>`2.` Attack `7` (**`+4`** if `0 SHD`)<br>`3.` Armor `+4` | **Spike Retaliation + Opportunist:** Deals **3 DMG** back if hit by a **non-Surge Attack** and survives. Beat 2 hits for `11 DMG` if you end with `0 Shield`. | Alpha-strike in 1 hit, bypass via **`4+`/`3+` Attack Surge** or `Riposte`, and retain/gain Shield on Beat 2. |
| **Bile Spitter** (`spitter`)<br>*The Disrupter · Polluter* | `22 HP` / `0 ARM` / `0 Pips` | `1.` Acid `5` (`+2 COR + Jam/Slag`)<br>`2.` Leech `6` (`+4 HP`)<br>`3.` Acid `6` (`+2 COR + Jam/Slag`) | **Acid Jam + Slag + Tile Hex:** Unblocked `acid` **Jams 1 tile** & adds `1 Caustic Slag` (`2 DMG` end-of-round hold burn; exhausted by `TECH`/`OD`). Turn 2+ casts **`⬡ HEX`** (`+4 HP / +3 ARM` if resolved while alive). | Full-block `acid` with Shield to stop Jam + Slag; kill caster, hold color, or Overdrive to break `⬡ HEX`; play `TECH`/`OD` to purge Slag. |
| **Carapace Brute** (`brute`)<br>*Threshold Tank · Check* | `38 HP` / `8 ARM` / **`1 Pip`** | `1.` Armor `+6`<br>`2.` Heavy **`13 DMG`**<br>`3.` Attack `8` | **Carapace Pip + Broken Stance:** `1 Pip + 8 ARM`. `>= 16` single-turn burst while priming `Heavy 13` **Staggers** it to `0 DMG`. | Two-step solve: crack its `1 Pip`, then shatter Armor (`Attack Surge` or `Armor Shred`) or **Stagger** Beat 2. |
| **Xenomorph Matriarch** (`boss`)<br>*Apex Taxer · Phase Lock* | `110 HP` / `10 ARM` / **`1 Pip`** | `1.` Armor `+10`<br>`2.` Attack `11` (**`+4`** if `ATK`)<br>`3.` Acid `8` (`+2 COR + Jam/Slag`)<br>`4.` Heavy **`18 DMG`** | **50% Phase Gate + Hex + Tax:** Locks at `55 HP` (`+1 Pip`, `+10 ARM`). Beat 2 taxes `Attack` turns (`+4 DMG`); casts **`⬡ HEX`** Turn 2+; `16+` burst **Staggers** `Heavy 18`. | Pace two phases cleanly: weave `TECH`/Defense on Beat 2, break `⬡ HEX` via Overdrive or timing, and Stagger Beat 4 `Heavy 18`. |

### Anti-Turtling, Disruption Rewards & Soft Enrages
* **`corrode`, `Caustic Jam` & `Caustic Slag`:** Unblocked `acid` injects `+2 Corrode`, jams 1 board tile, and adds 1 exhaustible `Caustic Slag` (`0` value, `2` round-end chip if left on board, purged permanently on `TECH` or `Overdrive`). Full-blocking with Defense Shields negates all disruption.
* **Broken Stance (`Stagger >= 16`):** Rewards aggressive burst turns by canceling `Charge` and `Heavy` intents into `0 DMG` recovery beats.
* **Score & Turn Economy:** Victory rewards, `Par Caches`, and `Tempo Streaks` (`+2 CR` per aggressive turn) reward decisive clearances.

---

## 6. Practical Playtesting & Iteration Workflow

### A. The "Baseline Bot" TTK & Damage-Taken Model
When tuning numbers in `src/engine/data.ts`, verify that a **Baseline Bot** (playing highest-EV color without perfect RNG) stays within **20–30% of the target TTK** across the whole campaign:

| Benchmark Matchup | Operative Build | Avg Output / Turn | Expected Enemy EHP | Expected TTK | Expected HP Lost | Target Window |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Sector 1 Skirmish**<br>(`Mite 9 + Stalker 20`) | **Starter Kira** (`113.4 TPU`, 9 tiles) | `~11.5 DMG/t` *(TECH T1 → Pop Mite → Surge/OD)* | `29 HP` *(effectively `23` after `6` Bio-Rupture)* | **2.2 – 3.2 Turns** | `3 – 8 HP` | `2.0 – 3.5 Turns` |
| **Sector 1 Skirmish**<br>(`Mite 9 + Stalker 20`) | **Starter Aurelia** (`113.8 TPU`, 9 tiles) | `~12.0 DMG/t` *(ATK + Riposte DEF)* | `29 HP` *(effectively `23`)* | **2.0 – 2.5 Turns** | `0 – 3 HP` | `2.0 – 3.0 Turns` |
| **Sector 3 Elite**<br>(`Brute + Spitter`, L2) | **Mid-Run Build** (`+1 Weapon/Armor`, `1 Implant`) | `~21.0 EHP/t` *(incl. Surge Cleave + 1 OD)* | `80 EHP` (`46` Brute + `26` Spitter + `8` ARM + `1` Pip) | **4.2 – 4.8 Turns** | `10 – 16 HP` | `4.0 – 5.5 Turns` |
| **Sector 5 Boss**<br>(`Matriarch`) | **Endgame Build** (`11–13` tiles, `2–3 Implants`) | `~24.0 EHP/t` *(Boosted ATK + 1–2 ODs)* | `140–155 EHP` (`110 HP` + `20–40` ARM + `2` Pips + `50%` Gate) | **5.5 – 6.5 Turns** | `15 – 24 HP` | `4.5 – 6.5 Turns` |

### B. Iteration Rules for Future Patches
1. **The Rule of 30–50% (Find the Boundary Fast):**
   * When an implant, tile, or enemy intent feels weak or oppressive, **do not tweak it by `±5%`**. Shift the parameter by **30–50%** (e.g., changing Defense Surge reflect from `6 → 9`, or `corrode` from `2 → 3`) in unit/browser tests to immediately feel where the mechanic breaks, then dial it back to the sweet spot.
2. **Diagnose Pick Rate vs. Setup Friction:**
   * **High Pick Rate + Trivializes Fights:** Increase equipment `size` (`+1` Load) or `price` (`+10 CR`) before nerfing the signature effect so the item remains exciting but carries a real loadout cost.
   * **Low Pick Rate:** Check **setup friction** first. If an item adds too many low-value filler tiles (diluting the 6-slot board), consolidate its value into **fewer, denser tiles** rather than just adding more weak tiles.
3. **Preserve Multi-Piece "Clever Combos":**
   * A player who assembles **3–4 specific pieces**—such as **Kira (`+1` Held passive) + *Mono-Wire Edge* (`+2` Held ATK) + *Surge Resonator* (`3+` Surge) + *Breacher Shotgun* (`ATK 9 ×2`)**, or **Aurelia (`2/tile` Riposte + `5` Shield retain) + *Ballistic Buckler* (`DEF 9 ×2`) + *Nano-Weave* (`+2` DEF) + *Kinetic Reflector***—*should* feel unstoppable. Balance is only broken when a **single** item or starter kit wins the run on its own.

---

## 7. Quick Reference Formula for New Content

When adding a new tile or equipment item in `src/engine/data.ts`, compute its TPU budget before committing:

```text
Tile TPU ≈
  (ATK_Value × 1.22)
+ (DEF_Value × 0.85)
+ (HEAL_Amount × 1.65)
+ (DMG_Boost_Pct × 0.32)
+ (Is_Tech ? 6.3 : 2.0)   // Overdrive + Surge contribution
```

* **Target Per-Tile Density:**
  * Starter filler tile: **`5.0 – 7.5 TPU`**
  * Standard equipment tile: **`8.0 – 11.5 TPU`**
  * Rare / build-around tile: **`12.0 – 18.0 TPU`** *(never exceed `18.5 TPU` on a single tile)*
* **Target Equipment Weight Efficiency (`Total TPU / Size`):**
  * Starter gear (`Size 1–3`): **`8.0 – 13.0 TPU / Size`**
  * Common shop/loot gear (`Size 2–4`): **`6.5 – 11.0 TPU / Size`**
  * Rare build-around gear (`Size 2–5`): **`6.5 – 13.0 TPU / Size`** *(heavier `Size 4–5` items trade `TPU / Size` for high **per-tile density** `> 10.5 TPU / tile`)*

---

## 8. Six-Enemy Sky-Bridge & Advanced Tactical Puzzle Mechanics

See [`ENEMY_DESIGN_PRINCIPLES.md`](./ENEMY_DESIGN_PRINCIPLES.md) for the complete enemy design constitution:

* **Six-Slot Sky-Bridge (`MAX_ACTIVE_BRIDGE_ENEMIES = 6`):** Supports up to **6 simultaneous active enemies/props** with adaptive lane geometry (`getEnemyLaneMetrics`) so 1–6 units render and target cleanly.
* **Advanced Hand & Deck Manipulation:**
  * **Hot Potato (`isHotPotato` / `💣 PASS 8`):** Unresolved at round end = **`6 DMG` to heroine**; resolved (`1 AP` color commit) = **`8 Pierce DMG` to front living enemy**.
  * **Positional Contagion (`isContagion` / `🦠 TRAP`):** Resolving a Contagion tile also discards adjacent non-matching board slots (`idx - 1` / `idx + 1`).
  * **Temptation Bargain (`isTemptation` / `⚡ +14 ALL`):** Resolving grants **`+14 Bonus Cleave DMG` to all enemies** at the cost of injecting **`2 Caustic Slag`** curses.
  * **Top-Deck Manipulation (`TOP DRAW`):** Acid sabotage places `Caustic Slag` directly at `drawPile[0]`, visible in `Upcoming Draws`.
* **Dynamic Win Conditions:**
  * **Loot Runner (`isLootRunner`):** `3T` warp channel (`0 DMG`); killing before warp awards **`+25 CR` Bonus Bounty**.
  * **Mercy Target (`isMercyTarget`):** Sparing a hijacked Med-Drone while eliminating all hostiles triggers immediate **Mercy Victory (`+6 HP` & `+15 CR`)**.
  * **Tug-of-War Meter (`tugOfWarMeter`):** Starts at `50%`; reaching `100%` (`+2%` per player DMG dealt, `-3%` per unblocked enemy HP DMG) triggers **Neural Purge** (Staggers all living enemies + **`+25% Overdrive`** + **`+10 CR`**).
  * **Sleepwalker (`sleepCounter`):** Dormant (`0 DMG`); `Defense` and `TECH` plays do not wake it, while each damaging `Attack` hit decrements `sleepCounter` by `1`.
* **Fairness Hacks & Environment Props:**
  * **Turn 1 Grace Period**, **Desperation Telegraph (`<= 20% HP` -> `🔥 +3 DMG`)**, **Overkill Weapon-Break (`>= 22 DMG` burst -> `🔨 -3 DMG` permanent)**, **Symmetrical Battlefield Rules (`volatile_atmosphere` / `magnetic_surge`)**, and **Props (`plasma_barrel` `10 Pierce AoE + 20% OD`, `decoy_totem` `5 HP / 1 Pip`, `bio_husk` `2T` corpse persistence)**.
