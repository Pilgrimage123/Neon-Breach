# NEON BREACH — Universal Enemy Animation & Sprite Sheet Specification

> **Engineering & Generative Pipeline Standard:** This document defines the canonical architecture for generating, cutting out, animating, and integrating 2D side-view combatant sprites in **NEON BREACH**. It establishes the **3-Row 10-Frame Master Standard** (Attack, Pain, Death + Procedural Idle/Guard) alongside the **4×4 Extended State Architecture**, ensuring 100% stylistic cohesion, stable ground baselines, zero anchor jitter, and deterministic engine coupling.

---

## 1. Executive Summary & First-Principles Critique

### 1.1 Why Legacy Sprite Sheet Workflows Fail
Previous enemy pipelines (e.g., legacy 16-frame `4×4` sheets) suffered from three critical generative and runtime bottlenecks:
1. **Diffusion Model Entropy & Hallucination:** Generating 16 distinct high-detail poses simultaneously in modern image models (Midjourney, SDXL, Imagen 3, FLUX) causes severe morphological drift—weapons morph, limbs multiply, proportions warp, and color palettes de-saturate across cells.
2. **Wasteful Frame Budgeting for Static Idles:** Dedicating 4 full raster frames to organic breathing is inefficient. Static raster frames jitter when looped at low frame rates. Modern 2D engines achieve superior, silky fluid idles procedurally (sub-pixel sine squash-and-stretch, pelvic tilt, Hermite trajectory bobbing, and additive canvas glow pulsing).
3. **Chroma Insecurity (Pure White vs. Pure Magenta):** Rendering sprites on pure white (`#FFFFFF`) destroys interior monster elements (fangs, sclera, exposed bone, bio-luminescent saliva, white lab coats) unless complex flood-fill heuristics and pocket-scanners are executed. Pure Magenta (`#FF00FF`) provides infallible chroma separation with zero false positives.

### 1.2 The Solution: The 3-Row 10-Frame Core Paradigm
The universal generation contract divides the enemy's visual lifecycle into **3 thematic rows** containing **10 semantic animation keyframes** arranged in a uniform **4-column × 3-row grid (12 cells total, with 2 padded/empty slots in Row 2)**:
* **Row 1 — ATTACK (4 Frames):** Anticipation (Telegraph) → Active Strike (Apex Lunge) → Follow-Through (Momentum) → Recovery (Settle).
* **Row 2 — PAIN / HURT (2 Frames + 2 Empty Cells):** Impact (Kinetic Knockback) → Stagger (Hunched Balance Recovery).
* **Row 3 — DEATH (4 Frames):** Fatal Hit (Collapse Initiation) → Falling (Ballistic Arc) → Ground Impact (Sole Compression) → Resting Pose (Flat Defeated Carcass).

---

## 2. Generative Art Direction & Grid Contract

### 2.1 The 4×3 Uniform Geometry
To guarantee automated grid slicing without fragile, variable column widths, sheets must be generated in a fixed rectangular ratio (e.g., `1024×768` or `2048×1536`):

```
+-------------------+-------------------+-------------------+-------------------+
| ROW 1, COL 0      | ROW 1, COL 1      | ROW 1, COL 2      | ROW 1, COL 3      |
| ATK 1: ANTICIPATE | ATK 2: STRIKE     | ATK 3: FOLLOWTHRU | ATK 4: RECOVERY   |
+-------------------+-------------------+-------------------+-------------------+
| ROW 2, COL 0      | ROW 2, COL 1      | ROW 2, COL 2      | ROW 2, COL 3      |
| PAIN 1: IMPACT    | PAIN 2: STAGGER   | [EMPTY PADDING]   | [EMPTY PADDING]   |
+-------------------+-------------------+-------------------+-------------------+
| ROW 3, COL 0      | ROW 3, COL 1      | ROW 3, COL 2      | ROW 3, COL 3      |
| DEATH 1: FATAL    | DEATH 2: FALLING  | DEATH 3: IMPACT   | DEATH 4: RESTING  |
+-------------------+-------------------+-------------------+-------------------+
```

### 2.2 Frame-by-Frame Kinetic Specification

#### ROW 1 — ATTACK (4 Frames)
* **Frame 1 (Anticipation / Telegraph):** The enemy shifts weight onto the rear foot, pulling weapon, claws, or bioluminescent organs backward. Torso coils; silhouette narrows horizontally while expanding vertically. This frame doubles as the engine's `charged` or `heavyPrimed` telegraph pose.
* **Frame 2 (Active Strike / Impact Apex):** Explosive forward lunge. Weapon or striking limbs fully extended toward the front edge. Maximum horizontal reach and silhouette clarity. Weight violently transferred to the front foot.
* **Frame 3 (Follow-Through):** Weapon/limbs complete the kinetic arc past the point of impact. Torso overextended forward, trailing momentum. High kinematic strain.
* **Frame 4 (Recovery / Neutral Settle):** Limbs retracting smoothly toward neutral fighting stance. Feet replanted on the baseline. Weight re-centering. This frame serves as the baseline target for procedural idle blending.

#### ROW 2 — PAIN / HURT (2 Frames)
* **Frame 1 (Impact Recoil):** Violent kinetic flinch. Head snapped backward, spine arched in reverse, arms/weapons blown open in broken guard. Center of mass displaced backward by `+8..+14%`.
* **Frame 2 (Stagger / Balance Recovery):** Heavy hunched posture. Knees bent, feet sliding along the ground baseline to regain purchase. Used continuously for `staggered` (Broken Stance) engine turns.

#### ROW 3 — DEATH (4 Frames)
* **Frame 1 (Fatal Hit):** Severe backward buckling. Center of balance lost, knees folding, weapon or bio-appendages slipping from grip.
* **Frame 2 (Falling):** Ballistic descent. Torso tipping downward/backward mid-air, limbs trailing limply.
* **Frame 3 (Ground Impact):** Kinetic body strike against the flat horizontal ground baseline. Flesh/chitin compression, fluid splatter, slight elastic rebound.
* **Frame 4 (Resting Pose):** Completely motionless carcass resting flat along the horizontal ground baseline. Proportions and body mass remain 100% scale-identical to Frame 1 (no shrinking or melting).

---

## 3. Strict Generative Constraints & Diffusion Prompt Architecture

### 3.1 Uncompromising Generation Rules
1. **Reference-Conditioned Identity:** The enemy's anatomical silhouette, coloration, armor plates, weapons, and stylistic line weight must remain 100% identical to the reference design across all 10 active cells.
2. **Orientation Consistency:** All frames must face strictly in the same direction (default: **facing RIGHT** in sheet coordinates; mirrored via `ctx.scale(-1, 1)` in-game to face the heroine on the left).
3. **Rigid Ground Baseline:** Within each row, the soles of the planted feet (or the ground contact plane in death) must align to an exact flat horizontal baseline.
4. **Padding & Isolation:** A minimum of `24px` clear background margin must separate the outermost pixel of any extended weapon, claw, or recumbent body from cell boundaries. No neighbor-cell bleeding.
5. **Chroma Cleanliness:** Solid `#FF00FF` (Magenta) or `#FFFFFF` (White) flat background. Strictly **zero drop shadows**, zero ambient occlusion baked into the floor, zero grid lines, and zero floating text labels.

### 3.2 Production Prompt Formula (Midjourney / SDXL / ControlNet)

```text
[IMAGE_REFERENCE_URL] 2D game sprite sheet, side-view of the exact enemy character from the reference image, performing animations across a clean 3-row grid. 

Row 1: 4 animation frames of attack sequence (anticipation telegraph, explosive forward strike lunge, follow-through arc, recovery pose).
Row 2: 2 animation frames of hit reaction (severe knockback pain impact, hunched stagger recovery).
Row 3: 4 animation frames of death sequence (fatal hit recoil, falling collapse, ground impact, lying flat motionless resting pose).

Character facing right in all frames, perfectly aligned to a flat horizontal ground baseline in every row, uniform character scale and proportions across all 10 frames, identical color palette and design details to reference.

Even spacing, generous padding between frames, no overlapping limbs, clean cell margins, isolated on solid flat #FF00FF magenta background, crisp edges, 2D game asset, no text, no grid lines, no shadows, no floor texture, studio lighting --ar 4:3 --no text, font, labels, shadows, blur, gradients, border
```

---

## 4. Software Architecture & Runtime Integration

### 4.1 Grid Slicing & Metric Definition (`src/utils/*SpriteSheet.ts`)

Every frame structure maps its local torso center of mass (`anchorX`) and ground baseline contact (`bottomY`):

```ts
export interface EnemySpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Center of mass X inside frame rect (before facing flip) */
  anchorX: number;
  /** Deck sole plane Y inside frame rect */
  bottomY: number;
  /** Relative offset for bio-luminescence or eye glows */
  headOriginRel: { dx: number; dy: number };
  /** Relative offset for weapon / claw impact point */
  impactOriginRel: { dx: number; dy: number };
}
```

### 4.2 State Machine Priority Hierarchy (`sampleEnemyFrame`)

In the game loop, states are evaluated in strict priority order:

```
[1. DEATH] -> [2. BRACE / BUFF] -> [3. PAIN / FLINCH] -> [4. ATTACK] -> [5. STAGGERED] -> [6. PRIMED TELEGRAPH] -> [7. PROCEDURAL IDLE]
```

