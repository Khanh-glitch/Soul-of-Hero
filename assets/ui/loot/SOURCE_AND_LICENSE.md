# Loot icon source and license

The PNG files in this directory are unchanged transparent-cutout copies from
**RPG Arsenal v1.1** by LimeZu (Edoardo), bundled under
`assets/library/downloaded/rpg_arsenal_1_1/`.

| Legacy/local cutout copy | Original file |
| --- | --- |
| `soul_vessel.png` | `Icons_no_background/consumables/rpg_icons129.png` |
| `soul_trace.png` | `Icons_no_background/rings_and_necklaces/rpg_icons13.png` |
| `soul_focus.png` | `Icons_no_background/staffs/rpg_icons69.png` (legacy; staff is now reserved for Mage Hero Soul) |
| `hero_soul.png` | `Icons_no_background/swords/rpg_icons25.png` (legacy sword fallback) |
| `hero_soul_sword.png` | `Icons_no_background/swords/rpg_icons25.png` |
| `hero_soul_axe.png` | `Icons_no_background/axes/rpg_icons89.png` |
| `soul_ember.png` | `Icons_no_background/consumables/rpg_icons132.png` |

Runtime semantic assets still referenced directly from the same licensed pack:

| Runtime use | Original file |
| --- | --- |
| Health-potion world drop | `Icons_no_background/consumables/rpg_icons129.png` |
| Future Mage Hero Soul (entitlement-gated) | `Icons_no_background/staffs/rpg_icons75.png` |

Soul Vessel, Soul Trace, and Soul Focus no longer use potion/staff stand-ins.
Their live semantic catalog is documented in
`docs/ITEM_ASSET_CATALOG_2026_07_16.md` and resolves RPG400 armor `151-200`,
rings/chains `241-260`, and crystals `321-400` directly.

The copied files are byte-identical to their listed originals. Transparent
cutouts are intentional: the inventory/equipment slot supplies the frame, while
ground loot supplies its own rarity aura, so the icon never receives a second
baked-in panel. The upstream license is
preserved at
`assets/library/downloaded/rpg_arsenal_1_1/LICENSE AND REQUESTS.txt` and also
mirrored at `assets/licenses/limezu_rpg_arsenal.txt`.

Upstream license statement:

> license: you can do anything but claiming the art as yours

Credit: [LimeZu](https://limezu.itch.io/)
