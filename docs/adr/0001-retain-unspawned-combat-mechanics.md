# Retain Unwired Combat Mechanics and Edge-Lock Infrastructure

The combat engine (`gameEngine.ts`) and HUD (`TacticalDock.tsx`, `CombatStageCanvas.tsx`) intentionally retain 11 implemented, unit-tested tactical puzzle mechanics (`isHotPotato`, `isContagion`, `isTemptation`, `edgeLockActive`, `tugOfWarMeter`, `battlefieldRule`, `Loot Runner`, `Mercy Target`, `Sleepwalker`, `Plasma Barrel`, and `Decoy Totem`) that have no encounter spawners in normal runs yet.

These mechanics are high-priority upcoming encounter content rather than abandoned code: stripping and rewriting them later would re-introduce risk across turn resolution, threat previews, and stage rendering. We keep their types, engine handlers, UI badges, and regression tests intact (`enemyRework.test.ts`), while wiring new encounters to opt into them cleanly in a future content pass.
