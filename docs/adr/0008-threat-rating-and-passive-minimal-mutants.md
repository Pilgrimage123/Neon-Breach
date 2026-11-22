# Unify Encounter Balancing via Multiplicative Threat Rating and Passive-Minimal Mutants

Standard non-boss Mutants are capped to pure stats, move types (`Attack`, `Heavy`, `Pierce`, `Overwhelm`, `Acid`, `Armor`, `Bolster`, `Charge`, `Pause`), and cadences with `passive: 'none'` (retaining persistent passives only on **Spore Mite** for Push kill-order puzzles and **Xenomorph Matriarch** as Boss), while both initial `encounterBuilder` spawning and `reinforcementDirector` drops share one multiplicative **Threat Rating** currency calibrated to a `~12 DMG/Turn` starter Hero baseline.

## Considered Options

- **Additive HP + DPR pricing vs. Multiplicative Lifespan Threat Rating**: Additive formulas systematically underprice high-HP/high-Armor Mutants like Carapace Brute because durability multiplies how many Turns the Mutant survives to act; multiplying `effectiveAvgDpr × expectedTurnsAlive` with Windup, Burst, and Multi-Enemy Tax prevents under-budgeted lethal waves.
- **Per-Mutant persistent passives vs. Move-type & Cadence differentiation**: Giving every Mutant a bespoke passive plus global reactive rules (`Weapon Break`, `Desperation Enrage`) cluttered the HUD with prose barks and hidden thresholds; expressing identity through `Pause`, `Pierce`, `Overwhelm`, and `Broken Stance` keeps the live battlefield purely graphical.

## Consequences

- `src/engine/threatRating.ts` is the single source of truth for Mutant Threat Ratings and Node Encounter Budgets, while `docs/adr/0004-sacred-chaff-difficulty-matrix.md` remains preserved (intent damage never scales by difficulty and Spore Mite stays `9 HP` on Tiers 2–5).
- Adding or tuning a Mutant template automatically updates its Threat Rating, initial Node spawning, and Reinforcement Director costs together.
