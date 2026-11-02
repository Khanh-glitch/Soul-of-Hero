# SOUL OF HERO — CHAPTER 1 INDEPENDENT VISUAL PRODUCTION REVIEW

**Reviewer:** Independent art director / production reviewer (fresh session, no prior context carried over).
**Review target (pinned):** `arena/6e89e68d-soul-of-hero` @ `15da7306002fc0547d0dee5fa7c4e8ab84204d3a`
**Production art commit:** `a0c858920f2ad819b1ca56088598cbdde113888c` (tip of the pinned branch at time of review)
**Engine:** Godot 4.7 stable
**Native resolution:** 640×360 canvas, presented at 1280×720 nearest-neighbour
**Evidence base:** full-map mosaics for L01–L10, all `after_*.png` native gameplay frames (640×360, real HUD/actors/entities) for L01–L10, and 3× nearest-neighbour diagnostic crops for L01–L10; cross-checked against `docs/chapter1-visual-recovery/level-report.md` and `repair-ledger.md` only after the blind pass.

Methodology note: the blind pass was completed (every mosaic, every native gameplay frame) before any historical documentation was opened. Observations in Section B are my own; I then explicitly accept or reject each historical risk in Section D.

---

## A. EXECUTIVE VERDICT

**READY WITH MINOR PUNCHLIST.**

The ten Chapter 1 levels are, in aggregate, a coherent, atmospheric and production-quality dark-fantasy campaign. The authored L05–L10 environments (Blood Crucible, Soul Anchor Relay, Failing Beacon, Divided Reliquary, Crimson Gate, Castellan Throne) are the work the owner will actually remember: each has a distinct palette, a readable landmark object, disciplined lighting, and a silhouette that identifies the level without a label. Actors, enemies, pickups, portals and combat VFX are visible against every background I inspected. Technical integrity (no missing props, no clamped frames, no light stacking, collision/route tests passing) is confirmed by the CI runs referenced in `INDEX.md` and is consistent with what I see on screen.

The remaining shortfall is concentrated almost entirely in the **L01–L04 procedural block**, where the environment system renders clean, readable rooms whose authored-prop layer is thin. Among those four, L04 lands a real landmark (the shrine), L02 and L03 carry their theme through texture identity, and **L01 — Crypt Entrance is the one room whose first impression falls below the bar the rest of the chapter sets**. There are also two isolated polish issues in the authored half (L07 beacon flame scale; L08 right-wing headroom during heavy combat VFX).

None of these are P0 blocking defects. Navigation, objectives, combat readability and spatial coherence are intact across all ten levels. The chapter tells a clear escalating arc — from quiet grey crypt to monumental crimson-gate approach to the purple throne-room finale — that is stronger than the sum of its parts.

**Recommendation:** approve Chapter 1 for playtesting/owner review after a single, tightly scoped polish pass (five interventions listed in Section E). Do **not** authorize another broad repair cycle; the visual foundation is sound and another open-ended sweep risks overworking strong compositions.

---

## B. LEVEL-BY-LEVEL ASSESSMENT

### L01 — Crypt Entrance

- **Identity the player perceives:** A quiet, cold, grey-stone burial antechamber; a short tutorial corridor lit by two warm torches, scattered with identical stone sarcophagi and three purple exit doors.
- **Strongest achievement:** Material discipline is high. Wall band, floor tiles, sarcophagus lids and rock voids share one cool palette without collapsing into a single value; torch pools and the exit portal give the eye a clear path. Actors, soul pickups and chests read cleanly. The room is uncluttered and readable, which is appropriate for a first level.
- **Main weakness:** **The four rooms are interchangeable.** There is no hero object, no burial monument, no differentiating prop that tells the player "this is the crypt entrance" rather than "generic stone room with boxes." The sarcophagi read at 640×360 as identical dark-grey low boxes — their burial identity is carried entirely by the level name and a few tiny urn props. The three purple doors at the exit are the only memorable silhouette, and they are a transition, not a destination.
- **Gameplay impact:** Does not block navigation, combat or objectives. Purely first-impression / art-direction polish. Enemies and projectiles are clearly visible.
- **Evidence:** `L01/images/after_entry.png` (spawn in the north-west alcove: the "niche" with three black slots and a single brazier is the strongest single detail, but it is small and placed against the far wall); `after_landmark.png` and `after_landmark_2.png` (central halls are visually identical); `after_exit.png` (the purple doors are the single memorable element). Mosaic `L01_mosaic.png` shows the three horizontal bands of near-identical sarcophagi.
- **Production verdict:** **FOCUSED REWORK REQUIRED** — but tightly scoped: add a single entrance monument / hero sarcophagus at spawn and break the rhythm of identical boxes. The underlying environment system, lighting and floor/wall separation should be preserved.

