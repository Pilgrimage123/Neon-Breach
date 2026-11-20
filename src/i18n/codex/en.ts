import type { CodexTranslationPack } from './types';

export const EN_CODEX_TRANSLATIONS: CodexTranslationPack = {
  codexButtonLabel: 'Codex',
  codexTitle: 'Tactical Codex & Hero Dossier',
  codexSubtitle:
    'Complete breakdown of Hero passives, Overdrive protocols, combat mechanics, and Mutant traits.',
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
    status: 'Status & Mutant Rules',
  },
  mechanicsLabel: 'How It Works',
  tacticalTipLabel: 'Tactical Tip',
  heroes: {
    kira: {
      roleTag: 'Tech-Surge Tempo · Scaling Burst',
      playstyleLead:
        'High-speed cyber-duelist Hero built around banking Held Attack/Defense Tiles across Turns, stacking massive TECH Damage Boosts, and firing frequent Plasma Blitz Overdrives.',
      passivePowers: [
        {
          name: 'Held Tile Momentum',
          badge: '+1 ATK / DEF Held',
          description:
            'Every Attack or Defense Tile left unresolved on the Board from the previous Turn (marked HELD) gains +1 flat base value this Turn. Stacks additively with Mono-Wire Edge (+2).',
        },
        {
          name: 'Synapse Overdrive Engine',
          badge: '+20% OD per TECH',
          description:
            'Resolving TECH Tiles charges +20% Overdrive per Tile (compared to +4% per Attack/Defense Tile), allowing rapid Overdrive cycles.',
        },
        {
          name: 'Offensive Focus (Zero Retain)',
          badge: '0 Retain · 0 Counter',
          description:
            'Retains 0 Shield between Turns without Aegis Capacitor, favoring proactive kills or full-Turn Defense stacks.',
        },
      ],
      overdriveRule:
        'Available at 100% Overdrive [Space]. Firing Plasma Blitz resets Overdrive to 0%, immediately hits ALL living Mutants, and keeps you in your active command phase so you can still resolve a Tile color on the same Turn!',
      overdriveBreakdown: [
        'Deals 20 Pierce DMG to ALL living Mutants (ignores Mutant Armor; still absorbed by active Aegis Pips).',
        'Grants +30% DMG Boost immediately (amplifies an Attack stack played on the same Turn!).',
        'Grants +6 Shield to absorb upcoming counter-attacks.',
      ],
      synergies:
        'Mono-Wire Edge (+2 on Held Attack Tiles), Surge Resonator (3-Tile Stack Surges), Flux Injector (+10% extra OD on TECH), and Phase-Blade Emitter (30% Armor Pierce).',
      tacticalLoop:
        'Turn 1: Resolve TECH (+42% DMG Boost & +20% OD/Tile) while holding Attack Tiles to power them up (+1 each). Turn 2: Trigger Plasma Blitz (+30% DMG Boost), then unleash the boosted Attack Stack Surge!',
    },
    auraline: {
      roleTag: 'Armored Juggernaut · UpCharge Anchor',
      playstyleLead:
        'Frontline heavy juggernaut Hero with 78 Max HP, 18 persistent starting Armor every combat, and 14 Memory. Starts with 1 Dud in each color—and converts every Dud resolved into +1 UpCharge.',
      passivePowers: [
        {
          name: 'Juggernaut Armor',
          badge: '+18 Armor / Combat',
          description:
            'Starts every encounter with 18 persistent Armor underneath Shield (DMG -> Shield -> Armor -> HP), absorbing hits across Turns without decaying or suffering Corrode.',
        },
        {
          name: 'Dud Overclock (UpCharge)',
          badge: '+1 UpCharge per Dud',
          description:
            'Starts with 3 Dud Tiles (1 Attack, 1 Defense, 1 TECH). Resolving any Dud grants +1 UpCharge (+1 extra Tile drawn onto next Turn’s Board), letting her cycle faster without needing to purge every Dud.',
        },
        {
          name: 'High-Memory Neural Rig',
          badge: '78 HP · 14 MEM',
          description:
            'Starts with 78 Max HP and 14 Memory—enough to run heavyweight AI Skill Chips like Apex Overwhelm.AI (Mem 5) + Adaptive Guard.AI (Mem 4) simultaneously.',
        },
      ],
      overdriveRule:
        'Available at 100% Overdrive [Space]. Sovereign Broadside is a Free Action that reinforces Armor and floods the next draw with +2 UpCharge.',
      overdriveBreakdown: [
        'Deals 20 Pierce DMG to ALL living Mutants (ignores Armor).',
        'Grants +10 persistent Armor to sustain deep frontline trades.',
        'Grants +2 UpCharge so your next Turn draws +2 extra Tiles onto the Board.',
      ],
      synergies:
        'Plasma Amplifier & Nano-Weave Plating (turns 0-value Duds into +2 ATK / +2 DEF Tiles), Synapse Overclock (+3 SHD on TECH Duds), Surge Resonator (3-Tile Surges using Duds), and Tempo Feed.AI.',
      tacticalLoop:
        'Let your 18 starting Armor absorb early hits while cycling 1-Dud-per-color into +1 UpCharge draws, stack Surge thresholds with Duds, and drop Sovereign Broadside (+10 Armor, +2 UpCharge) to overpower Boss phases.',
    },
    zuri: {
      roleTag: 'Armor-Shred Tactician · TECH Specialist',
      playstyleLead:
        'Airborne swarm commander Hero specializing in AoE Armor Shred, hybrid Tactical Shielding, and the fastest Overdrive generation in the roster—trading away Held bonuses and native Turn-1 Surges.',
      passivePowers: [
        {
          name: 'Solar Capacitor Uplink',
          badge: '+25% OD per TECH',
          description:
            'Resolving TECH Tiles generates +25% Overdrive per Tile—the highest in the roster—allowing frequent Solar Swarm Protocol activations.',
        },
        {
          name: 'Innate Armor Shred Core',
          badge: '-8 ARM All · 3 Pierce',
          description:
            'Zuri carries an innate TECH Armor Shred Tile that strips 8 Armor from ALL Mutants while dealing 3 direct Pierce DMG to the frontline target.',
        },
        {
          name: 'Hybrid Tactical Shield',
          badge: '+4 SHD · +24% DMG',
          description:
            'Zuri’s second core TECH Tile grants +4 Shield and +24% DMG Boost simultaneously, bridging defense and offense while charging +25% Overdrive.',
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
        'Synapse Overclock (+3 Shield per TECH Tile), Surge Resonator (unlocks 3-Tile Surges on her 3/3/3 balanced Master Tile Pool), Flux Injector (+35% OD per TECH Tile!), and Armor Crack.AI.',
      tacticalLoop:
        'Respect your 3/3/3 Blind Spot (no Turn-1 Surge without extra AI Skill Chips or Surge Resonator): weave innate TECH Tiles to strip Armor, gain +4 Shield/+24% DMG, charge +25% OD per Tile, then unleash Solar Swarm Protocol (-12 Armor All + 16 Pierce) into an Attack stack.',
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
      summary: 'Xenomorph Matriarch’s threshold passive locking her HP at 50% on first crossing to deploy +10 Armor and +1 Aegis Pip.',
      mechanics:
        'Once per fight, if a hit would push the Xenomorph Matriarch below 50% Max HP (55 HP on baseline), damage stops at 50% HP. She immediately gains +10 Armor and restores 1 Aegis Pip (◆).',
      tacticalTip:
        'Do not over-commit all your boosts into the 50% Phase Gate hit—save a way to crack her newly restored Aegis Pip and strip her +10 Armor afterward.',
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
        'A Defense Stack Surge deals 8 counter DMG directly to the frontline Mutant. Separately, the Kinetic Reflector Cyber Implant deals 3 DMG back to any attacker whose hit is absorbed by your Shield or Armor.',
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
        'Attack/Defense Tiles grant +4% OD each. TECH Tiles grant +20% (Kira), +15% (Auraline), or +25% (Zuri), plus +10% with Flux Injector and +15% on TECH Surge. Firing Overdrive resets OD to 0%, hits ALL Mutants with 100% Pierce damage, cleanses Jammed/Hex/Slag on Board, and does NOT end your Turn.',
      tacticalTip:
        'Fire Kira’s Overdrive (+30% DMG Boost) or Zuri’s Overdrive (-12 Armor All) BEFORE resolving your Attack stack on the same Turn!',
      keywords: ['overdrive', 'od', 'space', 'plasma blitz', 'broadside', 'swarm'],
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
      summary: 'Pyre Stinger charges for 2 harmless Turns before firing a 16 DMG Heavy blast on Turn 3.',
      mechanics:
        'Turns 1 and 2 of its cycle deal 0 DMG while telegraphing the countdown (2T → 1T). On Turn 3 it unleashes a 16 DMG Heavy blast. Dealing 16+ single-Turn damage triggers Broken Stance (Stagger) and resets the countdown.',
      tacticalTip:
        'Burst Pyre Stinger for 16+ DMG in 1 Turn to Stagger & reset its bomb, or Push it with [R] to line up a kill.',
      keywords: ['charge', 'thermal', 'stinger', 'countdown', '16 dmg', 'time-bomb', 'stagger'],
    },
    stagger: {
      term: 'Broken Stance (Stagger)',
      shortTag: '16+ Burst Interrupt',
      summary: 'The Staggered state triggered when a Mutant priming Charge or Heavy suffers 16+ single-Turn damage, reducing that action to 0 DMG.',
      mechanics:
        'When a Pyre Stinger (charging), Carapace Brute (2-slot juggernaut winding up a 14 DMG Heavy smash), or Xenomorph Matriarch (Heavy strike) takes 16+ combined HP and Armor damage in 1 Turn without dying, it enters Broken Stance (STAGGERED): its upcoming action drops to 0 DMG and Thermal Charge resets to 2T.',
      tacticalTip:
        'Watch for the ⚡ STAGGER! preview badge on Mutant pods when hovering high-burst Attacks or Overdrive.',
      keywords: ['stagger', 'broken stance', '16', 'burst', 'charge', 'heavy', 'brute', 'stinger', 'boss'],
    },
    tile_hex: {
      term: 'Tile Hex (⬡)',
      shortTag: 'Targeted Tile Curse',
      summary: 'Targeted curse placed on a high-value Attack or Defense Tile by Bile Spitter or Xenomorph Matriarch that heals and armors the caster.',
      mechanics:
        'From Turn 2 onward, Bile Spitter and Xenomorph Matriarch mark 1 high-value Attack or Defense Tile with ⬡ HEX. If you resolve that Tile color while the caster still lives, the caster immediately heals +4 HP and gains +3 Armor. Killing the caster or triggering Overdrive shatters all Tile Hexes.',
      tacticalTip:
        'Resolve another color, eliminate the caster via Overdrive/Cleave/Push, or out-burst the +4 HP heal.',
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
