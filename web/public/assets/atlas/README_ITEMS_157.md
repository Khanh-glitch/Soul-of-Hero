# 157 item pixel-art assets — SOH G1B

**Imported without repainting or re-rendering** from the already approved Arena2 157-item pack. All icons are 32×32 PNG, 157 distinct Item Master IDs.

Runtime direct load:
- `/assets/atlas/soh_items_157_atlas.png` — 512×320 full original RGBA PNG.
- `/assets/atlas/soh_items_157_atlas.json` — authoritative 157 ID -> {x,y,w,h}, with nearest-neighbor rendering.
- `/assets/registry/ITEM_VISUAL_HANDOFF.json` — handoff metadata/provenance.

For stand-alone source files, extract `/assets/items/soh_items_157_source_pngs.zip`: `items/<item_id>.png` (157 originals, no substitutions). Source ZIP original PNG bytes retained; archive SHA256: `fa426559c85a269b537fe2cb36b00c2d25c67223631f3e015c27ade16522cd0b`.

**Game integration required:** map item `id` to the atlas `frames[id]`; use nearest filtering, preserve alpha and aspect, and show in the chest, inventory, hotbar, equipment, tooltips, craft/research and transfer UI. Handle unknown/retired IDs explicitly. Do not show old procedural placeholder icons for any of the 157 IDs. QA in REAL Veyra at 640×360, human-reviewed; do not treat the mere file presence as accepted visual integration.

**Licensing audit note:** upstream Arena2 handoff flagged some `HF_HYBRID_REFINED` artwork requiring review of commercial redistribution rights. Do not remove origin and licensing metadata or claim commercial clearance without verifying it.
