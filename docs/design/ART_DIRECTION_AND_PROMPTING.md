# NEON BREACH — Art Direction & Gemini Prompting Playbook

> **Canonical Vocabulary & Decisions**: [GLOSSARY.md](../../GLOSSARY.md) · [ADR-0009](../adr/0009-light-in-chrome-solarpunk-theme-and-hearth-split.md) · [ADR-0011](../adr/0011-universal-build-time-sprite-baking.md) · [ADR-0012](../adr/0012-two-paradigm-animation-architecture-and-tier-a-mutant-convergence.md)
> **Animation Guidelines**: [Animation Do's & Don'ts](./animation/dos-and-donts.md) · [Hero Playbook](./animation/hero-animation-playbook.md) · [Mutant Playbook](./animation/mutant-animation-playbook.md)

This playbook is the canonical visual and prompting standard for generating **Hero Key-Art**, combat sprite sheets, portraits, and Mutant assets in Neon Breach using Gemini image generation.

---

## 1. Visual North Star: Arcade Neon-Chrome Airbrush

Our visual benchmark is the **Title Emblem** ([`title_logo_0.png`](../../assets-src/title/title_logo_0.png) and [`title_logo_4.png`](../../assets-src/title/title_logo_4.png)). Every Hero, Mutant, and portrait must look like it was pulled from the same high-voltage 1990s Neo-Geo / *Marvel vs. Capcom* arcade cabinet art.

### Five Non-Negotiable Style Pillars

1. **Deep Crushed Shadows + High-Gloss Speculars**: Surfaces must never look chalky or flat. Armor, chrome, enamel, patent leather, and chitin need deep near-black shadow troughs contrasted against razor-sharp white/neon specular highlights.
2. **Mandatory Dual-Color Neon Rim Lighting**: Every character silhouette is carved out of darkness by intense, contrasting rim lights on opposite edges (e.g., Electric Cyan on the left, Hot Gold or Magenta on the right). For **Hero Key-Art**, use tight, crisp dual-color rim lighting hugging the outer ink outline (no bloated blurry outer aura); for **combat sprite sheets**, use crisp black outer ink with internal/tight neon rim highlights so all Heroes match Kira immediately on stage.
3. **Bold 90s Arcade Comic Ink Outlines + Airbrushed Gradients**: Heavy, confident black ink linework paired with smooth, hyper-saturated airbrush color transitions—especially in hair, plasma weapons, and armor bevels.
4. **Jewel & Neon Palette Purity**: Use rich jewel tones (royal emerald, crimson, cobalt, liquid gold) electrified by pure neon accents (cyan, hot magenta, acid lime, solar amber). Never let outfits drift into muddy browns, olive drab, or desaturated slate greys.
5. **Exaggerated Arcade Attitude, ~5-Head Proportions & Special-Feature Framing**: Standardize all Hero Key-Art and combat sprites on **~5 heads tall** sole-to-crown stylized arcade proportions (matching [`kira_key_art.png`](../../assets-src/key-art/kira_key_art.png) and [`kira_sheet_a.png`](../../assets-src/heroes/kira_sheet_a.png)), with bold, chunky, simplified comic shapes and line weight that stay crisp at combat scale (`~180–220px`). **Be sensitive to each character's signature vertical/horizontal special features** (e.g., Auraline's towering rococo pouf, tall crests, wings, or floating drones) and actively reserve canvas composition and orientation space for them rather than squashing or cropping them to fit a standard frame.

---

## 2. Anti-Blandness Diagnosis & Banned Prompt Triggers

### Why Text-Only `4×4` Sheets on White/Green Look Boring

Generating a `4×4` sprite grid directly from text on a pure white (`#FFFFFF`) or flat chroma-green (`#00D856`) background triggers three failure modes in Gemini:

- **White-Paper Lighting Trap**: White backgrounds force Gemini into soft, even "tabletop RPG token" or "character turnaround" lighting—killing specular bloom, crushing contrast, and turning chrome into dull grey.
- **Grid Conservatism**: Asking for 16 poses at once pressures the model to keep every pose stiffly upright and polite to avoid cell overlap.
- **Style Drift**: Without an attached style reference, Gemini defaults to generic fantasy/sci-fi illustration instead of Neon Breach's specific arcade neon-chrome airbrush look.

### Banned Prompt Words

