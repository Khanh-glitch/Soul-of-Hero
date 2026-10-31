extends RefCounted
## Reversible A0 composition of the byte-pinned A1 first-hour visual treatment.
## NOT enabled by default or evidence of native visual/product acceptance.
## No inventory, clock, collision, save, POI or input authority is transferred.
const PINS := {
	"res://game/overworld/overworld_occlusion.gd": "8fe91f6d33d7bd79269a00df3ef10501c93c653ae2adb5b241da6323823071fc",
	"res://game/world_art/world_art_presentation.gd": "c6c9091509a1212953099cfd33af18fc859b7ca1341c6e93cf2fc411b042529d",
	"res://game/world_art/world_art_ambient.gdshader": "34906d403dcad88116dc44efd79ec5c8b81c84f2cc622e81d14cc6171e12c92a",
	"res://data/survival/world/art/atlas.v1.json": "617fc36d866653d67eb1b890ddcf5501b8660d87031ae04fefdb73941393326e",
	"res://data/survival/world/art/compiled/crown_roadside_visual_treatment.presentation.v1.json": "3ad267e47a4d1d47980887fbf9b8d1547323c0b695b3696e499d2a246d2f387f",
	"res://data/survival/world/art/mount_bundle.v1.json": "74588f13b1c7903fe335e4e5a8e7ba819a82348adf778ce74ae8a93a5d4acbd0",
	"res://data/survival/world/corridor/first_hour_route.v1.json": "4e4c4eb9864dfc28aca4fcb4168cd856fc3f6be466b95e3ff6b7fb5b3784722c",
	"res://assets/environment/survival_world/terrain.png": "fa8fb59c82ba7958d19aabeac66c04403b78bd1e9e9fb84fef312c657ad53c8f",
	"res://assets/environment/survival_world/props.png": "ff88e06852af61c50019f85c3de2c54409a953624b952c1e11f538e8ccdd1279",
}
const SCRIPT_PATH := "res://game/world_art/world_art_presentation.gd"
const PRESENTATION := "res://data/survival/world/art/compiled/crown_roadside_visual_treatment.presentation.v1.json"
const ATLAS := "res://data/survival/world/art/atlas.v1.json"

static func mount(world: Node, hero: CharacterBody2D) -> Dictionary:
	if world == null or hero == null or not is_instance_valid(world) or not is_instance_valid(hero) or not world.is_inside_tree():
		return {"ok": false, "reason": "missing_live_owner"}
	if not world is Node2D or (world as Node2D).global_transform != Transform2D.IDENTITY:
		return {"ok": false, "reason": "noncanonical_world_transform"}
	if world.get_node_or_null("A1RoadsidePresentation") != null:
		return {"ok": false, "reason": "already_mounted"}
	for path: String in PINS:
		if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != String(PINS[path]):
			return {"ok": false, "reason": "pin_mismatch:" + path}
	var script := load(SCRIPT_PATH) as Script
	if script == null:
		return {"ok": false, "reason": "presentation_script_missing"}
	var art := script.new() as Node2D
	if art == null:
		return {"ok": false, "reason": "presentation_instance_missing"}
	art.name = "A1RoadsidePresentation"
	world.add_child(art)
	if not bool(art.call(&"load_presentation", PRESENTATION, ATLAS)) or not bool(art.call(&"build", hero)):
		art.queue_free()
		return {"ok": false, "reason": "presentation_build_rejected"}
	# Deliberately keep Hero under the existing Entities parent: its combat/VFX
	# use get_parent(). Reparenting as A1's bundle suggests would alter that
	# lifecycle. Consequently cross-parent foot-sorting is NOT yet validated;
	# this mount remains opt-in until a rendered integration review resolves it.
	return {"ok": true, "node": art}