1. **`death` (`anim.dead`):** Steps through Row 3 (Frames 0..3) over `koProgress ∈ [0, 0.78]`, then clamps to Frame 3 (Resting Carcass) while fading alpha `1.0 → 0.0`.
2. **`brace` / `guard` (`bristleTimer > 0`):** Samples Attack Anticipation (Row 1, Frame 0) or Pain Stagger (Row 2, Frame 1) with additive shield glows.
3. **`pain` (`staggerTimer > 0`):** Samples Row 2 Frame 0 (Impact) for `u < 0.45`, transitioning into Frame 1 (Stagger).
4. **`attack` (`attackAnimTimer > 0`):** Samples Row 1 Frames 0..3 driven by a 4-keyframe Hermite trajectory:
   * `t ∈ [0.00, 0.22]`: Frame 0 (Anticipation), slight backward windup (`xProgress: +0.06`).
   * `t ∈ [0.22, 0.52]`: Frame 1 (Active Strike), violent forward leap (`xProgress: -0.28`, `yHopPx: -14`).
   * `t ∈ [0.52, 0.78]`: Frame 2 (Follow-Through), overextended strike (`xProgress: -0.32`, `yHopPx: 0`).
   * `t ∈ [0.78, 1.00]`: Frame 3 (Recovery), returning to stance (`xProgress: -0.06`).
5. **`staggered` (`enemy.staggered`):** Locks to Row 2 Frame 1 with a low-frequency procedural wobble (`sin(elapsed * 5.0) * 0.03 rad`).
6. **`primed` (`intent.kind === 'heavy'` / `charge`):** Holds Row 1 Frame 0 (Anticipation) with pulsing emissive glow.
7. **`idle`:** Procedural loop around Attack Frame 3 (Recovery) or neutral base with sine breathing:
   $$\text{scaleY} = 1 + 0.022 \cdot \sin(\text{elapsed} \cdot 2.5)$$
   $$\text{scaleX} = 1 - 0.011 \cdot \sin(\text{elapsed} \cdot 2.5)$$
   $$\text{tiltRad} = 0.015 \cdot \sin(\text{elapsed} \cdot 1.25)$$

### 4.3 Trajectory Hermite Smoothing & Dual-Frame Cross-Dissolve

To prevent visual popping between discrete frames:
* **C1 Monotone Hermite Splines (`interpolateMonotoneHermite`):** Eliminates acceleration kinks on lunges and recoils.
* **Smoothstep Cross-Dissolve:** Blends outgoing frame with incoming frame over a tuned window:
  * Fast Strikes: `0.050s` (crisp impact, no ghosting).
  * Flinches/Pain: `0.065s`.
  * Idle/Guard: `0.090s` (liquid organic transition).

---

## 5. Chroma Key & Defringing Pipeline (`spriteCutout.ts`)

### 5.1 Magenta `#FF00FF` Chroma Keying
When using solid `#FF00FF` (R=255, G=0, B=255):
* A pixel is classified as background if:
  $$R > 220 \quad \text{AND} \quad B > 220 \quad \text{AND} \quad G < 35 \quad \text{AND} \quad |R - B| < 30$$
* **Zero Interior False Positives:** Biological entities almost never possess saturated pure magenta in interior body volumes. Fangs, eyes, and bone remain 100% intact without pocket-scanning.

### 5.2 Defringing Formulation
On pixels directly bordering transparent background, magenta color spill is sanitized:
$$\text{excessMagenta} = \max\left(0, \min(R, B) - G\right)$$
$$R_{\text{clean}} = R - \text{excessMagenta} \cdot 0.85, \quad B_{\text{clean}} = B - \text{excessMagenta} \cdot 0.85$$

---

## 6. Verification & Quality Checklist

Before merging any reworked enemy sprite sheet, the implementation must satisfy all four gates:

1. **Geometry & Bounds Unit Test (`*.test.ts`):**
   * All 10 active frames fit strictly within canvas bounds.
   * `anchorX` lies within $(0, w)$ centered on torso mass.
   * `bottomY` touches the lowest foot sole plane ($h - 2 \le \text{bottomY} \le h$).
   * Frame sampling returns non-NaN coordinates for all animation states.
2. **Visual Continuity Audit (Live Browser):**
   * Enemy faces heroine on the left (`scale(-1, 1)` active).
   * No horizontal snapping or sliding during Idle $\to$ Attack $\to$ Idle transitions.
   * Ground contact point remains pinned to `enemyGroundY` through flinches and death.
   * Resting corpse lies flat on the glass deck without hovering or clipping through.
3. **Engine Intent Coupling:**
   * Heavy and Charge intents trigger Anticipation telegraph pose.
   * Hit events trigger kinetic Pain recoil.
   * Broken Stance (16+ DMG) locks unit in Stagger pose.
4. **Performance & Memory:**
   * Texture atlas size $\le 2048\times 1536$ (optimal: $1024\times 768$).
   * Zero per-frame memory allocation in `requestAnimationFrame` render loop.

---

## 7. Architektura WebGL2 Deformable 2D Mesh (`MeshSprite`) & Unifikovaný GLSL 300 es Pipeline

Pro nativní hardwarovou deformaci sítě a vlastní GPU shadery bez přepisování tahové logiky či stavových automatů byl vykreslovací subsystém v `CombatStageCanvas.tsx` a `combatRenderer.ts` povýšen z plochých 2D obdélníků (`ctx.drawImage`) na **3vrstvý hybridní kompozitor s čistým WebGL2 jádrem** (`src/components/combat/stageSpriteAdapter.ts` + `src/components/combat/webglMeshRenderer.ts`).

### 7.1 Třívrstvá hybridní kompozice scény (Z-Order Invariance)
Bojová scéna obsahuje procedurální vektorové vrstvy (vícevrstvé kaluže krve s kapilárami, Bézierovy křivky záměrů nepřátel, plovoucí typografii poškození), které by při naivním převodu do jediného WebGL kontextu ztratily ostrost nebo vyžadovaly triangulaci křivek. Řešením je přesné rozdělení do 3 synchronizovaných `<canvas>` vrstev se shodným rozlišením $\lfloor w \cdot \text{dpr} \rfloor \times \lfloor h \cdot \text{dpr} \rfloor$ a sdílenou kamerovou transformací (`cameraZoom`, `cameraPanX`, `cameraPanY`, `shakeOffset`):

1. **Vrstva 0 — Podklad (`canvasRef`, Canvas2D):**
   * Statické pozadí Neo-Prahy, geometrie skleněné mostovky, perzistentní krvácející dekály na podlaze/krytech/obrubníku a kontaktní eliptické stíny pod chodidly všech jednotek.
2. **Vrstva 1 — Postavy a odrazy (`webglCanvasRef`, Raw WebGL2 `#version 300 es`):**
   * Planární odrazy na skleněné mostovce (ořezané hardwarovým `gl.SCISSOR_TEST`), pohybové stíny při sprintu (`ghosts`), hlavní hrdinka (`Kira`, `Aurelia`, `Zuri`), 3 autonomní drony Zuri a všech 7 archetypů nepřátel vykreslovaných přes `MeshSprite`.
3. **Vrstva 2 — Popředí a telemetrie (`fgCanvasRef`, Canvas2D):**
   * Aditivní bio-luminiscenční záblesky, hexakosféra štítu, on-stage lifebary pod chodidly, vektorové trajektorie záměrů nepřátel, výsadkové paprsky, letící kapky krve, plazmové výboje, částice, plovoucí čísla poškození, kapky krve na hledí a volitelný debug drátěný model (`4×6 WIRE`).

### 7.2 Vzor Adapter (`ICharacterStageRenderer` & `IMeshSprite`)
Veškeré vykreslování postav v `combatRenderer.ts` je odděleno od konkrétního GPU API deklarativním příkazem `SpriteRenderCommand` předávaným do `webglRenderer.drawSprite(cmd)`:

* **Vstupy `SpriteRenderCommand`:**
  * `primarySource: HTMLCanvasElement` a volitelný `secondarySource?: HTMLCanvasElement | null` (pro plynulý cross-dissolve mezi 2 snímky animace přímo ve fragment shaderu).
  * `worldX`, `worldY`: Světová pozice kotvy chodidel (`anchorX`, `bottomY`).
  * `widthPx`, `heightPx`, `anchorOffsetXPx`, `anchorOffsetYPx`: Přesné rozměry snímku přepočtené přes `drawScale`.
  * `facingSign: 1 | -1` (zrcadlení nepřátel čelem k hrdince) a `verticalScaleSign` (pro vertikálně převrácené planární odrazy s měřítkem `-0.30` až `-0.32`).
  * `deform: ControlPointDeform`: 4 anatomické řídicí body (`feet`, `pelvis`, `waist`, `head`).
  * `uniforms: CharacterShaderUniforms`: Parametry pro vertex a fragment shader.

### 7.3 Deformovatelná $4 \times 6$ síť (`MeshSprite`) a 4bodová anatomická Hermitovská spline
Místo plochého 2trojúhelníkového obdélníku je každá postava vykreslena na rozdělené mřížce **$4 \times 6$ buněk (`35` vrcholů, `48` trojúhelníků, `144` indexů)**:

* **Struktura vrcholu (`8` floatů = `32` bajtů, prokládané pole `Float32Array(280)`):**
  $$\text{Vertex} = [x_{\text{world}},\, y_{\text{world}},\, u_0,\, v_0,\, u_1,\, v_1,\, h_{\text{weight}},\, \alpha_{\text{vertex}}]$$
  kde $h_{\text{weight}} = 1 - \frac{r}{\text{rows}} \in [0, 1]$ udává normalizovanou výšku vrcholu od chodidel ($h=0$) k hlavě ($h=1$).
