import type { CharacterId } from '../engine/types';

export type GlossaryCategory = 'all' | 'defense' | 'offense' | 'board' | 'status';

export type GlossaryTermId =
  | 'armor'
  | 'shield'
  | 'aegis_pip'
  | 'phase_lock'
  | 'dmg_boost'
  | 'armor_pierce'
  | 'armor_shred'
  | 'cleave'
  | 'riposte'
  | 'tile_pool'
  | 'held_tiles'
  | 'stack_surge'
  | 'overdrive'
  | 'corrode'
  | 'jammed_tile'
  | 'spike_retaliate'
  | 'volatile_burst'
  | 'thermal_charge'
  | 'stagger'
  | 'tile_hex'
  | 'caustic_slag';

export interface GlossaryEntryText {
  term: string;
  shortTag: string;
  summary: string;
  mechanics: string;
  tacticalTip: string;
  keywords: string[];
}

export interface HeroPowerDetail {
  name: string;
  badge: string;
  description: string;
}

export interface HeroCodexText {
  roleTag: string;
  playstyleLead: string;
  passivePowers: HeroPowerDetail[];
  overdriveRule: string;
  overdriveBreakdown: string[];
  synergies: string;
  tacticalLoop: string;
}

export interface CodexTranslationPack {
  codexButtonLabel: string;
  codexTitle: string;
  codexSubtitle: string;
  tabHeroes: string;
  tabGlossary: string;
  heroSelectorAria: string;
  vitalsHeader: string;
  baseStatsLabels: {
    hp: string;
    credits: string;
    capacity: string;
    startingPool: string;
  };
  passivePowersHeader: string;
  overdriveHeader: string;
  freeActionBadge: string;
  innateCoreHeader: string;
  innateCoreDesc: string;
  startingGearHeader: string;
  synergiesHeader: string;
  tacticalLoopHeader: string;
  inspectHeroDossierBtn: string;
  viewGlossaryBtn: string;
  openTermHint: string;
  searchPlaceholder: string;
  noSearchResults: string;
  clearSearch: string;
  categories: Record<GlossaryCategory, string>;
  mechanicsLabel: string;
  tacticalTipLabel: string;
  heroes: Record<CharacterId, HeroCodexText>;
  glossary: Record<GlossaryTermId, GlossaryEntryText>;
}

