import type { CodexTranslationPack } from './types';

export const EN_CODEX_TRANSLATIONS: CodexTranslationPack = {
  codexButtonLabel: 'Codex',
  codexTitle: 'Tactical Codex & Hero Dossier',
  codexSubtitle:
    'Complete breakdown of Reordered Neo-Prague Hero passives, external tactical gear, combat mechanics, and Dr. Lindqvist’s Mutants.',
  tabHeroes: 'Heroes & Powers',
  tabGlossary: 'Combat Glossary',
  heroSelectorAria: 'Select Hero dossier',
  vitalsHeader: 'Hero Profile & Neural Rig',
  baseStatsLabels: {
    hp: 'Max HP',
    credits: 'Starting CR',
    capacity: 'Memory',
    startingPool: 'Master Tile Pool',
  },
  passivePowersHeader: 'Passive Powers & Combat Modifiers',
  overdriveHeader: 'Signature Overdrive (100% OD)',
  freeActionBadge: 'Free Action · Does Not End Turn',
  innateCoreHeader: 'Innate Core (Permanent Tiles)',
  innateCoreDesc:
    'Always present in your Master Tile Pool regardless of installed AI Skill Chips.',
  startingGearHeader: 'Starting AI Skill Chips',
  synergiesHeader: 'Best Restorative Clinic Synergies',
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
    status: 'Status & Mutant Rules',
  },
  mechanicsLabel: 'How It Works',
  tacticalTipLabel: 'Tactical Tip',
  heroes: {
    kira: {
      roleTag: 'Blitz Reflex Tempo · Evasive Striker',
      playstyleLead:
        'High-speed cyber-duelist Hero built around chaining a free bonus turn on Attack resolutions (Blitz Reflex), shaving cooldowns via full-Shield Evasive Dodges, and banking +1 Momentum on Held Tiles.',
      passivePowers: [
        {
          name: 'Blitz Reflex (Free Turn)',
          badge: 'ATK → +1 Free Turn (3T CD)',
          description:
            'Resolving Attack Tiles while Blitz Reflex is Ready immediately refills the Board and grants a free bonus turn before Mutants act (3-Turn cooldown).',
        },
        {
          name: 'Evasive Dodge',
          badge: 'Full Shield Block → -1 CD',
          description:
            'Completely blocking an incoming Mutant attack with Shield (0 HP damage taken) triggers an acrobatic vault dodge that reduces Blitz Reflex cooldown by -1 Turn.',
        },
        {
          name: 'Held Tile Momentum',
          badge: '+1 ATK / DEF Held · +10% OD/ATK',
          description:
            'Every Attack or Defense Tile kept on the Board from the previous Turn (or across Blitz Reflex) gains +1 flat value, and Attack Tiles charge +10% Overdrive each.',
        },
      ],
      overdriveRule:
        'Available at 100% Overdrive [Space]. Firing Energy Dropkick resets Overdrive to 0%, slams the frontline Mutant and knocks it backward, blasts ALL living Mutants with an energy shockwave, and keeps you in your active command phase!',
      overdriveBreakdown: [
        'Deals 12 DMG to the frontline Mutant and knocks a surviving target backward 1 slot.',
        'Detonates a 10 DMG energy shockwave across ALL living Mutants (including the frontline target, for 22 total frontline DMG!).',
        'Grants +8 Shield to absorb upcoming counter-attacks.',
      ],
      synergies:
        'Mono-Wire Edge (+2 on Held Attack Tiles), Surge Resonator (3-Tile Stack Surges), Aegis Capacitor (50% Shield retain for Evasive Dodge setups), and Phase-Blade Emitter (30% Armor Pierce).',
      tacticalLoop:
        'Turn 1: Resolve Attack to trigger Blitz Reflex (free bonus turn + instant Board refill), then use your free turn on Defense (+1 Held Momentum) to full-block the enemy strike and trigger Evasive Dodge (-1 Blitz CD)!',
    },
    auraline: {
      roleTag: 'Armored Juggernaut · Reactor Core Anchor',
      playstyleLead:
        'Frontline heavy juggernaut Hero with 68 Max HP, 2 persistent starting Armor every combat, and 14 Memory. Starts with 1 Reactor Core Tile in each color (2 ATK, 3 DEF, +15% DMG TECH)—converting every Reactor Core into +1 UpCharge, +1 Armor, and +15% Overdrive.',
      passivePowers: [
        {
          name: 'Juggernaut Armor',
          badge: '+2 Armor / Combat',
          description:
            'Starts every encounter with 2 persistent Armor underneath Shield (DMG -> Shield -> Armor -> HP), absorbing hits across Turns without decaying or suffering Corrode.',
        },
        {
          name: 'Reactor Core (UpCharge & Plating)',
          badge: '+1 UC · +1 ARM · +15% OD',
          description:
            'Starts with 3 active Reactor Core Tiles (2 ATK, 3 DEF, +15% DMG TECH). Resolving any Reactor Core—even after upgrading it at the Charter Academy, Guild Apprenticeship, or FabLab—grants +1 UpCharge, +1 persistent Armor, and +15% Overdrive.',
        },
        {
          name: 'High-Memory Neural Rig',
          badge: '68 HP · 14 MEM',
          description:
            'Starts with 68 Max HP and 14 Memory—enough to run heavyweight AI Skill Chips like Apex Overwhelm.AI (Mem 5) + Adaptive Guard.AI (Mem 4) simultaneously.',
        },
      ],
      overdriveRule:
        'Available at 100% Overdrive [Space]. Sovereign Broadside is a Free Action that reinforces Armor and floods the next draw with +2 UpCharge.',
      overdriveBreakdown: [
        'Deals 20 Pierce DMG to ALL living Mutants (ignores Armor).',
        'Grants +4 persistent Armor to sustain deep frontline trades.',
        'Grants +2 UpCharge so your next Turn draws +2 extra Tiles onto the Board.',
      ],
      synergies:
        'Charter Academy & Guild Apprenticeship (upgrades Reactor Core tiles into high-stat Prodigies while preserving their +1 UC / +1 ARM bonus), Plasma Amplifier, Nano-Weave Plating, and Surge Resonator.',
      tacticalLoop:
        'Let your 2 starting Armor absorb early hits while cycling Reactor Core Tiles for +1 UpCharge and +1 Armor, upgrade them at Dynasty facilities, and drop Sovereign Broadside (+4 Armor, +2 UpCharge) to overpower Boss phases.',
    },
    zuri: {
      roleTag: 'Tri-Drone Tactician · TECH Specialist',
      playstyleLead:
        'Airborne swarm commander Hero with 64 Max HP who weaves between Tile colors to fire synchronized Tri-Drone support pulses (+4 Pierce DMG, +7 Shield, or +4 HP) while charging the fastest TECH Overdrive (+20%/Tile) in the roster.',
      passivePowers: [
        {
          name: 'Tri-Drone Sync',
          badge: 'Hawk +4⚔ · Aegis +7🛡 · Med-Rotor +4💚',
          description:
            'Resolving a Tile color primes the matching autonomous drone (Attack = Solar Hawk +4 Pierce DMG; Defense = Aegis Walker +7 Shield; TECH = Med-Rotor +4 HP). Switching to a different color on the next Turn fires the primed drone alongside your new action!',
        },
        {
          name: 'Solar Capacitor Uplink',
          badge: '+20% OD per TECH',
          description:
            'Starts with 4 TECH Tiles in her 9-Tile pool and generates +20% Overdrive per TECH Tile resolved—the highest in the roster—unlocking Turn-1 TECH Surges and frequent Solar Swarm Protocol activations.',
        },
        {
          name: 'Innate Armor Shred & Tactical Shield',
          badge: '-8 ARM All · +7 SHD / +24% DMG',
          description:
            'Carries innate TECH tiles that strip -8 Armor from ALL Mutants (+3 Pierce DMG) and project +7 Shield with +24% DMG Boost.',
        },
      ],
      overdriveRule:
        'Available at 100% Overdrive [Space]. Solar Swarm Protocol fires as a Free Action without ending your Turn, shattering Mutant Armor before your follow-up Attack stack.',
      overdriveBreakdown: [
        'Strips -12 Armor and deals 16 Pierce DMG to ALL living Mutants.',
        'Grants +8 Shield to brace against incoming counter-fire.',
        'Cleanses -2 Corrode stacks from your Hero.',
      ],
      synergies:
        'Family Crest (pairs two colors to double-dip with Tri-Drone Sync color alternation!), Synapse Overclock (+3 Shield per TECH Tile), Flux Injector (+30% OD per TECH Tile!), and Armor Crack.AI.',
      tacticalLoop:
        'Alternate Tile colors each Turn (e.g. TECH → Attack → Defense) so your primed Tri-Drone fires on every single action (+4 HP, +4 Pierce DMG, +6 Shield) while cycling +20% OD TECH Tiles into Solar Swarm Protocol.',
    },
  },
  glossary: {
    armor: {
      term: 'Armor (ARM)',
      shortTag: 'Persistent Defense',
      summary: 'Persistent damage mitigation on Auraline and armored Mutants that absorbs regular hits before HP drops.',
      mechanics:
        'Regular Attack damage and Defense Surge counter damage hit Armor first, reducing Armor 1-for-1 until it reaches 0; any leftover damage hits HP. Armor persists across Turns until shredded or broken. Optional Quantized Scale displays HP and Armor in compact 5-unit increments.',
      tacticalTip:
        'Bypass or break Mutant Armor using Attack Stack Surge (4+ Tiles shatters all front Armor), TECH Armor Shred (-8 or -10 Armor to ALL Mutants), Phase-Blade Emitter (30% Pierce), or Overdrive (100% Pierce).',
      keywords: ['armor', 'arm', 'bolster', 'auraline', 'quantized scale'],
    },
    shield: {
      term: 'Shield (SHD)',
      shortTag: 'Hero Mitigation',
      summary: 'Temporary single-Turn energy mitigation protecting your Hero from Mutant strikes, Acid Spit, and Spike Retaliation.',
      mechanics:
        'Absorbs incoming damage 1-for-1 before Armor and HP are reduced. Blocking an Acid Spit completely (0 HP lost) prevents Bile Spitter or Xenomorph Matriarch from jamming a Board Tile. At Turn end, unused Shield clears down to your retention cap (0 by default; 50% with Aegis Capacitor).',
      tacticalTip:
        'Keep enough Shield to absorb incoming damage completely—if Acid Spit deals even 1 HP damage, it jams a Tile!',
      keywords: ['shield', 'shd', 'def', 'defense', 'retain'],
    },
    aegis_pip: {
      term: 'Aegis Pip (◆)',
      shortTag: 'Single-Hit Charge',
      summary: 'Discrete single-hit barrier charge on a Mutant (1 hit = 1 Pip cracked) that absorbs one entire damaging hit.',
      mechanics:
        'Whenever a Mutant has 1 or more Aegis Pips, the next single damaging hit (even a 30-DMG Attack Surge, Overdrive, or Bio-Rupture explosion) cracks 1 Pip and deals 0 HP/Armor damage.',
      tacticalTip:
        'Never waste a giant Attack Stack Surge or Overdrive into an active Aegis Pip. Crack the Pip first with a small Attack, Defense Surge counter, or Zuri’s 3-DMG Pierce TECH Tile.',
      keywords: ['pip', 'aegis', 'diamond', 'negate', 'crack', 'skitter', 'brute', 'boss'],
    },
    phase_lock: {
      term: '50% Phase Gate',
      shortTag: 'Boss Threshold',
      summary: 'Xenomorph Matriarch’s threshold passive locking her HP at 50% on first crossing to deploy +8 Armor and +1 Aegis Pip.',
      mechanics:
        'Once per fight, if a hit would push the Xenomorph Matriarch below 50% Max HP (52 HP on baseline), damage stops at 50% HP. She immediately gains +8 Armor and restores 1 Aegis Pip (◆).',
      tacticalTip:
        'Do not over-commit all your boosts into the 50% Phase Gate hit—save a way to crack her newly restored Aegis Pip and strip her +8 Armor afterward.',
      keywords: ['phase', 'gate', 'lock', 'boss', 'matriarch', '50%'],
    },
    dmg_boost: {
      term: 'DMG Boost (+% DMG)',
      shortTag: 'Attack Multiplier',
      summary: 'Percentage multiplier applied to the total base damage of resolved Attack stacks.',
      mechanics:
        'Applied to Attack Tile sums as floor(baseDamage × (1 + DMG Boost / 100)). Decays by -10 percentage points at the end of every Turn. Does not multiply Overdrive, Defense Surge counter, or TECH Pierce damage.',
      tacticalTip:
        'Stack TECH Damage Boosts first, hold Attack Tiles for +1 Turn, then cash in your high DMG Boost before it decays.',
      keywords: ['boost', 'dmg', 'damage', 'multiplier', 'decay', 'tech'],
    },
    armor_pierce: {
      term: 'Armor Pierce (PIERCE)',
      shortTag: 'Bypass Armor',
      summary: 'Damage that ignores Mutant Armor and strikes HP directly.',
      mechanics:
        'Overdrive, Bio-Rupture explosions, and Armor-Shred TECH pulses deal 100% Pierce damage. Phase-Blade Emitter makes 30% of every Attack stack bypass Armor. Note: Pierce still cracks Aegis Pips (◆) instead of bypassing them.',
      tacticalTip:
        'Ideal against high-Armor Carapace Brutes or after Cobalt Skitter uses Aegis Projection (+4 Armor All).',
      keywords: ['pierce', 'penetration', 'ignore', 'armor', 'katana', 'phase-blade'],
    },
    armor_shred: {
      term: 'Armor Shred (SHRED)',
      shortTag: 'All-Mutant Strip',
      summary: 'TECH effect that permanently strips Armor from ALL living Mutants simultaneously.',
      mechanics:
        'Triggered by Zuri’s innate shred routine (-8 ARM All) or Armor Crack.AI (-10 ARM All). Reduces every living Mutant’s Armor down to 0 minimum, and pairs with direct Pierce damage to the front target.',
      tacticalTip:
        'Use Armor Shred on Turn 1 against Cobalt Skitter + Carapace Brute formations to strip Aegis Projection across the whole pack.',
      keywords: ['shred', 'strip', 'emp', 'armor', 'zuri', 'crack'],
    },
    cleave: {
      term: 'Cleave (CLEAVE)',
      shortTag: 'Splash Damage',
      summary: 'Secondary AoE damage dealt to all Mutants behind the frontline target on Attack Stack Surge.',
      mechanics:
        'Triggering an Attack Stack Surge deals 50% of the frontline Attack’s total damage to every other living Mutant. Benefits from 30% Armor Pierce if Phase-Blade Emitter is installed, though it does not shatter backline Armor.',
      tacticalTip:
        'Attack Surge Cleave also cracks Aegis Pips on backline Mutants for free!',
      keywords: ['cleave', 'aoe', 'splash', 'surge', 'backline'],
    },
    riposte: {
      term: 'Defense Counter & Reflect',
      shortTag: 'Defensive Counter',
      summary: 'Damage dealt back to Mutants when triggering Defense Stack Surge or absorbing hits with Shield.',
      mechanics:
        'A Defense Stack Surge deals 8 counter DMG directly to the frontline Mutant. Separately, the Kinetic Reflector Tactical Module deals 3 DMG back to any attacker whose hit is absorbed by your Shield or Armor.',
      tacticalTip:
        'Counter damage safely finishes low-HP Chitin Stalkers without triggering their Spike Retaliation.',
      keywords: ['riposte', 'reflect', 'counter', 'defense', 'auraline', 'zuri', 'kinetic'],
    },
    tile_pool: {
      term: 'Master Tile Pool & Memory',
      shortTag: 'Pool & Memory',
      summary: 'Your Hero’s persistent pool of Innate Tiles plus Tiles injected by equipped AI Skill Chips up to her Memory limit.',
      mechanics:
        'Each AI Skill Chip uses a Memory cost and adds 1–3 Tiles to your Master Tile Pool. You can install, uninstall, or scrap chips outside of combat via Chips & Pool (storing spares in the Chip Vault). During combat, 6 Tiles sit on the Board (expandable up to 9 via UpCharge).',
      tacticalTip:
        'Keep your Master Tile Pool lean! Uninstalling low-impact starter chips into the Chip Vault improves your odds of drawing 4-Tile Stack Surges.',
      keywords: ['pool', 'memory', 'capacity', 'chips', 'vault', 'draw', 'cycle', 'discard'],
    },
    held_tiles: {
      term: 'Held Tile (HELD)',
      shortTag: 'Board Carryover',
      summary: 'An unresolved Tile remaining on the Board into the next Turn (HELD), enabling color stacking and Kira’s +1 bonus.',
      mechanics:
        'Because you resolve only 1 Tile color per Turn, all unplayed Tiles remain on the Board next Turn (marked HELD) while new Tiles refill the Board to 6 (marked DRAWN). Kira gives HELD Attack/Defense Tiles +1 base value; Mono-Wire Edge adds +2 to HELD Attack Tiles.',
      tacticalTip:
        'Intentionally hold Attack Tiles for 1 Turn while resolving TECH or Defense to build a 4-Tile Stack Surge and trigger HELD bonuses.',
      keywords: ['held', 'drawn', 'carryover', 'monowire', 'kira'],
    },
    stack_surge: {
      term: 'Stack Surge',
      shortTag: '4+ Tile Payoff',
      summary: 'Bonus payoff triggered when resolving 4+ matching-color unjammed Tiles in one Turn (3+ with Surge Resonator).',
      mechanics:
        'Attack Surge: Shatters ALL Armor on the front Mutant + deals 50% Cleave DMG to all other Mutants + bypasses Spike Retaliation and Pustule Rupture. Defense Surge: Deals 8 counter DMG to the front Mutant. TECH Surge: Grants +15% extra Overdrive and +6 Shield.',
      tacticalTip:
        'Watch the Upcoming Draws strip to plan when your next draw will complete a 4-Tile Stack Surge!',
      keywords: ['surge', 'stack', '4+', '3+', 'resonator', 'armor break'],
    },
    overdrive: {
      term: 'Overdrive (OD)',
      shortTag: '0 AP Ultimate',
      summary: '100%-charged Hero ultimate maneuver (0 AP, does not end Turn) dealing Armor-piercing AoE damage plus signature utility.',
      mechanics:
        'Kira charges +10% OD per Attack Tile (+4% DEF / +12% TECH). Auraline charges +15% OD per Reactor Core or TECH Tile (+5% ATK/DEF). Zuri charges +20% OD per TECH Tile (+4% ATK/DEF). Firing Overdrive resets OD to 0%, hits ALL Mutants with 100% Pierce damage, cleanses Jammed/Hex/Slag on Board, and does NOT end your Turn.',
      tacticalTip:
        'Fire Kira’s Energy Dropkick (+30% DMG Boost) or Zuri’s Solar Swarm Protocol (-12 Armor All) BEFORE resolving your Attack stack on the same Turn!',
      keywords: ['overdrive', 'od', 'space', 'energy dropkick', 'broadside', 'swarm'],
    },
    corrode: {
      term: 'Corrode (COR)',
      shortTag: 'Shield Debuff',
      summary: 'Hero status stack that flatly subtracts from Shield gained on Defense plays (-1 Shield per stack) until cleansed.',
      mechanics:
        'Every stack of Corrode subtracts 1 Shield from the total Shield generated when you resolve a Defense stack (minimum 0 Shield). Inflicted by Bile Spitter’s Pustule Rupture (+2 COR when surviving non-Surge Attacks) and Caustic Claw Rend (+2 COR). Decays by -1 at Turn end and does not reduce TECH or Overdrive Shield.',
      tacticalTip:
        'Cleanse Corrode quickly using System Scrub.AI (-2 COR) or Zuri’s Overdrive (-2 COR), trigger Attack Surge to avoid Pustule Rupture, or rely on TECH Shield Tiles.',
      keywords: ['corrode', 'cor', 'acid', 'pustule', 'debuff', 'shield', 'cleanse'],
    },
    jammed_tile: {
      term: 'Jammed',
      shortTag: 'Board Lockout',
      summary: 'Locked status on a single Board Tile caused by unblocked Mutant acid hits or Overtime heat, preventing resolution for 1 Turn.',
      mechanics:
        'If Bile Spitter or Xenomorph Matriarch deals at least 1 unblocked HP damage with Acid Spit, 1 unjammed Tile on your Board becomes JAMMED. It cannot be resolved, does not count toward Stack Surge, and unjams automatically after your next color resolution (or immediately on Overdrive).',
      tacticalTip:
        'Raise enough Shield to absorb Acid Spit completely—preventing HP damage stops Jammed Tiles, Caustic Slag, and claw Armor gains.',
      keywords: ['jammed', 'jam', 'spitter', 'acid'],
    },
    spike_retaliate: {
      term: 'Spike Retaliation',
      shortTag: 'Mutant Counter',
      summary: 'Chitin Stalker’s passive punishing surviving non-Surge Attack hits with 3 immediate counter-damage.',
      mechanics:
        'Whenever you hit a Chitin Stalker in the front slot with a normal Attack (< Surge threshold) and it survives, it immediately deals 3 DMG to your Shield/Armor/HP. Bypassed if the hit kills it, if you trigger an Attack Stack Surge, or if you damage it via TECH, Defense Surge, or Overdrive.',
      tacticalTip:
        'Preview the red ⚠ RETALIATE badge on the tactical strip before committing—finish Chitin Stalker in one hit or surge through it.',
      keywords: ['retaliate', 'retaliation', 'thorny', 'stalker', 'spike', '3 dmg'],
    },
    volatile_burst: {
      term: 'Bio-Rupture',
      shortTag: 'Chain Explosion',
      summary: 'Spore Mite’s death passive dealing 6 Armor-piercing damage to all other living Mutants (and cracking Aegis Pips).',
      mechanics:
        'When a Spore Mite dies, it triggers an immediate 6 Pierce DMG detonation hitting every other living Mutant on the sky-bridge (cracking Aegis Pips or piercing straight through Armor, and even chain-detonating other Spore Mites).',
      tacticalTip:
        'Prioritize killing frontline Spore Mites when high-Armor Carapace Brutes or Pip-protected Cobalt Skitters stand behind them.',
      keywords: ['burst', 'rupture', 'spore mite', 'larva', 'explosion', 'chain'],
    },
    thermal_charge: {
      term: 'Thermal Charge',
      shortTag: '3-Turn Bomb',
      summary: 'Pyre Stinger charges for 2 harmless Turns before firing a 7 Overwhelm Heavy blast (14 DMG unblocked) on Turn 3.',
      mechanics:
        'Turns 1 and 2 of its cycle deal 0 DMG while telegraphing the countdown (2T → 1T). On Turn 3 it unleashes a 7 Overwhelm Heavy blast (up to 14 DMG unblocked at baseline Tier 3). Dealing 16+ single-Turn damage triggers Broken Stance (Stagger) and resets the countdown.',
      tacticalTip:
        'Burst Pyre Stinger for 16+ DMG in 1 Turn to Stagger & reset its bomb, or Push it with [R] to line up a kill.',
      keywords: ['charge', 'thermal', 'stinger', 'countdown', '14 dmg', 'overwhelm', 'time-bomb', 'stagger'],
    },
    stagger: {
      term: 'Broken Stance (Stagger)',
      shortTag: '16+ Burst Interrupt',
      summary: 'The Staggered state triggered when a Mutant priming Charge or Heavy suffers 16+ single-Turn damage, reducing that action to 0 DMG.',
      mechanics:
        'When a Pyre Stinger (charging), Carapace Brute (2-slot juggernaut winding up a 6 ×2 Overwhelm Heavy smash), or Xenomorph Matriarch (Heavy strike) takes 16+ combined HP and Armor damage in 1 Turn without dying, it enters Broken Stance (STAGGERED): its upcoming action drops to 0 DMG and Thermal Charge resets to 2T.',
      tacticalTip:
        'Watch for the ⚡ STAGGER! preview badge on Mutant pods when hovering high-burst Attacks or Overdrive.',
      keywords: ['stagger', 'broken stance', '16', 'burst', 'charge', 'heavy', 'brute', 'stinger', 'boss'],
    },
    tile_hex: {
      term: 'Tile Hex (⬡)',
      shortTag: 'Targeted Tile Curse',
      summary: 'Targeted curse placed on a high-value Attack or Defense Tile by Bile Spitter or Xenomorph Matriarch that heals and armors the caster.',
      mechanics:
        'On even Turns (Turn 2, 4, 6...), Xenomorph Matriarch marks 1 high-value Attack or Defense Tile with ⬡ HEX. If you resolve that Tile color while she still lives, she immediately heals +3 HP and gains +2 Armor. Killing the caster or triggering Overdrive shatters all Tile Hexes.',
      tacticalTip:
        'Resolve another color, eliminate the caster via Overdrive/Cleave/Push, or out-burst the +3 HP heal.',
      keywords: ['hex', 'tile hex', 'spitter', 'boss', 'heal', 'overdrive'],
    },
    caustic_slag: {
      term: 'Caustic Slag (☣)',
      shortTag: 'Exhaustible Hazard Tile',
      summary: 'Exhaustible 0-value hazard Tile injected into the discard or top of the draw pile by unblocked acid hits; burns for 2 DMG if held.',
      mechanics:
        'Up to 2 Caustic Slag Tiles (TECH color, 0 value) can enter your cycle when Bile Spitter or Xenomorph Matriarch deals unblocked Acid HP damage. Each Caustic Slag held on the Board at Turn end deals 2 DMG. Resolving TECH or firing Overdrive permanently purges Caustic Slag.',
      tacticalTip:
        'Absorb Acid Spit with Shield to prevent Caustic Slag, or purge it safely on your next TECH or Overdrive Turn.',
      keywords: ['slag', 'caustic slag', 'acid', 'purge', 'tech', 'overdrive'],
    },
  },
};
