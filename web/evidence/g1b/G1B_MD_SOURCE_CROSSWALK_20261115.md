# G1B CHEST — Source crosswalk from Creator discussion (15 Nov 2026)

> **SOURCE AUDIT / IMPLEMENTATION INPUT — NOT A NEW BIBLE OR APPROVED ODDS TABLE.** Transcribed from `SOH_RUONG_NPC_WORLD_SITUATIONS_HANDOFF_2026-11-15.md`, exactly 788 lines, sections §4–6, §12, §14–16. Preserve the status distinctions `CREATOR_DECIDED`, `DIRECTION_AGREED`, `PROPOSAL`, `SUPERSEDED`, `OPEN`. The artist's 15-frame atlas in `web/public/assets/g1b/chests/` is real; art existence is **not** gameplay implementation.

## What the source DOES and DOES NOT contain

| Aspect | Exact source | Status |
|---|---|---|
| Five major families / 16 grade variants | §4.1 lines 97–105 | DIRECTION_AGREED, enumerated |
| Green / Blue / Purple room compositions | §4.1 lines 106–114 | Historical reference 6/6/7, NOT mandatory for all Veyra POIs |
| Family item roles and example items | §4.2 lines 118–129 | DIRECTION_AGREED; **not individual item percentages** |
| 16×157 workbook | §5.2 lines 158–164 | 39 eligible items, 180 nonzero cells in OLD DRAFT, **SUPERSEDED**; workbook is not a final table |
| Creator Core eligibility by chest tier | §6.4 lines 211–223 | Source proposal, not complete numeric table |
| Percentage intervals | §6.4 line 224 | **PROPOSAL NOT APPROVED**, mutually-exclusive outcome normalization required |
| Veyra thematic Core POIs | §6.5 lines 235–250 | **PROPOSAL**, no exclusive Core POI or audited source coordinates |
| Actual density / frequency / clock | §12 lines 544–568 | **NOT LOCKED** |
| 14 Creator Core upgrade BOMs | §15 lines 614–622 | **MISSING**, requires design |
| Refresh and finite source policy | §15 line 628 | OPEN in source, later user decisions supersede cap questions |

## Exact 16 family/grade rows (only permissions and examples; NOT final RNG)

| Source variant | Family items/examples from §4.2 | Core direction from §6.4 | Site context (§4.2, §6.5) |
|---|---|---|---|
| Supply Damaged | Wood, Iron, spares/Parts, Cloth, Glass, Pipe, Plate, Gear, Electronic Parts (source eligible items only) | Common Lv1, low odds | Civilian/roadside goods, residential |
| Supply Low | same | Common Lv1, low odds | Civilian/roadside goods, residential |
| Supply Mid | same, higher access/quality to be designed | Common Lv1; occasional upgrade or Mid-tier Lv1 when source permits | Supply storage, ports/industrial, POI exterior |
| Supply High | same, higher access/quality to be designed | Common Lv1; occasional upgrade or Mid-tier Lv1 when source permits | Better secured/advanced supply storage |
| Toolbox Damaged | Parts, Blade, Gear, Electronics, completed Iron Axe/Pick, Cleaver, Machete | Common Lv1, low odds | Mechanics/workshop/roadside tool cache |
| Toolbox Low | same | Common Lv1, low odds | Mechanics/workshop/roadside tool cache |
| Toolbox High | same with high-grade sourcing | Common Lv1, occasional upgraded or Mid-tier Lv1 as permitted | Slagworks, workshops, technical POIs |
| Military Low | Arrow, Basic/Refined Energy, combat tools/weapons, authorised Creator Core | Common Lv1 more available; small Mid-tier Lv1 chance | Watch/military/exterior sites, real risk |
| Military Mid | same, more valuable equipment, not merely Parts | Mid-tier Lv1 priority; occasional Mid-tier Lv2 or Rare Lv1 | Dangerous military/secured POIs |
| Military High | same; credible non-Core combat reward | Mid-tier Lv1–2, Rare Lv1–2, *very rare* Lv3 when source allows | Deep/security-gated, purple-room candidate |
| Food Low | Berries, Canned Meat, crops/food and suitable survival supplies | NOT mass Creator Core source | Kitchens, homes, food storage |
| Food Mid | same, richer grade to be designed | NOT mass Creator Core source | Kitchens, homes, food storage |
| Food High | same; MUST NOT collapse into only canned_meat | NOT mass Creator Core source | Protected/high quality stores |
| Medical Low | Bandage, Medkit, Syringe, Herb, Antirad as authorised | NOT mass Creator Core source | Clinics, infirmaries, medical kits |
| Medical Mid | same, richer grade to be designed | NOT mass Creator Core source | Clinics, infirmaries, medical kits |
| Medical High | same, richer grade to be designed | NOT mass Creator Core source | Protected medical supplies |

The source lists these as **example item types**, not guaranteed/positive odds. Enumerate all 157 master IDs against acquisition policy, then generate a reviewable nonzero-only eligibility/percentage table. Do NOT accidentally claim 157 items all drop. Do NOT translate common/medium/rare tier into Lv1/2/3. Do not transform Food/Medical into weapon loot farms.

### Core tier names and thematic POIs (not exclusive)

