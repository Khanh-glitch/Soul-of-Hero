extends "res://tests/survival/balance_native_r11/r11_harness.gd"
## A7 harness for round 14 (CT-GATE-v2026-10-31, CT_ROUND12_CONNECTED_PLAYER_EXPEDITION).
##
## The round-11 composition commit is historical evidence; this family runs against
## the round-12 composition and never inherits an earlier verdict. Six of its probes
## are the round-11 probe bodies carried forward with only the probe id changed, so
## a defect that survived is a fact about *this* tree and not a recitation.
##
## What is genuinely new here is the seam the round-12 work order names as the first
## transitive root dependency of "a connected player expedition":
##
##   * **identity.** A6 publishes an avatar presenter, a sprite pipeline and an art
##     manifest. Whether a player can *be* somebody is decided by A0: does the save
##     service publish an appearance projection, and does any shipped scene mount the
##     presenter? `_identity_census()` answers both from the composed bytes.
##   * **reachable geography.** A1 authors 118 POIs. A0 loads one runtime world
##     document with a fixed extent. `_extent_census()` counts the authored cells
##     that fall outside it, and `_a8_mount_report()` asks A0's own mount authority
##     what it refuses, with the authority's own reason string.
##   * **pixels.** `_display_facts()` reports what display the engine actually has and
##     makes one real capture attempt at a requested resolution. A capture that
##     returns an empty image is `VISUAL_NOT_TESTED`, never a pass.
##
## Every helper is read-only except `_click_at()`/`_hold()` movement, which is the
## player's own input path, and the fixture grants the carried probes already
## document. Nothing here edits an owner file, tunes a number or invents a record.

const R14_A0_HERO := "res://game/characters/knight/knight.tscn"
const R14_A6_PRESENTER := "res://game/survival/player/player_avatar_presenter.gd"
const R14_A6_PIPELINE := "res://game/survival/ui/avatar_sprite_pipeline.gd"
const R14_A6_ADAPTER := "res://game/survival/ui/avatar_appearance_adapter.gd"
const R14_A6_MANIFEST := "res://game/survival/ui/avatar_art_manifest.json"
const R14_A8_PACKAGE := "res://data/survival/world_content/a8_a0_mount_transition_package.v2.json"
const R14_A1_GRAPH := "res://data/survival/world/poi_route_graph.json"
const R14_RUNTIME_WORLD := "res://data/overworld/hollow_marches.json"
const R14_CATALOG := "res://data/survival/items/items.json"
const R14_POI_MOUNT := "res://game/survival/a0_poi_mount.gd"
const R14_A0_SAVE_SERVICE := "res://game/autoload/save_service.gd"
const R14_IDENTITY_METHOD := "get_player_appearance_projection"
const R14_IDENTITY_SIGNAL := "player_avatar_changed"


# ------------------------------------------------------------------- identity
## Does the composed product publish a player-avatar identity at all?
##
## Three separate facts, because conflating them is what produced round 11's
## "A6 is not mounted" headline: A6's bytes can be present and still be dead code,
## and A0 can hold a generic dictionary without exposing a projection.
func _identity_census() -> Dictionary:
	var save := _save()
	var save_method := save != null and save.has_method(StringName(R14_IDENTITY_METHOD))
	var save_signal := save != null and save.has_signal(StringName(R14_IDENTITY_SIGNAL))
	var source := _source(R14_A0_SAVE_SERVICE)
	# Call sites across the whole composed `game/` tree, including A6's own file, so
	# the number is "who talks about this symbol", not "who could".
	var call_sites := _source_calls("res://game", R14_IDENTITY_METHOD, "###none###")
	var signal_sites := _source_calls("res://game", R14_IDENTITY_SIGNAL, "###none###")
	var hero_text := _source(R14_A0_HERO)
	return {
		"save_declares_method": save_method,
		"save_declares_signal": save_signal,
		"save_source_mentions_method": source.contains(R14_IDENTITY_METHOD),
		"project_call_sites_method": call_sites,
		"project_call_sites_signal": signal_sites,
		"presenter_in_composition": FileAccess.file_exists(R14_A6_PRESENTER),
		"pipeline_in_composition": FileAccess.file_exists(R14_A6_PIPELINE),
		"adapter_in_composition": FileAccess.file_exists(R14_A6_ADAPTER),
		"manifest_in_composition": FileAccess.file_exists(R14_A6_MANIFEST),
		"hero_scene_references_presenter": hero_text.contains("player_avatar_presenter"),
	}