* **Anatomická interpolace (`evaluateAnatomicalSplineRow`):**
  Čtyři virtuální řídicí body rozložené po výšce postavy (`feet` na $h=0.00$, `pelvis` na $h=0.33$, `waist` na $h=0.67$, `head` na $h=1.00$) definují lokální posun `(dx, dy)`, natočení řezu `rotRad` a šířkovou kompresi `scaleX`. Mezi sousedními uzly se interpoluje pomocí kubického Hermiteova vyhlazení:
  $$s(t) = t^2(3 - 2t), \quad t \in [0, 1]$$
  Protože uzel `feet` má $\text{dx}=0, \text{dy}=0, \text{rotRad}=0$, spodní řada vrcholů ($h=0$) zůstává při dýchání, záklonu i zásahu **absolutně přibitá k podlaze**, aniž by se PNG muselo rozřezávat na samostatné části těla.

### 7.4 Unifikovaný GLSL `#version 300 es` Vertex + Fragment Shader
Jeden sdílený shader program obsluhuje hrdinky, drony i všechny archetypy nepřátel:

1. **Vertex Shader (`UNIFIED_CHARACTER_VERTEX_SHADER`):**
   * Vypočítá relativní vektor vrcholu vůči kotvě chodidel `u_anchorWorld` a aplikuje `u_squashStretch`.
   * Vypočítá výškovou váhu $w(h) = h^2(3 - 2h)$ (nulová u chodidel, maximální u hlavy) a přičte harmonické kmitání $\sin(\text{u\_sway.z} + h \cdot 1.35) \cdot \text{u\_sway.x} \cdot w(h)$ spolu se střihem `u_shear * h`.
   * Transformuje výslednou světovou pozici ortografickou maticí `u_viewProjMatrix` (`mat3`), která přesně replikuje kamerový zoom, pan a trauma shake z Canvas2D.
2. **Fragment Shader (`UNIFIED_CHARACTER_FRAGMENT_SHADER`):**
   * Aplikuje volitelné vlnové zkreslení UV souřadnic (`u_uvDistort`) pro stavové efekty (kyselinová koroze, toxický sliz Spittera, energetické přetížení Overdrive) s hladkým útlumem na okrajích výřezu (`smoothstep(0.0, 0.12, v_uv)`), aby nedocházelo k ořezu siluety na hranici textury.
   * Vzorkuje `u_tex0` (aktuální snímek) a `u_tex1` (předchozí snímek) a míchá je v prostoru premultiplied alpha podle `u_frameBlend` – tím nativně na GPU provádí C1 sub-frame cross-dissolve.
   * Aplikuje multiplikativní `u_tintColor`, aditivní zásahový záblesk `u_flashColor` (`mix(rgb, u_flashColor.rgb, u_flashColor.a)`) a vrací `vec4(rgb * a, a)`.

---

## 8. Katalog vyřešených úskalí a kritických bodů selhání (Risk Mitigation)

Při návrhu a integraci WebGL2 vrstvy byla identifikována a vyřešena následující technická úskalí:

1. **Úskalí: Rozpad Z-pořadí (Z-ordering) mezi WebGL2 postavami a Canvas2D efekty**
   * *Příčina:* Pokud by se WebGL2 plátno pouze položilo nad původní Canvas2D, postavy by překryly vektorové trajektorie záměrů nepřátel, on-stage lifebary, plazmové výboje i plovoucí čísla poškození.
   * *Řešení:* Zavedení třetí vrstvy (`fgCanvasRef`) a přepínání cílového kontextu v `combatRenderer.ts` (`baseCtx` pro pozadí, dekály krve na podlaze a stíny pod chodidly $\to$ WebGL2 pro postavy a planární odrazy $\to$ `fgCtx` pro lifebary, záměry, střely, částice a čísla).

2. **Úskalí: Ztráta obrazu WebGL2 plátna při pauze nebo nečinném snímku (`preserveDrawingBuffer`)**
   * *Příčina:* Herní smyčka v `CombatStageCanvas.tsx` šetří CPU/GPU tím, že při pauze, otevřeném modálu nebo neaktivním okně (`isPaused && !activeSim.needsRedraw`) přeskočí vykreslení snímku. Výchozí WebGL2 kontext (`preserveDrawingBuffer: false`) po kompozici stránky vymaže backbuffer, takže by postavy při pauze zmizely.
   * *Řešení:* Inicializace WebGL2 kontextu s `preserveDrawingBuffer: true` a explicitní metodou `clearCanvas()` volanou výhradně při přepnutí do režimu `Canvas2D`.