### L02 — Ossuary Fork

- **Identity:** A bone-lined catacomb of curved corridors, tall pale bone-shaft colonnades, and skull racks; warm torchlight on off-white stone.
- **Strongest achievement:** The bone theme actually reads. Skulls embedded in the floor border, the curved ribbed arch walls, and the tall pale niches filled with skull rows establish "ossuary" immediately and unambiguously — better than L01 establishes "crypt." The three horizontal forks are spatially understandable.
- **Main weakness:** The branch distinction is weak. Despite the name "Fork," the three arms share the same bone-niche + skull-rack vocabulary and the same lighting, so the player does not feel they have chosen between meaningfully different destinations. This is a design-narrative issue, not a visibility one.
- **Gameplay impact:** Enemies (skeletal archers visible in `after_landmark_4.png`) and soul drops are clearly readable against the pale floor. Collision and navigation are clean. The bone-shaft props read as walls at native res, which is correct.
- **Evidence:** `after_entry.png` (skull racks + hanging cage + bone floor establish identity in one frame); `after_landmark_3.png` (the central chamber with the over-bright flood — this is the brightest point in the level and actually sells a "holy bone" sanctum feel, which works).
- **Production verdict:** **ACCEPT WITH MINOR PUNCHLIST.** The ossuary reads; only the branch-identity polish is optional.

### L03 — Crossfire Archive

- **Identity:** A warm, candle-lit library of packed dark-oak bookshelves, tan tile floors, scattered reading desks and floor candelabra.
- **Strongest achievement:** The bookshelf texture reads as books at 640×360 (the horizontal shelf lines and the colour variation of spine rows resolve correctly — a non-trivial pixel-art win). Palette is warm and distinct from both L01/L02's stone and L04's gold/green. The gated central chamber (visible in the mosaic) and the hanging lanterns create a plausible archive.
- **Main weakness:** "Crossfire" does not come across in the environment — the room does not visually tell the player they are entering a ranged-encounter arena. Sightlines exist mechanically but are not emphasized architecturally (no gallery railings, no firing-perch markers). This is a design point rather than a visual defect.
- **Gameplay impact:** Bookshelves provide clear cover silhouettes; ranged enemies (blue souls, archers) and their projectiles read clearly against the tan floor in every combat frame. No visual complaints affecting play.
- **Evidence:** `after_landmark_2.png`, `after_landmark_3.png` (combat in the bookshelf corridors: clear actor separation; the candelabrum and the chest are instantly identifiable); mosaic confirms three floor bands with a central lock.
- **Production verdict:** **ACCEPT.**

### L04 — Spiral Reliquary

- **Identity:** A columned processional hall of olive-gold stone and teal accents, culminating in a glowing diamond shrine on a stepped plinth with concentric green floor rings.
- **Strongest achievement:** **The shrine is the strongest landmark in the L01–L04 block.** The white stepped plinth, the suspended diamond, the hanging bell lanterns and the gold frieze band together read as a relic altar, and the concentric green circles around it establish a sanctified zone. The palette (olive stone + teal-gold accents) is unique in the chapter.
- **Main weakness:** Colonnade repetition. Outside the shrine room, the hall is a steady rhythm of identical banded columns with little visual punctuation between them — but columns are the correct architectural element for a reliquary procession, and this repetition does serve the "processional" feeling.
- **Gameplay impact:** The shrine is a clear waypoint; enemy skeletons read against the olive floor; combat in `after_landmark_3.png` is fully legible.
- **Evidence:** `after_landmark.png` (the shrine — this is a successful composition); `after_entry.png` (processional colonnade — repetitive but coherent).
- **Production verdict:** **ACCEPT.**

### L05 — Blood Crucible