## Every avatar-named image byte in the composed tree. A6's licence deliberately
## keeps the raw sheets out of Git, so zero here is the expected licence state and
## must be reported as such instead of as "A6 forgot the art".
func _avatar_bytes() -> Dictionary:
	var found: Array[String] = []
	var extensions := ["png", "webp", "svg", "tres"]
	for root_dir: String in ["res://game", "res://assets"]:
		var stack: Array[String] = [root_dir]
		while not stack.is_empty():
			var dir_path: String = stack.pop_back()
			var dir := DirAccess.open(dir_path)
			if dir == null:
				continue
			dir.list_dir_begin()
			var name := dir.get_next()
			while not name.is_empty():
				var full := dir_path.path_join(name)
				if dir.current_is_dir():
					if not name.begins_with("."):
						stack.append(full)
				else:
					var lower := name.to_lower()
					if lower.contains("avatar"):
						for extension: String in extensions:
							if lower.ends_with("." + extension):
								found.append(full)
								break
				name = dir.get_next()
			dir.list_dir_end()
	return {"count": found.size(), "files": found}


## A6's own manifest, read as the authoring record it is. Never treated as proof
## that the player sees anything.
func _manifest() -> Dictionary:
	var text := _source(R14_A6_MANIFEST)
	if text.is_empty():
		return {}
	var parsed: Variant = JSON.parse_string(text)
	return parsed as Dictionary if parsed is Dictionary else {}


# ------------------------------------------------------- reachable geography
## The runtime world document A0 is allowed to load, and its extent.
func _runtime_extent(mounted: Node = null) -> Dictionary:
	var document := _json(R14_RUNTIME_WORLD)
	var bounds: Dictionary = document.get("world_bounds", {}) if document.get("world_bounds") is Dictionary else {}
	var width := int(bounds.get("w", 0))
	var height := int(bounds.get("h", 0))
	if width > 0 and height > 0:
		pass
	elif mounted != null:
		# Fall back to the instantiated world object rather than to a guess.
		var physical: Variant = mounted.get(&"world")
		if physical != null:
			width = int(physical.get(&"width"))
			height = int(physical.get(&"height"))
	return {
		"width": width,
		"height": height,
		"document": R14_RUNTIME_WORLD,
		"document_width": int(bounds.get("w", 0)),
		"document_height": int(bounds.get("h", 0)),
	}


## A1's authored POIs and how many of their canonical cells the runtime world can
## contain. A cell outside `[0,w) x [0,h)` cannot be stood on, so the POI cannot be
## reached however good the content is.
func _extent_census(mounted: Node = null) -> Dictionary:
	var extent := _runtime_extent(mounted)
	var width := int(extent["width"])
	var height := int(extent["height"])
	var graph := _json(R14_A1_GRAPH)
	var rows: Array = graph.get("pois", []) if graph.get("pois") is Array else []
	var inside := 0
	var outside: Array[Dictionary] = []
	var cells: Array[Vector2i] = []
	for row: Variant in rows:
		if not row is Dictionary:
			continue
		var cell_value: Variant = (row as Dictionary).get("cell", [])
		if not cell_value is Array or (cell_value as Array).size() < 2:
			continue
		var cell := Vector2i(int((cell_value as Array)[0]), int((cell_value as Array)[1]))
		cells.append(cell)
		var reachable_cell := width > 0 and height > 0 and cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height
		if reachable_cell:
			inside += 1
		else:
			outside.append({
				"poi_id": String((row as Dictionary).get("poi_id", "")),
				"cell": [cell.x, cell.y],
			})
	return {
		"extent": extent,
		"authored_pois": cells.size(),
		"inside_extent": inside,
		"outside_extent": outside.size(),
		"outside_sample": outside.slice(0, 5),
	}


