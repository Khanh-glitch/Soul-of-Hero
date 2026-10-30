# D061 — Monsters reach player home only via real footprints
Date 2026-10-30. Direct user choice: “quái mò tới nhà khi có dấu chân th, đơn giản v, ng chơi tự biết dấu chân quanh nhà đã sạch chưa, gần đó có quái cần clear trckhi off ko”.

## User-locked experience
Home targeting is NOT an arbitrary time-based raid: monsters need a real, detectable remaining trail to discover the player's house. The player can assess nearby signs and hostile presence before closing the app. This applies both during active play and offline world-time per D060. Nearby monsters without a usable trail do not know the location of the player's home.

## Engineering interpretation for testing (not user-approved numeric values)
1. Trails emerge from actual actor movement on material surfaces; persistence depends on real elapsed world time, rain/wind, wet mud/snow/rock, and monster sensory class. Tracks diminish or wash away; routine house use must not permanently guarantee detection.
2. A monster must exist in a legitimate location, sense a segment, follow trace connectivity with pathfinding, and may lose the trail or give up. No world-wide home-coordinate lookup, instant teleport, raid spawned solely because the user is offline, or free chase through sealed walls.
3. The player can prepare by waiting for fading/washing of signs, choosing paths and surfaces, or clearing actual nearby pursuers. Do not show an omniscient 100%-safe status; give visual/audio signs the player can judge.
4. If a real creature follows valid tracks and reaches the home, structural integrity, wall navigation/breaching and repair rules still apply, including during offline progression. The precise hazard severity and outcomes must be defensible under continuous time and resources rather than a hidden login penalty.
5. Offline settlement must be bounded and idempotent: derive trace state and legitimate pursuer motion from saved world facts, don't endlessly spawn NPCs while closed, duplicate monster drops, or reset trail age on reload. Validate weather changes, chunk loading, newly generated runs, D055 expiry and D059 protected starvation independently.
6. Open technical questions: footprint lifecycle/readability, monster detection radius and ability, persistence after visual trace fades, whether roaming population moves across chunks offline, repair risk/forewarning and balancing. These do not reopen the USER LOCKED trigger condition.

Native regression expectations: fresh home with no surviving trail gets no targeted intrusion; one detected connected trail permits one real pursuit; rain or age can erase trail; nearby monsters cleared removes pursuers; offline and equivalent online elapsed intervals yield logically compatible detection; no ghost mobs from unloaded region; no loot dupe on restart.
No Arena dispatch or production claim. This supplement reconciles D061 with D055–D060 and CT system goals.