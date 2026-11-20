# Sacred Chaff Math & Non-Scaled Enemy Attack Across Difficulty Tiers

The 5-tier puzzle-strategy difficulty matrix (`src/engine/difficulty.ts`) deliberately **never** scales enemy attack/intent damage and keeps Spore Mite (`larva`, `9 HP`) unscaled across Tiers 2–5 (`keepChaffMathSacred: true`), scaling difficulty instead through Undo/Reset budgets, Information Horizon concealment, Par/Overtime turn clocks, non-chaff HP multipliers, and Tier 5 mandatory bonus objectives.

Scaling enemy attack numbers or early chaff HP by tier would shatter deterministic defensive Shield breakpoints, 2-tile starter kills, and 6-Pierce Bio-Rupture puzzle chains that define the tactical puzzle identity.