export const CODEX_TRANSLATIONS: Record<'en' | 'cs', CodexTranslationPack> = {
  en: {
    codexButtonLabel: 'Codex',
    codexTitle: 'Tactical Codex & Operative Dossier',
    codexSubtitle:
      'Complete breakdown of operative passives, Overdrive protocols, combat mechanics, and enemy traits.',
    tabHeroes: 'Operatives & Powers',
    tabGlossary: 'Combat Glossary',
    heroSelectorAria: 'Select operative dossier',
    vitalsHeader: 'Base Chassis & Loadout Profile',
    baseStatsLabels: {
      hp: 'Max HP',
      credits: 'Starting CR',
      capacity: 'Carry Load',
      startingPool: 'Starting Pool',
    },
    passivePowersHeader: 'Passive Powers & Combat Modifiers',
    overdriveHeader: 'Signature Overdrive (100% OD)',
    freeActionBadge: 'Free Action · Does Not End Turn',
    innateCoreHeader: 'Innate Core (5 Permanent Tiles)',
    innateCoreDesc: 'Always present in your active pool regardless of equipped gear.',
    startingGearHeader: 'Starting Equipment',
    synergiesHeader: 'Best Cyber-Clinic Synergies',
    tacticalLoopHeader: 'Core Combat Rhythm',
    inspectHeroDossierBtn: 'Full Abilities & Codex',
    viewGlossaryBtn: 'Glossary',
    openTermHint: 'Inspect term in Glossary',
    searchPlaceholder: 'Search terms (e.g. armor, corrode, surge, pip, overdrive...)',
    noSearchResults: 'No matching glossary entries found.',
    clearSearch: 'Reset Filter',
    categories: {
      all: 'All Terms',
      defense: 'Defense & Armor',
      offense: 'Offense & Damage',
      board: 'Board & Overdrive',
      status: 'Status & Enemy Rules',
    },
    mechanicsLabel: 'How It Works',
    tacticalTipLabel: 'Tactical Tip',
    heroes: {
      kira: {
        roleTag: 'Tech-Surge Tempo · Scaling Burst',
        playstyleLead:
          'High-speed cyber-duelist built around banking Attack/Defense tiles across turns, stacking massive TECH Damage Boosts, and firing frequent Plasma Blitz Overdrives.',
        passivePowers: [
          {
            name: 'Held Tile Momentum',
            badge: '+1 ATK / DEF Held',
            description:
              'Every Attack or Defense tile left unresolved on the board from the previous round (marked HELD) gains +1 flat base value this turn. Stacks additively with Mono-Wire Edge (+2).',
          },
          {
            name: 'Synapse Overdrive Engine',
            badge: '+20% OD per TECH',
            description:
              'Resolving TECH tiles charges +20% Overdrive per tile (compared to +4% per Attack/Defense tile), allowing rapid Overdrive cycles.',
          },
          {
            name: 'Offensive Focus (Zero Retain)',
            badge: '0 Retain · 0 Riposte',
            description:
              'Retains 0 Shield between turns without Aegis Capacitor and deals 0 passive Riposte on Defense tiles, favoring proactive kills or full-turn Defense stacks.',
          },
        ],
        overdriveRule:
          'Available at 100% Overdrive [Space]. Firing Plasma Blitz resets Overdrive to 0%, immediately hits ALL living enemies, and keeps you in your active command phase so you can still play a tile stack on the same turn!',
        overdriveBreakdown: [
          'Deals 20 Pierce DMG to ALL living enemies (ignores enemy Armor; still blocked by active Aegis Pips).',
          'Grants +30% DMG Boost immediately (amplifies an Attack stack played on the same turn!).',
          'Grants +6 Shield to absorb upcoming counter-attacks.',
        ],
        synergies:
          'Mono-Wire Edge (+2 on Held Attack tiles), Surge Resonator (3-tile Stack Surges), Flux Injector (+10% extra OD on TECH), and Phase-Blade Emitter (30% Armor Pierce).',
        tacticalLoop:
          'Turn 1: Resolve TECH (+42% DMG Boost & +20% OD/tile) while holding Attack tiles to power them up (+1 each). Turn 2: Trigger Plasma Blitz (+30% DMG Boost), then unleash the boosted Attack Stack Surge!',
      },
      aurelia: {
        roleTag: 'Slow Juggernaut · Armored Anchor',
        playstyleLead:
          'Frontline heavy juggernaut with 78 Max HP, 18 persistent starting Armor every combat, and 14 Chip Memory. Starts with 1 Dud in each color—and converts every Dud played into +1 UpCharge.',
        passivePowers: [
          {
            name: 'Juggernaut Plating',
            badge: '+18 Armor / Combat',
            description:
              'Starts every encounter with 18 persistent Armor underneath Shield (DMG -> Shield -> Armor -> HP), absorbing hits across rounds without decaying or suffering Corrode.',
          },
          {
            name: 'Dud Overclock (UpCharge)',
            badge: '+1 UpCharge per Dud',
            description:
              'Starts with 3 Dud tiles (1 Attack, 1 Defense, 1 TECH). Resolving any Dud grants +1 UpCharge (+1 extra tile drawn next turn), letting her cycle faster without needing to swamp Duds.',
          },
          {
            name: 'High-Memory Neural Rig',
            badge: '78 HP · 14 Memory',
            description:
              'Starts with 78 Max HP and 14 Chip Memory—enough to run heavyweight AI Skill Chips like Breacher Heavy.AI (Mem 5) + Reactive Exo.AI (Mem 4) simultaneously.',
          },
        ],
        overdriveRule:
          'Available at 100% Overdrive [Space]. Sovereign Broadside is a Free Action that reinforces Armor and floods the next draw with +2 UpCharge.',
        overdriveBreakdown: [
          'Deals 20 Pierce DMG to ALL living enemies (ignores Armor).',
          'Grants +10 persistent Armor to sustain deep frontline trades.',
          'Grants +2 UpCharge so your next turn draws +2 extra tiles.',
        ],
        synergies:
          'Plasma Amplifier & Nano-Weave Plating (turns 0-value Duds into +2 ATK / +2 DEF tiles), Synapse Overclock (+3 SHD on TECH Duds), Surge Resonator (3-tile Surges using Duds), and Pulse Capacitor.AI.',
        tacticalLoop:
          'Let your 18 starting Armor absorb early hits while cycling 1-Dud-per-color into +1 UpCharge draws, stack Surge thresholds with Duds, and drop Sovereign Broadside (+10 Armor, +2 UpCharge) to overpower Boss phases.',
      },
      zuri: {
        roleTag: 'Armor-Shred Tactician · TECH Specialist',
        playstyleLead:
          'Airborne swarm commander specializing in AoE Armor Shred, hybrid Tactical Shielding, and the fastest Overdrive generation in the roster—trading away Held bonuses, Riposte, and native Turn-1 Surges.',
        passivePowers: [
          {
            name: 'Solar Capacitor Uplink',
            badge: '+25% OD per TECH',
            description:
              'Resolving TECH tiles generates +25% Overdrive per tile—the highest in the roster—allowing frequent Solar Swarm Protocol activations.',
          },
          {
            name: 'Innate Armor Shred Core',
            badge: '-8 ARM All · 3 Pierce',
            description:
              'Zuri carries an innate TECH Armor Shred tile that strips 8 Armor from ALL enemies while dealing 3 direct Pierce DMG to the frontline target.',
          },
          {
            name: 'Hybrid Tactical Shield',
            badge: '+4 SHD · +24% DMG',
            description:
              'Zuri’s second core TECH tile grants +4 Shield and +24% DMG Boost simultaneously, bridging defense and offense while charging +25% Overdrive.',
          },
        ],
        overdriveRule:
          'Available at 100% Overdrive [Space]. Solar Swarm Protocol fires as a Free Action without ending your turn, shattering enemy armor before your follow-up Attack stack.',
        overdriveBreakdown: [
          'Strips -12 Armor and deals 16 Pierce DMG to ALL living enemies.',
          'Grants +8 Shield to brace against incoming counter-fire.',
          'Cleanses -2 Corrode stacks from your chassis.',
        ],
        synergies:
          'Synapse Overclock (+3 Shield per TECH tile), Surge Resonator (unlocks 3-tile Surges on her 3/3/3 balanced pool), Flux Injector (+35% OD per TECH tile!), and ARC Rail-Carbine.',
        tacticalLoop:
          'Respect your 3/3/3 Blind Spot (no Turn-1 Surge without gear or Resonator): weave innate TECH tiles to strip Armor, gain +4 Shield/+24% DMG, charge +25% OD per tile, then unleash Solar Swarm Protocol (-12 Armor All + 16 Pierce) into an Attack stack.',
      },
    },
    glossary: {
      armor: {
        term: 'Armor (ARM)',
        shortTag: 'Enemy Mitigation',
        summary: 'Gold plating on enemies that absorbs regular Attack and Riposte damage before HP drops.',
        mechanics:
          'Regular Attack damage and Riposte hit Armor first, reducing Armor 1-for-1 until it reaches 0; any leftover damage hits HP. Enemy Armor persists across turns and can be increased by Chitin Harden or Aegis Bolster.',
        tacticalTip:
          'Bypass or break Armor using Attack Stack Surge (4+ tiles shatters all front Armor), TECH Armor Shred (-8 or -10 Armor to ALL enemies), Phase-Blade Emitter (30% Pierce), or Overdrive (100% Pierce).',
        keywords: ['armor', 'arm', 'plating', 'chitin', 'bolster', 'mitigation'],
      },
      shield: {
        term: 'Shield (SHD)',
        shortTag: 'Operative Barrier',
        summary: 'Cyan energy barrier protecting your HP from enemy strikes, Acid Spit, and Thorny Carapace.',
        mechanics:
          'Absorbs incoming damage 1-for-1 before Armor and HP are reduced. Blocking an Acid Spit completely (0 HP lost) prevents Bile Spitter/Boss from jamming a board tile. At round end, unused Shield clears down to your retention cap (Kira 0, Auraline 0, Zuri 0; +50% with Aegis Capacitor).',
        tacticalTip:
          'Keep just enough Shield to block incoming damage—if Acid Spit deals even 1 HP damage, it jams a tile!',
        keywords: ['shield', 'shd', 'def', 'defense', 'block', 'retain'],
      },
      aegis_pip: {
        term: 'Aegis Pip (◆)',
        shortTag: 'Hit-Count Shield',
        summary: 'Diamond barrier that completely negates the next 1 damaging hit regardless of damage size.',
        mechanics:
          'Whenever an enemy has 1 or more Aegis Pips, the next single damaging hit (even a 30-DMG Attack Surge, Overdrive, or Bio-Burst explosion) cracks 1 Pip and deals 0 HP/Armor damage.',
        tacticalTip:
          'Never waste a giant Attack Stack Surge or Overdrive into an active Aegis Pip. Crack the Pip first with Riposte, a small Attack, or Zuri’s 3-DMG Pierce TECH tile.',
        keywords: ['pip', 'aegis', 'diamond', 'negate', 'crack', 'skitter', 'brute', 'boss'],
      },
      phase_lock: {
        term: '50% Phase Lock',
        shortTag: 'Boss Threshold',
        summary: 'Prevents the Hive Matriarch from being defeated before crossing her 50% HP phase gate.',
        mechanics:
          'Once per fight, if a hit would push the Xenomorph Matriarch below 50% Max HP (55 HP), damage stops at 55 HP. She immediately gains +10 Armor and restores 1 Aegis Pip (◆).',
        tacticalTip:
          'Do not over-commit all your boosts into the Phase Lock hit—save a way to crack her newly restored Pip and strip her +10 Armor afterward.',
        keywords: ['phase', 'lock', 'gate', 'boss', 'matriarch', '50%'],
      },
      dmg_boost: {
        term: 'DMG Boost (+% DMG)',
        shortTag: 'Attack Multiplier',
        summary: 'Percentage multiplier applied to the total base damage of resolved Attack stacks.',
        mechanics:
          'Applied to Attack tile sums as floor(baseDamage × (1 + DMG Boost / 100)). Decays by -10 percentage points at the end of every round. Does not multiply Overdrive, Riposte, or TECH Pierce damage.',
        tacticalTip:
          'Stack TECH Damage Boosters first, hold Attack tiles for +1 turn, then cash in your high DMG Boost before it decays.',
        keywords: ['boost', 'dmg', 'damage', 'multiplier', 'decay', 'tech'],
      },
      armor_pierce: {
        term: 'Armor Pierce (PIERCE)',
        shortTag: 'Bypass Plating',
        summary: 'Damage that ignores enemy Armor and strikes HP directly.',
        mechanics:
          'Overdrive, Bio-Rupture explosions, and Armor-Shred TECH pulses deal 100% Pierce damage. Phase-Blade Emitter makes 30% of every Attack stack bypass Armor. Note: Pierce still cracks Aegis Pips (◆) instead of bypassing them.',
        tacticalTip:
          'Ideal against high-Armor Brutes or after an enemy uses Aegis Bolster (+4 Armor All).',
        keywords: ['pierce', 'penetration', 'ignore', 'armor', 'katana', 'phase-blade'],
      },
      armor_shred: {
        term: 'Armor Shred (SHRED)',
        shortTag: 'All-Enemy Strip',
        summary: 'TECH effect that permanently strips Armor from ALL living enemies simultaneously.',
        mechanics:
          'Triggered by Zuri’s innate shred module (-8 ARM All) or ARC Rail-Carbine (-10 ARM All). Reduces every living enemy’s Armor down to 0 minimum, and pairs with direct Pierce damage to the front target.',
        tacticalTip:
          'Use Armor Shred on Turn 1 against Cobalt Skitter + Brute formations to strip Aegis Bolster plating across the whole pack.',
        keywords: ['shred', 'strip', 'emp', 'armor', 'zuri', 'carbine'],
      },
      cleave: {
        term: 'Cleave (CLEAVE)',
        shortTag: 'Splash Damage',
        summary: 'Secondary AoE damage dealt to all enemies behind the frontline target on Attack Surge.',
        mechanics:
          'Triggering an Attack Stack Surge deals 50% of the frontline Attack’s total damage to every other living enemy. Benefits from 30% Armor Pierce if Phase-Blade Emitter is installed, though it does not shatter backline Armor.',
        tacticalTip:
          'Attack Surge Cleave also cracks Aegis Pips on backline enemies for free!',
        keywords: ['cleave', 'aoe', 'splash', 'surge', 'backline'],
      },
      riposte: {
        term: 'Riposte & Reflect',
        shortTag: 'Defensive Counter',
        summary: 'Damage dealt back to the frontline enemy when resolving Defense tiles or blocking attacks.',
        mechanics:
          'Aurelia deals 2 DMG per Defense tile resolved; Zuri deals 1 DMG per Defense tile. A Defense Stack Surge deals an extra 8 DMG. Separately, the Kinetic Reflector implant deals 3 DMG back to any attacker whose hit is blocked by your Shield.',
        tacticalTip:
          'Riposte safely finishes low-HP Chitin Stalkers without triggering their Thorny Carapace retaliation.',
        keywords: ['riposte', 'reflect', 'counter', 'defense', 'aurelia', 'zuri', 'kinetic'],
      },
      tile_pool: {
        term: 'Active Tile Pool & Load',
        shortTag: 'Deck & Weight',
        summary: 'Your combat deck formed by 5 permanent Innate Core tiles plus equipped gear up to Carry Load.',
        mechanics:
          'Each equipment item has a Size cost and adds 1–3 tiles to your Active Pool. You can swap or scrap gear outside of combat via Loadout & Pool. During combat, 6 tiles sit on the board; empty slots draw from the Draw Pile and reshuffle the Cycle Pile when empty.',
        tacticalTip:
          'Keep your pool lean! Unequipping weak starter gear can improve your odds of drawing 4-tile Stack Surges.',
        keywords: ['pool', 'deck', 'load', 'capacity', 'carry', 'weight', 'draw', 'cycle', 'discard'],
      },
      held_tiles: {
        term: 'Held vs. Drawn Tiles',
        shortTag: 'Board Carryover',
        summary: 'Unresolved tiles stay on the board across turns and gain HELD status.',
        mechanics:
          'Because you activate only 1 tile color per turn, all unplayed tiles remain in place next turn (marked HELD) while new tiles refill the board to 6 (marked DRAWN). Kira and Zuri give HELD Attack/Defense tiles +1 base value; Mono-Wire Edge adds +2 to HELD Attack tiles.',
        tacticalTip:
          'Intentionally hold Attack tiles for 1 turn while using TECH or Defense to build a 4-tile Surge and trigger HELD bonuses.',
        keywords: ['held', 'drawn', 'carryover', 'stay', 'monowire', 'kira', 'zuri'],
      },
      stack_surge: {
        term: 'Stack Surge',
        shortTag: '4+ Tile Combo',
        summary: 'Bonus super-effect triggered by resolving 4+ unjammed tiles of the same type (3+ with Surge Resonator).',
        mechanics:
          'Attack Surge: Shatters ALL Armor on the front target + deals 50% Cleave DMG to all other enemies + prevents Thorny Carapace retaliation. Defense Surge: Deals 8 DMG to the front enemy. TECH Surge: Grants +15% extra Overdrive and +6 Shield.',
        tacticalTip:
          'Watch the Upcoming Draws strip to plan when your next draw will complete a 4-tile Stack Surge!',
        keywords: ['surge', 'stack', 'combo', '4+', '3+', 'resonator', 'armor break'],
      },
      overdrive: {
        term: 'Overdrive (OD)',
        shortTag: 'Free Ultimate',
        summary: 'Operative ultimate charged from 0% to 100% by resolving tiles; fires as a Free Action [Space].',
        mechanics:
          'Attack/Defense tiles grant +4% OD each. TECH tiles grant +20% (Kira), +15% (Aurelia), or +25% (Zuri), plus +10% with Flux Injector and +15% on TECH Surge. Firing Overdrive resets OD to 0%, hits ALL enemies with 100% Pierce damage, and does NOT end your turn.',
        tacticalTip:
          'Fire Kira’s or Zuri’s Overdrive BEFORE clicking your Attack stack on the same turn so their +25%/+30% DMG Boost empowers the Attack!',
        keywords: ['overdrive', 'od', 'ultimate', 'space', 'plasma blitz', 'broadside', 'swarm'],
      },
      corrode: {
        term: 'Corrode (COR)',
        shortTag: 'Shield Debuff',
        summary: 'Caustic debuff that reduces Shield gained from resolving Defense tiles.',
        mechanics:
          'Every point of Corrode subtracts 1 Shield from the total Shield generated when you resolve a Defense stack (minimum 0 Shield). Inflicted by Bile Spitter’s Pustule Rupture (+2 COR when surviving non-Surge Attacks) and Beat 2 Caustic Claw Rend (+2 COR). Decays naturally by -1 at round end and does not reduce TECH or Overdrive Shield.',
        tacticalTip:
          'Cleanse Corrode quickly using Cryo-Purge Module (-2 COR) or Aurelia/Zuri’s Overdrives (-2 COR), trigger Attack Surge to avoid Pustule Rupture, or rely on TECH Shield tiles.',
        keywords: ['corrode', 'cor', 'acid', 'pustule', 'debuff', 'shield', 'cleanse'],
      },
      jammed_tile: {
        term: 'Jammed Tile',
        shortTag: 'Board Lockout',
        summary: 'A tile disabled for 1 turn by Bile Spitter or Boss Acid Spit.',
        mechanics:
          'If an enemy with Pustule Rupture & Caustic Hex deals at least 1 unblocked HP damage with Acid Spit, 1 unjammed tile on your board becomes JAMMED. It cannot be resolved, does not count toward Stack Surge, and unjams automatically after your next color resolution (or immediately if you trigger Overdrive).',
        tacticalTip:
          'Raise enough Shield to absorb Acid Spit completely—blocking all HP damage prevents Jamming, Slag, and Beat 2 Claw Armor.',
        keywords: ['jammed', 'jam', 'lock', 'spitter', 'acid', 'web'],
      },
      spike_retaliate: {
        term: 'Thorny Carapace (Retaliate)',
        shortTag: 'Enemy Counter',
        summary: 'Chitin Stalker deals 3 DMG back whenever it survives a non-Surge Attack.',
        mechanics:
          'Whenever you hit a Chitin Stalker in the front slot with a normal Attack (< Surge threshold) and it survives, it immediately deals 3 DMG to your Shield/HP. Bypassed if the hit kills it, if you trigger an Attack Stack Surge, or if you damage it via TECH/Riposte/Overdrive.',
        tacticalTip:
          'Preview the red ⚠ RETALIATE badge on the tactical strip before committing—finish the Stalker in one hit or surge through it.',
        keywords: ['retaliate', 'thorny', 'stalker', 'spike', '3 dmg'],
      },
      volatile_burst: {
        term: 'Bio-Rupture (Bio-Burst)',
        shortTag: 'Chain Explosion',
        summary: 'Spore Mite explodes on death for 6 Pierce DMG to all surviving enemies.',
        mechanics:
          'When a Spore Mite dies, it triggers an immediate 6 Pierce DMG detonation hitting every other living mutant on the sky-bridge (cracking Aegis Pips or piercing straight through Armor, and even chain-detonating other Spore Mites).',
        tacticalTip:
          'Prioritize killing frontline Spore Mites when high-Armor Brutes or Pip-protected Skitters stand behind them.',
        keywords: ['burst', 'rupture', 'spore mite', 'larva', 'explosion', 'chain'],
      },
      thermal_charge: {
        term: 'Thermal Charge',
        shortTag: '3-Turn Bomb',
        summary: 'Pyre Stinger charges for 2 harmless turns before firing a 16 DMG blast on Turn 3.',
        mechanics:
          'Turns 1 and 2 of its cycle deal 0 DMG while telegraphing the countdown (2T → 1T). On Turn 3 it unleashes a 16 DMG Apex Rend. Dealing 16+ single-turn damage Staggers it and resets the countdown.',
        tacticalTip:
          'Burst Pyre Stinger for 16+ DMG in 1 turn to Stagger & reset its bomb, or Push it with [R] to line up a kill.',
        keywords: ['charge', 'thermal', 'stinger', 'countdown', '16 dmg', 'time-bomb', 'stagger'],
      },
      stagger: {
        term: 'Stagger (Broken Stance)',
        shortTag: '16+ Burst Interrupt',
        summary: 'Dealing 16+ HP/Armor damage in a single turn interrupts Heavy or Charge attacks.',
        mechanics:
          'When a Pyre Stinger (charging), Carapace Brute (2-slot juggernaut winding up a 14 DMG Heavy crush), or Xenomorph Matriarch (Heavy strike) takes 16+ combined HP and Armor damage in 1 turn without dying, it becomes STAGGERED: its upcoming attack becomes 0 DMG recovery and Thermal Charge resets to 2T.',
        tacticalTip:
          'Watch for the ⚡ STAGGER! preview badge on enemy pods when hovering high-burst Attacks or Overdrive.',
        keywords: ['stagger', 'interrupt', '16', 'burst', 'charge', 'heavy', 'brute', 'stinger', 'boss'],
      },
      tile_hex: {
        term: 'Targeted Tile Hex (⬡)',
        shortTag: 'Board Curse',
        summary: 'Enemies mark a tile on your board; resolving that color while the caster lives heals it.',
        mechanics:
          'From Turn 2 onward, Bile Spitter and Xenomorph Matriarch mark 1 high-value Attack or Defense tile with ⬡ HEX. If you resolve that tile color while the caster is still alive, it immediately heals +4 HP and gains +3 Armor. Killing the caster or triggering Overdrive shatters all Hexes.',
        tacticalTip:
          'Play another color, eliminate the caster via Overdrive/Cleave/Push, or out-burst the +4 HP heal.',
        keywords: ['hex', 'curse', 'spitter', 'boss', 'heal', 'overdrive'],
      },
      caustic_slag: {
        term: 'Caustic Slag (☣ Blight)',
        shortTag: 'Deck Pollution',
        summary: 'Unblocked Acid injects 0-value Slag tiles into your cycle that burn 2 HP if left unpurged.',
        mechanics:
          'Up to 2 Caustic Slag tiles (TECH color, 0 value) can enter your deck when Bile Spitter or Matriarch deals unblocked Acid HP damage. Each Slag kept on board at round end deals 2 chip DMG. Resolving TECH (even alongside real TECH tiles) or firing Overdrive permanently exhausts Slag.',
        tacticalTip:
          'Block Acid Spit with Shield to prevent Slag, or sweep Slag safely on your next TECH or Overdrive turn.',
        keywords: ['slag', 'blight', 'pollution', 'acid', 'purge', 'tech', 'overdrive'],
      },
    },
  },
  cs: {
    codexButtonLabel: 'Kodex',
    codexTitle: 'Taktický kodex a složka operativky',
    codexSubtitle:
      'Kompletní přehled pasivních schopností operativních postav, Overdrive protokolů, herních pojmů a pravidel nepřátel.',
    tabHeroes: 'Operativky a schopnosti',
    tabGlossary: 'Herní slovník',
    heroSelectorAria: 'Vyber složku operativky',
    vitalsHeader: 'Základní parametry a výzbroj',
    baseStatsLabels: {
      hp: 'Max Zdraví',
      credits: 'Startovní CR',
      capacity: 'Nosnost',
      startingPool: 'Základní pool',
    },
    passivePowersHeader: 'Pasivní schopnosti a modifikátory',
    overdriveHeader: 'Speciální Overdrive (100 % OD)',
    freeActionBadge: 'Volná akce · Neukončí tah',
    innateCoreHeader: 'Vrozené jádro (5 trvalých dlaždic)',
    innateCoreDesc: 'Vždy zůstává ve tvém aktivním poolu bez ohledu na nasazenou výbavu.',
    startingGearHeader: 'Startovní výbava',
    synergiesHeader: 'Doporučené implantáty z Kyber-kliniky',
    tacticalLoopHeader: 'Hlavní bojový rytmus',
    inspectHeroDossierBtn: 'Schopnosti a Kodex',
    viewGlossaryBtn: 'Slovník',
    openTermHint: 'Zobrazit pojem ve slovníku',
    searchPlaceholder: 'Hledej pojem (např. brnění, koroze, přetížení, pip, overdrive...)',
    noSearchResults: 'Žádný odpovídající pojem nebyl nalezen.',
    clearSearch: 'Zrušit filtr',
    categories: {
      all: 'Všechny pojmy',
      defense: 'Obrana a Brnění',
      offense: 'Útok a Poškození',
      board: 'Deska a Overdrive',
      status: 'Stavy a Pravidla nepřátel',
    },
    mechanicsLabel: 'Jak to funguje',
    tacticalTipLabel: 'Taktický tip',
    heroes: {
      kira: {
        roleTag: 'TECH-Přetížení · Nárazové kombo',
        playstyleLead:
          'Rychlá kyber-duelistka zaměřená na držení dlaždic Útoku/Obrany mezi tahy, skládání silných TECH Damage boosterů a časté spouštění Plazmového Blitzu.',
        passivePowers: [
          {
            name: 'Kyber-hybnost držených dlaždic',
            badge: '+1 ATK / DEF Držené',
            description:
              'Každá dlaždice Útoku nebo Obrany ponechaná na desce z minulého kola (označená DRŽENO) získá tento tah +1 k základní hodnotě. Sčítá se s implantátem Monovláknové ostří (+2).',
          },
          {
            name: 'Synaptický Overdrive motor',
            badge: '+20 % OD za TECH',
            description:
              'Aktivace dlaždic TECH nabije +20 % Overdrive za každou dlaždici (oproti +4 % za Útok/Obranu), což umožňuje časté řetězení Overdrive.',
          },
          {
            name: 'Ofenzivní zaměření (0 přenos)',
            badge: '0 Štít · 0 Odplata',
            description:
              'Nepřenáší Štít mezi koly bez Kondenzátoru Aegis a nemá pasivní Odvetu z Obrany — sází na včasnou likvidaci cílů nebo silné obranné sady.',
          },
        ],
        overdriveRule:
          'Dostupné při 100 % Overdrive [Mezerník]. Plazmový Blitz vynuluje Overdrive na 0 %, okamžitě zasáhne VŠECHNY živé nepřátele a nechá tě v tahu, takže můžeš hned zahrát i sadu dlaždic!',
        overdriveBreakdown: [
          'Udělí 20 průrazného DMG VŠEM živým nepřátelům (ignoruje brnění; pohltí jej jen aktivní Aegis Pip).',
          'Okamžitě přidá +30 % Boost DMG (zesílí útočnou sadu zahranou ještě v témže tahu!).',
          'Přidá +6 Štítu na vykrytí příchozích úderů.',
        ],
        synergies:
          'Monovláknové ostří (+2 pro držené Útoky), Rezonátor přetížení (Přetížení už od 3 dlaždic), Fluxový injektor (+10 % OD navíc za TECH) a Fázový emitor čepele (30 % průraz).',
        tacticalLoop:
          '1. tah: Aktivuj TECH (+42 % Boost DMG a +20 % OD/dlaždici) a podrž dlaždice Útoku pro bonus +1. 2. tah: Spusť Plazmový Blitz (+30 % Boost DMG) a doraž vlnu posíleným Přetížením Útoku!',
      },
      aurelia: {
        roleTag: 'Pomalý kolos · Obrněná kotva',
        playstyleLead:
          'Těžká předvojová bojovnice se 78 Max HP, 18 stálého Brnění na začátku každého boje a pamětí 14. Začíná s 1 Dud dílkem v každé barvě a každý zahraný Dud jí dá +1 UpCharge.',
        passivePowers: [
          {
            name: 'Pancíř kolosu',
            badge: '+18 Brnění / boj',
            description:
              'Každý boj začíná s 18 stálého Brnění pod Štítem (DMG -> Štít -> Brnění -> HP), které nemizí na konci kola a nepodléhá Korozi.',
          },
          {
            name: 'Přetížení zmetků (UpCharge)',
            badge: '+1 UpCharge za Dud',
            description:
              'Začíná se 3 Dud dílky (1 Útok, 1 Obrana, 1 TECH). Každý zahraný Dud udělí +1 UpCharge (+1 dílek příští tah), takže nemusí své Dudy za každou cenu přemazávat.',
          },
          {
            name: 'Vysoká paměť čipů',
            badge: '78 HP · Paměť 14',
            description:
              'Začíná se 78 Max HP a pamětí 14 — unese i těžké AI čipy jako Breacher Heavy.AI (Paměť 5) + Reactive Exo.AI (Paměť 4) najednou.',
          },
        ],
        overdriveRule:
          'Dostupné při 100 % Overdrive [Mezerník]. Královská salva je volná akce, která doplní Brnění a nabije +2 UpCharge pro další tah.',
        overdriveBreakdown: [
          'Udělí 20 průrazného DMG VŠEM živým nepřátelům (ignoruje brnění).',
          'Přidá +10 stálého Brnění pro hlubokou výdrž v boji.',
          'Přidá +2 UpCharge (+2 dílky do příštího tahu).',
        ],
        synergies:
          'Plazmový zesilovač a Nanovláknová zbroj (promění 0-hodnotové Dudy na +2 ATK/+2 DEF), Synaptické přetaktování (+3 Štít na TECH Dud), Rezonátor přetížení a Pulse Capacitor.AI.',
        tacticalLoop:
          'Nech 18 Brnění pohltit úvodní údery, toč Dudy do +1 UpCharge tahů, spouštěj Přetížení s pomocí Dudů a aktivuj Královskou salvu (+10 Brnění, +2 UpCharge) před klíčovými koly.',
      },
      zuri: {
        roleTag: 'Specialistka na stržení brnění · TECH',
        playstyleLead:
          'Létající velitelka solárního roje zaměřená na plošné strhávání Brnění, hybridní Taktický štít a nejrychlejší nabíjení Overdrive — bez bonusu za držení, bez Odvety a bez Přetížení v 1. tahu.',
        passivePowers: [
          {
            name: 'Solární uplink kondenzátoru',
            badge: '+25 % OD za TECH',
            description:
              'Aktivace dlaždic TECH dodá +25 % Overdrive za každou dlaždici — nejrychlejší nabíjení Overdrive ze všech operativních postav.',
          },
          {
            name: 'Vrozené jádro stržení brnění',
            badge: '-8 BRN všem · 3 Průraz',
            description:
              'Zuri má v jádru unikátní TECH dlaždici, která strhne 8 Brnění VŠEM nepřátelům a přednímu cíli udělí 3 přímého průrazného DMG.',
          },
          {
            name: 'Hybridní taktický štít',
            badge: '+4 Štít · +24 % DMG',
            description:
              'Druhá jádrová TECH dlaždice přidá +4 Štítu i +24 % Boost DMG najednou, čímž propojuje obranu s přípravou útoku a nabíjí +25 % OD.',
          },
        ],
        overdriveRule:
          'Dostupné při 100 % Overdrive [Mezerník]. Protokol Solární roj se aktivuje jako volná akce bez ukončení tahu a strhne nepřátelům brnění před následným útokem.',
        overdriveBreakdown: [
          'Strhne -12 Brnění a udělí 16 průrazného DMG VŠEM živým nepřátelům.',
          'Přidá +8 Štítu na vykrytí následného protiútoku.',
          'Očistí -2 Koroze z tvé schránky.',
        ],
        synergies:
          'Synaptické přetaktování (+3 Štít za TECH dlaždici), Rezonátor přetížení (odemkne 3dílná Přetížení na rozložení 3/3/3), Fluxový injektor (+35 % OD za TECH!) a Oblouková karabina.',
        tacticalLoop:
          'Respektuj slabinu 3/3/3 (žádné Přetížení v 1. tahu bez výbavy): toč vrozené TECH dlaždice pro stržení Brnění a +4 Štít/+24 % DMG, nabíjej +25 % OD a spusť Protokol Solární roj (-12 BRN + 16 Průraz) před Útokem.',
      },
    },
    glossary: {
      armor: {
        term: 'Brnění (BRN / ARM)',
        shortTag: 'Ochrana nepřítele',
        summary: 'Zlatý pancíř nepřátel, který pohlcuje běžné poškození Útoku a Odvety před zásahem Zdraví.',
        mechanics:
          'Běžný Útok a Odveta nejprve ubírají Brnění 1:1, dokud neklesne na 0; teprve zbytek snižuje Zdraví. Brnění zůstává mezi tahy a nepřátelé jej mohou doplňovat (Tvrzení krunýře, Aegis podpora).',
        tacticalTip:
          'Prolomení brnění: Přetížení Útoku (4+ dlaždice zničí celé přední Brnění), TECH Průraz (-8 nebo -10 BRN všem), Fázový emitor čepele (30 % průraz) nebo Overdrive (100 % průraz).',
        keywords: ['brnění', 'brn', 'armor', 'pancíř', 'krunýř', 'aegis'],
      },
      shield: {
        term: 'Štít (SHD / DEF)',
        shortTag: 'Ochranná bariéra',
        summary: 'Azurová bariéra, která chrání tvoje Zdraví před útoky nepřátel, kyselinou i trnovou odplatou.',
        mechanics:
          'Pohlcuje příchozí poškození 1:1 před Brněním a Zdravím. Úplné vykrytí Žíravého plivance (0 ztráty Zdraví) zabrání zablokování dlaždice. Na konci kola zbylý Štít klesne na tvůj limit přenosu (Kira 0, Auraline 0, Zuri 0; +50 % s Kondenzátorem Aegis).',
        tacticalTip:
          'Proti kyselině drž dostatečný Štít — i 1 bod poškození do Zdraví způsobí zablokování dlaždice!',
        keywords: ['štít', 'obrana', 'shield', 'def', 'blok', 'přenos'],
      },
      aegis_pip: {
        term: 'Aegis Pip (◆)',
        shortTag: 'Jednorázový štít',
        summary: 'Diamantový štít nepřítele, který zcela pohltí příští 1 zásah bez ohledu na výši poškození.',
        mechanics:
          'Dokud má nepřítel aktivní Aegis Pip (např. Kobaltový běžec, Krunýřový kolos, Matriarcha), příští jediný zásah (i silný Overdrive nebo Přetížení) pouze rozbije 1 Pip a udělí 0 poškození do Zdraví či Brnění.',
        tacticalTip:
          'Nikdy neplýtvej obřím Útokem nebo Overdrive do aktivního Pipu. Nejprve ho praskni Odvetou, lehkým Útokem nebo průrazným TECH pulzem.',
        keywords: ['pip', 'aegis', 'diamant', 'štít', 'kolos', 'běžec'],
      },
      phase_lock: {
        term: '50% Fázový zámek',
        shortTag: 'Práh bosse',
        summary: 'Brání zabití Xenomorfní Matriarchy jedinou ranou přes hranici 50 % Zdraví.',
        mechanics:
          'Jednou za boj se poškození zastaví přesně na 50 % max. Zdraví (55 HP). Matriarcha okamžitě získá +10 Brnění a obnoví si 1 Aegis Pip (◆).',
        tacticalTip:
          'Nepřepal všechna posílení do rány, která spustí zámek — nech si nástroj na prasknutí nového Pipu a stržení +10 Brnění.',
        keywords: ['fázový', 'zámek', 'boss', 'matriarcha', '50%'],
      },
      dmg_boost: {
        term: 'Boost DMG (+% DMG)',
        shortTag: 'Násobič útoku',
        summary: 'Procentuální bonus, který zvyšuje celkové poškození aktivovaných dlaždic Útoku.',
        mechanics:
          'Aplikuje se na součet základního poškození Útoku jako floor(základ × (1 + Boost / 100)). Na konci každého kola klesne o 10 procentních bodů. Nezvyšuje Overdrive, Odvetu ani průrazný TECH zásah.',
        tacticalTip:
          'Nejprve naber Boost DMG přes TECH dlaždice, podrž Útoky o tah déle a pak udeř naplno dřív, než bonus klesne.',
        keywords: ['boost', 'dmg', 'poškození', 'násobič', 'pokles'],
      },
      armor_pierce: {
        term: 'Průraz brněním (PIERCE)',
        shortTag: 'Zásah přímo do HP',
        summary: 'Poškození, které obchází nepřátelské Brnění a míří přímo do Zdraví.',
        mechanics:
          'Overdrive, Bio-exploze i průrazné TECH pulzy obcházejí Brnění ze 100 %. Fázový emitor čepele propustí skrz Brnění 30 % poškození každého Útoku. Pozor: aktivní Aegis Pip (◆) stále pohltí celý zásah.',
        tacticalTip:
          'Skvělé proti obrněným kolosům nebo skupinám posíleným Aegis podporou (+4 Brnění všem).',
        keywords: ['průraz', 'pierce', 'brnění', 'čepel', 'emitor'],
      },
      armor_shred: {
        term: 'Stržení brnění (SHRED)',
        shortTag: 'Plošné odzbrojení',
        summary: 'Efekt dlaždic TECH, který strhne Brnění VŠEM žijícím nepřátelům najednou.',
        mechanics:
          'Spouští jej Zuriina vrozená dlaždice (-8 BRN všem) nebo Oblouková karabina (-10 BRN všem). Snižuje Brnění každému nepříteli (min. 0) a zároveň přednímu cíli udělí přímé průrazné DMG.',
        tacticalTip:
          'Ideální v 1. tahu proti Kobaltovému běžci a Kolosovi na rychlé odhalení jejich Zdraví.',
        keywords: ['stržení', 'shred', 'emp', 'brnění', 'karabina', 'zuri'],
      },
      cleave: {
        term: 'Rozmach (CLEAVE)',
        shortTag: 'Plošný přesah',
        summary: 'Sekundární poškození zadních nepřátel při Přetížení Útoku.',
        mechanics:
          'Aktivace Přetížení Útoku zasáhne všechny zbývající živé nepřátele za předním cílem za 50 % celkového poškození. Využívá i 30 % průraz z Fázového emitoru čepele.',
        tacticalTip:
          'Rozmach umí zdarma prasknout Aegis Pipy nepřátelům stojícím v zadních řadách!',
        keywords: ['rozmach', 'cleave', 'plošné', 'přetížení'],
      },
      riposte: {
        term: 'Odveta a Odraz',
        shortTag: 'Obranný protiúder',
        summary: 'Poškození vrácené přednímu nepříteli při zahrání Obrany nebo vykrytí útoku.',
        mechanics:
          'Aurelia udělí 2 DMG za každou dlaždici Obrany, Zuri 1 DMG. Přetížení Obrany přidá dalších 8 DMG. Implantát Kinetický reflektor navíc vrátí 3 DMG útočníkovi pokaždé, když útok vykryješ Štítem.',
        tacticalTip:
          'Odveta bezpečně dorazí Chitinového slídiče bez spuštění jeho Trnitého krunýře.',
        keywords: ['odveta', 'odraz', 'riposte', 'obrana', 'reflektor'],
      },
      tile_pool: {
        term: 'Aktivní pool a Nosnost',
        shortTag: 'Balíček a Váha',
        summary: 'Tvůj bojový balíček složený z 5 vrozených dlaždic a nasazené výbavy do limitu Nosnosti.',
        mechanics:
          'Každý kus vybavení zabírá určitou Velikost a přidává 1–3 dlaždice do Aktivního poolu. Mimo boj můžeš výbavu měnit nebo šrotovat v okně Výbava a Pool. V boji držíš na desce 6 dlaždic a po vyčerpání zásobníku se cyklus promíchá.',
        tacticalTip:
          'Udržuj pool štíhlý — sundáním slabé výbavy zvýšíš šanci na pravidelná 4dílná Přetížení.',
        keywords: ['pool', 'nosnost', 'váha', 'výbava', 'zásobník', 'cyklus'],
      },
      held_tiles: {
        term: 'Držené vs. Nové dlaždice',
        shortTag: 'Přenos na desce',
        summary: 'Neaktivované dlaždice zůstávají na desce do příštího tahu jako DRŽENÉ.',
        mechanics:
          'Za tah aktivuješ jen 1 typ dlaždic; zbylé dlaždice zůstávají na místě (DRŽENO) a prázdná místa se doberou do 6 (NOVÝ). Kira a Zuri dávají drženým dlaždicím Útoku/Obrany +1; Monovláknové ostří přidává +2 k drženým Útokům.',
        tacticalTip:
          'Podrž si dlaždice Útoku o 1 kolo, zatímco hraješ TECH nebo Obranu, a poskládej si silné Přetížení.',
        keywords: ['držené', 'drženo', 'nový', 'held', 'monovlákno'],
      },
      stack_surge: {
        term: 'Přetížení (Stack Surge)',
        shortTag: 'Kombo 4+ dlaždic',
        summary: 'Bonusový super-efekt při aktivaci 4+ nezablokovaných dlaždic stejného typu (3+ s Rezonátorem).',
        mechanics:
          'Přetížení Útoku: Rozbije celé Brnění předního cíle + 50 % rozmach všem ostatním + neaktivuje Trnitý krunýř. Přetížení Obrany: Udělí 8 DMG přednímu cíli. Přetížení TECH: Přidá +15 % Overdrive a +6 Štítu.',
        tacticalTip:
          'Sleduj panel Příští dlaždice, abys věděl, kdy ti další dobírání doplní 4 dlaždice stejné barvy.',
        keywords: ['přetížení', 'surge', 'kombo', 'rezonátor', 'rozmach'],
      },
      overdrive: {
        term: 'Overdrive (OD)',
        shortTag: 'Volná ultimátka',
        summary: 'Speciální schopnost nabíjená z 0 na 100 % aktivací dlaždic; spouští se jako volná akce [Mezerník].',
        mechanics:
          'Útok a Obrana dávají +4 % OD za dlaždici. TECH dává +20 % (Kira), +15 % (Aurelia) nebo +25 % (Zuri), plus +10 % s Fluxovým injektorem a +15 % při Přetížení TECH. Spuštění Overdrive vynuluje OD, zasáhne VŠECHNY nepřátele průrazně a NEUKONČÍ tah.',
        tacticalTip:
          'Spusť Overdrive Kiry nebo Zuri PŘED zahráním Útoku ve stejném tahu, aby jejich +25 %/+30 % Boost DMG posílil i následný úder!',
        keywords: ['overdrive', 'od', 'mezerník', 'blitz', 'salva', 'roj'],
      },
      corrode: {
        term: 'Koroze (KOR)',
        shortTag: 'Oslabený štít',
        summary: 'Žíravý postih snižující Štít získaný z dlaždic Obrany.',
        mechanics:
          'Každý bod Koroze odečte 1 Štít z celkového Štítu získaného při aktivaci sady Obrany (minimálně 0). Uděluje ji Prasknutí pustul Žlučového plivače (+2 KOR při přežití běžného Útoku bez Přetížení) i jeho 2. fáze drápů (+2 KOR). Na konci kola klesne o 1 a neovlivňuje Štít z TECH ani Overdrive.',
        tacticalTip:
          'Korozi odstraň Kryo-čisticím modulem (-2 KOR) či Overdrive Aurelie/Zuri (-2 KOR) a proti Plivači spouštěj Přetížení Útoku.',
        keywords: ['koroze', 'kor', 'kyselina', 'pustuly', 'štít', 'očista'],
      },
      jammed_tile: {
        term: 'Blokovaná dlaždice (BLOK)',
        shortTag: 'Sabotáž desky',
        summary: 'Dlaždice vyřazená na 1 tah po nekrytém kyselinovém útoku.',
        mechanics:
          'Pokud Žlučový plivač nebo Matriarcha udělí Žíravým plivancem alespoň 1 poškození do Zdraví, 1 dlaždice na desce se zablokuje. Nelze ji zahrát ani započítat do Přetížení; odblokuje se po tvé příští akci (nebo ihned při Overdrive).',
        tacticalTip:
          'Vykryj útok Štítem na 100 % — při 0 ztráty Zdraví se žádná dlaždice nezablokuje a drápy nepřidají +3 Brnění.',
        keywords: ['blokovaná', 'blok', 'jammed', 'plivač', 'kyselina'],
      },
      spike_retaliate: {
        term: 'Trnitý krunýř (Odplata)',
        shortTag: 'Odveta nepřítele',
        summary: 'Chitinový slídič vrátí 3 DMG pokaždé, když přežije běžný Útok bez Přetížení.',
        mechanics:
          'Kdykoli zasáhneš předního Chitinového slídiče normálním Útokem (pod hranicí Přetížení) a on přežije, ihned ti udělí 3 DMG do Štítu/Zdraví. Nespustí se při zabití, Přetížení Útoku, TECH, Odvetě ani Overdrive.',
        tacticalTip:
          'Sleduj varování ⚠ ODPLATA v náhledu tahu a doraz Slídiče jednou ranou nebo Přetížením.',
        keywords: ['odplata', 'trnitý', 'slídič', 'krunýř', '3 dmg'],
      },
      volatile_burst: {
        term: 'Bio-exploze',
        shortTag: 'Řetězový výbuch',
        summary: 'Spórový roztoč při smrti vybuchne za 6 průrazného DMG všem ostatním nepřátelům.',
        mechanics:
          'Jakmile Spórový roztoč padne, okamžitě způsobí 6 průrazného poškození všem přeživším mutantům (praská Aegis Pipy, obchází Brnění a může řetězově odpálit další Roztoče).',
        tacticalTip:
          'Zlikviduj předního Roztoče, když za ním stojí silně obrnění mutanti — explozí jim prorazíš zdraví zadarmo.',
        keywords: ['exploze', 'roztoč', 'řetěz', 'průraz', 'výbuch'],
      },
      thermal_charge: {
        term: 'Žárové nabíjení',
        shortTag: 'Odpočet 3 tahy',
        summary: 'Žárový žahavec se 2 tahy neškodně nabíjí a ve 3. tahu vypálí výboj za 16 DMG.',
        mechanics:
          'První 2 tahy cyklu neudělují žádné poškození a odpočítávají čas do výboje (2T → 1T). Ve 3. tahu udeří za 16 DMG. Zásah za 16+ DMG v jednom tahu ho Omráčí a vrátí odpočet na začátek.',
        tacticalTip:
          'Uděl Žahavci 16+ DMG za 1 tah pro Omráčení a reset bomby, nebo ho posuň dopředu přes [R].',
        keywords: ['nabíjení', 'žahavec', 'žárové', '16 dmg', 'odpočet', 'omráčení'],
      },
      stagger: {
        term: 'Omráčení (Stagger)',
        shortTag: 'Přerušení 16+ DMG',
        summary: 'Udělení 16+ HP/BRN poškození v jednom tahu přeruší Těžké údery i Žárové nabíjení.',
        mechanics:
          'Pokud Žárový žahavec (nabíjení), Krunýřový kolos (Těžký úder) nebo Xenomorfní Matriarcha (Těžký úder) utrpí 16+ celkového poškození do HP a Brnění v jednom tahu a přežije, je OMRÁČEN: jeho příští akce klesne na 0 DMG a nabíjení se vrátí na 2T.',
        tacticalTip:
          'Sleduj štítek ⚡ OMRÁČÍ! na kartě nepřítele při najetí na silný Útok nebo Overdrive.',
        keywords: ['omráčení', 'stagger', 'přerušení', '16', 'kolos', 'žahavec', 'boss'],
      },
      tile_hex: {
        term: 'Kletba dlaždice (⬡)',
        shortTag: 'Sabotáž barvy',
        summary: 'Nepřítel prokleje dlaždici; zahrání této barvy, dokud sesilatel žije, jej vyléčí.',
        mechanics:
          'Od 2. tahu Žlučový plivač a Matriarcha označí silnou dlaždici Útoku/Obrany značkou ⬡ KLETBA. Pokud tuto barvu aktivuješ, zatímco sesilatel žije, okamžitě se vyléčí +4 HP a získá +3 Brnění. Zabití sesilatele nebo Overdrive Kletbu zruší.',
        tacticalTip:
          'Zahraj jinou barvu, zabij sesilatele přes Overdrive/Rozmach/Odstrčení, nebo jeho léčení přeraz.',
        keywords: ['kletba', 'hex', 'plivač', 'boss', 'léčení', 'overdrive'],
      },
      caustic_slag: {
        term: 'Žíravá struska (☣)',
        shortTag: 'Znečištění balíčku',
        summary: 'Nezablokovaná kyselina přidá 0hodnotovou Strusku, která při ponechání na desce spaluje 2 HP.',
        mechanics:
          'Až 2 kusy Žíravé strusky (barva TECH, hodnota 0) mohou vstoupit do cyklu po nezablokovaném zásahu kyselinou. Každá Struska držená na konci kola udělí 2 DMG. Zahrání TECH nebo spuštění Overdrive Strusku trvale spálí.',
        tacticalTip:
          'Vykryj kyselinu Štítem, nebo Strusku bezpečně spal příští sadou TECH či Overdrive.',
        keywords: ['struska', 'blight', 'kyselina', 'spálit', 'tech', 'overdrive'],
      },
    },
  },
};
