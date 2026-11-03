# MAP TOWER — Veyra GOLD source-of-truth workspace

Creator-selected map: `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` (2000x1400 authoring units). Immutable source ID for each island, landform, river, road, bridge, dock, POI, source, spawn, Elder. Design GOLD **does not** imply native playability.

Gameplay authority: `docs/survival/CURRENT_PRODUCT_CONTRACT.md` on **this same branch**, not old source archives.

Mandatory conversion sequence: validate Veyra source -> resolve art slots against exact committed pixels -> compile terrain/hydro/traversal -> regions and portals -> POI mechanics/resources -> survival gameplay/14-day clock/Ragnarok -> native Godot QA + captures. No static PNG-as-level, no symbolic marker-as-interactable, no artificial procedural replacement that loses source geometry.

**Staging / NOT_READY_FOR_ONE_SHOT**: original Veyra JSON committed, first two source ZIPs committed, but the full audited PNG library, artistically approved cohesive atlas, and native source-to-tile compiler are NOT yet committed. NEVER claim this branch is self-sufficient for the final agent until all assets are Git-resident and source/slot coverage passes.

See `map_tower/REAL_MAP_CONVERSION_CONTRACT.md` and `map_tower/ASSET_STAGING_STATUS.md`.