## The A8 sites, as A8 declares them, and what A0's own mount authority says about
## each one. The authority's reason string is the evidence: this probe does not
## paraphrase a refusal into a verdict.
func _a8_mount_report(mounted: Node) -> Array[Dictionary]:
	var report: Array[Dictionary] = []
	var package := _json(R14_A8_PACKAGE)
	var sites: Array = package.get("existing_a8_sites", []) if package.get("existing_a8_sites") is Array else []
	if sites.is_empty():
		return report
	var script: Script = load(R14_POI_MOUNT) as Script if ResourceLoader.exists(R14_POI_MOUNT) else null
	if script == null:
		return report
	var authority := script.new() as Node
	if authority == null:
		return report
	root.add_child(authority)
	for row: Variant in sites:
		if not row is Dictionary:
			continue
		var poi_id := String((row as Dictionary).get("poi_id", ""))
		var cell_value: Variant = (row as Dictionary).get("canonical_cell", [])
		var cell := Vector2i(int((cell_value as Array)[0]), int((cell_value as Array)[1])) \
			if cell_value is Array and (cell_value as Array).size() >= 2 else Vector2i(-1, -1)
		var probe: Dictionary = authority.call(&"probe", mounted, poi_id) as Dictionary
		report.append({
			"poi_id": poi_id,
			"canonical_cell": [cell.x, cell.y],
			"ok": bool(probe.get("ok", false)),
			"reason": String(probe.get("reason", "")),
		})
	authority.queue_free()
	return report


## A8's package declares the extent it authored against. When that number differs
## from A0's runtime world, the difference is the seam, not an opinion.
func _a8_declared_extent() -> Array:
	var package := _json(R14_A8_PACKAGE)
	var value: Variant = package.get("a1_authored_world_extent_cells", [])
	return value if value is Array else []


## Whether any shipped scene mounts one of A8's site scenes. Counted by script path
## so a renamed node cannot hide a mount.
func _mounted_site_nodes(mounted: Node) -> int:
	var found := 0
	var stack: Array[Node] = [mounted]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		var script: Script = node.get_script() as Script
		if script != null:
			var path := script.resource_path
			if path.contains("native_poi") or path.contains("poi_pilot") or path.contains("world_content/site"):
				found += 1
		for child: Node in node.get_children():
			stack.append(child)
	return found


# ------------------------------------------------------------------- display
## What display does this engine actually have, and what happens when a real
## capture is attempted at `size`. An empty image is "no pixels", not "clean UI".
func _capture_attempt(size: Vector2i) -> Dictionary:
	if root.size != size:
		root.size = size
	# No `frame_post_draw`: with the dummy renderer that signal is not guaranteed,
	# and a probe that waits for a frame nobody draws would be a timeout, not a
	# finding. The capture is attempted on whatever the root texture holds.
	for i in 3:
		await process_frame
	var texture := root.get_texture()
	if texture == null:
		return {"size": size, "ok": false, "why": "the root window has no texture"}
	var image := texture.get_image()
	if image == null:
		return {"size": size, "ok": false, "why": "the root texture produced no image"}
	var path := "user://tests/a7_r14_capture_%dx%d.png" % [size.x, size.y]
	var saved := image.save_png(path)
	var bytes := 0
	if FileAccess.file_exists(path):
		bytes = FileAccess.get_file_as_bytes(path).size()
	return {
		"size": size,
		"ok": saved == OK and not image.is_empty() and bytes > 0,
		"why": "" if saved == OK else "save_png returned %d" % saved,
		"image_size": [image.get_width(), image.get_height()],
		"image_empty": image.is_empty(),
		"png_bytes": bytes,
		"path": path,
	}


func _display_facts() -> Dictionary:
	return {
		"display_server": DisplayServer.get_name(),
		"window_size": [root.size.x, root.size.y],
		"adapter": RenderingServer.get_video_adapter_name(),
		"video_adapter_vendor": RenderingServer.get_video_adapter_vendor(),
		"is_headless": DisplayServer.get_name() == "headless",
	}
