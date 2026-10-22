# Parallel brainstorm prompts — V0.4

These prompts are prepared for the three external GPT conversations. They do
not authorize purchases, paid assets, external publishing, or changes to the
canonical rules in `PROTOTYPE_IMPLEMENTATION_SPEC_V0_4.md`.

## Shared project truth

- Godot 4.7, top-down pixel action RPG, working title **SOUL OF HERO**.
- Core fantasy: one Active Hero, Reserve Hero Souls, intentional two-way Soul
  Relay. Sword is the starter and Axe is the second production Hero.
- Prototype campaign target: 10 chapters × 10 level slots. Only content that
  passes map, runtime, reward, route, and playtest gates may be called playable.
- Current truth: Levels 1–5 are campaign-ready; Levels 6–10 have draft content
  definitions. Level 5 still needs a real Axe recruitment/Soul ownership chain
  before Level 6 can honestly teach Relay.
- Locked V0.4 rules: player cap 100; five Stat Points and five Skill Points per
  level including Level 1; stat cap 200; skill rank cap 20; eight rarities
  Normal, Magic, Rare, Epic, Legendary, Crystal, Mythic, Eternal; no Quality
  stat; auxiliary slots Soul Vessel/Trace/Focus at levels 2/4/7; Monster Soul
  unlock target level 50.
- Hero Soul variants begin at `minimum rarity + 4`, clamped to Eternal. Rare
  Souls may come from drops, gacha, shop, difficult stages, and difficult
  missions, but no paid-only power or purchase decision is allowed.
- Existing implementation already has stat/skill allocation, Hero Soul
  inventory/affixes/fusion/sale, auxiliary equipment, Axe identity, save
  migration, campaign data registry, and automated QA.

## GPT A — Chapter 1 production design

Act as a senior action-RPG encounter and progression designer. Using the shared
truth above, solve the exact production path from the end of Level 5 through
Level 10. The Level 5→Axe→Soul Relay ownership chain must be mechanically and
narratively valid before Level 6 starts. Design:

1. The smallest satisfying Axe recruitment encounter/reward at Level 5.
2. Level 6 with three Soul Anchors and an interactive Relay lesson.
3. Level 7 Beacon defense, Level 8 split elite route, Level 9 Gate Seal, and
   Level 10 two-phase Vampire Castellan.
4. Enemy composition, spatial pressure, objective fail states, optional
   objectives, first-clear rewards, retry flow, and anti-frustration rules.
5. Exact acceptance tests that distinguish data-complete, runtime-complete,
   playable, and production-ready.

Do not redesign locked V0.4 economy/rarity/stat rules. Do not claim a mechanic
is playable without identifying its runtime dependency. Return a compact table
for Levels 5–10 followed by implementation priorities P0/P1/P2.

## GPT B — Loot/economy for 100 levels

Act as a systems/economy designer familiar with Dungeon Quest-style loot
progression, but do not copy proprietary text, art, tables, or exact balance.
Build an original SOUL OF HERO economy that can stay interesting through the
first 100 levels while respecting every locked V0.4 rule in the shared truth.

Specify:

1. Drop cadence and rarity bands by ten-level chapter, with deterministic
   protection against long dry streaks.
2. Hero Soul sources, variant pity, fusion/sale sinks, duplicate handling, and
   inventory pressure without pay-to-win.
3. Soul Vessel/Trace/Focus progression and compact slot-specific affix pools.
4. A level-50 Monster Soul onboarding and its relationship to Monster Parts,
   without invalidating Hero Souls or auxiliary gear.
5. Chapter/boss reward guarantees and replay incentives.
6. Economy telemetry and numerical acceptance gates for boredom, power spikes,
   dead drops, runaway inflation, and build diversity.

Clearly label canon, recommendation, and open question. Prefer a small number
of meaningful modifiers over affix bloat. No premium currency or purchase
recommendation.

## GPT C — Already Playable and production roadmap

Act as a game director and QA lead. Audit the shared truth as if deciding
whether a prototype is genuinely “already playable.” Produce:

1. A dependency-ordered roadmap from the current Level 1–5 build to a complete
   Chapter 1, then a scalable authoring pipeline for Chapters 2–10.
2. A definition of done for combat, progression, UI, save, content, balance,
   accessibility, Android performance, and onboarding.
3. The highest-risk missing core loops, especially Level 5 Axe recruitment,
   equipment actually affecting combat, Level 10 boss, and level-50 Monster
   Soul onboarding.
4. A human playtest protocol and telemetry thresholds that automation cannot
   replace.
5. A free/original-only asset production plan; distinguish production-ready,
   license-blocked, generated placeholder, and final art.

Be strict: do not equate a 100-slot campaign registry with 100 authored levels,
and do not equate passing unit tests with game feel. End with the next three
vertical slices that provide the most player-visible value.