- **Identity:** A dark fortress of blue-grey masonry and red drapery, organized around three large circular basins of glowing blood, entered through a torture/sacrifice antechamber (hanging cage, rack, brazier, skulls on spikes).
- **Strongest achievement:** The entry antechamber is one of the most evocative single frames in the chapter — a cage hanging from the lintel, a triangular blood-cult sigil on the wall, scattered bone piles, a rack with blood drips and three lit braziers establish "blood cult dungeon" instantly. The boss-room basin (`after_boss.png`) reads as a large ceremonial bowl on a grated plinth, with warm red uplight; the archer boss positioned between the basin and the exit portal is a strong combat composition. The red banners with the triangle sigil provide a consistent cult iconography.
- **Main weakness:** The historical concern was that "the ceremonial basin is invisible from the spawn camera." Rejecting this as a defect: the spawn is a prep/chamber antechamber, and revealing the basin on entry would be weaker drama. The basin becomes visible as the player proceeds (`after_landmark.png`, `after_boss.png`). A real (milder) issue is that the **three basins use identical geometry and lighting**, which slightly undercuts the sense that the player is moving deeper into the site — but it also establishes a cult motif, which is a valid creative choice.
- **Gameplay impact:** Blood stains on the floor are dark red on dark grey and could be misread as shadow in places, but this has no mechanical consequence; enemies, projectiles and the exit portal are 100% visible.
- **Evidence:** `after_entry.png` (antechamber — strong, on-theme); `after_boss.png` (basin + boss composition — reads clearly); `after_landmark_2.png` (middle court — the grated causeway is the weakest architectural element, reading slightly as flat stripes, but still navigable).
- **Production verdict:** **ACCEPT.**

### L06 — Soul Anchor Relay

- **Identity:** A cool, cyan-lit soul-transfer station of slate-grey stone, with three large crystalline relay platforms connected by glowing conduit channels; tall soul-lamps, hanging banners bearing an ouroboros/loop sigil, and scattered battery crates.
- **Strongest achievement:** **The cleanest and most cohesive level in the chapter.** Palette is unique and controlled (deep slate + cyan soul-light + warm brass accents + pale banners). The relay crystal platforms are unambiguous hero objects — the jagged ice-blue crystal cluster on a circular pad with ring markers reads at a glance as a "soul anchor." Conduit channels glow cyan and gold and visibly link the three stations. Vertical relief is strong (wall bands, banners, lamp posts all break the ground plane).
- **Main weakness:** The conduit channels are thin at native res (the historical "1 px line" concern). At gameplay scale they read fine because the glow and the inlaid gold channel give them width; this is visible only in magnified crops and is not a player-visible defect. One small note: the soul-motes and scattered blue enemy projectiles share the relay's cyan, which in the worst case could momentarily obscure an incoming shot, but contrast against the slate floor and the projectile's motion resolve this.
- **Gameplay impact:** Enemies, pickups and relay objectives are all clearly visible; the central platform makes a natural combat arena.
- **Evidence:** `after_entry.png` (spawn looking down a relay hall — lamps, conduit and distant crystal form a clear line); `after_landmark.png`/`after_landmark_2.png` (the relay platform as combat arena — crystal, players, enemies and purple indicator squares all separate cleanly); mosaic shows coherent left-to-right escalation of the three stations.
- **Production verdict:** **ACCEPT.**

### L07 — The Failing Beacon

- **Identity:** A symmetrical four-courtyard garrison yard built around a central octagonal beacon hearth; tan flagstones, four tall pyramidal flame-torches, store-rooms full of crates, coiled ropes, torn red banners, and the beacon itself burning at the centre with a small bright flame over a scoured dark ash hearth.
- **Strongest achievement:** The central hearth composition is memorable: four conical orange-flamed towers at the cardinal points, two flanking torch braziers, the octagonal ward ring inlaid in dark stone with a red centre line, and the beacon's bright white flame over red drapes. The four side courtyards have readable clutter (crates, barrels, coiled rope, weapon racks, broken masonry) that establishes a lived-in military/fort space, distinct from the ceremonial levels around it. The top-wall band of torn banners and stored spears gives the impression of a perimeter wall.
- **Main weakness:** The beacon's **flame sprite is small relative to the monument**. The four pyramidal torches actually burn brighter and larger in silhouette than the central flame, which slightly undermines "beacon" in favour of "courtyard with four torches and a candle." This is thematically consistent with the title *Failing* Beacon (it is supposed to be guttering), but for a level named after its monument the flame should still dominate the composition.
- **Gameplay impact:** Boss health bar and ward indicators stack above the beacon and read clearly; the octagonal ward ring is visible under the player; enemies (dark warders) read against the tan flagstones.
- **Evidence:** `after_entry.png` (beacon from entry — four pyramidal torches dominate the composition; central flame is bright but small); `after_landmark.png` (beacon close-up — composition works but the central flame competes with the boss bar); mosaic shows strong four-quadrant symmetry.
- **Production verdict:** **ACCEPT WITH MINOR PUNCHLIST.**

### L08 — Divided Reliquary

