# A0 → A1 / Control Tower: canonical two-POI native composition blocker

**Status: OPEN — exact owner contract mismatch, not a claim that A1's authored data failed.** A1 and A3 stay paused; this is a handoff, not a branch edit or request for extra agents. A0 draft PR #21 stays held.

## Source evidence

- The existing mounted Chapter 1 `data/overworld/hollow_marches.json` declares `world_bounds = {x: 0, y: 0, w: 384, h: 256}`, so its x cells are 0–383. The ordinary start position is `[56, 218]`.
- A1's byte-identical `data/survival/world/vertical_slice/poi_crown_waystation.slice.json` at A1 commits `2cb1a3c5f093724eb9fecbdf45909ccb611f7b32` and `df526cc` (Git blob `efd125567891e973f5b9d4752192cbda0976df92`) declares `integration_status: NATIVE_READY_CONTRACT_NOT_MOUNTED`, `native_playable: false`, immutable Hero spawn `[392, 200]`, anchor `[408, 200]`, and node/stand positions outside the current overworld x bounds. The Relay slice declares anchor `[440, 236]`, crank node `[443, 234]`, stand `[442, 234]` and the same spawn `[392, 200]`; these too are outside those bounds. The slices refer to `chunk:6:3` of the authored larger world. Contract-native-ready is not a scene, reachable route, mounted collider, or transaction implementation.
- The assignment explicitly excludes integrating the full 192-chunk continent now and forbids fabricating a second world or teleport-based journey. Merely copying the JSON into the legacy world leaves its declared geometry out of bounds; silently moving the anchors or enlarging the production world would contradict A1's immutable geography/ownership and may replace authored navigation/physics. A0 cannot truthfully call that owner-compatible native composition or a fresh-save round trip.
- `world_slice` is not currently an implemented A0 SaveService/overworld POI namespace or mounted interaction/cooldown system. The POI documents require A0's atomic SaveService integration and real active-time accounting; parsing them or importing A3's conflicting model is not a substitute.

## Required canonical behavior if a bounded integration contract is provided

- Waystation `pry_locker`: capability `cap_salvage` only, no items. `seal_ledger`: `cap_seal_1` only. `cache_restock`: exactly 3 `iron_scrap` and 2 `knowledge_spares`, 1800 actual active seconds; `gather_deadfall`: exactly 2 `oak_wood`, 300 actual active seconds. No offline/pause progress, duplicate receipt, cooldown consumption on full bag, or invented locker loot.
- Relay `hand_crank_bypass`: exactly 2 `iron_scrap` and 1 `oak_wood` atomically debited once for `cap_power_1` and `bus_powered`; `copper_upgrade` stays disabled; preserve `cap_filter` shortcut gate. No A3 hypothetical 3+1 cache or item-granting locker.

## Owner-compatible resolution needed

Control Tower/A1 should specify a bounded native composition seam that preserves the canonical authored geometry and gives the existing player a physically navigable route from the real spawn **without integrating the full continent**, or explicitly approve an owner-authored transform/inset plus navigation and collision contract. Specify how the immutable coordinates map, which existing world/controller owns the extra space, and how to protect the original dungeon paths; A0 can then compose and test it without overwriting A1's branch. Until that decision, the two-POI portion of B0 is **BLOCKED**, not passed, and independent A0 work continues.