Never use these phrases in Neon Breach art prompts—they actively pull Gemini toward bland, desaturated output:

- `concept art`, `character turnaround`, `reference sheet`, `model sheet`
- `matte`, `muted`, `earthy`, `pastel`, `realistic`, `photorealistic`, `gritty`
- `tabletop RPG`, `D&D`, `neutral studio lighting`, `soft diffused lighting`, `even lighting`
- `white background` (unless explicitly required for an isolated cutout edge case)

---

## 3. Canonical 2-Stage Reference-Anchored Workflow

All new characters and major visual overhauls follow a strict two-stage pipeline.

### Stage 1: **Hero Key-Art** (Style & Silhouette Lock)

1. **Attach Style & Proportion References**: Attach [`assets-src/title/title_logo_0.png`](../../assets-src/title/title_logo_0.png) (and optionally [`title_logo_4.png`](../../assets-src/title/title_logo_4.png)) as the **Rendering & Gloss Reference**, AND attach [`assets-src/key-art/kira_key_art.png`](../../assets-src/key-art/kira_key_art.png) as the mandatory **Hero Proportion & Line-Weight Anchor** (~5 heads tall sole-to-crown, expressive arcade face scale, chunky comic ink weight, tight dual rim lighting).
2. **Generate Single Master Illustration (Special-Feature Composition)**: Generate one dynamic full-body or 3/4 action illustration on a **solid pitch-black `#000000`** background with mandatory dual neon rim lighting. **Be sensitive to special features**—actively budget canvas orientation and composition space for towering hair, crests, wings, or wide weapons instead of shrinking them to fit standard framing. For Auraline, compose her ~5-head body in the **lower ~50–55%** of a tall `9:16` vertical canvas, reserving the **upper ~35–40%** for her towering rococo pouf plus **~8–10%** clean `#000000` headroom at the top.
3. **Iterate Until 1:1 Match**: Do not proceed to sprite sheets until the **Hero Key-Art** matches the Title Emblem's gloss, line weight, contrast, and attitude.
4. **Lock & Store**: Save the approved master illustration to `assets-src/key-art/<character>_key_art.png`.

### Stage 2: Combat Sprite Sheets (`4×4` + `2×2` Splicing)

1. **Attach Locked Key-Art**: Attach `assets-src/key-art/<character>_key_art.png` as the primary **Character + Style Reference**.
2. **Default Backdrop — Pitch-Black `#000000` + Neon Rim-Light**: Generate sheets on solid `#000000` with bright neon rim-lighting tracing the entire outer silhouette so `cleanDarkBackgroundData` in [`scripts/bakeSprites.ts`](../../scripts/bakeSprites.ts) cleanly separates dark comic outlines without eating into the character.
3. **Fallback Backdrop — `#00D856` Chroma-Green**: Reserve `#00D856` (`cleanChromaGreenData`) strictly for characters with non-glowing dark outer silhouettes or bright white garments (`Feral Nurse`), and explicitly demand **dark-stage arcade speculars + zero green color spill** so the green screen never flattens lighting.
4. **Animation & Baking Invariants** (see [`dos-and-donts.md`](./animation/dos-and-donts.md)):
   - Keep pose heights consistent within continuous loops (`Δh <= 8px` for idle breathing).
   - **Tall-silhouette cell layout & body-span scaling**: Heroes with tall vertical silhouettes (such as Auraline with her towering caricature rococo pouf) must use **fewer sprite rows with taller portrait cells** (`4×2` or `4×3` per sheet instead of `4×4` square cells) AND calibrate runtime scale to **sole-to-eye body span** so her body stays full-scale alongside Kira and Zuri while the pouf towers above.
   - Never bake wide horizontal beams or transient VFX into character cells (render beams/halos at runtime via `projectSpriteLandmarkToStage`).
   - Use **`2×2` heroic keyframe splicing** for extreme signature poses (e.g., `F11` Surge Blast / Artillery Roar) instead of forcing extreme recoil into a cramped `4×4` generation.

---

## 4. Roster Signature Palette & Silhouette Matrix