3. **Úskalí: Tmavé lemy (dark halo / alpha fringing) kolem ručně kreslených HD výřezů při `gl.LINEAR` filtrování a prolínání snímků**
   * *Příčina:* Standardní alfa blending (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`) při bilineárním filtrování poloprůhledných okrajů míchá RGB barvu s černými (`0,0,0,0`) sousedními texely, což vytváří špinavý šedý obrys kolem vlasů a zbraní.
   * *Řešení:* Textury se nahrávají s `UNPACK_PREMULTIPLY_ALPHA_WEBGL = false`, ve fragment shaderu se vzorky z `u_tex0` a `u_tex1` nejprve převedou do premultiplied prostoru (`c.rgb * c.a`), prolnou přes `mix()`, po aplikaci tintu/flashe se výstup zapíše jako `vec4(rgb * a, a)` a WebGL pipeline používá `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`.

4. **Úskalí: Zasekávání (GC spikes a VRAM thrashing) při opakovaném nahrávání textur a realokaci VBO v každém snímku**
   * *Příčina:* Vytváření `new Float32Array` nebo volání `gl.texImage2D` v každém tiknutí `requestAnimationFrame` způsobuje mikrozáškuby (stutter).
   * *Řešení:*
     * Každý `MeshSprite` drží jedno staticky alokované `Float32Array(280)` a jedno škrabací pole `knotScratch`, které mutuje in-place; do GPU se posílá pouze `gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprite.vertices)` do předalokovaného `DYNAMIC_DRAW` VBO.
     * Textury jsou uložené ve `WeakMap<HTMLCanvasElement, WebGLTexture>` – každý předřezaný snímek z `assetPreloader.ts` se nahraje do GPU přes `gl.texImage2D` pouze jednou za životnost aplikace.

5. **Úskalí: Planární odrazy na skleněné mostovce mimo oblast skla**
   * *Příčina:* V Canvas2D byly odrazy oříznuty přes `ctx.rect(0, deckBackY, w, deckFrontY - deckBackY + 4); ctx.clip()`. Ve WebGL2 by neomezený vertikálně převrácený mesh přečníval pod mostovku do spodního HUD panelu.
   * *Řešení:* V `WebGL2CharacterStageRenderer.endFrame` se pro příkazy s `isReflection: true` přepočítají souřadnice `deckBackY` a `deckFrontY` přes aktuální kamerový zoom/pan/shake do fyzických pixelů WebGL viewportu (s převrácenou osou Y dle konvence WebGL) a aktivuje se hardwarový `gl.enable(gl.SCISSOR_TEST)` + `gl.scissor(...)`.

6. **Úskalí: Poskakování chodidel (foot sliding) při kombinaci dechu, náklonu a zásahu**
   * *Příčina:* Globální rotace nebo škálování kolem středu obdélníku posouvá spodní hranu spritu vůči eliptickému stínu na podlaze.
   * *Řešení:* Veškeré transformace (`computeDeformedMeshVertices` i vertex shader `u_squashStretch` / `u_sway` / `u_shear`) mají počátek v bodě `(worldX, worldY)` = střed chodidel (`anchorOffsetXPx`, `anchorOffsetYPx`) a váha deformace je v $h=0$ nulová ($\text{weight}(0) = 0$). To je ověřeno i automatizovaným unit testem v `src/components/combat/stageSpriteAdapter.test.ts`.

7. **Úskalí: Vodorovné natahování a smršťování postavy při GPU prolínání (`u_frameBlend`) různě širokých snímků**
   * *Příčina:* Jednotlivé oříznuté snímky ve sprite sheetu mají odlišné rozměry (např. snímek `4` má šířku `162 px`, zatímco snímek výstřelu `5` má `184 px`). Pokud se UV souřadnice sekundárního snímku (`v_uv1`) počítají z obdélníku primárního snímku (`widthPx`, `heightPx`), sekundární textura se při prolínání vodorovně natáhne nebo smrští až o $20\,\%$, což vytváří nepřirozený škubavý pohyb.
   * *Řešení:* V `computeDeformedMeshVertices` (`stageSpriteAdapter.ts`) se `u1, v1` počítají z vlastních rozměrů a vlastní kotvy sekundárního snímku (`secondaryWidthPx`, `secondaryHeightPx`, `secondaryAnchorOffsetXPx`, `secondaryAnchorOffsetYPx`) vůči společnému bodu chodidel `(worldX, worldY)`:
     $$u_1 = \frac{x - x_{\text{left},1}}{w_1}, \qquad v_1 = \frac{y - y_{\text{top},1}}{h_1}$$
     V `UNIFIED_CHARACTER_FRAGMENT_SHADER` (`webglMeshRenderer.ts`) se vzorky `v_uv1` mimo interval $[0, 1]^2$ maskují na `vec4(0.0)`, takže oba snímky při prolínání sedí na identické kotvě chodidel bez jakékoliv změny proporcí.

8. **Úskalí: Nepřirozené želé vlnění (Jelly Artifact) při souběhu více procedurálních deformací**
   * *Příčina:* Současná aktivace (a) 4bodové spline deformace páteře (`deform`), (b) vertexového kmitání `u_sway`, (c) fragmentového vlnění textury `u_uvDistort` a (d) vysokofrekvenčního šumu (`sin(t * 45)`) způsobí, že pevný chitinový krunýř a končetiny plavou jako želatina a kmitají proti obnovovací frekvenci monitoru (60 Hz aliasing).
   * *Řešení:* Přísná ortogonalita vrstev:
     * Fragmentové vlnění `u_uvDistort` musí být v klidu (`idle`), při chůzi (`advance_retreat`), při útoku (`attack_lunge`), zásahu (`take_hit`) i otočce (`turn_around`) **vypnuté (`uvDistortAmp = 0`)**. Aktivuje se výhradně při natlakování hrdelního vaku v `cast_charge` (`uvDistortAmp <= 0.0018`, `uvDistortFreq = 5.5`) a při kolapsu v `death_knockback` (`uvDistortAmp <= 0.0022`).
     * Vertexové kmitání `u_sway` je omezeno na `0.45 px` v `idle` (`1.8 rad/s`) a `0 px` ve všech akčních stavech.

---

## 9. 4vrstvý procedurální „Juice“ systém & pružinová fyzika (Referenční implementace: Bile Spitter)

Pro maximální živost („game feel / juice“) z minimálního počtu ručně kreslených snímků kombinuje modul `src/utils/spitterJuiceController.ts` a adaptér `src/components/combat/stageSpriteAdapter.ts` **čtyři ortogonální animační vrstvy**, které se skládají bez vzájemných kolizí a mají **jedinou autoritu transformací** (nikdy se nenásobí s paralelním samplerem). Všechny vrstvy jsou ukotveny v bodě **střed chodidel** (`bottom-center`, $h = 0$).

### 9.1 Architektura 4 vrstev (Blending Pipeline bez vzájemného přebíjení)

1. **Vrstva 1 — Stabilní Sprite Frame Layer (`frameIndex` + `secondaryFrameIndex`):**
   * Řídí výběr primárního a sekundárního snímku (`0..7`) bez rychlého stroboskopického cyklování.
   * Ve stavu `idle` drží stabilní základní snímek `0` (`spitter_idle_0`) s občasným krátkým cvaknutím čelistí do snímku `1` (`spitter_open_1`) každých `5.2 s` (nebo v okně `cyclePhase ∈ [0.76, 0.88)`).
   * Ve stavu nabíjení (`cast_charge` / `blightPrimed`) drží stabilní snímek `4` (`spitter_cyst_4` – nafouklý žlutý hrdelní vak) místo přeskakování mezi nekompatibilními snímky.

2. **Vrstva 2 — Transform Math & Damped Spring Physics („Juice“ Layer):**
   * **Tlumený harmonický oscilátor pro Squash & Stretch (Damped Harmonic Spring):**
     Odchylky měřítka $(\delta_x, \delta_y) = (\text{scaleX} - 1,\, \text{scaleY} - 1)$ jsou řízeny diferenciální rovnicí 2. řádu integrovanou semi-implicitní Eulerovou metodou se sub-steppingem ($\Delta t_{\max} \le \frac{1}{120}\text{ s}$):
     $$a_x = -k \cdot \delta_x - c \cdot v_x, \qquad a_y = -k \cdot \delta_y - c \cdot v_y$$
     $$v_{x,t+\Delta t} = v_{x,t} + a_x \Delta t, \qquad \delta_{x,t+\Delta t} = \delta_{x,t} + v_{x,t+\Delta t} \Delta t$$
   * **Walk Waddle (kolébavá chůze s parabolickým poskokem):**
     $$\theta_{\text{waddle}}(t) = \sin(t \cdot \omega_{\text{waddle}}) \cdot \theta_{\max}, \qquad \Delta y_{\text{hop}}(t) = -\left|\sin(t \cdot \omega_{\text{waddle}})\right| \cdot H_{\text{hop}}$$
   * **Velocity Skew / Shear (rychlostní střih siluety):**
     $$\text{skewX} = \text{clamp}\!\left(v_x \cdot k_{\text{skew}} + \text{skew}_{\text{state}},\; -0.42,\; +0.42\right)$$
   * **2.5D Paper-Mario Flip (plynulé otočení s výskokem):**
     $$\text{facingScale}(u) = \text{fromFacing} + (\text{toFacing} - \text{fromFacing}) \cdot \frac{1 - \cos(\pi u)}{2}, \qquad \Delta y_{\text{flip}}(u) = -\sin(\pi u) \cdot H_{\text{flip}}$$

3. **Vrstva 3 — Lightweight 2D Mesh Deformation Layer (Kvadraticky kotvená páteř na mřížce $8 \times 12$):**
   * Deformace páteře (`headOffsetX`, `headOffsetY`, `chestBulgeX`, `ribRiseY`) se aplikuje s kvadratickou výškovou vahou $w(v) = (1 - v)^2$, takže chodidla ($v = 1$) mají nulový posun.
   * V `idle` probíhá pouze jemné sub-pixelové dýchání hrudníku (`headOffsetX = sin(phase - 0.5) * 0.9 px`, `headOffsetY = -breath * 1.15 px`), bez kmitání krunýře.

4. **Vrstva 4 — GPU Shader Layer (Vertex & Fragment `#version 300 es`):**
   * **Nezávislé UV mapování při prolínání (`v_uv0`, `v_uv1`):** Každý ze dvou prolínaných snímků se mapuje do svých vlastních pixelových rozměrů ukotvených k chodidlům.
   * **Selektivní `u_uvDistort`:** Vypnuto (`0.0`) pro všechny běžné stavy; zapnuto pouze pro var žluči v hrdelním vaku při `cast_charge` (`<= 0.0018`).
   * **Synchronizovaný Hit-Flash (`u_flashColor`) a Throat Glow (`throatGlowIntensity`):** Hladká aditivní luminiscence žlutého vaku místo vysokofrekvenčního třesu.

---

### 9.2 Integrace tahových bojových stavů a interaktivní testovací laboratoř (`Klávesy 1–6`)

| Klávesa / Stav | Snímek (Vrstva 1) | Pružina & Transformace (Vrstva 2) | Mesh Páteř (Vrstva 3) | GPU Shader & VFX (Vrstva 4) |
| :--- | :--- | :--- | :--- | :--- |
| **`1` — Idle** | Snímek `0` + občasné cvaknutí čelistí do `1` (`5.2 s`) | Pružina v klidu `(1, 1)`, nulový střih | Sub-pixelový dech (`±0.9 px` X, `±1.15 px` Y) | `u_uvDistort = 0`, `swayAmpPx = 0.45`, trvalá podlahová kaluž |
| **`2` — Advance / Retreat** | Snímky `0` $\leftrightarrow$ `1`/`2` v rytmu kroku | Walk Waddle + parabolický odskok + `velocitySkew` | Protipohyb hrudníku a hlavy při dopadu | `u_uvDistort = 0`, `swayAmpPx = 0` |
| **`3` — Attack Lunge (Spit)** | `4` (nátisk) $\to$ `5` (výstřel) $\to$ `6` (dozvuk) $\to$ `1` $\to$ `0` | $\mathcal{C}^1$ nátisk vzad $\to$ výpad vpřed $\to$ klouzavý návrat | Natažení krku vzad $\to$ švih hlavy vpřed (`+14 px`) | Spojitý proud žluté žluči z `mouthOriginRel` až na hrdinku + částice |
| **`4` — Cast / Charge** | Stabilní snímek `4` (`spitter_cyst_4`) | Hladké dýchání vaku (`3.6 rad/s`), bez vysokofrekvenčního třesu | Zvednutí hrudníku a rozšíření hrdelního vaku (`chestBulgeX`) | `u_uvDistort <= 0.0018`, pulzující `throatGlowIntensity` + var kaluže |
| **`5` — Take Hit / Recoil** | Snímek `6` $\to$ `2` $\to$ `0` | Impulz `applySpitterSquash` + zpětný ráz + záporný střih | Bičové zaklonění hlavy (`-14 px`) s tlumeným dozvukem | `u_flashColor` záblesk, `u_uvDistort = 0` |
| **`6` — 2.5D Turn Around** | Snímek `2` uprostřed otočky (`facingScale ≈ 0`) | Kosinová interpolace `facingScale` mezi `-1` a `+1` + výskok `-18 px` | Komprese hrudníku při průchodu hranou | `u_uvDistort = 0`, čistý 2.5D průchod přes nulu |

---

## 10. Architektonická poučení z praxe (Design Rules & Post-Mortem: Bile Spitter)

Při ladění a opravě animace **Bile Spittera** byla odvozena pětice obecných inženýrských pravidel, která jsou závazná pro všechny budoucí nepřátele a bossy v **NEON BREACH**:

### 10.1 Pravidlo 1: Oddělení rastru postavy od podlahových dekorací (No Baked-In Floor Props)
* **Problém:** Ve zdrojovém sprite sheetu obsahoval pouze jediný snímek (`SPITTER_SHEET_FRAMES[3]`, `spitter_swell_3`) ve spodních `25 px` ($y \in [224, 248]$) zapečenou kaluž slizu na podlaze. Při každém přepnutí na snímek `3` a zpět se:
  1. Kaluž na podlaze skokově objevila a zase zmizela.
  2. Kotva chodidel `bottomY` se posunula ze stopy drápů (`y = 223`) na spodní okraj kaluže (`y = 248`), takže celá postava poskočila o `25 px` do vzduchu.
* **Architektonické řešení:**
  1. Veškeré zapečené podlahové kaluže, stíny či úlomky v jednotlivých buňkách sprite sheetu musí být při definici rámce oříznuty (`h`, `bottomY`) a jejich boční přesahy vymaskovány přes `excludeRects`.
  2. Trvalé prvky prostředí pod postavou (jako žlutozelená kaluž slizu `renderSpitterGroundPuddle`) se vykreslují **procedurálně v podkladové vrstvě `baseCtx`** na souřadnici `(footX, enemyGroundY)`. Tím zůstávají 100% stabilní bez ohledu na to, jaký snímek postava právě přehrává.

