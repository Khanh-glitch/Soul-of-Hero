# Item asset catalog — 2026-07-16

This catalog is the semantic authority for the downloaded RPG icon and chest
packs. Asset numbers are never selected randomly across unrelated families.

## Live auxiliary equipment

The current combat/save model has three shared slots. Cosmetic identity is
derived deterministically from the persisted item UUID; the save does not
duplicate display names or raw asset paths.

| Live slot | Gameplay role | Approved RPG400 range | Visual families |
| --- | --- | --- | --- |
| `soul_vessel` | HP and defence | 151–200 | shields 151–160, helmets 161–180, torso armour 181–200 |
| `soul_boots` | movement, Dash and footwork | 221–240 | twenty authored boots |
| `soul_trace` | Jewelry: Power, Mana and skill rhythm | 241–260 | rings 241–250, necklaces 251–260 |

The complete authored names and rarity pools live in
`game/meta/equipment/auxiliary_equipment_presentation.gd`. UI and physical
loot resolve through that catalog instead of hard-coded placeholder icons.

### Crystal grouping and upgrade stones

Crystals are stackable **upgrade materials**, not equipment. Crystal colour is
an affinity/material identity. Shape is the eight-step item rarity progression
(`Normal` through `Eternal`). The source sheet wraps two colour families across
rows, so raw numeric order is not a rarity order.

The live upgrade path uses one Radiant silhouette per rarity:

| Stone rarity, Normal → Eternal | Icon IDs |
| --- | --- |
| `soul_upgrade_stone_<rarity>` | 321, 322, 323, 324, 341, 342, 343, 344 |

An auxiliary item consumes exactly one stone of its own rarity per upgrade rank.
The remaining crystal affinities stay catalogued for future material recipes or
presentation variants; they must not be reintroduced as `soul_focus` gear.

| Affinity | Ordered icons, Normal → Eternal |
| --- | --- |
| Radiant | 321, 322, 323, 324, 341, 342, 343, 344 |
| Ember | 325–332 |
| Azure | 333–340 |
| Verdant | 345–352 |
| Earth | 353–360 |
| Frost | 361, 362, 363, 364, 381, 382, 383, 384 |
| Void | 365–372 |
| Blood | 373–380 |
| Ancient | 385–392 |
| Dusk | 393–400 |

## Catalogued but not live

- 201–220 are a complete gauntlet family. Reserve them for a future mechanic
  or cosmetic layer; do not mix them into armour merely to consume assets.
- Crystal affinities outside the eight Radiant upgrade-stone silhouettes are
  asset/catalog capacity only. A future recipe may use them after adding a
  validated material contract; they are not extra rarities or gear slots.

## Chest atlas

`assets/library/downloaded/treasure_chests_1_2a/treasure chests.png` is a
160×192 atlas: five columns by six rows of 32×32 cells. Every skin is a vertical
pair: closed on top, open immediately below it.

- Columns 0–2 contain nine regular chest grades.
- Columns 3–4 contain six monster/mimic chest grades.
- Grade order is top-to-bottom within one column, then left-to-right.
- Regular grade 9 is an Eternal jackpot container, not a ninth item rarity.
- Monster grades map to the six upper item rarities, Rare through Eternal.

Container grade and item rarity are separate concepts. The canonical item
rarity contract remains exactly eight tiers.

## Runtime enforcement and visual QA

- `auxiliary_equipment_presentation.gd` validates exact, duplicate-free
  coverage for armor, boots, jewelry, and crystals, and requires every icon
  path and authored Vietnamese name to resolve.
- The live slot order is Vessel/Armor, Boots, Jewelry. In Field Codex this puts
  Boots in equipment position 5 and Jewelry in position 6 after the three Hero
  Soul positions; crystals appear only as stackable upgrade stones.
- Loot rolls only among auxiliary slots already unlocked at the current player
  level; a locked-slot roll falls back to material loot instead of leaking a
  future equipment family.
- The Hero Roster and Field Codex load each item's deterministic icon and name,
  while ground loot uses the same presentation payload.
- `chest_visual_catalog_test.gd` validates all fifteen closed/open atlas regions
  and their runtime rarity/family selection.
- OpenGL QA captures are written to
  `.artifacts/visual_acceptance_roster_aux_847x437.png` and
  `.artifacts/visual_acceptance_chest_catalog_1280x720.png`.

## Other downloaded sources

- RPG Arsenal is suitable for weapons and consumables and has explicit local
  license text. It must not override the user-approved RPG400 jewellery ranges.
- Shikashi fills genuine gaps such as currency, keys, scrolls/maps, monster
  claws, pelts, ore, resources and buff/skill symbols. Use its authored atlas
  index semantically, never a random cell.
- Raven Armor contains 18 silhouettes × 8 palette rows. Its style is visibly
  different from RPG400, so reserve it for skins/cosmetics rather than mixing
  it into the core equipment catalog.

## Release provenance warning

The imported RPG400 archive is byte-identical to the downloaded ZIP and all
400 images are intact 32×32 RGBA files. However, the local package currently
does not contain explicit license proof. The Treasure Chest and Raven readmes
also do not state a complete usage grant. Preserve the store EULA/receipt or
other purchase proof before a commercial release.
