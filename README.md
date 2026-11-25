# Neon Breach: Xeno-Purge

A turn-based 2D cyberpunk tactical puzzle roguelite built with React 19, TypeScript, Tailwind CSS v4, and a hybrid Canvas2D + WebGL2 combat stage. Guide a cybernetic hero (**Kira**, **Auraline**, or **Zuri**) across a 12-stage Neo-Prague sky-bridge by resolving one of three Tile colors (`Attack`, `Defense`, `TECH`) each turn from a 6-slot tactical Board while chaining Stack Surges, UpCharges, and Overdrive maneuvers.

## Commands

```bash
npm install --no-package-lock   # Install dependencies locally (keeps bun.lock canonical)
npm run dev                     # Start Vite dev server on port 3000 (with DEV-only Combat Labs)
npm run lint                    # TypeScript check (tsc --noEmit)
npm test                        # Run all unit test suites via node:test + tsx
npm run bake:sprites            # Bake raw assets-src/ sprites into src/assets/sprites/baked/
npm run build                   # Production Vite build into dist/
npm run preview                 # Preview production build
```

> **AI Studio Note:** `bun.lock`, `metadata.json`, port `3000`, `DISABLE_HMR`, and `allowedHosts: true` in `vite.config.ts` are intentionally preserved for Google AI Studio compatibility (see [ADR-0002](./docs/adr/0002-ai-studio-compatibility.md)).

## Architecture & Documentation

- **Domain Vocabulary:** [GLOSSARY.md](./GLOSSARY.md)
- **Architecture Decision Records:** [docs/adr/](./docs/adr/)
- **Design & System Specifications:** [docs/design/](./docs/design/)
  - [Balance & Tile Valuation](./docs/design/BALANCE_GUIDE.md)
  - [Hero Core Fantasies](./docs/design/HERO_FANTASIES.md)
  - [Tactical Tiles & 12-Stage Metropolis](./docs/design/TILES_DESIGN.md)
  - [Enemy Design Principles](./docs/design/ENEMY_DESIGN_PRINCIPLES.md)
  - [Low Floor, High Ceiling Design](./docs/design/LOW_FLOOR_HIGH_CEILING_DESIGN.md)
  - [Cross-Platform Accessibility](./docs/design/CROSS_PLATFORM_ACCESSIBILITY.md)
  - [Spatial Minimalist UX](./docs/design/SPATIAL_MINIMALIST_UX.md)
  - [Animation Architecture & Domain Playbooks](./docs/design/ANIMATION_ARCHITECTURE.md)
