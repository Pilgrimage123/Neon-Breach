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
* **Six-Slot Sky-Bridge & Turn-1 Breathing Room (`buildEncounterSpec` & `MAX_ACTIVE_BRIDGE_ENEMIES = 6`):** The sky-bridge supports **up to 6 active enemy/prop slots simultaneously** across high-threat waves, reinforcements, and battlefield props, while Turn-1 incoming damage stays capped (`3 DMG` in Layer 0, `3–5 DMG` in Layers 1–3, `0 DMG` on Boss Turn 1) so players always have agency to inspect, hold, or Push.

---

## 5. Golden Rules: "Fun" vs. "Frustrating"

1. **Always Use Soft Counters, Never Hard Immunities:**
   * Shield Pips crack to *any* hit (`Riposte`, `Bio-Rupture`, `ARC Pierce`, `Push`-assisted follow-up, light Attack). Spike Retaliation is bypassed by Surges, `TECH Pierce`, `Riposte`, or 1-hit KOs. Tile Hexes shatter instantly when the caster dies or when Overdrive fires.
2. **Reward Disruption Generously:**
   * Full-blocking `Acid` completely prevents both **Tile Jam** and **Caustic Slag** injection; full-blocking `Leech` denies enemy healing; dealing `16+` burst **Staggers** `Charge`/`Heavy` attacks to `0 DMG`; dealing `22+` burst **Weapon-Breaks** (`🔨 -3 DMG` permanent); popping `Spore Mite` or `Plasma Barrel` damages enemies behind them.
3. **Prevent Infinite Stalling (`reinforcementDirector`):**
   * `Par Caches` reward fast clears (`T3/T4/T5+`), `Tempo Streaks` pay `+2 CR` per aggressive turn, and Overtime Heat escalates gently if players stall indefinitely.
4. **Visual & Telemetry Cohesion:**
   * Every mechanic (`Conditional +4`, `⚡ STAGGER`, `🔨 WEAPON BREAK`, `⬡ HEX`, `☣ SLAG`, `💣 HOT POTATO`, `🦠 CONTAGION`, `⚡ BARGAIN`, `Aegis Pip`, `Phase Gate`) surfaces directly via high-contrast icons, color-coded stage rings, reactive enemy barks, and live **What-If Hover Previews** on both player and enemy lifebars before a single tile is committed.

---

## 6. Advanced Hand & Board Manipulation

Going beyond basic `Caustic Slag` pollution that passively sits on the board, advanced enemies turn the player's 6-slot board and draw queue into an active micro-game:

| Board / Deck Mechanic | How It Works in **NEON BREACH** | Tactical Decision & Counterplay |
| --- | --- | --- |
| **Ticking Time-Bomb Tile (`isHotPotato` / `💣 PASS 8`)** | Armed onto a board tile by `Pyre Stinger` or `Apex Sovereign`. If kept unresolved at round end, it detonates on the heroine for **`6 DMG`**. If resolved (`1 AP` color commit), the heroine **passes the bomb back** to the front living enemy for **`8 Pierce DMG`**! | Turns a dangerous end-of-turn hazard into free offensive tempo when the player commits the marked color immediately. |
| **Positional Hand Traps (`isContagion` / `🦠 TRAP` & Edge Slot Lock)** | **Contagion** infects a board tile so resolving its color also **discards adjacent non-matching board tiles (`idx - 1` / `idx + 1`)** before refilling. **Cryo Edge Lock** freezes the leftmost/rightmost slots (`#1` / `#6`). | Forces players to inspect neighboring board slots (`idx ± 1`) before committing a Contagion color, or use `Swap` / `Scry` to protect high-rank tiles. |
| **The Bargain / Temptation Tile (`isTemptation` / `⚡ +14 ALL`)** | An enemy stamps a dark pact onto a board tile: resolving its color unleashes **`+14 Bonus Cleave Damage` to ALL living enemies**, at the cost of adding **`2 Caustic Slag` (`isBlight`) curses** to the deck. | When at critical HP or facing a 6-unit bridge swarm, players agonize over whether to take the massive AoE bailout now at the cost of deck purity. |
| **Top-Deck Manipulation (`TOP DRAW` Sabotage)** | Instead of shuffling `Caustic Slag` randomly into the discard pile, `Bile Spitter` / `Acid Sabotage` places the slag **directly on top of `drawPile` (`drawPile[0]`)**, visibly previewed as the `#1` slot in `Upcoming Draws`. | Gives the player deterministic foresight that their very next draw is ruined unless they use `Scry [G]` or `Cycle` right now. |

---

## 7. Dynamic Win Conditions (Beyond "Reduce HP to 0")

Not every bridge entity is a standard fight to the death. Alternate combat goals keep runs fresh and reward utility, precision targeting, and tempo control:

