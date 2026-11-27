# NEON BREACH — Tactical Tile Architecture & 12-Stage Grand Metropolis Map

> **CORE ARCHITECTURAL RULE: Remember there are ONLY TILES in this game.**
> Every combat resolution, pool cycle, upgrade, Family Crest synergy, Guild Apprenticeship training, FabLab splice, and Family Heirloom in *Neon Breach* operates exclusively on **Tactical Tiles** (`attack`, `defense`, `tech`) inside the **Master Tile Pool** (`masterPool`) and on the **6-slot Board** (`combat.board`), paired with **AI Skill Chips** that inject specialized Tiles into the pool.

---

## 1. Fundamental Tile Paradigm

1. **Master Tile Pool (`masterPool`):** Each Hero maintains a persistent Master Tile Pool built from her **Innate Core Tiles** (`5` for Kira and Zuri, `6` for Auraline including 3 Duds) plus Tiles injected by equipped **AI Skill Chips** up to her **Memory** budget (`12` / `14` / `13`).
2. **Board (`combat.board`):** Draws `6` Tiles per Turn by default (`BOARD_CAPACITY = 6`), expandable up to `9` via **UpCharge** (`MAX_UPCHARGE_BOARD_CAPACITY = 9`). Committing one color (`Attack`, `Defense`, `TECH`) resolves all unjammed Tiles of that color together; `4+` matching Tiles (`3+` with *Surge Resonator*) trigger a **Stack Surge**.
3. **Tile Modifiers & Traits:**
   - **Base Value (`value`):** Primary damage or Shield output.
   - **UpCharge (`upcharge` ⚡):** Each `⚡` on a resolved Tile adds `+1` to `pendingUpcharge`, drawing `+1` extra Tile onto the Board on the **next Turn** (total Board size capped at `9`). Does **not** add flat `+2` tile output.
   - **Dual-Channel Hybrid (`secondaryType` + `secondaryValue`):** Created in the **Open-Source FabLab**; fires its secondary channel alongside its primary color when resolved.
   - **Prodigy Tile (`prodigyTileIds`):** Innate Tiles enrolled at the **Charter Academy** (or **Smart-Hearth Grandparents**) gain `+3` Base Value (minimum `6`), `+1` UpCharge, and `+1` to all other non-Dud Innate Attack/Defense Tiles.
   - **Apprenticeship-Trained Tile (`maturedNextGenTiles`):** Tiles trained via **Guild Apprenticeship** return after `3` Nodes at **`2×` Base Value**, `+1` UpCharge, and their **Craft Trait** (`upcharge` extra `+1` draw, `pierce_boost` Armor-piercing attacks, or `shield_aura` `+3` Shield on play).

---

## 2. Civic-Tech & Dynasty Tile Facilities

### A. Restorative Clinic (`CyberClinicView`)
* **Guild Apprenticeship:** Place a Tile into craft-guild training for **3 map Nodes**; it returns at **`2×` value**, `+1` UpCharge, and its craft trait (`upcharge`, `pierce_boost`, or `shield_aura`).
* **Heraldry Bench (`Family Crest`):** Pair two Tile colors (`ATK ⚭ DEF`, `ATK ⚭ TECH`, or `DEF ⚭ TECH`). Resolving one paired color primes **Crest Resonance** (`+2` flat bonus and `+1` UpCharge) for the partner color on the Board.
* **Charter Academy:** Enroll an Innate Tile (`15 CR`, `0 CR` when funded) to gain **Prodigy** status (`+3` Base Value, min `6`, `+1` UpCharge, and `+1` to sibling non-Dud Innate ATK/DEF Tiles).
* **Open-Source FabLab:** Merge two Innate Tiles (`target` + `consumed`) into a **Dual-Channel Hybrid Tile**, absorbing `ceil(consumed * 0.75)` primary or `ceil(consumed * 0.65)` secondary output plus `+1` UpCharge.

### B. Family Hearth (`BioMedBayView`) & Chip Dealer (`ChipDealerView`)
* **Family Hearth Smart-Hearth Compound:**
  1. **Grandparents (`hearth_grandparents`):** Promotes an Innate Tile to **Prodigy**, grants `+1` Overclock, cleanses all Corrode, and restores **`+12 HP`**.
  2. **Spouse (`hearth_spouse`):** Establishes an `ATK ⚭ DEF` **Family Crest** (`+2` Resonance Value) and restores **`+14 HP`**.
  3. **The Kids (`hearth_kids`):** Restores **`+22 HP`**, grants **`+25%` Overdrive**, and activates *Kids' Vitality Boost* for the next **2 Nodes** (`+4` Start Shield & `+25%` Starting Overdrive).