- **Identity:** A marble antechamber split down a central gold spine: the left wing is cool, blue-lit and penitent (white sarcophagi, tall thin blue candles, dark statues); the right wing is warm, pink-lit and opulent (heavy red curtains, gold candelabra, red-cushioned benches, framed mirrors). The exit is a tall arched portal in a white marble vestibule at the top.
- **Strongest achievement:** **The wing split is a successful and high-concept piece of environmental storytelling.** The left (penitent/silent) wing and right (luxurious/corrupted) wing read as different places despite sharing one floor plan, and the central spine with the gold double-lane and the circular floor markers (the white "I" and the gold chalice) provides legible wayfinding and choice feedback. The exit vestibule (`after_exit.png`) is one of the prettiest frames in the chapter — tall white columns, blue candles, a small gold-trimmed arch, banners, all framed symmetrically.
- **Main weakness:** The historical concern is right-wing over-exposure. At native scale the red wing *is* bright (values in the upper 220–255 range), and during the boss fight (`after_boss.png`) stacked pink VFX, enemy projectiles and torch blooms push the floor and wall detail close to blow-out. This is partly intentional (the wing is meant to be opulent/gilded), but during dense combat it costs some readability. Also, the dividing spine is a very thin gold double-line that in a few frames reads slightly like a scratch rather than built marble inlay — again, visible only on close inspection.
- **Gameplay impact:** In ordinary traversal the wing reads fine. During heavy combat in the boss cluster, enemies and projectiles still separate from the environment due to their dark/cyan silhouettes, but the floor detail is lost. Not a blocking issue.
- **Evidence:** `after_entry.png` (spawn in the central corridor looking down the spine — split is instantly readable); `after_boss.png` (dense combat on the red wing — bright but actors remain visible); `after_exit.png` (vestibule — strong, successful).
- **Production verdict:** **ACCEPT WITH MINOR PUNCHLIST.**

### L09 — Crimson Gate

- **Identity:** A monumental red-stone gatehouse approached down a long central nave flanked by ritual stations (left: a gold bell; right: a flaming cauldron) and terminating at a tall blue-lit portcullis flanked by crenellated towers; blood-red banners, tall urn-censers on tripods, and a central circular seal mechanism with a golden wheel.
- **Strongest achievement:** **This is the best-realized "approaching the big door" composition in the chapter.** The portcullis at the top (`after_exit.png`) reads as a genuine architectural gate — arched voussoirs, a keystone seal, two guard towers with arrow slits, the blue glow falling through the bars onto a bloody threshold. The nave's rhythm (urn → seal → urn → central wheel → urn → seal → urn → gate stairs) is processional and satisfying. The side chambers with the bell and cauldron break symmetry in a purposeful way (two different ritual tools) rather than reading as copy-paste. The palette (rose-brown stone + deep red + blue gate glow + gold bronze) is distinct and warm.
- **Main weakness:** The historical concern was that "four seal stations are not differentiated." At gameplay scale the two *side* stations (bell / cauldron) clearly differ from each other and from the gate; the two *nave* seals near the wheel are similar, but they are flanking markers, not destinations. I do not regard this as a meaningful defect. The "iron band is 1 px" concern is invisible at native scale. One smaller issue: blood splatters on the floor of the nave are quite small and sparse at 640×360, so the "ritual sacrifice" narrative is carried more by the urns and the lighting than by the floor stains — but this is fine.
- **Gameplay impact:** Combat frames (`after_entry.png`, `after_checkpoint.png`) show many enemies, projectiles and soul drops all clearly separated against the warm stone. The gate is always visible as the upward objective.
- **Evidence:** `after_exit.png` (the gate itself — production-quality, strongest end-of-level vista in the chapter); `after_entry.png` (nave with cauldron wing visible right); mosaic shows strong axial composition.
- **Production verdict:** **ACCEPT.**

### L10 — Castellan Throne

