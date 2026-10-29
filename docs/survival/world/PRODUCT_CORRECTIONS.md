# SURV-050A Living-World Product Corrections

Status: `AUTHORED_PRODUCT_CONTRACTS_NOT_NATIVE_PLAYABLE`  
Scoped CI: push run https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40889886618 and PR run https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40889899260 at `b9c81fdb` — success.  
Branch: `arena/e385312a-soul-of-hero` · PR #20 · starting HEAD `da93be3c`

This checkpoint answers the independent product review without regenerating the continent, inflating POI counts, editing the production overworld, or claiming 108 implemented encounters.

## 1. Novice survival and hazard bootstrap

The previous early salvage/power estimate crossed the authored legacy heat/rot rects before `cap_filter` existed. The correction preserves those hazards and adds an explicit safe preparation route:

- `rt_crown_safe_approach`: no required capability, zero authored hazard exposure, walkable sampled cells, and a return path to the refuge.
- `rt_east_seam`: remains a faster shortcut but now requires `cap_filter`; heat/rot exposure is still present for prepared players.
- First-hour journey: refuge → Ashen Waystation (`cap_salvage`, `cap_seal_1`) → Crown Relay Shed (`cap_power_1`) → refuge → Orchard Apothecary (`cap_filter`) → refuge.
- Bootstrap materials are separated from sustain materials. In particular, `venom_sac` is a filter sustain/repair material, not a prerequisite for the filter lesson that opens it.
- Removing the safe route does not create an invisible softlock: a much longer southern fallback remains, and the novice is not routed through the filter-gated hazard shortcut.

Machine-readable contracts:

- `data/survival/world/novice_bootstrap_contract.json`
- `data/survival/world/hazard_damage_contract.json`
- `data/survival/world/pacing_analysis.json` → `novice_hazard_counterfactual`
- `docs/survival/world/previews/novice_bootstrap_detail.png`

The damage contract is a native-compatible **proposal**, not a balance claim: A0 owns damage application, A3 owns gear/resistance values, A6 owns clues/UI. It publishes hp/s proposals, mitigation capability/resistance keys, telegraph, grace/retreat rules, and explicitly warns that A3 `toxin_mask` venom:60 is not automatically heat/acid_gas/poison coverage.

## 2. A1/A3 material reconciliation

Reviewed PR #19 head `86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e`:

- `docs/survival/economy/A1_MATERIAL_MAPPING.md`
- `data/survival/items/a1_material_mapping.json`

A1 decision contract: `data/survival/world/a1_a3_material_decisions.json` (`soh.world.a1_a3_material_decisions.v1`). A3 catalog code was not changed.

| A1 material | Proposed A3 alias | A1 decision | Priority | Core reason |
|---|---|---|---|---|
| `bog_iron` | `iron_ore` | SPLIT | P2 | Slow redox renewal / pump/filter-frame sink is not finite-vein generic ore. |
| `glacial_iron` | `iron_ore` | SPLIT | P1 | Thaw-season skarn / thermal-pressure feedstock must not collapse into generic iron. |
| `fibre` | `reed_fibre` | SPLIT | P0 | River/lake reed may map source-specifically; oasis/forest fibre needs a distinct dry-fibre decision. |
| `hardwood` | `oak_wood` | REJECT | P1 | Boat hull/boardwalk/advanced-frame hardwood is not generic early timber. |
| `frost_resin` | `frost_shard` | SPLIT | P1 | Tapped ecological resin is not mineral shard; thermal ward is a real sink. |
| `peat` | `coal` | SPLIT | P2 | Very slow cut bog fuel/filter carbon is not geological coal. |
| `rare_herb` | `moonleaf` | SPLIT | P0 | Orchard understorey may map conditionally; karst/cenote herb remains distinct. |
| `venom_sac` | `venom_spine` | SPLIT | P1 | Fauna sac is not spine reward; extract_venom/toxin_mask/venom-core are real sinks. |

The 12 missing A3 items remain explicit and are classified by gameplay dependency/priority (P1 copper/rubber_sap/limestone; P2 honey/salt/pearl/silica_sand/storm_glass; P3 obsidian/basalt/abyssal_pearl/aether_crystal). None is marked first-hour blocking after the relay hand-crank bypass and filter lesson separation.

## 3. Truthful POI readiness and two early exemplars

All 108 new POIs now carry `content_readiness`:

- `WORLD_SITE_CONTRACT_ONLY`: 106 sites. These are authored world anchors/material/capability contracts, **not** implemented encounters.
- `INTERACTION_SPEC_AUTHORED_NOT_NATIVE`: 2 early exemplars below.
- `PRESERVED_BASELINE`: 10 Chapter 1 entrances.

Versioned schema: `data/survival/world/schemas/poi_authoring.schema.json` (`soh.world.poi_authoring.v1`). Specs:

- `data/survival/world/poi_authoring/poi_crown_waystation.v1.json`
- `data/survival/world/poi_authoring/poi_crown_relay_shed.v1.json`

The exemplars are deliberately early roadside/power sites, not S6 premium deep-POI duplicates. They publish distinct footprints, approach/retreat topology, one-time vs renewable world-state actions, salvage/power/access interactions, rewards, SaveService-keyed persistence, failure recovery, map clues, and testable A0/A3/A6 interface requirements. The relay first-hour hand-crank bypass uses salvage + timber; copper upgrade remains a later A3-dependent repair, not a first-hour softlock.

## Preserved foundation

- Ten Chapter 1 entrances, stable IDs, 192-chunk frame, baseline/source locks and W-01 `build_permission=2` delegation are preserved.
- No production overworld controller, SaveService, A0 construction, A3 catalog, A4 Gold/VFX, A6 UX or root `project.godot` edits.
- `native_playable=false`. Full living-world product acceptance still requires independent review and native A0/A3/A6 integration gates.


## Verification at product-correction checkpoint

- Compiler: `ok=true`; plan SHA `fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4`.
- Validator: 0 errors; 15 schemas PASS.
- Pytest: 56 passed.
- Determinism: 221 artifacts, tree SHA `29e0cbf05f442929df676ce7bbd1c91087b49fe923f586c83683cd371a9ae77f`.
- Pacing: 11 journeys; first-hour safe preparation/retreat has zero authored hazard exposure; hazardous shortcut remains exposed and filter-gated.
- Isolated Godot 4.7 reader: CI success, including readable hazard/bootstrap/material/POI product contracts and truthful readiness counts.
- Previews: 9 PNGs; `novice_bootstrap_detail.png`, routes and starter detail inspected.