### 10.2 Pravidlo 2: Oddělení rastru postavy od dalekonosných projektilů (Seamless Ballistic Hand-Off)
* **Problém:** Snímky `5` (`spitter_spit_5`) a `6` (`spitter_spall_6`) měly v bitmapě zapečené vodorovné pruhy žluči, které končily uříznuté svislou hranou buňky uprostřed vzduchu (`w = 212 px` a `w = 214 px`). Při útoku tak z tlamy trčela krátká statická tyč, která nikdy nedolétla k hrdince.
* **Architektonické řešení:**
  1. V rastru útočného snímku se ponechá pouze otevřená tlama a bezprostřední kužel výšlehu v čelistech (zbytek uříznutého pruhu se ořízne zmenšením `w` na `184–186 px` a `excludeRects`).
  2. Každý snímek definuje přesnou relativní pozici ústí `mouthOriginRel: { x, y }`.
  3. Samotný proud žluči (`renderSpitterBileTorrent`) se vykresluje v popředí (`fgCtx`) jako spojitá kvadratická Bézierova křivka vedoucí přesně z `(mouthX, mouthY)` až do bodu zásahu na hrdince `(heroImpactX, heroImpactY)`.
  4. Aby proud tvořil nepřerušený vizuální most po celou dobu otevřených čelistí (snímky `5` a `6`), čelo proudu (`headT`) dolétne k cíli v první čtvrtině výstřelu (`p <= 0.26`), zatímco pata proudu (`tailT`) zůstává ukotvena v tlamě (`tailT = 0`) až do `p = 0.76` a teprve poté se odtrhne a doputuje k cíli.
  5. Proud je doprovázen živou emisí částic do `sim.particles` (tvar kapky `shape = 2`, barvy `#FEF08A`, `#FACC15`, `#A3E635`) a fyzikálními kapkami do `sim.bloodDrops` (`owner: 'spitter'`, `shapeKind: 'cone_droplet'`), které padají na mostovku a vytvářejí trvalé kaluže.

### 10.3 Pravidlo 3: Zákaz souběžného vrstvení prostorových vlnění (Anti-Jelly Principle)
* **Problém:** Kombinace 2D spline deformace sítě (`deform`), vertexového vlnění (`u_sway`) a fragmentového UV vlnění (`u_uvDistort`) vytváří gumový „želé“ artefakt, kdy se vlní i tvrdé chitinové drápy a krunýř.
* **Architektonické řešení:**
  * Tvrdé anatomické části se pohybují pouze přes kosterní/spline uzly (`deform`) a pružinovou fyziku (`scaleX`, `scaleY`, `rotationRad`).
  * Fragmentové UV zkreslení (`u_uvDistort`) musí být rovno `0` ve všech pohybových a klidových stavech a smí se zapnout pouze pro vnitřní var tekutiny v nehybném stavu nabíjení (`cast_charge`, `uvDistortAmp <= 0.0018`).
  * Vysokofrekvenční oscilace (`> 12 rad/s`) na pozicích vrcholů jsou zakázány kvůli stroboskopickému aliasingu s `60 Hz` obnovovací frekvencí; napětí před výstřelem se vyjadřuje aditivním jasem (`throatGlowIntensity`) a pomalou expanzí objemu (`3.6 rad/s`).

### 10.4 Pravidlo 4: Jediná autorita snímku a transformace (Single Transform Authority)
* **Problém:** Pokud v `combatRenderer.ts` běží současně stavový sampler (`sampleSpitterFrame`) i procedurální řadič (`stepSpitterJuice`) a jejich posuny (`xOffsetPx + strideX`), měřítka (`scaleX * juice.scaleX`) či indexy snímků se kombinují, dochází k dvojímu přičítání výpadu a konfliktu mezi prolínanými snímky.
* **Architektonické řešení:** Jakmile je pro daný archetyp aktivní procedurální řadič (`JuiceController`), přebírá **100% autoritu** nad výběrem primárního snímku (`frameIndex`), sekundárního snímku (`secondaryFrameIndex`), váhy prolínání (`secondaryWeight`), posunu (`strideX`, `hopY`), měřítka (`scaleX`, `scaleY`), rotace (`rotationRad`) i fázových indikátorů (`spitWindupProgress`, `spitStreamProgress`).

### 10.5 Pravidlo 5: $\mathcal{C}^1$ spojitost trajektorií a normalizované časování VFX
* **Problém:** Skokové přepisy pozice na hranicích fází (např. `if (u < 0.22) x = 0.09; else x = -0.22;`) způsobí v jediném snímku teleportaci postavy o desítky pixelů. Stejně tak pevné časové konstanty VFX v sekundách se rozpadnou při změně rychlosti animace (`animSpeed`).
* **Architektonické řešení:**
  * Každá trajektorie (`spit`, `claw`, `rupture`) musí mít spojitou hodnotu i derivaci na všech vnitřních uzlech ($u = 0.22, 0.56, 0.78$) pomocí `smoothstep` nebo Hermiteových polynomů.
  * Veškeré vizuální efekty vázané na pózu postavy (výtrysk z tlamy, let proudu žluči, dopad na hrdinku) musí být řízeny normalizovanou fází animace (`spitStreamProgress ∈ [0, 1]`), aby zůstaly na milimetr přesně synchronizované při libovolném `animSpeed` (`0.25×` až `2.0×`) i při krokování snímků v debug laboratoři.

---

## 11. Dynamic 2D Combat Presentation & Action Camera System v2 (*Darkest Dungeon* Melee & Ranged Cut-In Architecture)

> **Runtime Specification v2 (NEON BREACH Cut-In & Action Camera Layer):** While Sections 1–10 define sprite sheet slicing, `4×6` WebGL2 anatomical mesh deformation, and per-archetype spring physics, this section documents the production **Dynamic 2D Combat Presentation & Action Camera System** supporting **Melee Center-Stage Clashes**, **Two-Beat Ranged/Projectile Camera Cuts**, and **Cascaded Ranged AoE Volleys**. Inspired by *Darkest Dungeon*, it elevates minimal-frame 2D turn-based combat into weighty, visceral exchanges through obsidian stage dimming (`0.0 → 0.75`), `drawPriority` foreground promotion, floating world-space HUD suppression, rotation-aware overscan bounds clamping, viewport-relative Perlin trauma shake & knockback, static keyframe pose swaps with `1.25×` elastic scale punch, and `simDt = 0` Hit-Stop freezes.

---

### 11.1 Architectural Integration with NEON BREACH's 3-Layer Hybrid Pipeline

NEON BREACH renders every combat frame across three synchronized `<canvas>` surfaces (`baseCtx` → `WebGL2CharacterStageRenderer` → `fgCtx`), avoiding extra offscreen render targets while preserving exact Canvas2D/WebGL2 matrix parity:

```text
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                      Collapsible Action Camera Lab (Keys 1 / 2 / 3 / 4)                │
  │ [1 · Melee Hit]  [2 · Melee Crit]  [3 · Ranged Shot]  [4 · Ranged AoE]  [VW Sliders]   │
  └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ playCutIn / enqueueCutIn (serialized FIFO)
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                     CombatActionSequencer (6-State Machine + Queue)                    │
  │  idle ─▶ windup (Melee 0.15s / Ranged Beat 1 0.24s) ─▶ [travel: whip-pan / track X]    │
  │       ─▶ impact_freeze (simDt=0 Hit-Stop + 30-50ms AoE L→R cascade)                    │
  │       ─▶ followthrough (0.60s / 1.00s +5%-10% zoom creep & drift)                      │
  │       ─▶ reset (0.25s EaseInOutCubic + guaranteed cleanup) ─▶ Promise<void> resolve    │
  └──────┬──────────────────────────────────┬───────────────────────────────────────┬──────┘
         │ mat3 / Canvas2D + overscan clamp │ slide, punch, knockback, flash        │ dimmer & HUD
         ▼                                  ▼                                       ▼
  ┌─────────────────────────────┐  ┌────────────────────────────────┐  ┌──────────────────────────┐
  │ ActionCameraController      │  │ SpriteJuiceFeedbackHandler     │  │ 3-Layer Split Compositor │
  │ - Melee BBox / Shooter Lead │  │ - Melee 34% midpoint slide     │  │ L0 Base: BG + Deck +     │
  │ - AoE Centroid [1.22x-1.30x]│  │ - Ranged 8% in-slot lunge      │  │   Dimmer (alpha 0→0.75)  │
  │ - Dutch Tilt (±2.0°/±3.4°)  │  │ - 1.25x elastic scale punch    │  │ L1 WebGL2: drawPriority  │
  │ - Rotation-Aware Bleed Clamp│  │ - 4%-6% VW knockback + drift   │  │   (4=Atk, 3=Tgt, 1=Bys)  │
  │ - Perlin + Directional Kick │  │ - 3f #FFFFFF → #FF2E7E flash   │  │ L2 FG: Projectiles/VFX,  │
  └──────────────┬──────────────┘  └───────────────┬────────────────┘  │   worldUiAlpha (1→0→1),  │
                 └─────────────────────────────────┴───────────────────┤   Vignette + Crit Flash  │
                                                                       └──────────────────────────┘
```