| Dynamic Objective | How It Works in **NEON BREACH** | Reward & Strategy |
| --- | --- | --- |
| **The Heist / Loot Runner (`isLootRunner` / `💰 ESCAPE`)** | A non-attacking courier drone (`0 DMG` intent) channels a warp beacon for **`3 Turns`** while gaining Armor each round. At `0T`, it warps away (`escaped = true`) without hurting the player. | Pure optional DPS/Pierce check: destroying the Loot Runner before warp grants a **`+25 CR` Bonus Bounty**. |
| **The Mercy / Pacifist Puzzle (`isMercyTarget` / `🕊 MERCY`)** | A hijacked Civilian Med-Drone accompanies hostile bio-horrors, poking recklessly (`3 DMG`). Combat ends immediately in **Mercy Victory** as soon as all hostile enemies are eliminated while the Med-Drone survives! | Forces the player to block light pokes and carefully avoid lethal AoE (`Cleave`) until hostiles drop—rewarding **`+6 HP` Field Repair & `+15 CR`**. |
| **The Tug-of-War Meter (`combat.tugOfWarMeter`, `0%..100%`)** | Active in neural resonance encounters (starts at `50%`). Every point of player damage pushes it toward **`100%` (`+2%` per DMG)**; every point of unblocked enemy HP damage pulls it toward **`0%` (`-3%` per DMG)**. | Reaching **`100%` triggers Neural Purge**: immediately **Staggers all living enemies**, grants **`+25% Overdrive`**, and awards **`+10 CR`**. |
| **The Sleepwalker (`sleepCounter` / `💤 DORMANT`)** | Dormant heavy horrors start asleep (`sleepCounter > 0`, `0 DMG · SLEEPING` intent). Playing `Defense [Y]` or `TECH [G]` does **not** wake them—only damaging `Attack [R]` hits reduce `sleepCounter` by `1` (waking at `0`). | Lets slow setup decks stack Next-Turn `Boost`, `Shield`, and `Overdrive` safely before waking the beast for a 1-turn execution. |

---

## 8. Psychological Pacing & "Fairness Hacks"

Invisible guardrails and high-skill bonuses make fights feel tense without causing cheap Turn-1 deaths:

| Design Trick | Implementation in **NEON BREACH** | Why It Feels Great |
| --- | --- | --- |
| **Turn 1 Grace Period** | Heavy-hitting enemies and newly arrived reinforcements (`createReinforcementUnit`) never open on their biggest `heavy` nuke on their first active turn—automatically shifting to `strike`, `bolster`, or `charge`. | Gives players with slow setup engines a fair window to bring mitigation online. |
| **Desperation Telegraph (`desperationEnraged` at `<= 20% HP`)** | When a non-prop enemy is reduced to **`<= 20% HP`** (and survives), it panics—dropping passive `armor`/`bolster` intents and telegraphing a final **Desperation Strike (`🔥 +3 DMG`)**. | Eliminates boring "cleanup turns" where a 2-HP enemy just blocks; creates a dramatic final standoff. |
| **Shared Battlefield Rules (`combat.battlefieldRule`)** | Symmetrical sector anomalies affect **both** heroine and enemies: **`VOLATILE ATMOSPHERE` (`+25% Attack DMG` for all)** or **`MAGNETIC SURGE` (`+2 Shield / +2 Armor` on defensive gains)**. | Feels fair because the rule is symmetrical, while letting clever players exploit the modifier harder than the AI. |
| **The "Overkill" Weapon-Break Bonus (`weaponBroken` at `>= 22 DMG`)** | Dealing **`>= 22` single-turn burst damage** (`WEAPON_BREAK_THRESHOLD`) to an enemy priming `charge` or `heavy` **permanently breaks its bio-weapon (`🔨 -3 DMG` on all attacks for the rest of combat)** in addition to Staggering it! | Rewards greedy all-in burst turns over timid chip damage, turning offense into permanent mitigation. |

---

## 9. Environment & Prop Entities (Up to 6 Simultaneous Bridge Slots)

With **`MAX_ACTIVE_BRIDGE_ENEMIES = 6`**, the sky-bridge hosts interactive battlefield props and persistent corpses alongside enemy squads:

* **Explosive Plasma Barrel (`propKind: 'plasma_barrel'`, `10 HP`, `0 DMG` intent):**
  * Neutral/enemy-side volatile canister. Destroying it triggers a chain explosion dealing **`10 Pierce DMG` to ALL living enemies** and granting **`+20% Overdrive`** to the heroine!
* **Meat Shield / Decoy Totem (`propKind: 'decoy_totem'`, `5 HP`, `1 Pip`, `0 DMG` intent):**
  * A frontline holo-totem that intercepts single-target `Attack [R]` hits in front of priority backliners (`Spitter` / `Warden`), rewarding `Push [R]`, `TECH Pierce [G]`, or `Cleave Surge`.
* **Corpse Persistence / Bio-Husk (`propKind: 'bio_husk'`, `8 HP`, `reviveTimer: 2`):**
  * When a non-prop enemy dies while a backline `Apex Sovereign` (`boss`) or `Bile Spitter` (`spitter`) lives, its biomass collapses into a pulsing **Bio-Husk (`8 HP`)** for `2` turns. If not destroyed before `reviveTimer` reaches `0`, it **resurrects at `50% HP`**!

---

## 10. UI & Juice Tricks (Selling the "Smart" AI)

* **Reactive Hover Barks (`getEnemyReactiveBark`):**
  * Hovering `Attack [R]`, `Defense [Y]`, or `TECH [G]` in the Tactical Dock triggers real-time contextual enemy barks above overhead pods (`"UNSHIELDED PREY!"`, `"STRIKE ME & BLEED!"`, `"FEED MY HEX!"`, `"⚡ WEAPON BREAK!"`, `"💤 UNDISTURBED"`).
* **Dynamic Intent Updates:**
  * Overhead intent pills transform immediately when Staggered (`⚡ 0 DMG`), Weapon-Broken (`🔨 -3`), Desperation (`🔥 +3`), Dormant (`💤 0 DMG`), or Escaping (`💰 3T`).
* **The "Inspect" Tooltip Hierarchy:**
  * Overhead pods keep numeric badges clean (`15 DMG`, `🛡 4`, `◈1`, `🔨 -3`), while clicking/inspecting any unit opens the structured **Enemy Intel Panel** with highlighted reactive triggers and full intent cycle breakdowns.
