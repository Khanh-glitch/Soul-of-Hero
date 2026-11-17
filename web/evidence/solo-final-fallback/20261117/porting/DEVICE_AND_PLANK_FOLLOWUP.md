# Device hardware + optional Plank access — selective port follow-up

NPC remote independently checked with `git ls-remote` at `79ac5f0b2855ef44d5ca95ed32a19781fa66a045` on2026-11-17. No NPC edit/push/merge. This is **NOT** a current-NPC replay certificate.

## Permanent device hardware (`cc95190`)
- Apply on top of the prior9c2d1e8 station hardware delta, not instead of it.
- Extend only the optional hardware grammar with key-specific generatorCapacity2 / coldFrame true. Do not replace NPC's expanded Stack.production or any job/custody fields.
- Build restores hardware AFTER empty station/basePower/garden initialization. Capturing at reclaim uses the current live device, never stale deployed metadata (a frame may have been dismantled).
- Existing bagStation is still the only authority for fuel, contents and reservations. Do not serialize workers, jobs, enabled flags, power, crops or remote links in hardware.
- Focused device/industry/power/ecology/custody31PASS on Solo; strict live/save rejection, migration and dismantled-frame negative. NPC-specific production custody must be retested at its actual current HEAD before any port is accepted.

## Plank access
- Catalog default wood→stone is unchanged. Add only optional wood→plank and default plank→stone; full current target bills and fractional HP preserved. Do not import the historical6Wood substitute, retire Plank, add Brick/steel targets or replace research/crafting tables.
- Carry optional `target` through dispatch and UI; validate against `upgradeTargets` before payment. Keep NPC's owner/workforce/access predicates AND require supported cabinet for both base and already-upgraded structural geometry.
- UI exposes persistent choice and real current cost, not a fake device recipe. Economic graph/M5/item-ontology adapters must enumerate all options, not just default map values.
- No save schema change for placed walls: same entity ID/type/hp/claim/position grammar. Added device metadata is optional. Default old-client intents still upgrade wood→stone.
- Integration must preserve independently evolved NPC building ownership, reservations, labor receipts, claim/link and floor guards. Manual function-level composition preferred; do not blanket merge Solo engine.ts.

## Performance prototypes
No game render/atlas/common performance change is in this follow-up. All new readback/PNG/software-copy variants were rejected at sustained-frame gate. Encoder exists ONLY in e2e/support for diagnostics. Never port it into production based only on fast first-open input numbers.
