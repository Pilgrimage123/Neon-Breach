# Neon Breach

A turn-based cyberpunk tactical puzzle roguelite where cybernetic heroes defend the Neo-Prague sky-bridge against xenomorphic mutants using a 6-slot tactical tile board and modular AI Skill Chips.

## Language

### Heroes & Loadout

**Hero**:
A playable cybernetic protagonist leading a Run across the sky-bridge (Kira, Auraline, or Zuri; Czech: _Hrdinka_ / _Hrdinky_).
_Avoid_: Operative, Heroine, Agent, Operativka

**Auraline**:
The armored juggernaut Hero (`AURALINE-07`) whose high persistent Armor and Dud-to-UpCharge engine convert malfunctions into extra tile draws.
_Avoid_: Aurelia

**AI Skill Chip**:
An installable software module equipping specialized Tactical Tiles into a Hero's Master Tile Pool up to her Memory limit.
_Avoid_: Equipment, Gear, Weapon, Item

**Chip Vault**:
The Hero's stash of owned but currently unequipped AI Skill Chips.
_Avoid_: Cargo Stash, Inventory, Stash

**Memory**:
The total equip capacity budget (`RAM`) constraining which AI Skill Chips are active simultaneously (`12` Kira, `14` Auraline, `13` Zuri).
_Avoid_: Carry Capacity, Weight, Load, Size

**Chip Dealer**:
The facility node where Heroes purchase, restock, test, and heirloom-engrave AI Skill Chips and adopt Nanny-Bots.
_Avoid_: Clinic Shop, Arms Dealer, Merchant

**Cyber Implant**:
A socketed cybernetic rule-modifier (`4` sockets max) that alters how Board actions, Surges, or defenses trigger across combat.
_Avoid_: Relic, Perk, Augment

**Chip Rarity**:
The tier classification of an AI Skill Chip: **Starter** (starting loadout), **Standard** (common drop/shop), or **Prototype** (rare build-around).
_Avoid_: Common, Rare

---

### Run & Map Progression

**Run**:
A single complete attempt from Stage 01 through the Xenomorph Matriarch Boss or Defeat.
_Avoid_: Expedition, Mission, Campaign

**District**:
One of the four named civic-sector zones spanning 3 Stages each across the 12-Stage Grand Metropolis map.
_Avoid_: Act, Zone

**Stage**:
A single horizontal depth column (`Stage 01`–`Stage 12`) on the Grand Metropolis route map.
_Avoid_: Sector, Layer, Floor, Level

**Node**:
A single selectable encounter, shop, clinic, med-bay, or anomaly destination on a Stage.
_Avoid_: Room, Space

**Cyber-Clinic**:
The facility node offering Cyber Implant surgery, Innate Tile purging, Stork Nursery incubation, Pedigree Bloodline pairing, and FabLab tile splicing.
_Avoid_: Hospital, Workshop

**Bio-Med Bay**:
The recovery node offering Nano-Gel healing, Tile Overclocking, and Smart-Hearth household restoration.
_Avoid_: Clinic, Rest Site, Campfire

---

### Combat & Board

**Turn**:
One full tactical cycle: the Hero commits a single Tile color (or unleashes Overdrive first) and every surviving Mutant executes its current intent step.
_Avoid_: Round

**Tile**:
The fundamental atomic combat unit (`Attack`, `Defense`, or `TECH`) drawn from the Master Tile Pool onto the Board.
_Avoid_: Card, Piece, Ability

**Board**:
The active 6-slot tactical tray (expandable up to `9` via UpCharge) holding drawn and Held Tiles for the current Turn.
_Avoid_: Hand, Tactical Rack, Tray

**Master Tile Pool**:
The Hero's persistent deck of Innate Tiles plus Tiles injected by equipped AI Skill Chips.
_Avoid_: Deck, Active Pool

**Held Tile**:
An unresolved Tile remaining on the Board into the next Turn (`HELD`), enabling color stacking and Kira's `+1` Cyber-Momentum bonus.
_Avoid_: Stay Tile, Retained Tile

**Stack Surge**:
The bonus payoff triggered when resolving `4+` matching-color Tiles in one Turn (`3+` with Surge Resonator).
_Avoid_: Combo, Chain

**Overdrive**:
The `100%`-charged Hero ultimate maneuver (`0 AP`, does not end the Turn) that deals Armor-piercing AoE damage plus signature Hero utility.
_Avoid_: Ultimate, Limit Break

**UpCharge**:
A Tile property (`⚡`) that banks `+1` extra Tile draw onto the next Turn's Board (capped at `9` total slots).
_Avoid_: Draw Boost, Charge Power

**Dud**:
A `0`-base-value malfunction Tile that carries color for Stack Surges and Overdrive, triggering Auraline's `+1` UpCharge per Dud resolved.
_Avoid_: Blank, Dead Tile, Junk

**Push**:
The free once-per-Turn `0 AP` maneuver that swaps the front two living Mutants on the sky-bridge with zero collision damage.
_Avoid_: Swap, Reposition, Pull

**Quantized Scale**:
The optional accessibility display mode translating HP and damage values into compact `5`-unit increments.
_Avoid_: Discrete Pip Math, Pip Math

---

### Defenses & Statuses

**Shield**:
Temporary single-Turn damage mitigation gained from Defense Tiles and TECH effects that absorbs incoming damage before Armor and HP.
_Avoid_: Block, Barrier, Aegis Shield

**Armor**:
Persistent damage mitigation (held by Auraline and armored Mutants) sitting beneath Shield that absorbs hits across Turns until shredded or broken.
_Avoid_: Plating, Chitin, Mitigation

