# Preserve Google AI Studio Hosting & Tooling Compatibility

This project is actively edited and previewed both locally (Node + npm) and inside Google AI Studio (Bun + Cloud Run preview proxy). Therefore, we deliberately preserve `DISABLE_HMR` handling and `allowedHosts: true` in `vite.config.ts`, `"dev": "vite --port=3000 --host=0.0.0.0"` in `package.json`, `metadata.json` at the repo root, and `bun.lock` as the canonical lockfile.

Local Node verification installs dependencies with `npm install --no-package-lock` so no conflicting `package-lock.json` is committed alongside `bun.lock`.
