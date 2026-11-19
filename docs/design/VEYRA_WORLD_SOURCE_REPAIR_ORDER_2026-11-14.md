# Veyra world source repair order (Item Ontology V2, P8 and P9)

- **From:** Item Ontology V2, Draft PR #61 (`arena/f7f5cf36-soul-of-hero`).
- **To:** Veyra ecology / map owner (`web/src/veyra05/ecosystem.ts`, `VEYRA_BIOME_CREATURE` in `web/src/game/engine.ts`, the Veyra POI plans).
- **Rule followed in PR #61:** no source, loot stock, drop chance, creature placement, Keycard or POI was added or changed. Every number below is read from the live tables; where a number has to be chosen it is marked **OWNER**.

## 1. What is broken

The Veyra ecosystem spawns 9 ordinary creatures, 5 wildlife, 4 side bosses and 6 Primordials and deliberately leaves out the Shipping set (wolf, toad, crawler, beetle, crab). Four items are dropped only by creatures in that left-out set, so on Veyra they do not exist:

| Item | Only dropper (live table) | Drop | What it is for | Effect of the gap on Veyra |
| --- | --- | --- | --- | --- |
| Ash Chitin `chitin` | Cinder Beetle `beetle` | 2, always | 6 per Chitin Plate (`chitin_armor`) | Chitin Plate cannot be made. **Hard block.** |
| Beetle Horn `beetle_horn` | Cinder Beetle | 1, 30 % | specimen: teaches Chitin Plate | Chitin Plate is research tier 3, above the directed-study limit (tiers below 3), so on Veyra it can only come from a random study roll (4 Parts) — and is then uncraftable anyway. |
| Crawler Optic `crawler_optic` | Scrap Crawler `crawler` | 1, 35 % | specimen: teaches Filter Mask; 1 per 2 Spirit Essence; 2 per Demon Core | Spirit Essence recipe and Demon Core recipe cannot run. Filter Mask is still learnable by directed study (9 Parts) and craftable. |
| Wolf Fang `wolf_fang` | Greyfang Wolf `wolf` | 1, 40 % | specimen: teaches Fur Cloak | Soft: Fur Cloak is still learnable by directed study (9 Parts) and its Fur comes from Red Fox and Brush Hare. Only the free specimen route is missing. |

Veyra-blocked recipes today (projection `veyra_blocked_recipes`): `chitin_armor`, `core_demon`, `essence_spirit` — plus `pump_crude` and `refinery_crude`, which are the oil problem in §5.

## 2. Keycard: no repair needed

Measured from the Veyra POI plans by the economic multigraph: **0 keycard doors** on Veyra (`graph.summary.veyraPoiStats.keycardDoors`, pinned by test). Veyra doors are created without a lock (`veyra05/floors.ts`). Every Keycard consumer is a Shipping door. Veyra has no Keycard source and needs none. **No Keycard is to be added to clear the diagnostic.**

## 3. Demon Core and Spirit Essence: drop and manufacture are different routes

| Item | Drop / found route | Own-recipe route |
| --- | --- | --- |
| Spirit Essence `essence_spirit` | **Live on Veyra**: Crimson Warden `vampire_3` (1, 35 %; habitat `po_tombs`, 3 animals) and the Pale Custodian side boss (2, always; Argus Academy sealed archive, floor −1, one defeat per run). None on Shipping. | 1 Crawler Optic + 1 Crystal → 2, Workbench L2, known from the start. **Blocked on Veyra** by Crawler Optic. |
| Demon Core `core_demon` | **Shipping only**: one unique crate (`factory_vault`, behind the Shipping keycard door, `CREATOR_LOOT_V1`). **No Veyra drop.** | 4 Iron + 12 Parts + 5 Crystal + 2 Crawler Optic, Workbench L2; the formula is learned by studying a Demon Core or at the Research Table. **Blocked on Veyra** by Crawler Optic. |

Consequences:
- Spirit Essence is obtainable on Veyra today, but only as a rare drop, and it loads only the Demon Core — which Veyra cannot have. On Veyra it is currently an item with no use.
- Repairing Crawler Optic (§4, order B) unblocks both recipes at once. It does **not** by itself give Veyra a Demon Core: the player still has to learn the formula. Whether Veyra also gets a found Demon Core (a `CREATOR_LOOT_V1`-style unique crate) is a separate **OWNER** decision; this order does not ask for it.

## 4. Work orders

The mechanism already exists and is the owner's: a row in `ORDINARY_CREATURE_HABITATS` (`{ species, poiId, au, count, spreadTiles, leashTiles }`) anchors a creature at a POI; a species name in a `VEYRA_BIOME_CREATURE` row lets the roaming spawner use it on that tile type. The creatures, their sprites, stats and drop tables are already in `CREATURES`; **the drop tables are not to be edited**.