* **Chip Dealer Nanny-Bot Showroom:**
  - **Guardian Nanny (`guardian_nanny`):** Grants **`+5` Start-of-Combat Shield** and **`+4` Turn-End Shield**.
  - **Caretaker Nanny (`caretaker_nanny`):** Cleanses **`-1` Corrode** and heals **`+2 HP`** every Turn end.
  - **Tutor Nanny (`tutor_nanny`):** Grants **`+1` bonus Tile draw** on Turn 1 of every combat.
* **Beta-Test Arcade:** Claim a temporary **AI Skill Chip** for **2 combats** (`0 CR`). Resolving `5+` Tiles grants `+1` Overclock (`MAX_OVERCLOCK_STACKS = 2`). Un-upgraded trials expire after their 2nd combat.
* **Heirloom Forge:** Once per Chip Dealer visit (`25 CR`), engrave a chosen owned AI Skill Chip as a **Family Heirloom** (`+1` Tile value per combat win, capped at `+6`, persisted across Runs in `v2` best records).

### C. Civic Feasts & Escorts (`CyberEventView` & Elite Nodes)
* **Happy Wife Day Square:** Ally with **House Solaris** (`+45 CR`, `+25%` DMG Boost, `+2` Attack bonus) or **House Valkyr** (`+18 HP`, Free Tactical Module, `+3` Defense bonus), or toast for `+35%` OD & `+20 CR`.
* **Three-Day Man Day Shift:** Take a Free Tactical Module under a **Guild Shift Pledge** (`-25%` Combat Credits for 2 Nodes), sync **Workshop Shift Cadence** (`+15 CR` & `+2` Turn-1 extra draw for 3 Nodes), or share guild tools (`+30 CR` & `+10 HP`).
* **Nuclear & Homecoming Day / National Borders Day:** Bless a Family Heirloom (`+2` Heirloom stacks, `+12 HP`), celebrate the Homecoming Table Feast (`+24 HP`, `+30%` OD), or muster the Bridge Watch (`+25%` DMG, `+30%` OD) and Fortify the Gatehouse (Free Tactical Module, `+10 HP`).
* **Parish Bio-Cradle Escort:** Elite nodes deploy an `18 HP` **Parish Bio-Cradle**. Keeping it intact for `2` Turns awards `+25 CR`, unlocks the **Guild Vanguard Module** (`+1` ATK/DEF per `6` Tiles in `masterPool`), and funds downstream Shops/Clinics.

---

## 3. 12-Stage / 32-Node Grand Metropolis Route Map

Standard runs generate a **12-Stage / 32-Node Metropolis** (`Stages 01–12`) across **4 Districts**:
1. **District I — Sunlit Workshops & Market (`Stages 01–03`):** Modular Nuclear Core · Craft Guilds · Bakeries
2. **District II — Greenhouse Commons & Academy (`Stages 04–06`):** Restorative Clinic · Guild Craft · Heraldry
3. **District III — Chrome Sky-Gardens & Domes (`Stages 07–09`):** Happy Wife Day · Nuclear Day · Heirloom Forge
4. **District IV — Dr. Lindqvist’s Overgrown Citadel (`Stages 10–12`):** Family Hearth · Border Watch · Lindqvist’s Matriarch

*(Compact 5-Stage / 11-Node routes remain explicitly selectable via `mapLength: 'compact'` for quick scenarios and unit tests.)*

### Route Tools
1. **4-District Navigator Bar:** Jump across Districts I–IV or focus the active Stage.
2. **Mesh-Net Reroute (`2/Run` on Metropolis map):** Bridge across disconnected lanes into the next Stage.
3. **Mag-Lev Express (`+25 CR`, `-2` Corrode, `+1` Guild Apprenticeship tick):** Leap directly `2` Stages ahead.
4. **Suburban Estate Charter (`20 CR`):** Charter the next Stage for `+5 HP` immediately and `+12 CR / +5 HP` upon entering it.
