# Asymmetric Hero Combat Engines over Universal Tile Pools

We keep all AI Skill Chips, Cyber Implants, and Dynasty facility operations universal across the roster while differentiating the three Heroes through orthogonal, state-driven combat loops in `HeroSpec` and `CombatState`: Kira manipulates turn tempo via **Blitz Reflex** (an Attack-triggered free bonus turn with a turn cooldown reduced by full-Shield **Evasive Dodge**), Auraline manipulates draw capacity and persistent mitigation via **Reactor Core** Duds that restore both UpCharge and Armor even after Dynasty upgrades, and Zuri manipulates color sequencing via **Tri-Drone Sync** (a one-turn primed drone pulse that fires whenever she alternates Tile colors) alongside rapid TECH Overdrive generation.

## Considered Options

- **Class-locked AI Skill Chips and Implants**: Rejected because partitioning the 19-chip catalog by Hero shrinks combinatorial build variety and makes Dynasty facilities (FabLab, Heirloom Forge, Beta Arcade) less expressive.
- **Stat-only Hero passives (`HeroSpec` flat numbers only)**: Rejected because when Kira and Zuri both shared high TECH Overdrive generation without distinct turn/sequence loops, all three Heroes converged into identical color-stacking patterns once Standard and Prototype chips were equipped.
- **Multi-effect passive bundles (e.g., Kinetic Bulk Armor thresholds + multi-stat drone triggers)**: Rejected to keep each Hero's mental model streamlined to a single signature loop with one atomic payoff per trigger.

## Consequences

- `docs/design/HERO_FANTASIES.md` defines only qualitative Hero concepts and mechanical pillars without hardcoded stats, leaving all numerical tuning to `src/engine/data.ts` and `docs/design/BALANCE_GUIDE.md`.
- Innate Dud tiles carry a persistent `isReactorCore` origin tag so upgrading them at the Charter Academy, Stork Nursery, or FabLab preserves Auraline's signature engine rather than shutting it off.
- Turn preview (`previewColorResolution`) and the Tactical Hint Solver evaluate Kira's free-turn bonus, Auraline's Reactor Armor recharge, and Zuri's primed drone pulse directly so players never have to compute passive interactions manually.
- Armor absorbs `90%` of post-Shield damage (`10%` bleeds through to HP), and true `100%` Armor Pierce is reserved strictly for Spore Mite's **Bio-Rupture** and Zuri's precision **TECH Armor Shred / Solar Hawk Drone** pulses (`Phase-Blade Emitter` and Stork `pierce_boost` grant `40%` Pierce), while Kira's **Energy Dropkick** Overdrive executes a 2-hit `14` Frontline Kick (with knockback swap) + `10` All-Enemy Shockwave + `+8` Shield.

