# A6 canonical avatar source and presentation gate

**Locked authority:** D051/D052, user correction dated 2026-10-30. This note records implementation evidence and blocks false visual acceptance; it does not approve production mount or source redistribution.

## Canonical identities

| A0 player identity | User-verified source | User-provided Drive file | Base sheet source member | Arena checkout |
|---|---|---|---|---|
| Bald, unarmored male | Craftpix 555940, `craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip` | `1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb` | `PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png`, 768×256, four directions | Downloaded from the user-provided Drive folder; 6,439,805 bytes, MD5 `b4910c4dd86a5193e5e0640751a20abd`; all 350 PNG members CRC-clean. Idle/walk/run direction sheets inspected from extracted temporary previews. No runtime asset imported or source sprite included in Git. |
| Bald, unarmored female | Craftpix 419402, `craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip` | `1o5hRVbPZjZxcPGwP5coPDHZARbAej75o` | `PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png`, 768×256, four directions | Downloaded from the user-provided Drive folder; 6,419,098 bytes, MD5 `cf6ffa60ef922e4703dc6b27c3b5bac2`; all 316 PNG members CRC-clean. Idle/walk/run direction sheets inspected from extracted temporary previews. No runtime asset imported or source sprite included in Git. |

The connected Drive handoff made actual source bytes available in this session. Each archive's `License.txt` contains only `https://craftpix.net/file-licenses/`; the terms/attribution and permission to redistribute in this repository were **not** independently verified. The source ZIPs and extracted inspection previews were kept out of the project/Git. This verifies archive identity, PNG integrity and appearance content, but not license clearance, runtime import, or production animation. Do not redistribute raw source art in this public repository.

## Equipment appearance state

The owner-supplied appearance tuple is selected gender × authoritative equipped armor grade:

- Grade 0: selected bald, unarmored base body.
- Grade 1: same gender identity with matching armor-grade-1 appearance.
- Grade 2: same gender identity with matching armor-grade-2 appearance.
- Unequip returns to grade 0. Save/reload/death/respawn must resolve from the persisted owner equipment state, not from A6-local flags.

`game/survival/ui/avatar_appearance_adapter.gd` is a read-only resolver for a versioned A0 owner projection. The checked-in `avatar_art_manifest.json` carries the exact source IDs and expected source member. It reports `SOURCE_BLOCKED` when bytes, matching art, or owner input are unavailable; it never swaps gender or falls back to another character. `tests/survival/ui/avatar_appearance_test.gd` asserts identity preservation, source pins, rejected substitution and fail-closed missing art. This is an adapter/source gate, not proof of a mounted playable character.

## Exact unresolved art blocker

Source-byte inspection confirms the two bald/unarmored canonical sets and their four-direction idle, walk and run sheets. It does **not** establish compatible male and female grade-1/grade-2 armor sprites, armor layers, or a validated runtime compositing method. Targeted Drive filename searches found no assets named for armor, humans or heroes; the only five character-named results include the canonical bases plus the explicitly rejected 180537 Swordsman, Orc and Vampire packs. This is not a broad archive-content audit, so it is not evidence that all other packs lack compatible armor. No armor candidate has been selected or inspected; grades 1/2 remain `SOURCE_BLOCKED` until a real approved source is found and tested. The 180537 `Swordsman_lvl1/lvl2/lvl3` is a different character and is not the matching pair—especially not female armor. The Knight protagonist is also not a permitted fallback.

## Owner integration contract

A0 owns player selection, equipment truth, persistence, SaveService, death and respawn. A3 may own item instance/equipment semantics as its approved source contract specifies. A6 only maps an already validated owner appearance projection to art. A0 must verify that changing armor and reloading or recovering the character preserves the selected identity and correct tier, then run the real native host. No production merge or full-game acceptance follows from source-manifest tests alone.