#### Foreground Promotion, World-Space UI Suppression & Safety Overrides
1. **Stage Dimmer (`dimmerAlpha ∈ [0.0, 0.75]`):** Rendered on `baseCtx` (`rgba(3, 7, 18, dimmerAlpha)`) in `0.15s` via `EaseOutExpo` after the sky-bridge backdrop, tactical cover barriers, and deck reflections, and immediately before foreground units (`combatRenderer.ts`). During active cut-ins, backdrop idle parallax (`parallaxX`) zeros cleanly so the `±16px` horizontal overscan bleed stays symmetric under Dutch tilt.
2. **Foreground Sorting Layer (`drawPriority` + `fgCtx`):**
   * `0` — Planar glass-deck reflections (`webglMeshRenderer.ts`)
   * `1` — Bystanders during an active cut-in (`tintRgba = [d * 0.86, d * 0.9, min(1, d * 1.06), 1]`, `d = 1 - dimmerAlpha * 0.82`)
   * `2` — Idle / neutral formation actors
   * `3` — Active Cut-In Target(s)
   * `4` — Active Cut-In Attacker
   * **`fgCtx` Overlay:** Active projectiles (`sim.bolts`), muzzle bursts, slash arcs, floating combat text, and crit speed lines draw on `fgCtx` strictly above both the stage dimmer and WebGL2 sprite pass.
3. **World-Space UI / Health Bar Suppression (`worldUiAlpha`):** When `hideWorldUiDuringCutIn === true`, `CombatActionSequencer` fades `worldUiAlpha` from `1 → 0` across Phase A Wind-up, holds `0` through Travel, Hit-Stop, and Hold, and glides `0 → 1` across Phase D Reset. `combatRenderer.ts` multiplies Hero and Enemy on-stage lifebars, gold armor crests, cyan Aegis shield pips, damage previews, and lethal skulls by `worldUiAlpha` (skipping draw calls entirely when `worldUiAlpha <= 0.02`) so floating HUD bars never clutter focal clashes.
4. **Tactical View & Reduced Motion Overrides:**
   * When `tacticalViewActive === true`, `CombatActionSequencer.step(...)` immediately flushes active + queued cut-ins via `cleanupActiveState()`, snapping `dimmerAlpha = 0`, `worldUiAlpha = 1`, `zoom = 1`, `panX = 0`, `panY = 0`, `rotationRad = 0`, and `trauma = 0`.
   * When `reducedMotion === true`, zoom/pan framing still centers the focal exchange softly, while Dutch tilt, Perlin shake, invert flash, and speed lines remain `0`.

---

### 11.2 Melee vs. Ranged vs. AoE Staging & Framing Matrix

| Mode (`CutInStagingMode`) | Character Movement | Camera Framing & Beats | Target Reactions & VFX |
| :--- | :--- | :--- | :--- |
| **`melee`** (Center-Stage Clash) | Attacker and Target(s) physically slide **`25%–40%`** (`meleeClashSlideRatio = 0.34`) closer to their shared midpoint using `EaseOutExpo` so they clash in the center third with zero awkward empty void. | Single focal frame centered on the post-slide clash midpoint: **`1.40×`** (`1.35×–1.50×`) Normal, **`1.72×`** (`1.60×–1.85×`) Crit. | Immediate impact recoil (`recoil_pose`), `4.5%–6.0% VW` knockback, `1.25×` elastic attacker scale punch, Dutch tilt (`±2.0°` / `±3.4°`), 3-frame `#FFFFFF → #FF2E7E` flash. |
| **`ranged_fast`** (Bullets / Bolts / Spit) | Characters stay in their formation slots; Attacker performs only a subtle **`5%–10%`** (`rangedSlotLungeRatio = 0.08`) forward fire lunge. | **Beat 1 (`0.24s`):** Zoom tightly (`1.40×`) onto the Attacker alone with **`+6% VW`** directional lead room ahead of the muzzle/jaw, then invoke `onProjectileSpawn()`.<br>**Beat 2 (`0.13s`):** Rapid `EaseOutExpo` whip-pan straight to the Target, arriving precisely on impact. | Bolt draws above dimmer on `fgCtx`; on arrival, Target snaps into `recoil_pose` with in-slot recoil, 3-frame white flash, sparks, and floating damage text. |
| **`ranged_lobbed`** (Slow / Arcing Projectiles) | Same in-slot `5%–10%` lunge; no center-stage slide. | **Beat 1 (`0.24s`):** Shooter close-up with lead room.<br>**Beat 2 (Live Track):** Smoothly tracks `getProjectileX()` with gentle lag until collision (or safety cap), then snaps tight onto the Target. | Seamless transition from projectile tracking into Hit-Stop impact freeze and Hold creep. |
| **`ranged_aoe`** (Multi-Target Volley / Overdrive) | Shooter stays in slot with `8%` fire lunge; targets stay in formation slots. | **Beat 1 (`0.24s`):** Shooter close-up with lead room.<br>**Beat 2 (`0.13s`):** `EaseOutExpo` whip-pan to the **centroid of all hit targets** at a clamped wider zoom (**`1.22×–1.30×`**, hard floor **`≥ 1.0×`**). | Targets are sorted strictly **left-to-right by world X**; `triggerTargetImpact` and `onImpactTarget(id, idx)` cascade by **`30ms–50ms`** (`aoeCascadeStepMs = 40ms`) so flashes, knockbacks, bursts, and popups ripple through the squad. |

---

### 11.3 Sequenced Action Timeline (Phase A → D) & Critical Game-Feel Safeguards

Every action runs through a deterministic 6-state machine (`'idle' | 'windup' | 'travel' | 'impact_freeze' | 'followthrough' | 'reset'`) returning a `Promise<void>` upon Phase D completion:

| Phase | State | Timing & Easing | Camera & Stage Behavior | Actor Juice & Foreground FX |
| :--- | :--- | :--- | :--- | :--- |
| **A · Wind-up** | `windup` | Melee `0.15s` / Ranged Beat 1 `0.24s` (`EaseOutExpo`) | Dimmer ramps `0 → 0.75`; `worldUiAlpha` fades `1 → 0`; camera snaps to clash midpoint (Melee) or Shooter + lead room (Ranged). | Attacker → `attack_pose` (Melee `34%` slide or Ranged `8%` lunge); Target(s) → `brace_pose`. Fires `onWindupStart()`. |
| **A2 · Travel** *(Ranged only)* | `travel` | Fast whip-pan `0.13s` (`EaseOutExpo`) or live `getProjectileX()` track | Fires `onProjectileSpawn()` at entry; whip-pans or tracks from Shooter frame to Target / AoE Centroid frame. | Projectiles traverse `fgCtx` above dimmer while `worldUiAlpha` stays `0`. |
| **B · Impact & Hit-Stop** | `impact_freeze` | `120ms` Normal / `160ms` AoE / `250ms` Crit (**`simDt = 0`**, ticked on `rawDt`) | Applies Dutch tilt (`±2.0°` / `±3.4°`) and viewport-relative Perlin + directional trauma shake (`1.1% VW` Normal, `2.2% VW` Crit). | Target(s) snap to `recoil_pose` (`40ms` L→R cascade on AoE), `1.25×` elastic attacker scale punch, `3` raw-frame `#FFFFFF → #FF2E7E` flash. Crit adds 2-frame `'difference'` invert flash + radial vignette + 28 `'lighter'` speed lines. |
| **C · Follow-Through Hold** | `followthrough` | `0.60s` Normal / `1.00s` Crit (linear creep) | **Never static:** camera continuously creeps inward by **`+5%–10%`** (`holdZoomCreepPct = 0.08`, e.g., `1.40× → 1.51×`) while Dutch tilt eases back gently. | Actors subtly drift apart (`holdDriftApartVw = 1.4% VW`) from impact force while scale punch and knockback settle smoothly. |
| **D · Reset** | `reset` | `0.25s` (`EaseInOutCubic`) | Smooth S-curve return of zoom (`→ 1.0×`), pan (`→ 0,0`), tilt (`→ 0°`), dimmer (`→ 0`), and `worldUiAlpha` (`→ 1`). | Actors glide smoothly back to original formation slots and restore `idle` poses (`poseOverride = 'none'`). `cleanupActiveState()` guarantees zero lingering overrides. |

#### Five Mandatory Game-Feel Safeguards
1. **Viewport-Relative Units (`% VW`):** Shake amplitude (`shakeNormalVw = 1.1%`, `shakeCritVw = 2.2%`), target knockback (`knockbackNormalVw = 4.5%`, `knockbackCritVw = 6.0%`), Hold drift (`1.4%`), and Ranged lead room (`6.0%`) scale proportionally to `viewportW` so impact feels identical on 720p mobile landscape, 1440p desktop, and 4K displays.
2. **Rotation-Aware Camera Bounds Clamping (`computeMinZoomForRotation` & `clampPanForRotationBounds`):** Tilting the viewport by `θ` expands its axis-aligned world bounding extents to `W·cos|θ| + H·sin|θ|` and `W·sin|θ| + H·cos|θ|`. `ActionCameraController.step()` enforces minimum overscan zoom AND clamps both base `(panX, panY)` and combined `(panX + shakeOffsetX, panY + shakeOffsetY)` against the backdrop bleed rect (`BACKDROP_BLEED_X = 32`, `BACKDROP_BLEED_Y = 16`), mathematically preventing unrendered black corners even under `3.4°` tilt + maximum trauma shake.
3. **Never-Static Hold Phase:** Continuous `+5%–10%` inward zoom creep (`zoomHoldEnd = zoom * (1 + holdZoomCreepPct)`) paired with `holdDriftX = holdDriftTargetX * p` keeps dramatic clashes alive instead of looking frozen after Hit-Stop ends.
4. **Hit-Stop Time Isolation (`rawDt` vs. `simDt`):** During `impact_freeze`, `SequencerFrameState.simDt === 0` freezes world sprite animation clocks while unscaled wall `rawDt` drives camera shake, particle sparks, floating numbers, speed lines, and the strict per-frame white-flash countdown.
5. **Serialized Queue & Guaranteed Cleanup:** `CombatActionSequencer.enqueueCutIn(...)` serializes overlapping combat actions in a FIFO queue so concurrent turn triggers never stomp each other's camera transforms or dimmer alpha. Passing `replaceQueue: true` (used by Keys `1–4` debug hotkeys and fresh combat batches) cleanly flushes pending entries via `cleanupActiveState()`, and `invokeSafely(...)` isolates external VFX/audio callbacks (`onWindupStart`, `onProjectileSpawn`, `onImpactFrame`, `onImpactTarget`) inside `try/catch` guards—guaranteeing `dimmerAlpha = 0`, `worldUiAlpha = 1`, `drawPriority = 2`, and `poseOverride = 'none'` on completion, interruption, exception, or Tactical View toggle.

