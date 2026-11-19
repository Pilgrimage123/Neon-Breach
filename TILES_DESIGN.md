# NEON BREACH — Tactical Tile Architecture & 12-Stage Grand Metropolis Sector Map

> **CORE ARCHITECTURAL RULE: Remember there are ONLY TILES in this game.**
> Every combat resolution, pool cycle, upgrade, bloodline synergy, neonatal incubation pod, dual-channel splice operation, and generational heirloom in *Neon Breach* operates exclusively on **Tactical Tiles** (`attack`, `defense`, `tech`) inside the **Master Tile Pool** (`masterPool`) and on the **6-Slot Tactical Tile Board** (alongside **AI Skill Chips** that inject specialized Tiles into the pool).

---

## 1. Fundamental Tile Paradigm (Pure Tactical Tiles)

In *Neon Breach*, every player action revolves around **Tactical Tiles**:
1. **Master Tile Pool (`masterPool`)**: The heroine maintains a persistent **Master Tile Pool** composed of 5 permanent **Innate Core Tiles** plus specialized Tiles injected by equipped **AI Skill Chips** up to her **Carry Capacity**.
2. **6-Slot Tactical Tile Board (`combat.board`)**: Each combat turn draws up to 6 **Tiles** onto the active board. Committing a Tile color (`ATTACK`, `DEFENSE`, or `TECH`) resolves all unjammed Tiles of that color simultaneously; resolving **4+ Tiles** of the same color triggers a **Surge**.
3. **Advanced Tile Attributes**:
   - **Value (`value`)**: Raw tactical output (damage or shield barrier) of the Tile.
   - **UpCharge (`upcharge` ⚡)**: Supercharges a Tile (`+2` output per stack, up to `⚡3`) and can be passed onto future board draws.
   - **Dual-Channel Hybrid Spliced Status (`secondaryType` + `secondaryValue`)**: Created in the **Open-Source FabLab** by splicing two Tiles together. When resolved as its primary color on the 6-slot board, a Dual-Channel Hybrid Tile **simultaneously fires its secondary channel** (e.g. an Attack Tile spliced with Defense generates immediate Aegis Shield on the same turn; a Defense Tile spliced with Attack fires an Armor-Piercing Twin Strike!).
   - **Prodigy Status (`prodigyTileIds`)**: Tiles enrolled in the **Charter Academy** lose any starter Dud penalty, gain `+3` Base Value and `+1 UpCharge (⚡)`, and gain **+1 Value for every 2 turns held on the 6-slot board**, while buffing adjacent Innate Tiles in the Master Tile Pool by `+1`.
   - **Next-Gen Incubated Status (`maturedNextGenTiles`)**: Tiles gestated across 3 map nodes in the **Ectogenesis Stork Nursery** hatch as **Next-Gen Apex Tiles** with **2x Base Value**, `+1 UpCharge (⚡)`, and an **Inherited Genetic Trait** (`upcharge`, `pierce_boost`, or `shield_aura`).

---

## 2. Optimistic Civic-Tech & Pro-Family Dynasty Tile Mechanics

*Neon Breach* blends **optimistic civic-tech makerspaces** with **pro-family, multi-generational cyber-dynasties**:

### A. Generational, Genetic & Makerspace Tile Nodes (`CyberClinicView`)
* **Ectogenesis Stork Nursery (`stork_nursery`) — 3-Node Tile Incubation**:
  - Place any **Tile** into a neonatal biotech gestation pod.
  - The Tile leaves your Master Tile Pool for **3 Sector Map nodes** while growing, then returns as a **Next-Gen Apex Tile** with **doubled base stats (`2x`)**, `+1 UpCharge (⚡)`, and an inherited secondary trait (`upcharge`, `pierce_boost`, or `shield_aura`).
