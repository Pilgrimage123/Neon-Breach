---
status: accepted
---

# 0010. Anthropological Integrity, External Tools, and Pax Particularis

We aligned Neon Breach's setting and domain language with *The Pax Particularis: A World Reordered* and Catholic philosophical anthropology's distinction between **using an external tool** (holding a telescope) and **altering intrinsic human nature** (surgically modifying eyes to zoom). Consequently, `Hero` was reframed as a human defender wearing external chrome-and-solar gear, `Cyber Implant` became **`Tactical Module`** (*Taktický modul*), `Cyber-Clinic` became **`Restorative Clinic`** (*Obnovná klinika*, healing natural design rather than modifying healthy flesh), `Stork Nursery` became **`Guild Apprenticeship`** (*Cechovní učení*, removing ectogenesis/incubator-pod framing), `Bloodline Crest` became **`Family Crest`** (*Rodový erb*), and the five civic feasts (*Happy Wife Day*, *Three-Day Man Day*, *National Borders Day*, *Nuclear Day*, *Remigration Day*) were mapped onto Dynasty Events and map badges.

## Considered Options

- **Keep "Cyber Implant" and "Stork Nursery" as Pure Sci-Fi Metaphors**: Rejected because surgical body-modification and ectogenesis directly contradict *Pax Particularis*'s restorative medicine ethic and anthropological boundary.
- **Refactor All Internal Engine Identifiers (`CyberImplantId`, `CYBER_CLINIC`, `bloodlineCrest`)**: Rejected to preserve save compatibility and avoid unnecessary churn across combat/simulation tests.

## Consequences

- Player-facing EN/CS copy and `GLOSSARY.md` strictly use `Restorative Clinic`, `Tactical Module`, `Guild Apprenticeship`, and `Family Crest` (enforced by `translations.test.ts` legacy-term guards).
- Internal TypeScript identifiers (`CyberImplantId`, `MapNodeType` `'CYBER_CLINIC'`, `hero.implants`, `hero.incubatingTile`, `hero.bloodlineCrest`, and `ectogenesis_nursery_gala`) remain unchanged for backwards compatibility.