| Character | Silhouette & Gear Hook | Primary Surface Palette | Neon Accent & Energy | Mandatory Dual Rim-Light |
| :--- | :--- | :--- | :--- | :--- |
| **Kira (`KIRA-09`)** | Cropped biker jacket, glowing LED visor/goggles, voluminous undercut ponytail, compact plasma pistol | Crimson-red leather, pitch-black tactical pants, chrome buckles | Hot Magenta-to-Electric-Cyan hair, Violet-Pink plasma | **Electric Cyan** + **Hot Magenta** |
| **Auraline (`AURALINE-07`)** | **~5 heads tall** sole-to-crown body in lower ~50–55% of `9:16` frame + expressive **baroque/rococo long dress** with **chunky, simplified cyber holo-plating** (sculpted pauldrons, **cinched V-pointed ornamental armored slim corset** with cyan plasma-cable lacing, wide panniers, bold glowing cyan holo-lace motifs, **exaggerated caricature high rococo pouf** ~2.5× face height filling upper ~35–40% with holo-plumes & solar-reactor crest, oversized rail-cannon) | Glossy **Royal Emerald-Chrome** + **Liquid Gold** bold embossed plating | **Electric Cyan** bold holo-filigree, plasma corset lacing, Reactor Core vents & cannon coils, **Golden-Blonde** glowing hair | **Electric Cyan** + **Hot Liquid Gold** |
| **Zuri (`ZURI-03`)** | Curvy, full-figured, **generously endowed** **~5 heads tall** arcade scale matching Kira + **restorative legless 4-pod hover-thruster rig** (heavy obsidian/gold/indigo jet pods below hips, no lower legs/boots), **sculpted high Afrofuturist twin braided Afro-puffs / geometric crown-locs** with gold cuffs & glowing solar-gold tech beads, **chunky oversized round geek smart-glasses with flip-down holo-magnifier lens**, gold hoops, **Afrofuturist tribal golden-black geometric bicep tattoo** (right upper arm), **high-collared asymmetrical Deep Royal Indigo/Obsidian solar-engineer tunic** with bold simplified gold/amber Kente shoulder panels, brass utility tool-bandolier (micro-tools/calibration stylus), ankh diagnostic pouch, **oversized high-contrast Solar Gold on Obsidian Africa-emblem belt medallion**, and **chunky wrist-mounted holographic command deck** projecting floating solar-amber geometric telemetry schematics (solo, no Tri-Drones); airborne `9:16` framing with generous bottom plume clearance. **Tri-Drones (`zuri_drones_sheet.png`)**: unified **Deep Royal Indigo & Obsidian + Solar Gold** chassis with high-contrast Africa badge and smooth Kira-weight comic ink, color-coded by role: **Aegis Walker (`Defense` = Electric Cyan)**, **Med-Rotor (`TECH` = Emerald-Mint Green)**, **Solar Hawk (`Attack` = Fiery Crimson-Red)** | **Deep Royal Indigo & Glossy Obsidian** armor/tunic & drone hulls, **Solar Gold** trim, **Warm Amber/Terracotta** bold Kente accents (zero crimson-red overlap on Zuri herself) | **Solar-Amber** floating geometric holo-HUD & tech beads, **Electric Blue-Violet** downward thruster plumes; Drones: **Electric Cyan** (`DEF`), **Emerald-Mint Green** (`TECH`), **Crimson-Red** (`ATK`) | **Solar Gold** + **Electric Violet** |
| **Mutants** | Asymmetric bio-mechanical silhouettes, exposed jaws/carapace/vials | Deep crushed violet-indigo, obsidian chitin, crimson muscle | **Acid Lime** (`Xeno Slime` / bile), **Electric Magenta**, **Toxic Cyan** | **Acid Lime** + **Electric Magenta** |

---

## 5. Copy-Paste Gemini Prompt Templates

### Template A: Stage 1 — **Hero Key-Art** Master Prompt

> **Attach:** `assets-src/title/title_logo_0.png` (gloss/color reference) + `assets-src/key-art/kira_key_art.png` (Hero proportion & line-weight anchor).

