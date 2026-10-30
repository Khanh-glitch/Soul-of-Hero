# First Core discovery and loot-source ecology — Control Tower study
Date: 2026-10-30. Status: RESEARCH_ACCEPTED_SCOPED; DESIGN_ONLY; not authorized for gameplay edits, probability changes, merges or agent dispatch.

## Firsthand player evidence — supersedes earlier inference
An early Last Island novice quest gave a six-round revolver; that was not the first memorable weapon. The later SMG was dramatically more enjoyable to use because of continuous rapid firing. The player already entered radiation/toxic sites with a mask before the SMG. The exact original SMG container is unremembered, possibly roadside. Initial behavior was enthusiastic shooting and experimenting, not storing unused. Only after repeated death and unrecovered guns did the player start preserving a gun and investing in an expensive permanent manufacturing recipe. Do not infer exact source or timing from uncertain memory.

## Historical evidence (2019; mode/date caveats)
Official 2019-09-27: novice revolver, SMG in supply/military crates, higher weapons gated by stronger crates: https://hero.yingxiong.com/info/2019/0927/7249.html
2019-09 beginner guide: roadside tool/supply crates vs POI military crates: https://a.4399.cn/gl/13650770_115226.html
2019-08-02 player guide: rare handgun/SMG from roadside barrels/crates; no numeric drop probability: https://www.gamersky.com/handbooksy/201908/1209408.shtml
2019 original FAQ: roadside blueprint, permanent learned recipe vs lost carried plan: https://news.4399.com/zhytgz/zixun/m/895413.html
These Chinese/regional sources do NOT prove exact global Last Island drop tables or 2026 values. Original SOH Atlas sections SYS-04/05/06/11-17/33-34, DEP-01-05/18 and JOURNEY-01-04/08 are conceptual trace anchors.

## Verified current SOH source snapshot
A3 PR19 at 18e7afc: data/survival/items/loot_tables.json roadside_cache = 3 weighted rolls; iron_scrap 40, knowledge_spares 30, research_notes 15, grain_seed 15; excludes rare, core, exploration_only. Proposed generic specimen_vault table gives materials, not a whole Core.
A3 items/sources: 56 items and 36 sources. core_venom (12 uses), core_frost (8), core_ember (8) are proposed tier-3 unique instances, each BLOCKED_PENDING_A4, with high-risk access-tier-2 power-gated specimen source proposals. Plan drops in proposed medium-risk Institute. These are placeholders, not native playable/Gold-attested.
A1 PR20 at 2951bf85: 118 planned POIs = 10 preserved entrances +108 new, with 106 new site-only contracts and two early authored POIs. Waystation locker grants cap_salvage ZERO items; ledger grants cap_seal_1 ZERO items; cache 3 scrap +2 spares per 1800 active seconds. Relay 2 scrap+1 oak to cap_power_1. Do not alter these canonical rewards or treat them as Core crates.
A0 native B0 full journey, real Core pickup and complete A4 Gold on-world/enemy cast are not product accepted. A3 14-session Core-count simulation is conservation, not actual player emotion or native drop-balance proof.

## Scoped design direction: distinct source ecology
L0 ecology: predictable tools, wood, stone, basic health/food; starter economy can proceed without Core.
L1 roadside junk: keep current generic roadside_cache non-Core materials, Spares, notes, useful seeds.
L1-S separate eligible roadside SUPPLY crate candidate: sparse, geographically authored, visually distinct from junk. After A4 attests a suitable lower-band Gold skill, consider very rare physical finite-use Core as one possible output; no vault-tier Core, no blanket tag-exclusion removal, no fixed chance yet, no invisible guaranteed pity. Remains NOT_AUTHORED/NOT_MOUNTED.
L2 POI perimeter: rewarding early exploration and partial access even with melee and proper mask, with hints, trade-offs and deliberate retreat.
L3 keyed/powered/hazard interior: special Core specimens, catalyst/plan and exclusive advanced rewards; different independent preparations, not one combat-level wall.
L4 unique deep goals: signature skill families and nontrivial recipe paths with fair death-bag, custody and replacement.
Source class is different from item tier, player level and map region. Do not force every Gold skill to mimic rapid SMG fire.

## Test gates before any A1/A3 modification
G0 source provenance/IDs pinned and historical uncertainty retained.
G1 common loot yields actual sources/sinks and no cooldown/death/reload/free-value exploit.
G2 blind novices can encounter some unannounced meaningful Core surprises from eligible supply crates without being forced through a boss or tutorial; unlucky players still have legitimate targeted research routes. Measure eligible crate count, discoveries and timing before setting rates.
G3 deeper POIs still offer exclusive value, greater density, distinct danger and multiple access strategies.
G4 mask+basic melee can achieve worthwhile hazardous-perimeter exploration without Core; missing mask and missing damage capability are not equivalent.
G5 Core first use has full Gold, actual enemy/terrain effect, limited debit, readable UI, and freedom to experiment.
G6 learning/preservation/reconstruction follows experienced utility/loss, fair recovery and real costs, not forced weapon confiscation.
G7 long-form multi-session leaves at least three independently attractive goals across two systems; no forced wipe.

## Ownership and next action
Control Tower: continue quantitative source-density vs route-risk vs research opportunity analysis; audit human gameplay in future B1. A0 continues B0, A4 continues source-native Gold, A1/A3 stay paused, A6 UX unmerged. No prompt dispatch or native acceptance from this note. Existing decisions D001-D050 and original Atlas remain unchanged.