---

### 11.4 Core TypeScript Modules & Verified API Contracts

All five presentation modules live under `src/components/combat/` with zero DOM dependencies in the pure logic core:

1. **`combatPresentationMath.ts`:** `clamp01`, `lerp`, `smoothstep01`, `easeOutCubic`, `easeInOutCubic` (Phase D reset), `easeOutExpo` (Phase A wind-up & Beat 2 whip-pan), `easeOutElastic`, `evaluateCurve`, and deterministic 256-entry 1D gradient `perlinNoise1D`.
2. **`combatPresentationConfig.ts`:** Complete designer tuning contract and `DEFAULT_COMBAT_PRESENTATION_CONFIG`, plus multi-enemy pack speedup helpers `computePackTempoScale` (`1.0×` for 1–2 enemies, `0.80×` for 3–4, `0.64×` for 5+) and `computeNonCutInBeatMs`.
3. **`ActionCameraController.ts`:**
   * `BACKDROP_BLEED_X = 32`, `BACKDROP_BLEED_Y = 16`
   * `computeMinZoomForRotation(viewportW, viewportH, rotationRad, bleedX, bleedY)`
   * `clampPanForRotationBounds(panX, panY, zoom, rotationRad, viewportW, viewportH, bleedX, bleedY)`
   * `computeFocusFrame(...)` (Melee clash framing), `computeShooterLeadFrame(...)` (Ranged Beat 1 shooter + lead room), `computeAoeCentroidFrame(...)` (Ranged AoE Beat 2 wider centroid `[1.22×, 1.30×]`, `≥ 1.0×`)
   * `addTrauma(amount, kickDirX, kickDirY, viewportW, shakeMaxVw)` & `step(rawDt, input)` (supports `directPose` for exact `EaseOutExpo` / linear creep / `EaseInOutCubic`, plus combined `pan + shake` rotation-aware overscan clamp)
   * `applyToCanvas2D(ctx, w, h)` & column-major `buildWebGLViewProjMatrix(w, h)` (`a = z·cosR`, `b = -z·sinR`, `c = z·sinR`, `d = z·cosR`) — both `baseCtx`, `WebGL2CharacterStageRenderer`, and `fgCtx` apply screen-space `pan + shake` prior to `rotate → scale → translate(-cx, -cy)` so shadows, sprites, and foreground projectiles remain pixel-locked under crit zoom + trauma shake.
4. **`SpriteJuiceFeedbackHandler.ts`:**
   * `beginWindup({ attackerId, targetIds, allActorIds, strikeDirX, isMelee, clashSlideDistPx, rangedLungePx })`
   * `triggerAttackerPunch(...)`, `triggerTargetImpact(...)` (per-target for `30ms–50ms` AoE cascade), `triggerImpact(...)`, `beginReset()`, `finish()`
   * `stepFrame(rawDt, isHitStopped, phase, phaseProgress)` — `EaseOutExpo` wind-up slides, Hold `holdDriftX = holdDriftTargetX * p`, `EaseInOutCubic` reset, elastic scale punch (`k = 260, c = 18`), and strict per-frame `whiteFlashFramesLeft` countdown → `#FF2E7E` crimson decay
5. **`CombatActionSequencer.ts`:**
   * `enqueueCutIn(request, config, viewportW, viewportH)` & `playCutIn(request, config, viewportW, viewportH)`
   * `triggerImpactNow()`, `reset()`, `step(rawDt, viewportW, viewportH, options)` returning `SequencerFrameState` (including `stagingMode` and `worldUiAlpha`)
   * `renderCutInForegroundVfx(ctx, frame, viewportW, viewportH, elapsed)` — renders the radial crit vignette pulse, 28 `'lighter'` speed lines, and 2-frame `'difference'` invert flash

#### Reference Tuning Defaults (`combatPresentationConfig.ts`)
```ts
export const DEFAULT_COMBAT_PRESENTATION_CONFIG: CombatPresentationConfig = {
  enabled: true,
  windupSec: 0.15,
  rangedBeat1Sec: 0.24,
  rangedWhipPanSec: 0.13,
  holdNormalSec: 0.60,
  holdCritSec: 1.00,
  resetSec: 0.25,
  hitstopNormalSec: 0.12,
  hitstopAoeSec: 0.16,
  hitstopCritSec: 0.25,
  whiteFlashFrames: 3,
  zoomNormal: 1.40,
  zoomCrit: 1.72,
  zoomRangedShooter: 1.40,
  zoomAoeMin: 1.22,
  zoomAoeMax: 1.30,
  holdZoomCreepPct: 0.08,
  rangedLeadRoomVw: 0.06,
  dutchDegNormal: 2.0,
  dutchDegCrit: 3.4,
  dimmerAlpha: 0.75,
  shakeTraumaNormal: 0.45,
  shakeTraumaCrit: 0.85,
  shakeDecayPerSec: 2.2,
  shakeNormalVw: 0.011,
  shakeCritVw: 0.022,
  meleeClashSlideRatio: 0.34,
  rangedSlotLungeRatio: 0.08,
  knockbackNormalVw: 0.045,
  knockbackCritVw: 0.060,
  holdDriftApartVw: 0.014,
  attackerScalePunch: 1.25,
  aoeCascadeStepMs: 40,
  hideWorldUiDuringCutIn: true,
  critSpeedLinesEnabled: true,
  critInvertFlashEnabled: true,
  adaptivePackSpeedup: true,
};
```

#### Rotation-Aware Overscan Clamp (`ActionCameraController.ts`)
```ts
export const BACKDROP_BLEED_X = 32;
export const BACKDROP_BLEED_Y = 16;

export function computeMinZoomForRotation(
  viewportW: number,
  viewportH: number,
  rotationRad: number,
  bleedX = BACKDROP_BLEED_X,
  bleedY = BACKDROP_BLEED_Y,
): number {
  const w = Math.max(1, viewportW);
  const h = Math.max(1, viewportH);
  const absRot = Math.abs(rotationRad);
  if (absRot < 1e-5) return 1.0;
  const cosR = Math.cos(absRot);
  const sinR = Math.sin(absRot);
  const rotW = w * cosR + h * sinR;
  const rotH = w * sinR + h * cosR;
  return Math.max(1.0, rotW / (w + bleedX), rotH / (h + bleedY));
}
```

---

### 11.5 Heroine & Enemy Staging Matrix, Nose-to-Nose Clashes & Single Horizontal Authority

1. **Explicit Melee vs. Ranged Staging Classifier (`combatStagingClassifier.ts`):**
   * **Heroines (`classifyHeroAttackStaging`):**
     * **Aurelia:** **100% Ranged (`scattergun`)** — fires wide amber/cyan plasma scattergun pellet bursts from formation (`ranged_fast` single, `ranged_aoe` multi/Overdrive); never slides into melee.
     * **Zuri:** **100% Ranged (`drone_plasma`)** — stays aloft in formation while her foreground-promoted Tri-Drone formation fires twin rotary magenta/gold plasma volleys (`ranged_fast` single, `ranged_aoe` multi/Overdrive).
     * **Kira:** **Hybrid Melee / Ranged** — alternates **in-your-face nose-to-nose melee Dash-Kicks** (`melee` on Surge or even attack toggle) with **Two-Beat Ranged Cyber-Pistol shots** (`pistol_bolt`, `ranged_fast` / `ranged_aoe`).
   * **Enemies (`classifyEnemyAttackStaging`):**
     * **Bile Spitter (`enemy_acid`):** Two-Beat Ranged (`ranged_fast`, `acid_bile` corrosive globules + pressurized bile torrent).
     * **Bile Spitter (`clawRend`):** In-your-face nose-to-nose Melee clash (`melee`, frame `9`).
     * **Pyre Stinger:** Two-Beat Ranged (`ranged_fast`, `stinger_dart` glowing chitin dart volley).
     * **Spore Mite (`larva`), Acid Skitter (`skitter`), Spine Stalker (`stalker`), Carapace Brute (`brute`), Brood Queen (`boss`):** In-your-face nose-to-nose Melee clashes (`melee`).
2. **Slot-Invariant Nose-to-Nose Contact Gap (`computeNoseToNoseMeleeSlides`):**
   * Pulls Attacker & Target toward center stage to an exact contact separation (`meleeClashGapVw = 12.5%` of viewport width, configurable `8%–22%` in Action Camera Lab) regardless of starting slot (Slots 1–5), keeping the attacker strictly on their attack side with foreground scale emphasis (`meleeForegroundScale = 1.07×`) and tight `1.52×` normal / `1.80×` crit zoom.
   * **Single Horizontal Transform Authority:** During melee cut-ins, legacy per-archetype horizontal shifts (`heroSample.xProgress`, enemy `lunge`, `stalkerSample.xOffsetRatio`, `spitterJuice.offsetX`, `bruteJuice.offsetX`, `stagger.dx`) are suppressed so `clashSlideX + knockbackX` is the sole horizontal authority—preventing double-slide overshoot, snap-back jitter, or detached reflections/shadows/popups.
