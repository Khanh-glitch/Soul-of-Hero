# A6 canonical avatar source and presentation gate

**Locked authority:** D051/D052, user correction dated 2026-10-30. This note records implementation evidence and blocks false visual acceptance; it does not approve production mount or source redistribution.

## Canonical identities

| A0 player identity | User-verified source | User-provided Drive file | Base sheet source member | Arena checkout |
|---|---|---|---|---|
| Bald, unarmored male | Craftpix 555940, `craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip` | `1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb` | `PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png`, 768×256, four directions | ZIP and sprite bytes absent; not imported |
| Bald, unarmored female | Craftpix 419402, `craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip` | `1o5hRVbPZjZxcPGwP5coPDHZARbAej75o` | `PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png`, 768×256, four directions | ZIP and sprite bytes absent; not imported |

The user has directly inspected both original ZIPs and the sheets; that evidence is recorded here as user-supplied source verification. It is not local byte verification, local import, license/attribution review, or a production animation test. These sources supersede prior source assumptions. Do not redistribute raw source art in this public repository.

## Equipment appearance state

The owner-supplied appearance tuple is selected gender × authoritative equipped armor grade:

- Grade 0: selected bald, unarmored base body.
- Grade 1: same gender identity with matching armor-grade-1 appearance.
- Grade 2: same gender identity with matching armor-grade-2 appearance.
- Unequip returns to grade 0. Save/reload/death/respawn must resolve from the persisted owner equipment state, not from A6-local flags.

`game/survival/ui/avatar_appearance_adapter.gd` is a read-only resolver for a versioned A0 owner projection. The checked-in `avatar_art_manifest.json` carries the exact source IDs and expected source member. It reports `SOURCE_BLOCKED` when bytes, matching art, or owner input are unavailable; it never swaps gender or falls back to another character. `tests/survival/ui/avatar_appearance_test.gd` asserts identity preservation, source pins, rejected substitution and fail-closed missing art. This is an adapter/source gate, not proof of a mounted playable character.

## Exact unresolved art blocker

The source verification currently available in the Arena package establishes only the unarmored idle sheet from each of the two ZIPs. It does **not** establish compatible male and female grade-1/grade-2 armor sprites, armor layers, or a validated runtime compositing method. The Craftpix 180537 `Swordsman_lvl1/lvl2/lvl3` is a different character and is explicitly rejected as the matching pair—especially as female armor. The Knight protagonist is also not a permitted visual fallback. Until authorized bytes are handed off and all four armor-stage sources are inspected, these appearance stages remain `SOURCE_BLOCKED`.

## Owner integration contract

A0 owns player selection, equipment truth, persistence, SaveService, death and respawn. A3 may own item instance/equipment semantics as its approved source contract specifies. A6 only maps an already validated owner appearance projection to art. A0 must verify that changing armor and reloading or recovering the character preserves the selected identity and correct tier, then run the real native host. No production merge or full-game acceptance follows from source-manifest tests alone.
