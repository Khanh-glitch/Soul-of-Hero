# VEYRA H01 → Web Gameplay staging (GitHub-only)

## Current real status: SOURCE IMPORTED, RUNTIME INTEGRATION PENDING

**The GitHub-only source blocker is RESOLVED.** Full approved H01 map-owned source has been committed on a dedicated branch and imported into this staging branch. This is NOT yet a playable integrated VEYRA world.

### Pinned commits
- Approved map source: `map/veyra-h01-approved-source-20261108` at `cc85379e58e724de3ff6d1df46bc0669d1ab7765`.
- Map source is unpacked and browsable at `web/src/veyra05/`; its H01 architecture is `web/src/veyra05/arch/f01.ts` and `arch/sites.ts`. Source-only archive and custody record: `map_sources/VEYRA_H01_APPROVED_SOURCE_ONLY.tar.gz`, `docs/map/VEYRA_H01_GITHUB_SOURCE_README.md`.
- GitHub source import staging commit: `e2c2e0994783e8189039574dedcf9bc5b5b23135`. It adds map-owned files with blob SHA identity preserved; **no older Gameplay engine/runtime files overwritten**.
- Original approved map ZIP SHA-256 (custody only): `e08a34e5ee19c4cd1e7447002d387e88636303dcedcb08440155587654820248`.
- Source-only archive SHA-256: `08920f408f4cc3956d46ea9532ad4dd994c6010a76c44910d45d0d304f68b583`.
- Gameplay branch: `arena/a9d7aa20-soul-of-hero`; integration initially based on `6bcb71247322dba610ddae90977d8a2d1a955d55`. **IMPORTANT: that branch has advanced to `ee580c13ee799540144064a8c07d5da9ccd28a3c` (three commits ahead), including MEC01 R3 test/audit work. Integration owner must inspect and synchronize before declaring a validated combined build.**
- Scope: canonical GOLD VEYRA, 81 POIs, Greywater/Argus/Ironholm bespoke POIs, and H01 Hook Village (`po_hook`), Mirage Camp (`po_oasis`), Cinder Camp (`po_cindercamp`). C03 has not been accepted.

### Source custody verification
Verified with GitHub tree and local Git blob SHA equality against Creator-approved ZIP:
- `web/src/veyra05/arch/f01.ts`: `459b3dd8fe10a2e927ffda629602f4ae23e1a08a`
- `web/src/veyra05/arch/sites.ts`: `6044d0562d72dc0a844e76894f228b0e1f81a327`
- `web/src/veyra05/poi-arch.generated.ts`: `c46d9fddbbdf318d39885fc3c45d4d5b217c9ddb`
- `web/src/veyra05/continuity.ts`: `daad9c359490d0d0c7cc8e932ddf63c09fa08b30`
- `web/src/game/veyra/projection.ts`: `5198b1f5e02b2864b41743d0cee12bb498f59878`
- Of 95 map-owned files from the ZIP, most canonical geography and several `web/src/game/veyra/**` files already matched Gameplay by Git blob SHA; the missing `web/src/veyra05/**` set and source differences were imported without overwriting Game-owned code. Source-only archive contains all 95 originals.

### Next work: LIVE Gameplay integration (owner: Gameplay agent)
1. Work exclusively from this GitHub staging branch and the pinned map source branch; **no chat/Drive attachment** required.
2. Sync latest a9 Gameplay without losing the existing staging Start-footer patch, map modules, or MEC01 R3 changes. Examine actual API/type changes and conflicts.
3. Reconcile and wire `web/src/veyra05/**` and existing `web/src/game/veyra/**` into current `world`, `sim`, `render`, `engine`, `core`, `persist`, entry UI and Creator Inspect. Preserve identity, saves, source custody, item/UID/cargo ownership, industrial chains and offline catch-up.
4. Preserve the 640×360 fixed Start/footer layout; descriptions and map options must not hide Start.
5. Build a fresh combined deploy from the same source SHA — do not ship or copy stale prebuilt HTML.
6. Browser-validate real New Run → Unified World → controllable character; Creator Inspect at H01 and original bespoke POIs; enter/use spatial buildings, stairs/floors; cross world-window boundary and return; save/reload the same run and prove no dupes/losses; key MEC01 regression checks.
7. Provide exact deployed build SHA, screenshots/captures of real game and named blockers. Do not equate source compile, automated tests or mocked harnesses with full gameplay/visual acceptance.

### Boundaries
Map owns geography, terrain, art, structures, floors, architectural connectors and physical exploration possibilities. Gameplay owns game laws, item grants, loot, AI, economy, crafting, persistence and run authority. Do not downgrade ambitious map locations to fit diagnostic window limits; preserve 4000×2800 global coordinate semantics.

**PR #45 remains draft. No merge into Gameplay or main without Creator approval.**