- Common: **Big Bang, Earth Mother's Breath**.
- Mid: **Meteor, Elsa's Sword, Mjolnir**.
- Rare: **Dragon's Breath, Demon Core**.
- Veyra POI proposals (§6.5): Meteor → Argus Academy/Observatory; Elsa → Wreck Isle Salvage; Mjolnir → Falls Powerhouse; Dragon → Slagworks Foundry; Demon → Argus Archive Vaults; common cores from compatible civilian sites. **Other matching sources may roll each Core; never lock a Core to one POI.**
- Legacy Shipping fixed 5 Creator + 3 Field sources MUST retain exact authority/migration; they are NOT the new Veyra random-roll table.

### Exactly sourced 6/6/7 historical room contents (§4.1)

- Green (6): **2 Supply Low, 1 Toolbox Low, 1 Military Low, 1 Food Low, 1 Medical Low**.
- Blue (6): **2 Supply Mid, 1 Toolbox Low, 1 Military Mid, 1 Food Mid, 1 Medical Mid**.
- Purple (7): **2 Supply High, 1 Toolbox High, 1 Military High, 1 Military Mid, 1 Food High, 1 Medical High**.
- Veyra rooms may adopt these benchmarks **only after proving physical dimensions, valid keycard/electric/PPE route, actual doorway, and no softlock**. Do not create 3 sets of 6/6/7 at every one of 81 POIs.

### Exact published percentage *proposals*, NOT approved odds (§6.4 line 224)

- Supply Damaged common Lv1 **2–4%**; Supply Low common Lv1 **3–5%**.
- Toolbox Damaged/Low common Lv1 **3–6%**.
- Military Low common Lv1 **18–25%**, Mid-tier Lv1 **4–7%**.
- Military Mid Mid-tier Lv1 **30–45%**, Mid-tier Lv2 **2–5%**, Rare Lv1 **1–3%**.
- Military High Mid-tier Lv1 **20–30%**, Mid-tier Lv2 **10–18%**, Rare Lv1 **8–15%**, Rare Lv2 **1–4%**.
- The historical draft warns these intervals **cannot be treated as independent rolls** or taken as final; prefer a mutually exclusive Core-outcome distribution within one chest cycle so multiple independent Core rolls do not double-mint.
- Missing intervals for some chest/grade and individual item IDs are **NOT zeros**; they remain UNDECIDED.

### Superceded data DO NOT REUSE

- Old `SOH_157items_16chests_drop_rates_DRAFT.xlsx`: 39 positive items / 180 positive item-chest cells, 118 absent; historical mechanics 1–2 core pool draws + bonus + tool, but **SUPERSEDED**, no Core Lv2/3.
- Old `SOH_157items_16chests_CORE_SOURCE_SCENARIO.xlsx` using Field Core Military 2%/6%: **SUPERSEDED**.
- Field-only percentages Low 8/12%, Mid 20/25%, High 40%, and 0.5/1.5% per type: **SUPERSEDED**.
- Do not use LI 2019/2021 community 4h/12h chest timers as SOH canon. The 2022 reference provides types/room compositions but **NOT per-item odds**.

## Later CREATOR DECISIONS after this handoff MD (supersede its old OPEN issues)

1. Ordinary chests, including deep POI, **can refill after a valid completed cycle**. **Every valid cycle uses the same item and Creator-Core probabilities, with no pity, per-run Core cap, hidden diminishing rate, or one-time chance**. Partial loot must persist. **24 real hours is ONLY a playtest timer candidate from Control Tower, NOT Creator-approved.**
2. A freshly looted Creator Core is **at full shared durability**, NOT supplied with old 40/12/4 internal reserves. Chest Core item keeps own UID and Lv1/2/3.
3. Core has **one shared durability**, independent LMB/Q/E cooldowns, auto-uses valid Basic/Refined/appropriate Refined+Essence directly from carried inventory upon successful cast, **no R reload**. Lv1 LMB, Lv2 +Q, Lv3 +E. Preserve ammo items/recipes.
4. Upgrade the **same UID** with real materials + correct Workbench, **no separate research gate for upgrading an owned Core**, no free repair by upgrading. 14 BOMs yet to be designed.
5. Human player decides visual/gameplay enjoyment; bot tests short technical invariants only.

## Required Agent implementation output and status rules

- Keep actively implementing S1 as a **real playable Veyra container**, not a chest showcase. Do not stop work on interactions, save, image/UI, player drop auto-repickup repair or placement while constructing the data table.
- Before presenting G1B as feature-complete, produce **one auditable per-variant table (all 16)** of: all permitted item IDs, explicit source policy and POI context, per-item positive odds, qty range, slots, distinct Core-type/level outcome distribution, no-Core reward, cycle timer, physical source IDs/coordinates/eligible POI archetypes and estimated density. Every invented rate or placement must be labelled `SOH_PROVISIONAL / NEEDS CREATOR ACCEPTANCE`.
- Resolve Core source-policy revision/migration intentionally; do not bypass `CRAFT_ONLY` silently, do not create false access to inaccessible locked rooms, and do not add new weapon IDs to fill Military.
- Do not declare final approved numeric balance until user has examined the complete table and played a real build. Only bug gates may be robot tested; loot desirability, progression and visual cues belong to the user.
