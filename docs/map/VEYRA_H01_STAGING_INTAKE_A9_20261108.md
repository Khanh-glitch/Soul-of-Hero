# VEYRA H01 → Gameplay Web staging: correct base intake

> **GITHUB-ONLY SOURCE BLOCKER (2026-11-08):** This staging branch does **not** contain `web/src/veyra05/**`, `web/src/game/veyra/**`, H01 `arch/f01.ts`, or the approved VEYRA map source. The original approved ZIP is still outside GitHub. **Do not ask the Gameplay agent for a chat attachment, claim H01 has been imported, or start the integration until the complete approved map source is committed to a dedicated GitHub map-source branch and pinned by immutable commit SHA.** The source archive filename/checksum below are custody references only; they are not proof of a GitHub-uploaded file. Current PR #45 contains only intake documentation and the New Run Start footer fix.


**Status: staged for integration; no map source has been ported and no integrated runtime/visual acceptance is claimed.**

## Pinned source custody
- **Correct live Gameplay base:** `arena/a9d7aa20-soul-of-hero`, HEAD `6bcb71247322dba610ddae90977d8a2d1a955d55` (2026-11-08).
- **Previously selected base:** `arena/d4bfcfff-soul-of-hero`, HEAD `2a4db2a62a78a874df3931f4856fe2fe7cc7c1e8`. GitHub comparison confirms the correct base is exactly **one commit ahead, zero behind**, preserving previous Gameplay and adding MEC-01 R2 industrial/consumer/freight/offline chain work.
- **Creator-approved map artifact:** `VEYRA_CURRENT_H01_SOURCE_FIXED.zip`; **SHA-256:** `e08a34e5ee19c4cd1e7447002d387e88636303dcedcb08440155587654820248`. Its name denotes the map source handoff; it does **not** supersede newer Gameplay.
- **Map content:** 81 canonical VEYRA POI identities, 4000×2800 world geography, the bespoke Greywater/Argus/Ironholm and H01 Hook Village (`po_hook`), Mirage Camp (`po_oasis`), Cinder Camp (`po_cindercamp`). C03 is NOT accepted or part of this handoff.

## Integration boundaries
1. Read ZIP custody manifests and source; verify exact hash and canonical POI IDs before modifying runtime.
2. Import VEYRA-only geography, asset, map renderer/architecture and F01 source. Do **not** wholesale replace current `web/src/game/**`, `web/src/ui/**`, Vite tooling, tests, persistence or economy with the older snapshot bundled in the ZIP.
3. Extend current live Web Gameplay through explicit integration seams, preserving all current MEC-01 additions (consumption/custody, vehicle/freight, depot, offline continuation), other Gameplay and save guarantees.
4. Maintain canonical global coordinates; do not confuse a static 200×200 local window with completion of the continuous 4000×2800 world.
5. Repair/preserve the 640×360 selection panel with fixed Start/Back/Creator Inspect actions; map selection text and descriptions must not hide Start.
6. Build a *fresh combined* standalone/deploy from integrated source. No stale prebuilt HTML in the ZIP as release source of truth.
7. Prove in browser: normal start; Creator Inspect at H01 and original bespoke POIs; meaningful physical routes/doors; cross window boundary and back; durable save/reload without duplication or state loss; no regressions in updated MEC-01 gameplay.
8. Record exact running SHA, evidence links and unresolved blockers. Compilation ≠ playable acceptance. **No production merge without Creator approval.**

## Workstream strategy
This staging branch is the **Gameplay integration lane**. Keep map creativity/source ownership separate for future one-triad Arena rounds; port only Creator-accepted map changes. This doc is intake guidance, not integration implementation.