- **Identity:** A tall purple-slate throne hall, dominated by a crimson-carpeted cross that runs up the centre to a multi-tiered gold-and-red throne; symmetric white marble columns and gold candelabra line the approach, with red banners bearing a circle emblem on the upper walls. The final boss stands on the red carpet. The exit is a smaller gold-trimmed antechamber.
- **Strongest achievement:** **The throne is the chapter's final landmark, and it reads.** Five distinct masses (stepped dais, winged buttresses outside the back slab, a crimson field behind the seat, a projecting seat with arms, and the crown on the lintel) resolve cleanly at 640×360 as a throne, not as a chair. The purple-slate + gold + red-carpet palette is unique, regal, and feels like a final-level escalation. The boss fight framed on the red carpet with symmetric columns in the background is a composition that supports the climactic duel.
- **Main weakness:** The ground plane outside the carpet is sparse. The four quadrants left and right of the cross are mostly uniform purple tile with a few low stone benches and evenly spaced candelabra. At gameplay scale this reads as *formality and grandeur* (throne rooms are supposed to be austere), which is the correct creative choice — but the candelabra are on a strict grid and the bench debris is minimal, so in frames like `after_checkpoint.png` and `after_entry.png` the floor can feel under-furnished relative to the opulence of the throne itself. The historical concern about "throne silhouette" and "candelabra repetition" is real but mild; tightening the candelabra rhythm or adding 2–3 broken benches/weapons on each side would raise the scene without harming the symmetry.
- **Gameplay impact:** Boss, minions, projectiles and soul drops are all clearly visible against the purple floor. The throne is visible from most of the room and serves as orientation.
- **Evidence:** `after_boss.png` (throne + boss approach — strong composition; columns and banners frame the red carpet); `after_entry.png` (spawn on the carpet — columns and candelabra rhythm visible, floor outside the carpet is a bit plain); `after_exit.png` (exit antechamber — banners and candle-flame symmetry, strong); mosaic shows strong T-shape with axial carpet.
- **Production verdict:** **ACCEPT WITH MINOR PUNCHLIST.**

---

## C. BEST EXISTING WORK (preservation constraints)

These are the elements any subsequent agent must not damage:

1. **The palette arc across L05–L10.** Six distinct palettes (blue-grey/red → slate/cyan → tan/orange → marble split → rose/blue → purple/gold/crimson) that escalate in warmth and monumentality. Do not flatten them with global colour re-tuning.
2. **L06 Soul Anchor Relay as a whole.** The relay crystal platforms, conduit glow, wall-band/lamp/banner rhythm and cyan-on-slate palette are the chapter's cleanest composition. Do not add props to the open floor; the emptiness supports the mechanical/soul-tech feel.
3. **L09 Crimson Gate vista.** The portcullis composition, the blood-urn rhythm down the nave, the bell/cauldron asymmetry and the blue gate glow on rose stone. This is the chapter's strongest single architectural image.
4. **L08 Divided Wing split.** The cool-blue left wing vs warm-red right wing divided by the gold spine is a successful high-concept environmental narrative. Do not "balance" the exposure of both wings to the same value — the asymmetry is the point.
5. **L04 shrine.** The stepped plinth, suspended diamond, hanging bell-lanterns and concentric green rings form the only real monument in L01–L04. It should be the template for L01's added hero object, not a candidate for rework.
6. **L05 entry antechamber.** The cage, rack, blood sigil, scattered skull piles and brazier composition establish the blood-cult theme in one frame.
7. **L10 throne silhouette.** The five-mass throne described in the repair ledger works at native scale. Do not add more detail to the throne itself.
8. **Torch and flame discipline.** Across the chapter, flame sprites are small, warm, and consistently drawn; they never over-bloom or overwhelm the scene. This is a consistent production quality that should be preserved.
9. **Per-level authored prop kits in `assets/environment/chapter1/`** (crucible, relay, vigil, reliquary, gatehouse, castellan) and their JSON documents in `data/environment/chapter1/`. These have been validated to `missing=0 clamped=0`; edits should be minimal and localized.

---

## D. MOST IMPORTANT REMAINING PROBLEMS

I explicitly accept or reject each historical risk listed in the brief, and surface anything I found independently.

### Gameplay-affecting failures (P0/P1)

**None.** In every native combat frame I inspected (L01–L10), the player, enemies, projectiles, soul pickups, chests, portals and indicator squares are visible and separable from the background. Navigation is clear. Objectives (the exit portal, the L08 circular markers, the L07 beacon ward, the L09 gate, the L10 throne) are readable. There are no P0 defects.

### High-value visual improvements (P1)

1. **L01 lacks a hero object / landmark — its four rooms are interchangeable, and the sarcophagi do not read clearly as sarcophagi at 640×360.** This is the player's first impression of the authored-art chapter, and it is materially below the standard set by L04–L10. (Confirms the historical concern, but I locate the issue more narrowly in L01 than in the whole L01–L04 block.)
2. **L07 beacon flame is out-scaled by its own four flanking pyramidal torches.** The monument should burn brighter/larger than its guards; right now the pyramids read as the fire feature and the beacon reads as a smaller central candle. The fix is small (one sprite) and high-impact.
3. **L08 right-wing exposure clips during dense combat.** The wing is intentionally bright, but stacked pink VFX push floor detail to ~250/255 in combat frames (`after_boss.png`). A modest ambient or curtain-opacity trim would keep the opulent feel while recovering floor detail during fights.

