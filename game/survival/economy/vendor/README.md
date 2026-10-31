# Pinned first-party A3 adapter

`a3_economy_service.gd` is an unmodified copy of A3 PR #19 head
`35214ed8f555350b83bd8985e9bec7512f3181e8` (`game/survival/economy/economy_service.gd`),
SHA-256 `109c268036bb92e5dcca2d23ec5f5c1664e1f8645c01abf189d6b5c90f06302c`.
`meta_economy_planner.gd` and `offline_operation_planner.gd` in the parent
directory are A3-authored files from the same commit, kept at their own
canonical paths so their own preloads resolve; their bytes are unmodified
(`35e88cc0166c5cf1…`, `11ba4037cc08be1b…`). A3 owns every formula, cost, rate
and reward; A0 only composes them.

The A3 catalogs under `data/survival/items/` and `recipes/` are byte-exact
copies of the same pin, including the V7 additions `items.json`
(`cd1a27c48078a694…`, which adds the physical `ragnarok_unbanked` token),
`meta_display_names.v1.json`, `recipes/meta_economy.v1.json` and
`recipes/offline_operations.v1.json`. `a0_v5_source_pins.gd` pins all of them
and refuses the whole economy session on any mismatch, so a stale fence can
never silently run an older loot or rate set.

Round 11 correction, for the record: the earlier fence pinned A3 `4bfba38d`
(V5) while A7 measured `items.json` at `cd1a27c4` on a composed A3 tree. The
mismatch was real but it was A0 running old owner bytes, not a corrupted A3
file; adopting the V7 owner bytes above is the fix. No A3 semantic was edited,
no A1 binding changed (`world_source_bindings.v3.json` is byte-identical to the
previous pin), and the A3 branch is unchanged.

A0's separately owned `a0_economy_adapter.gd` restricts mutation callbacks; it is
source-hash pinned in SaveService together with this base script. Future A3
version changes require joint review and pin updates. Gold remains blocked.