| Order | Creature to place | Veyra habitat that matches its biome (live data) | Suggested anchor | Access condition to verify | Unblocks |
| --- | --- | --- | --- | --- | --- |
| **A** (high) | Cinder Beetle (`biome: 'ash'`) | Cinder Isle scene `veyra05-cinder` — "volcanic ash (hazard)". Cinder Core `slime_3` (also `ash`) already lives at `po_sulfur`, AU (1768, 882), 4 animals. | `po_sulfur` or `po_geo`; roaming row `T.ASH` (today `['slime_3', 'orc_2']`). | Cinder Isle is `firstHour: false` and a hazard zone: confirm a walkable or boat route from a start region and what the ash hazard requires. | `chitin`, `beetle_horn` → Chitin Plate learnable by specimen and craftable. |
| **B** (high) | Scrap Crawler (`biome: 'toxic'`) | Slag Flats scene `veyra05-slag` — "toxic flats (hazard)"; `po_slag` Slagworks Foundry is there and is also the Veyra Recycler site. | `po_slag`; roaming row `T.TOXIC` (today `['slime_2', 'vampire_2']`). | Slag Flats is `firstHour: false` and toxic: confirm the route and whether a Filter Mask is needed to stay (Filter Mask is learnable without the Optic by directed study, so there is no circular lock — verify in play). | `crawler_optic` → Spirit Essence recipe, Demon Core recipe, free Filter Mask study. The Crawler also drops 2 Parts and 2 Scrap every kill: placing it adds a renewable Parts source on Veyra, which the owner must weigh against the Parts economy. |
| **C** (normal) | Greyfang Wolf (`biome: 'forest'`; Shipping also uses it on snow and hill) | Elderwood Forest scene `veyra05-elderwood` — "temperate forest", `firstHour: true`. Dusk Stray `vampire_1` is anchored at `po_ranger`, AU (800, 760). | A forest POI away from the start windows; roaming row `T.FOREST`, `T.SNOW` or `T.HILL`. | First-hour region: a 30 HP / 9 dmg lunging pack animal next to starts is a difficulty decision. Keep the existing 12-tile start exclusion. | `wolf_fang` → free Fur Cloak study. |

For each order the owner chooses (**OWNER**): the anchor AU, `count`, `spreadTiles`, `leashTiles` (the three creatures have no `leashTiles` today), anchor versus roaming versus both, and day/night behaviour. Existing rows use count 3–4, spread 16–20, leash 18–28; that is context, not a recommendation.

Alternative the owner may prefer for any order: an explicit "Shipping-only by design" ruling. Then the dependent recipe must be marked as such in the catalog by its owner; it must not simply be hidden.

Tests each order needs (owner's PR): the species appears in the Veyra spawner tables and in `gate:veyra_spawner`; `ecosystem-full.test.ts` species list updated; a seeded Veyra run in which the creature spawns at the anchor, is killed, and its drop is picked up; restart keeps the habitat's spawned state. In PR #61, `VEYRA_UNSOURCED_INPUTS` and the `SHIPPING_ONLY` pin in `item-ontology-v2.test.ts` then fail on purpose and are shortened.

## 5. Oil: what a real source has to demonstrate (P9)

Crude Petroleum is fixture-only: the only oil source the engine accepts has `authority: 'test-fixture-v1'` and is created by `registerTestOilSource`, which no map loader calls. Save validation refuses any other authority. PR #61 changed the wording only (§6). Oil Pump production may be called live only after all four of these exist and are shown:

1. **A physical site** on a shipping map: a versioned, map-owned source record (new authority value accepted by `persist.validate`), with a visible world object and finite stock.
2. **The interaction**: a player places a packed Oil Pump on that tile through the normal build intent (`buildReason` passes because of the map source, not a fixture).
3. **A production job**: a fuelled `pump_crude` cycle that debits the site and puts 1 Crude Petroleum in the pump output, then `refinery_crude` (4 Crude + 1 Glass → Fuel Can).
4. **A restart** mid-cycle and after it: the job, the site stock and the output survive and pay exactly once.

Related work in flight: PR #59 ("authentic Veyra wreck oil…") covers Salvaged Oil custody, not a Crude site. Salvaged Oil → Fuel Can at the Oil Refinery stays the live fuel route and was not touched.

## 6. What PR #61 did implement (its own boundary: item text and readiness wording)

- **Oil wording.** `engine.oilAvailability()` + `OIL_TEXT` own the text. With no oil site in the world, build refusal, build menu, packed-device readiness, Station Console, station panel, the two oil recipes and both descriptions say "No oil site exists in this world yet" and point to Salvaged Oil. The phrases that implied a site could be found are gone. The recipes stay listed.
- **Veyra wording.** On a Veyra run, a recipe short of Ash Chitin or Crawler Optic says "<item> has no source on Veyra yet" instead of "Get N <item>". The recipe stays listed; nothing is hidden. The list (`VEYRA_UNSOURCED_INPUTS`) is pinned to the projection and must shrink when order A or B ships.
- **Not implemented:** orders A, B, C; any oil site; any Keycard; any Demon Core source.