### Optional polish (P2)

4. **L02 branch distinction.** The three forks of the ossuary read as variations of the same room. Adding one unique prop per branch (e.g., a small bone altar on one, a broken pillar on another) would help players feel the fork matters. Low priority; does not affect the level's identity as an ossuary.
5. **L10 candelabra/bench rhythm.** The side quadrants are a touch austere; 2–3 broken benches, a dropped weapon or two, or slightly off-grid candle placement would add life without threatening the symmetry.
6. **L05 three-basin sameness.** Modest variation (one basin with a different grate pattern, one lit from a different angle) would deepen the sense of descending through the site. Low priority.

### Historical concerns I am rejecting as NOT defects

- **"L05 ceremonial basin not visible from spawn camera."** Intentionally good encounter design; the reveal is earned.
- **"L06 1-px conduit lines."** At native 640×360 the glow and gold channel give the conduit enough width that this is invisible to the player. The issue exists only in magnified crops.
- **"L08 walls one tile high."** At native scale the marble walls read as walls due to colour and trim; the thickness concern is an atlas-inspection artefact.
- **"L09 four seal stations identical."** The side stations (bell vs cauldron) are clearly different at native scale; the two nave seals are flanking markers, not destinations.
- **"L09 iron band 1 px."** Invisible at gameplay scale.
- **"L10 candelabra repetition."** The regular grid supports formality; it is a stylistic choice, not a defect. A light loosening is optional polish, not required.
- **"L01 floor/wall value separation."** Wall band is lighter than floor and clearly separated at native scale; the coping strip and torch pools further anchor planes. The separation is adequate.

---

## E. TOP INTERVENTIONS (ranked by player-visible impact / cost)

Listed in priority order. Fewer than five are strongly justified; I list four.

### Intervention 1 — L01 Crypt Entrance: add a single entrance monument

- **Target / problem:** L01 spawn room (north-west alcove) reads as "generic grey room with a torch and some boxes." It has no hero object and fails to establish "crypt entrance" as a distinct place. The sarcophagi are visually identical dark low boxes.
- **Intended visual result:** From the spawn frame (`after_entry.png`), the player immediately sees a large, clearly readable burial monument — a hero sarcophagus, a sealed tomb gate, or a carved stele — centred on the entry wall or in the first chamber. This establishes the crypt identity and gives L01 the silhouette strength L04's shrine already has. The other sarcophagi can remain as-is (mass-produced minor tombs) but the monument gives them a hierarchy.
- **Recommended approach:** Add 1 authored prop (a "hero sarcophagus" / sealed niche) to the L01 procedural kit. Place it in the spawn room. Light it with the existing warm torchlight (one extra torch adjacent if needed). Preserve the existing floor, wall-band, coping, rock voids, and torch pool placement; do not globally re-palette L01.
- **What NOT to change:** Do not rebuild the procedural generator; do not alter floor tiles; do not add props to every room (that would clutter the tutorial level and risks collision regressions).
- **Scope:** SMALL (1 prop sprite + 1–2 placements + light).
- **Expected impact:** HIGH for first-impression; low for deep gameplay.
- **Acceptance criteria:** In a fresh native capture of the L01 spawn, a player looking at the frame for 2 seconds can identify "this is a crypt / tomb" without the level label; the monument has a distinct silhouette from the ordinary sarcophagi at 640×360; collision/route tests still pass.

### Intervention 2 — L07 Beacon: scale up the central flame