```text
Using the attached NEON BREACH title emblem ONLY for rendering gloss, lighting, and color energy (do NOT include any text, logos, or monsters), and matching the exact ~5-heads-tall sole-to-crown stylized arcade body proportions, expressive face scale, chunky comic ink line weight, and tight rim-light style of the attached Kira Hero Key-Art, paint a single full-body Hero Key-Art illustration of [CHARACTER NAME & ROLE].

STYLE & RENDERING (CRITICAL):
- Exact 1990s arcade cabinet airbrush + bold, chunky black comic ink outlines matching the attached Kira Hero Key-Art.
- Simplified, bold, readable shapes that survive downscaling to combat sprite size (no tiny micro-filigree).
- Deep crushed near-black shadow troughs contrasted against razor-sharp glossy chrome, enamel, and specular highlights.
- Hyper-saturated jewel and neon colors with smooth airbrushed gradients.
- Exaggerated arcade comic attitude, sharp expressive face, and dynamic heroic stance.

CHARACTER DESIGN:
- [SILHOUETTE & ARMOR/OUTFIT DETAILS]
- [HAIR / HEADGEAR / HUD DECALS]
- [SIGNATURE WEAPON & ENERGY GLOW]

LIGHTING & BACKGROUND:
- Isolated on a completely flat, solid pitch-black (#000000) background with ZERO scenery, ZERO floor shadow, and ZERO text.
- Tight, crisp dual neon rim lighting hugging the outer ink silhouette (no bloated blurry outer halo): [RIM COLOR 1] on the left edge and [RIM COLOR 2] on the right edge, separating every dark ink outline cleanly from the #000000 background.
```

---

### Template B: Stage 2 — `4×4` Combat Sprite Sheet Prompt

> **Attach:** Locked `assets-src/key-art/<character>_key_art.png` as Character + Style Reference.

```text
Using the attached Hero Key-Art as the exact character design, outfit, colors, and arcade neon-chrome rendering reference, generate a clean 4×4 sprite sheet (16 evenly spaced cells in 4 rows × 4 columns, facing right) on a completely flat, solid pitch-black (#000000) background.

STRICT SHEET RULES:
- Preserve the EXACT glossy chrome speculars, bold comic ink outlines, deep crushed shadows, and dual neon rim lighting ([RIM COLOR 1] + [RIM COLOR 2]) from the Hero Key-Art in every cell.
- Do NOT flatten lighting or turn materials matte.
- Every cell must keep the character centered horizontally with feet planted on a consistent baseline, NO overlapping between adjacent cells, NO grid lines, NO labels, and NO background scenery.
- Keep standing idle/walk head heights uniform across loop frames; keep weapon muzzle flashes/beams compact or omitted so the full body stays large in each cell.

ROW LAYOUT (4×4):
- Row 0 (F0–F3): Idle breathing loop (4 subtle, consistent-height frames).
- Row 1 (F4–F7): Forward tactical step/brace (F4–F5) and weapon aim + fire (F6–F7).
- Row 2 (F8–F11): Recoil brace (F8), charge/overcharge windup (F9–F10), and signature heroic blast pose (F11).
- Row 3 (F12–F15): Cooldown/venting (F12), guard/shield pose (F13), hit stagger flinch (F14), and one-knee defeat/overload pose (F15).
```