3. **Static Keyframe Pose Swaps & Facing-Aware Spline Bend:**
   * **Heroines (`combatRenderer.ts` `resolveHeroCutInFrameIndex`):** Locks iconic poses during Wind-up, Hit-Stop, and Hold (Kira melee `16→18` High Plasma Kick / pistol `9→10` / guard `22` / recoil `24`; Aurelia `13→14` Scattergun / guard `28` / recoil `21`; Zuri `19→20` Drone Command / guard `46` / recoil `2`).
   * **Enemies:** `crawlerSpriteSheet.ts` (`4 / 1 / 9`), `stalkerSpriteSheet.ts` (`6 / 11 / 12`), Spitter (`9` melee / `6` ranged / `10` brace / `12` recoil, facing locked `-1`), Brute (`10` heavy / `11` melee / `7` brace / `12` recoil, facing locked `-1`), and Boss (`1.06×` clash emphasis).
   * **Facing-Aware Spine Bend (`stageSpriteAdapter.ts`):** `deriveEnemyDeformAndUniforms` computes `fwdSign = facingSign < 0 ? 1 : -1` so both native left-facing sprites (`larva`, `skitter`, `stinger`, `boss`, `facingSign = +1`) and mirrored right-facing sprites (`stalker`, `spitter`, `brute`, `facingSign = -1`) consistently bend **LEFT toward the heroine on attack** and **RIGHT away on recoil/stagger**.
4. **Smooth Zero-Overshoot Knockback & World-Space HUD Fade:**
   * `SpriteJuiceFeedbackHandler` drives knockback via an `EaseOutExpo` punch-out (`0.095s`) into a weighty settle (`0.58×` peak) with critically damped scale springs (`c = 26`), eliminating 1-frame snap teleports and rubber-band bounce-back.
   * `worldUiAlpha` fades Hero and Enemy on-stage lifebars, armor crests, shield pips, threat labels, and death skulls smoothly out during focal cut-ins and back in on Phase D reset.

---

### 11.6 Collapsible Action Camera Lab & Keys `1–4` Test Harness

Matching the **Bile Spitter Juice Lab** and **Carapace Brute Juice Lab** drawers in `CombatStageCanvas.tsx`, the **Action Camera Lab** (`data-testid="camera-lab-panel"`, bottom-left `aaa-charcoal-surface`, `font-mono-tabular`) provides instant visual QA for all four staging modes:

#### Keys `1–4` Hotkey & Trigger Contract
| Key | Trigger (`fireCameraTrigger`) | Staging Mode | Framing & Projectile Behavior | Hit-Stop, Zoom, Tilt & Screen FX |
| :--- | :--- | :--- | :--- | :--- |
| **`1`** | **`melee_normal`** (`1 · Melee Hit`) | `'melee'` | Attacker & front enemy pull to exact nose-to-nose contact gap (`12.5% VW`) via `EaseOutExpo` | `120ms` Hit-Stop, `1.52× → +8%` Hold creep, `-2.2°` tilt, `3f` white→crimson flash, live-anchored `-14` popup |
| **`2`** | **`melee_crit`** (`2 · Melee Crit`) | `'melee'` | Nose-to-nose center-stage melee clash at deep Crit zoom | `250ms` Hit-Stop, `1.80× → +8%` Hold creep, `-3.5°` tilt, `2.2% VW` shake, 2f invert flash + vignette + 28 speed lines, `CRIT -28!` |
| **`3`** | **`ranged_single`** (`3 · Ranged Shot`) | `'ranged_fast'` | **Beat 1 (`0.24s`):** `1.42×` shooter close-up + `6% VW` lead room; `onProjectileSpawn` fires heroine's styled weapon volley (`scattergun` / `drone_plasma` / `pistol_bolt`).<br>**Beat 2 (`0.13s`):** `EaseOutExpo` whip-pan to target | `120ms` Hit-Stop on arrival, in-slot `8%` lunge & recoil, `3f` white→crimson flash, `-16` popup |
| **`4`** | **`ranged_aoe`** (`4 · Ranged AoE`) | `'ranged_aoe'` | **Beat 1 (`0.24s`):** Shooter close-up + styled multi-target volley.<br>**Beat 2 (`0.13s`):** Whip-pan to multi-target centroid at clamped `1.22×–1.30×` | `160ms` Hit-Stop, **`40ms` L→R cascaded** target flashes, knockbacks, crimson bursts, and staggered `-16 / -18 / -20` popups |

#### Drawer Controls & Scoped Key Guard
1. **Header Row:** Cyan badge (`◎ Action Camera Lab`), cross-lab pills (`⬡ Spitter`, `■ Brute`), `Reset` (`data-testid="camera-lab-reset-btn"` — restores `DEFAULT_COMBAT_PRESENTATION_CONFIG` and calls `actionSequencer.reset()`), and `✕` Close (`data-testid="camera-lab-close-btn"`).
2. **Designer Sliders & Flags:** `Wind-up (s)`, `Hit-Stop Norm (ms)`, `Hit-Stop Crit (ms)`, `Zoom Norm / Crit`, `Hold Creep (%)`, **`Clash Gap (% VW)`** (`8%–22%`), `Dutch Tilt Crit (°)`, `Shake Crit (% VW)`, `Knockback (% VW)`, `AoE Cascade (ms)`, `Stage Dimmer`, plus checkboxes for `Adaptive Pack`, `Crit Flash`, and `Hide HUD` (`hideWorldUiDuringCutIn`).
3. **Scoped Key Listener (`CombatStageCanvas.tsx`):** Capture-phase `window.addEventListener('keydown', onKeyDown, true)` active only while `cameraLabOpen === true`, ignoring `<input>` / `<textarea>` focus targets and calling `e.preventDefault(); e.stopPropagation();` for `'1' | '2' | '3' | '4'`.

---

### 11.7 Automated Verification Suite (`combatPresentation.test.ts`)

Run the presentation unit suite with `tsx` (resolves TypeScript relative imports cleanly):

```bash
npx tsx --test src/components/combat/combatPresentation.test.ts
```

1. **Adaptive Pack Tempo:** Verifies `1.0× / 0.80× / 0.64×` pack scaling and non-cut-in beat durations.
2. **Melee, Shooter Lead & AoE Centroid Framing:** Confirms Melee midpoint framing, Beat 1 shooter directional lead room, and AoE centroid clamping within `[1.22×, 1.30×]` (`≥ 1.0×`).
3. **Rotation-Aware Overscan Corner Invariant:** Transforms all 4 viewport corners through the inverse camera matrix under `3.4°` Dutch tilt + extreme pan + maximum trauma shake and asserts every corner remains inside `[-16, W+16] × [-8, H+8]`.
4. **Viewport-Relative Shake Scaling & Safety Overrides:** Confirms shake pixels scale proportionally across `640px` vs. `1920px` viewports, and verifies `reducedMotion` and `tacticalViewActive` overrides.
5. **Melee Clash Slide vs. Ranged In-Slot Lunge & 3-Frame White Flash:** Verifies midpoint slide vs. `8%` in-slot lunge, 3-frame `#FFFFFF → #FF2E7E` countdown during Hit-Stop, Hold drift apart, and clean `finish()` reset.
6. **Melee Crit Full Timeline:** Verifies `windup` → `impact_freeze` (`simDt = 0`, `worldUiAlpha = 0`, invert flash, speed lines) → `followthrough` (`+8%` inward zoom creep) → `reset` (`worldUiAlpha = 1`).
7. **Two-Beat Ranged Fast & Ranged Lobbed:** Verifies `onProjectileSpawn` firing once at Beat 1 → Beat 2, rapid `EaseOutExpo` whip-pan, and live `getProjectileX()` camera tracking.
8. **Ranged AoE Left-to-Right Cascade:** Supplies out-of-order targets and verifies `onImpactTarget` fires strictly left-to-right at `~40ms` intervals with clamped wider zoom.
9. **Serialized FIFO Queue & Guaranteed Cleanup:** Confirms overlapping `enqueueCutIn` calls execute sequentially without stomping and `tacticalViewActive` immediately cleans up camera, dimmer, and HUD state.
10. **Static Cut-In Pose Overrides:** Confirms exact `attack_pose`, `brace_pose`, and `recoil_pose` frame indices for `crawlerSpriteSheet.ts` and `stalkerSpriteSheet.ts`.
11. **Callback Exception Isolation & Guaranteed Cleanup:** Throws errors inside `onWindupStart`, `onProjectileSpawn`, `onImpactFrame`, and `onImpactTarget` and asserts the sequencer still completes Phase D cleanly.
12. **Hero & Enemy Staging Classifiers:** Confirms Aurelia/Zuri are 100% ranged (`scattergun` / `drone_plasma`), Kira is hybrid melee/pistol, Spitter acid & Stinger darts are ranged, and all other enemy archetypes use melee clashes.
13. **Slot-Invariant Nose-to-Nose Slides (Slots 1–5):** Asserts exact contact gap without crossing for both hero-vs-enemy and enemy-vs-hero melee attacks across all 5 enemy slots.
14. **Zero-Overshoot Smooth Knockback:** Asserts `knockbackX` begins smoothly at `0px` and never reverses negative across 45 frames.
15. **Left/Right Facing-Aware Spine Bend:** Verifies both native left-facing (`larva`, `facingSign = +1`) and mirrored right-facing (`stalker`, `facingSign = -1`) enemies bend toward the heroine (screen left) on `attack_pose` and away (screen right) on `recoil_pose`.

