---
status: accepted
---

# 0009. Light in Chrome Solarpunk Theme and Family Hearth Split

We unified Neon Breach's world framing, 4 Metropolis Districts, 4 core `EVENT` nodes, and recovery node around a lighthearted comic solarpunk-cyberpunk *"Light in Chrome: World of the New Dawn"* (*Světlo v chromu: Svět Nového Úsvitu*) tone with **Dr. Lindqvist** as the flamboyant eco-fanatic antagonist, while renaming `Bio-Med Bay` to **`Family Hearth`** (*Rodinný krb*) and relocating `NurseStageCanvas` to **`Cyber-Clinic`**. Previously, the map mixed sterile clinical labels (`Bio-Med Bay`, `Sub-Canopy AI Core`) with warm family-dynasty mechanics (`Smart-Hearth`), creating a tonal clash and placing the medical nurse sprite inside a domestic hearth bar.

## Considered Options

- **Full World & Combat Reboot**: Rename the game, replace all 3 Heroes and Mutant sprites, and redesign combat resources. Rejected to preserve proven combat balance, existing sprite assets, and test coverage.
- **Copy-Only Flavor Pass**: Rename strings without moving `NurseStageCanvas` or adding Settlement Growth UI. Rejected because keeping a clinical nurse in `Family Hearth` contradicted the warm home-base fantasy.

## Consequences

- Internal engine identifiers (`MapNodeType` `'MED_BAY'`, screen `'medbay'`, `applyMedBayAction`, event IDs `rogue_ai_cache`, `black_market_smuggler`, `derelict_combat_drone`, `tachyon_terminal`, and asset key `'nurse'`) remain unchanged so existing saves, balance simulations, and engine tests stay backwards-compatible.
- `Cyber-Clinic` and `Chip Dealer` mechanics and names remain intact, while `Family Hearth` houses the `HeroPortraitCanvas` showcase and all 7 recovery/household actions.

> **Update Note:** `Cyber-Clinic` was subsequently renamed to **`Restorative Clinic`** (*Obnovná klinika*) in [ADR-0010](./0010-anthropological-integrity-external-tools-and-pax-particularis.md).