- **Target / problem:** The beacon's central flame sprite is small enough that the four flanking pyramidal torches dominate the composition; the monument named in the level title does not read as the primary fire source.
- **Intended visual result:** When the player stands at the entry of L07 (`after_entry.png`), the central beacon flame is the brightest, largest fire in the frame; the four pyramidal torches frame it rather than compete with it.
- **Recommended approach:** Enlarge the beacon flame sprite ~1.5–2× and give it a modest additional light radius/energy so its bloom reads above the pyramids. Keep the flame palette consistent with the existing warm orange; do not change the hearth, ward ring, banners or pyramidal torches. Keep the "failing/guttering" character (don't make it a roaring inferno — just the dominant flame in the yard).
- **What NOT to change:** Do not re-light the whole level; do not alter the octagonal ward ring or the side courtyards; do not move the pyramidal torches.
- **Scope:** SMALL (1 sprite scale/light adjustment).
- **Expected impact:** MEDIUM.
- **Acceptance criteria:** In the L07 entry frame, the central flame has the largest silhouette and highest bloom value; the hearth still reads as scoured/ash-covered; the ward ring is still visible under combat UI.

### Intervention 3 — L08 Divided Reliquary: trim right-wing exposure during combat

- **Target / problem:** The right (red) wing pushes toward value 255 in the floor/wall region during dense combat, because a bright ambient + 45 authored lights + stacked pink VFX combine. Traversal frames are fine; combat frames (`after_boss.png`, `after_checkpoint.png`) lose floor detail.
- **Intended visual result:** The right wing remains opulent, warm and pink-lit — but at peak combat brightness, floor tiles and bench cushions still separate from the wall base (i.e., no channel above ~235 in the floor region). The left wing stays cool as a contrast.
- **Recommended approach:** Reduce ambient on the right wing by ~10–15% (a document-level tweak in `chapter_1_level_8.json`), OR lower the energy of 2–3 of the brightest overlapping candelabra near the boss spawn. Verify by re-capturing `after_boss.png` and checking that bench silhouettes and floor joints remain visible under stacked VFX.
- **What NOT to change:** Do not match the wings to the same exposure; do not remove curtains or candelabra; do not alter the central gold spine or the exit vestibule (which is already well-exposed).
- **Scope:** SMALL (light-tuning pass, 1–3 lights).
- **Expected impact:** MEDIUM (affects the most combat-dense frames of L08).
- **Acceptance criteria:** In a boss-combat capture, floor tiles and bench outlines are distinguishable from walls even with maximum VFX on screen; the wing remains perceptually warmer/brighter than the left wing; curtain reds remain saturated.

### Intervention 4 — L10 Throne: loosen the side-quadrant austerity slightly

- **Target / problem:** The four floor quadrants flanking the red-carpet cross are near-empty purple tile with candelabra on a strict grid and a few low benches. The austerity supports the throne-room reading, but in combat frames (`after_checkpoint.png`, `after_entry.png`) the area outside the carpet reads as under-furnished relative to the opulence of the throne and banners.
- **Intended visual result:** The quadrants still feel formal and symmetric, but have small signs of use/hall life — a couple of discarded polearms, a cracked stone tile, a fallen banner tassel, a few benches rotated slightly off-grid — so the hall feels occupied rather than staged.
- **Recommended approach:** Add 4–6 small "clutter" props per quadrant (can be drawn from the existing castellan kit — weapons, broken benches, fallen candelabrum bases, blood pools). Keep them at least one tile from the carpet edge to preserve the cross's visual authority. Jitter 2–3 of the existing candelabra slightly off their grid position (don't destroy the symmetry entirely; a throne room should feel ordered). Preserve the throne, the red carpet, the columns, the banners, the boss spawn position and all collision.
- **What NOT to change:** Do not add large props that block the throne sightline; do not break the cardinal symmetry of the columns and banners; do not alter the palette or lighting.
- **Scope:** SMALL (prop placement only, no new art).
- **Expected impact:** LOW–MEDIUM.
- **Acceptance criteria:** In the entry frame (`after_entry.png`), the floor outside the carpet has more than one kind of object visible; symmetry is preserved (left side mirrors right in composition, even if individual props differ); collision/route tests still pass; the throne remains the dominant silhouette.

### Interventions NOT recommended

- No broad re-palettization of L02/L03. Their themes read.
- No rebuild of L05, L06, or L09. These levels are successful; further work risks harm.
- No new props kits. The existing six authored kits carry the chapter.
- No global lighting pass. Lighting discipline is one of the chapter's strengths.

---

**Would implementing these interventions materially improve Chapter 1 enough to justify another production pass?**

**Yes — but a pass of very tight scope.** Intervention 1 (L01 monument) is worth doing on its own because it is the player's first authored-art moment and the gap between L01 and L04/L05 is the only place the chapter shows its seams. Interventions 2–4 are half-day-at-most adjustments that polish existing strengths without risking regression. I do **not** recommend another broad repair cycle; I recommend a single scoped pass with these four items as the entire backlog, followed by a native re-capture of the affected frames and owner approval.

If the owner is willing to ship with the current L01 (and treat "simple tutorial crypt" as an intentional design choice rather than a shortfall), then even those four interventions are optional and the chapter can move directly to gameplay playtesting. The authored half (L05–L10) is already the strongest work in the repository and does not need more cycles.

---

## F. RECOMMENDED NEXT ASSIGNMENT

**Assignment title:** Chapter 1 visual punchlist — L01 monument + three small trims.

**Exact scope:**