*(For extreme `F11` signature poses that feel cramped in `4×4`, run a `2×2` batch using the same Hero Key-Art reference and splice the best cell into `F11` per [`dos-and-donts.md`](./animation/dos-and-donts.md#L35).)*

---

### Ready-to-Run Prompt: Auraline (`AURALINE-07`) Stage 1 **Hero Key-Art**

> **Attach:** `assets-src/title/title_logo_0.png` and `assets-src/key-art/kira_key_art.png`.

```text
Using the attached NEON BREACH title emblem ONLY for rendering gloss, lighting, and color energy (do NOT include any text, logos, or monsters), and matching the exact ~5-heads-tall sole-to-crown stylized arcade body proportions, expressive face scale, chunky comic ink line weight, and tight rim-light style of the attached Kira Hero Key-Art, paint a single full-body Hero Key-Art illustration of AURALINE, an armored neo-baroque juggernaut vanguard.

STYLE & RENDERING (CRITICAL):
- Exact 1990s arcade cabinet airbrush + bold, chunky black comic ink outlines matching the attached Kira Hero Key-Art.
- ~5 heads tall sole-to-crown body proportions (larger expressive arcade face/eyes, compact athletic torso, chunky armored boots) matching Kira, while her exaggerated rococo pouf towers high above her brow.
- Simplified, bold, readable baroque armor and glowing cyan holo-lace motifs—NO tiny micro-filigree or busy fine lines—so every detail stays crisp at combat sprite size.
- Deep crushed near-black shadow troughs contrasted against razor-sharp glossy chrome, lacquered enamel, and mirror-bright specular highlights.
- Hyper-saturated jewel and neon colors—NO dull browns, NO muted greys, NO matte cloth.
- Fierce, confident royal-commander arcade expression with sharp eyes and a battle-ready smirk.

CHARACTER DESIGN (AURALINE):
- Tall `9:16` vertical portrait canvas: compose her ~5-head body in the **lower ~50–55%** of the frame, reserving the **upper ~35–40%** for her massive multi-tiered rococo pouf and plumes, with **~8–10%** clean `#000000` headroom above the top plumes.
- Expressive, sweeping baroque/rococo long dress fused with bold, chunky decorative cyberpunk holo-plating: sculpted pauldrons, a **sharply cinched hourglass V-pointed cyberpunk/rococo ornamental armored slim corset** (bold Royal Emerald-Chrome & Liquid Gold trim, glowing Electric Cyan plasma-cable front lacing, glowing cyan Reactor Core centerpiece, and clean cyan holo-lace neckline), wide sculpted pannier hip plates, and layered floor-length skirt tiers with bold glowing Electric Cyan holographic scrollwork motifs.
- Glowing Electric Cyan Reactor Core vents embedded in her chest plate, gauntlets, and belt buckle, plus a sleek glowing cyan holographic HUD monocle/earpiece.
- Radiant golden-blonde hair styled into an exaggerated, towering caricature high rococo pouf (~2.0×–2.5× the height of her face above her brow), ornamented with glowing translucent Electric Cyan & Gold holographic plumes, bold baroque filigree tiara arcs, and a miniature glowing holographic solar-reactor crest nested in the curls, with lush golden-blonde curls cascading behind her.
- Wielding an oversized, heavy chrome-and-gold Artillery Rail-Cannon crackling with bright Electric Cyan plasma coils.

LIGHTING & BACKGROUND:
- Isolated on a completely flat, solid pitch-black (#000000) background with ZERO scenery, ZERO floor shadow, and ZERO text.
- Tight, crisp dual neon rim lighting hugging her outer ink outlines (no bloated blurry outer halo): bright Electric Cyan on the left edge and Hot Liquid Gold on the right edge, cleanly separating every dark ink outline from the #000000 background.
```

---

### Ready-to-Run Prompt: Zuri (`ZURI-03`) Stage 1 **Hero Key-Art**

> **Attach:** `assets-src/title/title_logo_0.png` and `assets-src/key-art/kira_key_art.png` (deliberately omit legacy red-jacket `zuri_spritesheet.png` so crimson-jacket/ponytail/exposed-midriff details never bleed back in).

```text
Using the attached NEON BREACH title emblem ONLY for rendering gloss, lighting, and color energy (do NOT include any text, logos, or monsters), and matching the ~5-heads-tall stylized arcade scale, expressive face/eye scale, chunky comic ink line weight, and tight rim-light style of the attached Kira Hero Key-Art, paint a single full-body Hero Key-Art illustration of ZURI, the Afrofuturist solar swarm robotics geek commander.

STYLE & RENDERING (CRITICAL):
- Exact 1990s arcade cabinet airbrush + bold, chunky black comic ink outlines matching the attached Kira Hero Key-Art.
- Curvy, full-figured ~5 heads tall arcade proportions matching Kira's head/eye scale and simplified chunky shapes—simplify Kente patterns into bold, readable geometric Solar Gold & Warm Amber/Terracotta panels that stay crisp at combat sprite size.
- Deep crushed near-black shadow troughs contrasted against razor-sharp glossy chrome, lacquered enamel, and mirror-bright specular highlights.
- Joyful, charismatic, geeky arcade commander expression with a big warm grin.

CHARACTER DESIGN (ZURI — SOLO, NO TRI-DRONES, ZERO OVERLAP WITH KIRA):
- Tall `9:16` vertical portrait canvas: compose Zuri hovering in the center-upper-middle with ~8–10% clean `#000000` headroom above her sculpted crown-puffs, ~12–15% clean `#000000` hover clearance at the bottom so her Electric Blue-Violet thruster plumes taper completely uncropped, and horizontal clearance for her puffs and floating telemetry.
- Restorative legless 4-pod hover-thruster rig: 4 heavy glossy obsidian, chrome, and Solar Gold jet thruster pods mounted beneath her hips blasting bright Electric Blue-Violet plasma plumes downward (NO human lower legs or boots).
- Afrofuturist hair & geek eyewear (NO swept-back ponytail, NO red hair): sculpted high twin geometric braided Afro-puffs / Bantu-knot crown-locs in natural jet-black hair threaded with gold metallic cuffs and glowing solar-gold tech beads; chunky oversized round geek smart-glasses (thick gold-and-indigo frames) with a flip-down glowing solar-amber holographic magnifier/HUD lens over one eye; bold gold hoop earrings.
- Solar-engineer outfit (NO cropped red jacket, NO exposed midriff, NO biker gloves): fitted, high-collared asymmetrical Deep Royal Indigo & Glossy Obsidian solar-engineer tunic (full torso coverage, sculpting a generously endowed, voluptuous curvy bust contour with crisp comic-ink shading and subtle gold seam piping clearly visible behind the bandolier), bold simplified Solar Gold & Warm Amber/Terracotta Kente shoulder panels, a bold high-contrast Afrofuturist tribal golden-and-black geometric tattoo wrapping her bare right bicep/deltoid, a brass utility tool-bandolier holding micro-tools & a glowing calibration stylus, an ankh-badged diagnostic pouch, an oversized (~1.5× larger) high-contrast belt medallion (polished Solar Gold Africa-continent silhouette inset on a deep pitch-black/obsidian disc with a thick gold rim), and insulated indigo-and-gold engineer gauntlets.
- Geek command rig: chunky wrist-mounted Afrofuturist holographic command deck on her left forearm projecting floating glowing Solar-Amber Afro-geometric drone-telemetry schematics and holo-keys that she taps with her right hand.
- Zuri SOLO—do NOT include her three autonomous drones (Solar Hawk, Aegis Walker, Med-Rotor).

LIGHTING & BACKGROUND:
- Isolated on a completely flat, solid pitch-black (#000000) background with ZERO scenery, ZERO floor shadow, and ZERO text/UI borders.
- Tight, crisp dual neon rim lighting hugging her outer ink outlines (no bloated blurry outer halo): bright Solar Gold on the left edge and Electric Violet on the right edge, cleanly separating every dark ink outline from the #000000 background.
```

---

### Ready-to-Run Prompt: Zuri **Tri-Drone Sync** Sheet (`assets-src/heroes/zuri_drones_sheet.png`)

> **Attach:** `assets-src/heroes/zuri_drones_sheet.png` (3-drone horizontal `3:1` layout/pose reference) and `assets-src/key-art/zuri_key_art.png` (smooth comic-ink style & Deep Royal Indigo/Obsidian + Solar Gold chassis reference).

```text
Redraw the attached 3:1 horizontal Tri-Drone sprite sheet on a clean solid white (#FFFFFF) background with clear separation between the 3 drones (Aegis Walker left, Med-Rotor center, Solar Hawk right, all facing right), matching the smooth 90s arcade airbrush + bold, chunky black comic ink outlines + simplified readable shapes of the attached Zuri Hero Key-Art (ZERO gritty, speckled, or rough weathered metal texture).

SHARED CHASSIS (ALL 3 DRONES):
- Deep Royal Indigo & Glossy Obsidian armor plating with polished Solar Gold trim, simplified bold Kente geometric accents, and a high-contrast Solar Gold Africa-continent silhouette on a pitch-black obsidian badge on each hull.

ROLE COLOR-CODING (ATK / DEF / TECH):
- Left — Aegis Walker (Defense = Electric Cyan): Quadruped tank walker with Indigo/Obsidian + Solar Gold hull, bright Electric Cyan glowing top radar dish, Electric Cyan cockpit visor/trim, and translucent Electric Cyan hex energy shield dome in front.
- Center — Med-Rotor (TECH = Vibrant Emerald-Mint Green): Twin-rotor support drone with Indigo/Obsidian + Solar Gold body, gold-cuffed black braided tech-cables trailing behind, bright Emerald-Mint Green glowing twin rotor rings, glowing green medical cross core, and mechanical arms holding a green-cross medkit and glowing green bio-syringe.
- Right — Solar Hawk (Attack = Fiery Crimson-Red / Hot Solar-Coral): Sleek gunship jet drone with Indigo/Obsidian + Solar Gold hull and Kente wing chevrons, fierce Fiery Crimson-Red glowing hawk eye visor, crimson wing strike stripes, 4-barrel rotary cannon with glowing crimson-orange muzzles, and fiery crimson-orange-to-gold afterburner jets.
```
