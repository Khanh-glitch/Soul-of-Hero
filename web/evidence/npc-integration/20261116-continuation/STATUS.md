# Continuation — engineering progress, NOT full acceptance

Inherits accepted P0 corrections from 4d4bb16. No production merge.

## Verified on this continuation tree
- App TypeScript: PASS.
- Six focused NPC suites: 53/53 PASS (48 retained + 4 shelter/incident + 1 paid cook reload test).
- Production build: PASS, 13.25 s; warning remains for large JavaScript chunk.
- Production ordinary controls → fresh Veyra run: native 640×360, no page errors, no mutable QA global. Screenshot is only fresh-run smoke, not occupation/social acceptance.
- Canonical vfx-pack CSS: 90 PNG references, 39,523,098 decoded bytes independently compared byte-for-byte against emitted SHA256-named files. CSS now 115,947 bytes, index.html 457 bytes. No atlas reencoding or visual-quality reduction.
- Build is now an HTTP multifile package; do not distribute index.html alone or claim file:// support.

## Source changes
Global/floor-aware physical shelter adapter; single assault incident with persistent ID; biological damage no longer rounds a tiny starvation/bleeding increment into a full armor-adjusted hit; one-second needs resolution retains elapsed time. Shared paid recipe admission and NPC work planner/executor reuse station queues, fuel, Recycler, repair bills, garden recipes, medicine and power custody. Guard posts/perception use physical movement/LOS and existing combat.

## Still PARTIAL / unverified
Occupation module is integrated, but only paid cooking has a direct execution+reload test. Guard complete reload/rest/retreat, autonomous supply/station coverage, all eight occupations naturally demonstrated, output UID-specific claims, global legal route/window continuity, all 81 POI capacity/336-hour supply proof, six-region shared play, offline causal combat, Elder assault, three concurrent evacuation transports, final outcomes/cleanup, final full-suite failure classification, and Vietnamese full walkthrough remain unfinished. No Creator visual acceptance claimed.

60-frame SwiftShader smoke timing is NOT comparable performance evidence (mean 163.33 ms, P95 299.90 ms); prior comparison remains invalid. The <=10% target is unproven. Source externalization proves packaging reduction, not frame-time improvement. No replacement of prior failure disclosures.