* **Gene-Splice Pedigree Lab (`pedigree_lab`) — Bloodline Tile Crest**:
  - Marry two distinct **Tile Colors** (`ATTACK ⚭ DEFENSE`, `ATTACK ⚭ TECH`, or `DEFENSE ⚭ TECH`) into a unified **Family Bloodline Crest**.
  - Resolving one married color primes **Bloodline Resonance** (`+2 Value` per Tile or `+15% Tech Boost`) for its partner color AND **immediately supercharges all partner-color Tiles currently sitting on the 6-slot board with `+1 UpCharge (⚡)`**!
* **Charter Academy (`charter_academy`) — Youth Prodigy Tile Mentorship**:
  - Enroll a **Tile** into the cyber-academy (`15 CR` or `0 CR` at a Funded Clinic). Enrolled Tiles become **Prodigy Tiles** (`+3 Value`, `+1 UpCharge ⚡`, and `+1 Value` per 2 turns held on the 6-slot board).
* **Open-Source FabLab (`open_fablab`) — Dual-Channel Hybrid Tile Splicing**:
  - Fork and merge two **Tiles** into one custom **Dual-Channel Hybrid Tile** that combines their values, gains `+1 UpCharge (⚡)`, and triggers its donor Tile's secondary channel (`secondaryType` + `secondaryValue`) whenever resolved on the 6-slot board.
* **Upcycle Kiosk (`upcycle_kiosk`) — Dynamic Starter Tile Recycling**:
  - Recycle a bloated starter/Dud **Innate Tile** into raw bandwidth, permanently buffing adjacent Tiles in your Master Tile Pool.

### B. Domestic, Automation & Cross-Run Dynasty Nodes (`ChipDealerView` & `BioMedBayView`)
* **Smart-Hearth Compound (`smart_hearth`) — Multi-Generational Penthouse**:
  - Spend time with your multi-generational household:
    1. **Grandparents' Wisdom (`hearth_grandparents`)**: Educate a starter/Dud Innate Tile into a **Prodigy Tile**, gain `+1 Overclock`, cleanse all Corrode, and restore `+12 HP`.
    2. **Spouse's Synergy (`hearth_spouse`)**: Forge an `ATTACK ⚭ DEFENSE` **Bloodline Tile Crest** (`+2 Resonance Value` + board auto-UpCharge) and restore `+14 HP`.
    3. **The Kids' Vitality (`hearth_kids`)**: Restore `+22 HP`, gain `+25% Overdrive`, and activate **Kids' Vitality Boost** for the next 2 combats (`+20% Starting Overdrive` & `+1 Pending UpCharge ⚡` on Round 1).
* **Nanny-Bot Showroom (`nanny_showroom`) — Persistent Domestic Drones**:
  - Adopt persistent domestic robotics that automate defense and Tile tutoring at the start of every combat turn:
    - **Guardian Nanny-Bot (`guardian_nanny`)**: Passively generates `+3 Aegis Shield` every turn.
    - **Caretaker Nanny-Bot (`caretaker_nanny`)**: Automatically cleanses `1 Corrode` and unjams `1 Jammed Tile` on the 6-slot board every turn.
    - **Tutor Nanny-Bot (`tutor_nanny`)**: Automatically grants `+1 UpCharge (⚡)` to your highest-value uncharged Tile on the 6-slot board every turn.
* **Beta-Test Arcade (`beta_arcade`) — Experimental AI Skill Chip Trial**:
  - Claim a free experimental **AI Skill Chip** (and its injected **Tiles**) for **2 combats**. Resolving `5+ Tiles` across those fights logs telemetry data and permanently upgrades your Master Tile Pool (`+1 Overclock`).
* **Heirloom Forge (`heirloom_forge`) — Cross-Run Descendant Inheritance**:
  - Engrave an owned **AI Skill Chip** as a **Family Heirloom**. Its injected **Tiles** gain `+1 Value` for every combat won this run, and the engraved Heirloom is persisted in `localStorage` so your **Descendant** inherits those accumulated Tile buffs on future runs.

