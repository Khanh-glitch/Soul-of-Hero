# Dungeon Quest inspiration review

## Decision

SOUL OF HERO may borrow the readable eight-color rarity language and the loop of
loot comparison, escalating modifiers, boss rewards, salvage, and targeted
crafting. It must **not** copy Dungeon Quest's item text, assets, exact tables,
Quality system, or the special transformation semantics of Crystal/Mythic/
Eternal.

The V0.4 eight-rarity ladder remains intentionally linear:

`Normal → Magic → Rare → Epic → Legendary → Crystal → Mythic → Eternal`

Quality remains nonexistent.

## Verified reference points

- Official store descriptions center Dungeon Quest on randomized loot,
  escalating difficulty, bosses, skill/talent customization and targeted
  LegendEx crafting from salvaged high-tier items:
  [Google Play](https://play.google.com/store/apps/details?id=com.shinybox.smash),
  [App Store](https://apps.apple.com/us/app/dungeon-quest/id574486553).
- Community documentation uses the familiar gray/blue/yellow/orange/red/cyan/
  purple/green color sequence, but its upper tiers are not simply three linear
  power grades. This is why SOUL OF HERO keeps the names/colors while defining
  original behavior: [rarity discussion](https://forums.dungeon-quest.com/t/help-me/15198),
  [equipment explanation](https://forums.dungeon-quest.com/t/how-to-use-an-equipment-5/33642).
- Community affix references show a useful progression from comprehensible
  numeric stats toward conditional/build-defining properties:
  [affix reference](https://dungeonquest.fandom.com/wiki/Affixes).

## Safe recommendations for SOUL OF HERO

These are proposals, not canon until accepted and implemented.

1. **Rarity role ladder.** Normal/Magic stay immediately readable; Rare adds
   light synergy; Epic introduces conditional/Soul-Action rolls; Legendary+
   owns the build-changing properties. Before Level 50, an item should expose
   at most one mechanic-changing affix.
2. **Target Progress.** A Hunt that yields no useful upgrade adds visible
   progress toward a player-selected Hero Identity or auxiliary slot. Harder
   clears advance it faster. This protection is separate from Variant pity.
3. **Hunt modifiers.** Start with one visible modifier after Level 10 and grow
   to at most three. Modifiers must change enemy behavior, pack composition,
   healing pressure, or Relay geometry—not only multiply HP.
4. **Smart loot comparison.** Compare against both Active and Reserve Heroes,
   expose action tags, and filter by rarity/Identity/slot/synergy. Auto-sell is
   opt-in after onboarding and can never touch equipped, favorite, locked, or
   Monster-Soul-bonded items.
5. **Soul Archive candidate.** First ownership records an Identity. A future
   targeted-crafting path could recreate discovered Identities within the
   campaign rarity cap, while fusion remains the efficient rarity-upgrade path.
   Currency count and exact cost remain an open decision; no new currency is
   authorized by this document.

## Mechanics to avoid

- Quality, Luck, Gold Find, Item Drop Chance, mandatory farm builds.
- Many crystal/mythstone currencies or recipe fragments.
- Crafting/rank-up failure or destructive reroll gambling.
- Campaign progress that depends on a rare random drop.
- Infinite procedural floors replacing the authored 100-level campaign.
- Pets/hirelings that dilute the Active/Reserve/Soul Relay fantasy.
