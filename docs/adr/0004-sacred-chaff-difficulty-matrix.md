# Difficulty Tier Scaling & Stage-Invariant Base Mutant Stats

The 5-tier difficulty matrix (`src/engine/difficulty.ts`) scales both Mutant HP (`0.65×` on T1 up to `1.46×` on T5, `1.54×` for `Carapace Brute` and `Xenomorph Matriarch`) and damaging intents (`0.65× / 0.85× / 1.0× / 1.35× / 1.75×`) with `keepChaffMathSacred: false`, superseding the original non-scaled intent damage and sacred `9 HP` Spore Mite rule.

To keep each Mutant's base stats recognizable across `Stage 01`–`Stage 12` at Baseline (Tier 3), per-Stage `lateBonus` HP inflation in `src/engine/encounterBuilder.ts` is to be removed. Stage progression is driven instead by `Encounter Budget`, multi-Mutant pairings, District unlocks, and explicit `Overcharged` hazard modifiers rather than hidden per-Stage stat creep.