### C. High-Society & Civic Relay Nodes (`CyberEventView`)
* **Matchmaker’s Gala (`matchmakers_gala`)**:
  - Forge an alliance with **House Solaris** (`+2 Attack Tile Value` & `+40 CR Dowry`), **House Valkyr** (`+3 Defense Tile Value`, `+1 Free Cyber Implant`, & `+25 CR Dowry`), or engrave a **Dynasty Heirloom** (`+2 Heirloom Stacks`).
* **Mutual-Aid Co-op (`mutual_aid_coop`) & Synth-Rave (`synth_rave`)**:
  - Withdraw `+45 CR` from the neighborhood co-op under a **Bandwidth Vow**, donate `20 CR` for a free **Cyber Implant + +2 Nanites**, or sync your Tile Pool tempo to the **Algo-Rave Beat** (`algo_rave_surge`: every 3rd Tile resolved in combat grants `+1 Pending UpCharge ⚡` for 3 nodes).
* **Maternal / Paternal Vanguard Escort (`vanguard_escort`) & Data Liberation (`data_liberation`)**:
  - Protect a **Neonatal Bio-Cradle** (`18 HP`) during Elite encounters. Keeping the Bio-Cradle intact awards **`+25 CR`**, unlocks the **Dynasty Vanguard Relic** (`+1 Attack/Defense Tile Value` per 6 Tiles in your Master Tile Pool), and **liberates downstream Clinic, Med-Bay, and Chip Dealer nodes** (`Funded Clinic 0 CR` / `35% Flash Sale`)!

---

## 3. 12-Stage / 32-Node Grand Metropolis Sector Map (`mapGenerator.ts` & `SectorMapView.tsx`)

The Sector Map spans a **12-Stage / 32-Node Grand Metropolis Expedition** (`Layers 0 → 11`) divided into **4 Named Metropolis Districts**:

| District | Stages | Featured Optimistic Civic-Tech & Pro-Family Dynasty Nodes |
| :--- | :--- | :--- |
| **I. Civic Makerspace Quarter (`DIST-I`)** | **Stages 01–03 (`L0–L2`)** | Entry Breach, **Open-Source FabLab**, **Upcycle Kiosk**, **Beta-Test Arcade**, **Mutual-Aid Co-op**, **Data Liberation Elite** |
| **II. Neonatal & Pedigree Commons (`DIST-II`)** | **Stages 04–06 (`L3–L5`)** | **Ectogenesis Stork Nursery**, **Gene-Splice Pedigree Lab**, **Charter Academy**, **Maternal Vanguard Escort**, **Nanny-Bot Showroom** |
| **III. Dynasty Sky-Domes & Gala (`DIST-III`)** | **Stages 07–09 (`L6–L8`)** | **Matchmaker’s Gala**, **Suburban Dome Charter**, **Heirloom Forge**, **Synth-Rave**, **AR Holo-Graffiti Wall**, **Mag-Lev Hub** |
| **IV. Sovereign Citadel Approach (`DIST-IV`)** | **Stages 10–12 (`L9–L11`)** | **Smart-Hearth Penthouse**, **Paternal Vanguard Escort**, Pre-Boss Armory, **Xenomorph Matriarch Apex Finale (`n_11_0`)** |

### Active Route Manipulation on the 12-Stage Sector Map:
1. **4-District Metropolis Navigator Bar**: Jump smoothly between Districts I–IV or auto-center on your active Stage.
2. **Mesh-Net Relay Reroute (`2/Run` on 12-Stage Map)**: Rewire a connection line to jump across disconnected branches in the next Stage.
3. **Mag-Lev Express Line (`+25 CR`, `-2 Corrode`, `+1 Stork Incubation Step`)**: Bridge directly to a node **2 Stages ahead** (`L+2`).
4. **Suburban Dome Estate Charter (`20 CR`)**: Establish a **Family Estate** on the next Stage (`+5 HP` immediately, plus `+12 CR & +5 HP` dividend whenever entering a node on that Stage).
