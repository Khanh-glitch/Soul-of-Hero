# R5 ELDER LAIR SOURCE PATCH — 2026-11-09

Scope: isolated branch `game/veyra-81-poi-art-battle-20261109`. Do not merge to production or label as boss-combat integration.

This patch corrects the specific R5 art-location flaw: the previously open ground-level boss monuments are no longer the encounter cores. It retains all six canonical POI IDs/centres, 4-floor plans and their 3 stair links, while giving each territory a deep, bounded encounter approach. **No boss actor, hero, damage system, reward, save mutation, or AI is added.** The symbolic statues remain provisional.

| Elder | Canonical POI | Boss-symbol anchor (relative to canonical centre) | Realm | Approach topology |
| --- | --- | --- | --- | --- |
| Aion / Time | po_elderwood | (0,+12) | -1, closed root hollow | Forest ring → root hatch at (0,-15) → two offset root knots → Buried Heart |
| Anubis / Spirit | po_necropolis | (0,+12) | -1, walled judgement crypt | Desert procession → hidden ossuary at (0,-18) → two offset crypt gates |
| Argus / Mind | po_hall_eyes | (0,+12) | -1, closed observation chamber | Academic oculus → archive stair at (0,-16) → staggered sight apertures |
| Atlas / Space | po_gate | (0,+13) | -1, folded subspace vault | Coastal causeway → vault stair at (0,-17) → two bent openings and rune reflections |
| Surtur / Fire | po_surtur | (0,+12) | -1, basalt heart-furnace | Volcanic forge terraces → furnace hatch at (0,-18) → constricted throat |
| Typhon / Pressure/Ice | po_typhon | (0,-14) | 0, roofless walled pressure cleft | Falls Road → southern slot at (0,+17) → two staggered canyon notches |

Technical notes:
- `elderLair()` authors non-open walled chambers through the existing Plan DSL. Floor `-1` uses no roof sprite because it is subterranean, but wall/collision exists; Typhon is intentionally open to sky with physical rock walls.
- Stair descent target remains on its same floor, and each core is at least one authored corridor away. Existing tall monuments were moved to actual cores; outer pylons/runes remain wayfinding landmarks.
- `web/src/veyra05/arch/elder-lairs.test.ts` asserts all six source POI centres, floor count, three links, enclosed cores and shortest-path traversal over compiled real wall/floor tiles, not merely `compilePlan().issues`.
- The old `R5_RELEASE_MANIFEST.json` describes a **different frozen ZIP artifact**. Its checksums and prior browser QA MUST NOT be attributed to this patch. The GitHub branch has **no committed standalone release HTML or R4 baseline** to rebuild it here. Native Vite build/browser screenshots, every live stair E, geometry over GOLD dry/water rasters, and actual combat balance remain unverified until a connected runtime has run.
- No world-map geometry, canonical POI positions, legacy source identities, GOLD water, or gameplay economy/loot/combat was intentionally changed.

Acceptance still required: `cd web && npm ci && npx vitest run src/veyra05/arch/elder-lairs.test.ts`, Vite build, six browser captures at 1x on correct POIs, real keyboard approach/return, stair E in both directions, no duplicate clipping, no water/terrain conflicts. **This source geometry patch is not visual or gameplay certification.**
