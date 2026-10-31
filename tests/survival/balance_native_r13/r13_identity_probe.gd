extends "res://tests/survival/balance_native_r13/r13_harness.gd"
## R13ID — the first transitive root dependency: does a player *be* somebody?
##
## The round-12 work order asks for "real avatar selection + movement". Those are
## two claims and this probe keeps them apart, because the composed product can
## satisfy one and not the other:
##
##   1. **movement** — the Hero body is the shipped `Knight`, driven by the same
##      `Input` actions `_physics_process` reads. Measured in pixels on the real
##      overworld with real keys.
##   2. **identity** — a selected body. A6 publishes a presenter, a sprite pipeline
##      and an art manifest; A0 owns the save service and the Hero scene. The seam
##      is exactly "who publishes the appearance projection and who mounts the
##      reader", so the probe measures both sides from the composed bytes.
##
## It then measures the other half of "connected expedition": whether the authored
## POIs are inside the only runtime world A0 loads, and what A0's own mount
## authority answers when asked to place an A8 site. Every refusal is quoted with
## the authority's own reason string.
##
## Not claimed: that the art looks right (no rasterizer, see R13VIS), or that a
## player would enjoy the first ten minutes (needs a human, EV8).

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

func _body() -> void:
	probe_id = "R13ID"
	probe_title = "identity + reachable geography: is there a player avatar at all, and can a POI cell be stood on?"
	owner_action = (
		"One owner action, dependency-ordered. (1) A0 (arena_dea2428e, 21c37aec): publish "
		+ "`SaveService.get_player_appearance_projection()` + `player_avatar_changed` and mount A6's "
		+ "`player_avatar_presenter.gd` in the shipped Hero scene — without it every A6 avatar byte is dead code. "
		+ "(2) A1 (9ca1453c) + A0: reconcile the world extent (A1 authors 1024x768, A0 loads 384x256), which is "
		+ "what makes 108 of 118 POIs unstandable and every A8 site refuse. Until (1) lands, 'two avatars' (P1) "
		+ "cannot be evaluated at all; until (2) lands, layering POIs (P5) is unreachable content."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	_identity()
	await _movement_without_identity(mounted)
	_geography(mounted)
	_display()

	_done()


# --------------------------------------------------------------- 1. identity
func _identity() -> void:
	var census := _identity_census()
	_note("identity census: %s" % str(census))
	var bytes := _avatar_bytes()
	_note("avatar-named asset files in the composed tree: %d %s"
		% [int(bytes["count"]), str((bytes["files"] as Array).slice(0, 6))])
	var manifest := _manifest()
	if not manifest.is_empty():
		var characters: Variant = manifest.get("characters", {})
		_note("A6 manifest: status=%s characters=%s"
			% [String(manifest.get("status", "")),
				str(characters.keys() if characters is Dictionary else characters)])
	# A0's own file, not anybody's prose: the save service that would have to
	# publish the projection does not mention it.
	_expect(not bool(census["save_source_mentions_method"]),
		"A0's SaveService source does not name %s (it publishes no player appearance)" % R13_IDENTITY_METHOD)
	if not bool(census["save_declares_method"]):
		_missing("%s() on SaveService" % R13_IDENTITY_METHOD, R13_A0_SAVE_SERVICE)
	if not bool(census["save_declares_signal"]):
		_missing("%s signal on SaveService" % R13_IDENTITY_SIGNAL, R13_A0_SAVE_SERVICE)
	if not bool(census["hero_scene_references_presenter"]):
		_missing("a shipped scene that mounts A6's player_avatar_presenter", R13_A0_HERO)
	if not bool(census["presenter_in_composition"]):
		_missing("A6's presenter bytes in the composition", R13_A6_PRESENTER)
	# A6's reader is present *and* the API it reads is absent: dead code, stated as
	# two facts rather than as "A6 is broken".
	if bool(census["presenter_in_composition"]) and not bool(census["save_declares_method"]):
		_note("A6_READER_WITHOUT_API %s calls %s, which this composition does not publish; the presenter's only "
			% [R13_A6_PRESENTER, R13_IDENTITY_METHOD]
			+ "reachable status is its NO_SAVE safety path")
	# Persisting a body is not the same as the product projecting one. This write is
	# A7's own key inside `profile`; the product neither reads nor validates it.
	_write_appearance_key()


## MUTATION_A7_KEY: one transaction that stores an appearance dictionary under a
## key A7 chose. The round-12 question is whether a save round-trip *can* hold a
## body, not whether inventing a key makes the feature exist. A projection API that
## read this key does not exist, so nothing downstream can consume it.
func _write_appearance_key() -> void:
	var save := _save()
	if save == null:
		return
	var wrote := bool(save.call(&"transact_once", "a7_r13_appearance_%d" % Time.get_ticks_usec(),
		func(candidate: Dictionary) -> bool:
			var profile: Variant = candidate.get("profile", {})
			if not profile is Dictionary:
				return false
			var root_profile := profile as Dictionary
			root_profile["player_appearance"] = {"body": "female", "schema": "a7.r12.probe.v1"}
			candidate["profile"] = root_profile
			return true,
		{"kind": "a7_r13_appearance_key"}))
	var snapshot := _snapshot()
	var profile_now: Variant = snapshot.get("profile", {})
	var stored: Variant = (profile_now as Dictionary).get("player_appearance", {}) if profile_now is Dictionary else {}
	_note("MUTATION_A7_KEY profile.player_appearance stored=%s readback=%s" % [str(wrote), str(stored)])
	_expect(stored is Dictionary and String((stored as Dictionary).get("body", "")) == "female",
		"the save round-trip can hold an appearance record (storage is not the blocker)")
	_expect(not save.has_method(StringName(R13_IDENTITY_METHOD)),
		"holding the record does not give the product a projection (still no %s)" % R13_IDENTITY_METHOD)


# --------------------------------------------------- 2. movement without an avatar
func _movement_without_identity(mounted: Node) -> void:
	if hero == null:
		_block("the world mounted without a player body")
		return
	var start := hero.global_position
	var moved := 0.0
	for action: String in ["move_right", "move_left", "move_up", "move_down"]:
		var before := hero.global_position
		await _hold(action, 12)
		moved = maxf(moved, before.distance_to(hero.global_position))
	_note("held each of the four movement actions for 12 physics frames; largest displacement %.1f px" % moved)
	_expect(moved > 1.0, "the Hero body moves under real key input (%.1f px)" % moved)
	_expect(hero.global_position.distance_to(start) < 96.0,
		"four short bursts do not teleport the body (%.1f px from spawn)" % hero.global_position.distance_to(start))
	# What the body actually renders, independent of any selection: one shipped
	# sprite resource, whatever its name. This is the gap the avatar seam would fill.
	var sprite := hero.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
	if sprite == null:
		for child: Node in hero.get_children():
			if child is AnimatedSprite2D:
				sprite = child as AnimatedSprite2D
				break
	if sprite != null and sprite.sprite_frames != null:
		# A0 assembles the Hero's SpriteFrames in code, so `resource_path` is empty
		# even when real textures are bound. The honest test is a frame count plus a
		# non-null texture, not a path.
		var animations := sprite.sprite_frames.get_animation_names()
		var first := animations[0] if not animations.is_empty() else ""
		var frames: int = sprite.sprite_frames.get_frame_count(first) if not first.is_empty() else 0
		var texture: Texture2D = sprite.sprite_frames.get_frame_texture(first, 0) if frames > 0 else null
		_note("Hero body art: %s (%d animations, first=%s frames=%d texture=%s)"
			% [sprite.sprite_frames.resource_path if not sprite.sprite_frames.resource_path.is_empty() else "built at runtime",
				animations.size(), first, frames, texture.resource_path if texture != null else "none"])
		_expect(frames > 0 and texture != null,
			"the player sees a bound body texture, not a blank placeholder (%d frames in %s)" % [frames, first])
	else:
		_missing("a rendered body sprite on the shipped Hero", R13_A0_HERO)
	# Selection surface: is there any node at all through which a player picks a
	# body? Counted by script path and node name over the live mounted tree.
	var selection_nodes: Array[String] = []
	var stack: Array[Node] = [mounted]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		var script: Script = node.get_script() as Script
		var script_path := script.resource_path if script != null else ""
		if script_path.contains("avatar_choice") or script_path.contains("player_avatar_presenter") \
				or node.name.to_lower().contains("avatar"):
			selection_nodes.append("%s (%s)" % [str(node.name), script_path])
		for child: Node in node.get_children():
			stack.append(child)
	_note("nodes in the live world that could select or present an avatar: %d %s"
		% [selection_nodes.size(), str(selection_nodes)])
	if selection_nodes.is_empty():
		_missing("any in-world avatar selection or presentation node",
			"the live overworld subtree contains none (A6's presenter is not mounted)")


# --------------------------------------------------------- 3. reachable geography
func _geography(mounted: Node) -> void:
	var census := _extent_census(mounted)
	_note("runtime world extent=%s authored_pois=%d inside=%d outside=%d sample_outside=%s" % [
		str(census["extent"]), int(census["authored_pois"]), int(census["inside_extent"]),
		int(census["outside_extent"]), str(census["outside_sample"]),
	])
	_expect(int(census["authored_pois"]) > 0, "A1's route graph authors POIs (%d)" % int(census["authored_pois"]))
	_expect(int(census["outside_extent"]) == int(census["authored_pois"]) - int(census["inside_extent"]),
		"the extent arithmetic accounts for every authored POI")
	# A POI outside the loaded world is not "far away", it is absent: no cell, no
	# collision, no stand. That is the reason the A8 sites cannot mount.
	var declared := _a8_declared_extent()
	var extent := census["extent"] as Dictionary
	_note("A8 authored against %s, A0 loads %sx%s" % [str(declared), str(extent["width"]), str(extent["height"])])
	if not declared.is_empty() and int(declared[0]) > int(extent["width"]):
		_missing("a runtime world whose extent contains A1's authored geography",
			"A1 authors %s cells, A0's only runtime document is %sx%s -> %d of %d POIs are unstandable"
			% [str(declared), str(extent["width"]), str(extent["height"]),
				int(census["outside_extent"]), int(census["authored_pois"])])
	var sites := _a8_mount_report(mounted)
	var refused := 0
	for row: Dictionary in sites:
		_note("A0 mount authority %s at %s -> ok=%s reason=%s" % [
			String(row["poi_id"]), str(row["canonical_cell"]), str(row["ok"]), String(row["reason"]),
		])
		if not bool(row["ok"]):
			refused += 1
	# The authority is fail-closed by design; a refusal is correct behaviour and a
	# missing capability at the same time. Both are stated.
	_expect(refused == sites.size(),
		"no A8 site mounts without every gate passing (%d/%d refused)" % [refused, sites.size()])
	var mounted_sites := _mounted_site_nodes(mounted)
	_expect(mounted_sites == 0, "the live world mounts no A8 site node (%d found)" % mounted_sites)
	if sites.is_empty():
		_missing("A8's site package in the composition", R13_A8_PACKAGE)
	elif refused > 0:
		_missing("a walkable A8 site (P5 layered POIs)",
			"all %d sites refused: %s" % [refused, String((sites[0] as Dictionary).get("reason", ""))])


# ------------------------------------------------------------------- 4. pixels
func _display() -> void:
	var facts := _display_facts()
	_note("display facts: %s" % str(facts))
	if bool(facts["is_headless"]):
		_note("VISUAL_NOT_TESTED no rasterizer and no window: this probe produces no pixels, so no visual "
			+ "verdict is claimed here (R13VIS attempts three real captures)")