**Corrode**:
A Hero status stack that flatly subtracts from Shield gained on Defense plays (`-1` Shield per stack) until cleansed.
_Avoid_: Poison, Acid Stack

**Jammed**:
A locked status on a single Board Tile caused by unblocked Mutant acid hits or Overtime heat, preventing that Tile from resolving for one Turn.
_Avoid_: Frozen, Locked

**Caustic Slag**:
An exhaustible `0`-value hazard Tile injected into the discard or top of the draw pile by unblocked acid hits; burns for `2 DMG` if held at Turn end and purges permanently on `TECH` or `Overdrive`.
_Avoid_: Blight, Bio-Hazard, Curse

**Tile Hex**:
A targeted curse placed on a high-value Attack or Defense Tile by Bile Spitter or Xenomorph Matriarch that heals and armors the caster if resolved while the caster still lives.
_Avoid_: Curse, Mark

**Broken Stance**:
The `Staggered` state triggered when a Mutant priming `Charge` or `Heavy` suffers `16+` single-Turn damage, reducing that action to `0 DMG`.
_Avoid_: Stunned, Interrupted

---

### Mutants & Passives

**Mutant**:
A hostile xenomorphic biological enemy confronting the Hero on the sky-bridge.
_Avoid_: Bio-mutant, Bio-horror, Abomination, Xeno

**Spore Mite**:
The fragile `9 HP` frontline Mutant carrying **Bio-Rupture**.
_Avoid_: Larva, Fodder Mite

**Cobalt Skitter**:
The armored support Mutant protecting allies with **Aegis Projection** (`+4 Armor All`, `1 Aegis Pip`) that enrages if left alone.
_Avoid_: Aegis Skitter, Acid Skitter

**Pyre Stinger**:
The fragile `16 HP` ranged time-bomb Mutant charging a 2-Turn `16 DMG` Heavy blast unless Staggered or burst down.
_Avoid_: Stinger

**Chitin Stalker**:
The `24 HP` crimson punisher Mutant armed with **Spike Retaliation** and an opportunistic `+4 DMG` strike when the Hero lacks Shield.
_Avoid_: Spine Stalker

**Bile Spitter**:
The `22 HP` backline disrupter Mutant firing acid torrents, Caustic Claw Rends, **Tile Hexes**, and **Pustule Rupture** (`+2` Corrode on surviving non-Surge hits).
_Avoid_: Spitter

**Carapace Brute**:
The `2`-slot `38 HP` heavyweight tank Mutant combining `8` starting Armor, `1 Aegis Pip`, Mutagen healing, and a staggerable `14 DMG` Heavy smash.
_Avoid_: Brute

**Xenomorph Matriarch**:
The `110 HP` Stage 12 Apex Boss enforcing a **50% Phase Gate**, Attack-taxing strikes, Tile Hexes, and Bio-Husk corpse resurrection.
_Avoid_: Hive Matriarch, Sector Hive Queen, Hive Boss, Brood Queen, Apex Sovereign

**Aegis Pip**:
A discrete single-hit barrier charge on a Mutant (`1` hit = `1` Pip cracked) that absorbs the entire damage of one instance before Armor and HP can take damage.
_Avoid_: Shield Pip, Carapace Pip, Armor Pip

**Bio-Rupture**:
Spore Mite's death passive dealing `6` Armor-piercing damage to all other living Mutants (and cracking Aegis Pips).
_Avoid_: Bio-Burst, Volatile Burst

**Spike Retaliation**:
Chitin Stalker's passive punishing surviving non-Surge Attack hits with `3` immediate counter-damage (`+4` extra if the Hero has `0` Shield).
_Avoid_: Thorny Carapace, Retaliate

**50% Phase Gate**:
Xenomorph Matriarch's threshold passive locking her HP at `50%` on first crossing to deploy `+10` Armor and `+1 Aegis Pip`.
_Avoid_: Phase Lock, Phase Barrier Lock, Phase Carapace

---

### Dynasty Facilities

**Stork Nursery**:
The Cyber-Clinic neonatal pod incubating any Tile across `3` map Nodes to return it at `2×` Base Value with `+1` UpCharge and a genetic trait (UpCharge, Armor-Piercing, or Shield Aura).
_Avoid_: Incubation Bay

**Bloodline Crest**:
A married pair of two Tile colors forged at the Pedigree Lab or Smart-Hearth granting `+2` bonus value and `+1` UpCharge resonance whenever you alternate between those two colors.
_Avoid_: Color Marriage

**Prodigy Tile**:
An Innate Tile enrolled at the Charter Academy (or Smart-Hearth Grandparents) gaining `+3` Base Value (min `6`), `+1` UpCharge, and `+1` to other non-Dud Innate Attack/Defense Tiles.
_Avoid_: Mentored Tile

**FabLab Splice**:
An Open-Source FabLab operation merging a donor Tile into a target Tile to create a Dual-Channel Hybrid Tile firing both channels together.
_Avoid_: Tile Fusion

**Nanny-Bot**:
A persistent domestic support drone adopted at the Chip Dealer (`Guardian`, `Caretaker`, or `Tutor`) automating Turn defenses, Corrode/HP recovery, or Turn-1 draw boosts.
_Avoid_: Domestic Drone

**Family Heirloom**:
An AI Skill Chip engraved at the Heirloom Forge whose Tiles gain `+1` per run combat win (up to `+6`) and pass inherited power to future Runs.
_Avoid_: Legacy Chip
