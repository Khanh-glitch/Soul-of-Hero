extends "res://tests/survival/balance_native_r11/r11_harness.gd"
## WP5 — what this environment can and cannot say about the picture.
##
## The gate asks for inspected frames at 720p, 1440p and 2160p. An acceptance
## report that skipped that and quietly marked "visual PASS" would be worthless, so
## this probe does the honest thing: it *attempts* a real capture on the composed
## product, records exactly why it fails here when it fails, and separately measures
## the parts of readability that are structural rather than aesthetic (what the HUD
## is made of, whether a real action produces a textual result the player can read,
## whether the interaction prompt exists at all).
##
## Nothing here is a substitute for CT's own A6 render inspection, and nothing here
## may be quoted as "visual approved".

const HUD_SCRIPT := "res://game/overworld/overworld_hud.gd"

func _body() -> void:
	probe_id = "R11VIS"
	probe_title = "visual evidence: attempted real capture, plus the structural readability facts"
	owner_action = (
		"No owner action for the capture itself: this sandbox has no display server, no GL driver and the engine "
		+ "release assets are unreachable, so 720p/1440p/2160p frames are NOT_TESTED here and remain with CT. "
		+ "The HUD/interaction/prompt facts below are what can be measured without a frame."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	_attempt_capture()
	_hud_structure(mounted)
	await _action_readability(mounted)

	_done()


# ------------------------------------------------------------- 1. the capture
## Ask the engine for a texture of the rendered viewport. Headless renders nothing,
## so `get_texture()` returning null is the *evidence* that no frame exists — the
## probe records the shape of the failure instead of a claim about pixels.
func _attempt_capture() -> void:
	var viewport := root.get_viewport() if root != null else null
	if viewport == null:
		_note("CAPTURE no viewport is available")
		_expect(false, "a rendered viewport exists to capture from")
		return
	var size := viewport.get_visible_rect().size
	var driver := ""
	if DisplayServer.get_name() != "":
		driver = String(DisplayServer.get_name())
	var texture: Variant = viewport.get_texture()
	var image_ok := false
	if texture != null:
		var image: Variant = (texture as ViewportTexture).get_image()
		image_ok = image != null and (image as Image).get_width() > 0
	_note("CAPTURE display_driver=%s visible_rect=%s texture_null=%s image_ok=%s" % [
		driver if not driver.is_empty() else "none", str(size), str(texture == null), str(image_ok),
	])
	if not image_ok:
		_note("CAPTURE no rendered frame is obtainable in this environment (display driver %s, %dx%d viewport)"
			% [driver if not driver.is_empty() else "headless", int(size.x), int(size.y)])
		_missing("inspected 720p/1440p/2160p frames of the composed product (VISUAL_NOT_REVIEWED)",
			"the engine runs with the dummy display driver here; get_texture() yields no image, so no frame exists to "
			+ "inspect. CT's separate A6 render inspection covers A6's own scenes, not this composition.")
	else:
		_expect(image_ok, "a rendered frame is obtainable at %dx%d" % [int(size.x), int(size.y)])


# ----------------------------------------------------------- 2. what the HUD is
func _hud_structure(mounted: Node) -> void:
	var hud: Node = mounted.get(&"hud") if mounted.get("hud") != null else null
	if hud == null:
		for child: Node in mounted.get_children():
			if String(child.name).to_lower().contains("hud"):
				hud = child
	_note("hud node: %s" % (str(hud.name) if hud != null else "absent"))
	_expect(hud != null, "the overworld mounts a HUD node at all")
	if hud == null:
		return
	var labels := 0
	var controls := 0
	var stack: Array[Node] = [hud]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is Label or node is RichTextLabel:
			labels += 1
		if node is Control:
			controls += 1
		for child: Node in node.get_children():
			stack.append(child)
	_note("hud: %d controls, %d text labels" % [controls, labels])
	_expect(labels >= 1, "the HUD contains at least one real text element (%d)" % labels)
	# Gold readability: the campaign HUD shows currency; the survival HUD must at
	# least have somewhere to put it.
	var gold_mentions := 0
	for path: String in [HUD_SCRIPT]:
		var text := _source(path)
		if text.contains("gold") or text.contains("Gold"):
			gold_mentions += 1
	_note("hud script mentions gold: %s" % str(gold_mentions > 0))


# ------------------------------------------------- 3. can a player read a result
func _action_readability(mounted: Node) -> void:
	var oak: Node = await _reach_any("oak_tree")
	if oak == null:
		_note("NOT_TESTED the swing readout: no oak could be reached on foot")
		return
	# Clear the node's own cooldown before the swing, so the readout is about the swing
	# and not about a swallowed click.
	await _wait_seconds(0.25)
	var before := _count_item("oak_wood")
	oak.call(&"interact", hero)
	await process_frame
	var after := _count_item("oak_wood")
	var last_result: Dictionary = oak.get(&"_last_result") if oak.get("_last_result") is Dictionary else {}
	_note("harvest result: %d -> %d, last_result keys=%s" % [before, after, str(last_result.keys())])
	_expect(not last_result.is_empty(),
		"the node keeps a machine-readable result of the swing the player just made")
	_expect(last_result.has("item_id") or last_result.has("reason"),
		"the result names either what was gained or why it was refused")
	# The prompt is the only in-world text a player sees for a swing; a HUD that has
	# no prompt surface cannot explain an action.
	var hud_has_prompt := false
	var hud: Node = mounted_world.get(&"hud") if mounted_world.get("hud") != null else null
	if hud != null:
		hud_has_prompt = hud.has_method(&"show_prompt")
	_note("hud show_prompt=%s" % str(hud_has_prompt))
	if not hud_has_prompt:
		_missing("an in-world result prompt for gathering", "the mounted HUD exposes no show_prompt()")
	_expect(hud_has_prompt, "the HUD can show the result of an action the player just took")


func _finish() -> void:
	_release_all()
	super._finish()