1. Author one hero-sarcophagus / entrance-tomb prop for the L01 crypt procedural kit; place it in the L01 spawn chamber; add one warm torch adjacent if needed. Verify against collision/route tests.
2. Increase L07 beacon flame scale ~1.75× and marginally boost its light so it dominates the four pyramidal torches.
3. Trim L08 right-wing ambient or the two brightest overlapping candelabra energies to recover floor detail in the boss fight (target: floor values ≤ 235/255 under VFX load).
4. Add 16–24 small clutter props (weapons, cracked stones, jittered candelabra) to L10's side quadrants; preserve throne sightline and axial symmetry.

**Stopping conditions:**

- All four items implemented.
- `tools/validate_chapter1_art_refs.py` and `chapter_1_collision_route_test` pass.
- Native re-capture of L01 entry, L07 entry, L08 boss, L10 entry frames show the intended visual result at 640×360, verified by eye (not by pixel averaging).
- No light/prop changes outside the four items above. Specifically, do not touch L02–L06 or L09 except in service of (1).
- Do not start a new validator or a new sweep of fixes. Stop after these four items and submit for owner approval.

**Separation of tasks:** all four items are independent and could be split by level (L01, L07, L08, L10 as four small PRs), but because they are all tiny and share the same approval gate, bundling them into one focused pass is acceptable.

---

## G. EVIDENCE AND UNCERTAINTY

**Source SHA pinned:** `15da7306002fc0547d0dee5fa7c4e8ab84204d3a` (branch `arena/6e89e68d-soul-of-hero`, lowercase). Production art commit `a0c85892` is an ancestor of that SHA; the tip adds only documentation (`docs(level-report)` and CI publishing), so visual content in the review is effectively `a0c85892`.

**Evidence inspected directly:**
- Full-map mosaics: `docs/chapter1-visual-recovery/after/L0{1..10}_mosaic.png` (all ten).
- Native gameplay frames: all `after_*.png` files in `docs/chapter1-visual-overhaul/L0{1..10}/images/` (58 frames total: L01 7, L02 8, L03 9, L04 8, L05 9, L06 7, L07 4, L08 4, L09 4, L10 4).
- Diagnostic 3× nearest-neighbour crops for L01–L10 entry/exit/landmark frames.
- Contact sheets of all native frames were assembled and reviewed at native 640×360.

**CI results referenced (not rerun):**
- Visual overhaul run: GitHub Actions `40305715932` — produced the `after_*.png` frames I reviewed.
- Audit sweep run: `40305715916` — produced the mosaics.
- Runtime validation: `40321720314` — import/generator/collision/render jobs pass; the known pre-existing failure vs old `main` baseline is correctly classified as unrelated.
- Per `docs/chapter1-visual-overhaul/INDEX.md`, all chapter_1_map_design, chapter_1_campaign_map_design, chapter_1_collision_route tests pass; art-reference validator reports `missing=0 clamped=0` on every authored level.

**Views I did not inspect directly (declared uncertainty):**
- I did not rerun the Godot engine to capture new frames; all gameplay evidence is from the CI-produced native captures on the pinned SHA. The captures include HUD, actors, enemies, pickups, portals and combat VFX, and cover entry, checkpoint, landmark and exit camera positions for each level, so I believe the evidence is sufficient for a production-verdict review — but I did not perform live gameplay (controller in hand) or verify animation frames, particle motion, or transitions between rooms.
- I did not inspect sound, animation timing, or enemy-AI behaviour; this review is visual-only, per the brief.
- I inspected the GDScript presentation layer (`chapter1_environment_art.gd`, `crucible_art.gd`) and the JSON theme documents at a high level to confirm the L1–L4 procedural vs L5–L10 authored split; I did not audit their logic in depth. The technical-validation report in the repository is my source for "missing=0 clamped=0" and generator reproducibility.

**Distinguishing direct observation from inference:**
- Direct observation: palette identity per level; hero-object presence/size/readability; actor/enemy visibility in combat frames; torch density and bloom; landmark silhouettes; floor/wall value separation at native scale; L01 room interchangeability; L07 flame vs pyramid scale; L08 right-wing brightness in combat frames; L10 side-quadrant sparseness; the visual success of L06, L09 and the L08 exit, L04 shrine and L05 antechamber.
- Inference (labelled as such in text): that L01's weak first impression matters more than its absolute visual quality because it is the player's entry point; that the "failing beacon" theme justifies a smaller flame but not one smaller than its guards; that the L08 right wing is intentionally bright rather than mistakenly over-exposed; that the authored levels (L05–L10) are production-ready on their own merits rather than merely "better than L01–L04."
