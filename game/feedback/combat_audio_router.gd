class_name CombatAudioRouter
extends Node

## Asset-backed combat/world audio. Gameplay emits stable cue IDs and this
## router resolves legacy WAV cues plus curated Kenney OGG variation pools.
## Selection never immediately repeats a variant and never synthesizes a
## procedural fallback.

signal cue_played(cue_id: StringName)

const LEGACY_AUDIO_ROOT := "res://assets/audio/sfx/rpg_essentials/"
const KENNEY_RPG_ROOT := "res://assets/audio/sfx/kenney/rpg_audio/"
const KENNEY_IMPACT_ROOT := "res://assets/audio/sfx/kenney/impact_sounds/"

@export_range(2, 16, 1) var polyphony := 10
@export var playback_enabled := true
@export_range(64.0, 1600.0, 16.0) var max_hearing_distance := 720.0

var _players: Array[AudioStreamPlayer2D] = []
var _streams: Dictionary = {}
var _last_variant_by_cue: Dictionary = {}
var _next_player := 0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	if not playback_enabled:
		return
	_build_player_pool()
	var event_bus := get_node_or_null("/root/GameEvents")
	if event_bus != null and event_bus.has_signal(&"combat_cue_requested"):
		var callback := Callable(self, "_on_cue_requested")
		if not event_bus.is_connected(&"combat_cue_requested", callback):
			event_bus.connect(&"combat_cue_requested", callback)


func _exit_tree() -> void:
	var event_bus := get_node_or_null("/root/GameEvents")
	var callback := Callable(self, "_on_cue_requested")
	if event_bus != null and event_bus.has_signal(&"combat_cue_requested") \
			and event_bus.is_connected(&"combat_cue_requested", callback):
		event_bus.disconnect(&"combat_cue_requested", callback)
	for player: AudioStreamPlayer2D in _players:
		player.stop()
		player.stream = null
	_streams.clear()
	_last_variant_by_cue.clear()


func request_cue(
		cue_id: StringName,
		context: Dictionary = {},
		world_position: Vector2 = Vector2.ZERO
) -> void:
	if not playback_enabled or bool(context.get("mute", false)):
		return
	var normalized := cue_id if not String(cue_id).is_empty() else &"hit_confirmed"
	# Headless runs use Godot's dummy audio backend. Starting a stream there has no
	# audible value and leaves its playback object alive when a test quits on the
	# same frame. Keep cue dispatch testable, but reserve playback/resources for
	# real game windows.
	if DisplayServer.get_name() == "headless":
		cue_played.emit(normalized)
		return
	if _players.is_empty():
		_build_player_pool()
	var resolved_cue := _resolve_material_cue(normalized, context)
	var profile := _cue_profile(resolved_cue)
	var stream: AudioStream = get_cue_stream(resolved_cue)
	if stream == null:
		return
	var player := _players[_next_player % _players.size()]
	_next_player += 1
	player.stop()
	player.stream = stream
	player.global_position = world_position
	player.bus = StringName(profile.get("bus", &"SFX"))
	var pitch_scale := float(context.get("pitch_scale", profile.get("pitch_scale", 1.0)))
	if not context.has("pitch_scale"):
		var pitch_variation := float(profile.get("pitch_variation", 0.0))
		pitch_scale += _rng.randf_range(-pitch_variation, pitch_variation)
	player.pitch_scale = clampf(
		pitch_scale,
		0.75,
		1.3
	)
	player.volume_db = clampf(
		float(context.get("volume_db", profile.get("volume_db", -12.0))),
		-30.0,
		-3.0
	)
	player.play()
	cue_played.emit(normalized)


# Variant return keeps the original public helper source-compatible: callers
# that know a legacy cue is WAV may still inspect AudioStreamWAV.data, while
# the same method can now return AudioStreamOggVorbis for Kenney pools.
func get_cue_stream(cue_id: StringName, context: Dictionary = {}) -> Variant:
	var normalized := cue_id if not String(cue_id).is_empty() else &"hit_confirmed"
	var resolved_cue := _resolve_material_cue(normalized, context)
	var paths := get_cue_variant_paths(resolved_cue)
	if paths.is_empty():
		return null
	var selected_path := _select_variant_path(resolved_cue, paths)
	if not _streams.has(selected_path):
		var loaded := load(selected_path)
		if loaded is AudioStream:
			_streams[selected_path] = loaded
		else:
			push_warning("Combat audio cue could not load: %s" % selected_path)
			return null
	return _streams[selected_path] as AudioStream


func get_cue_variant_paths(cue_id: StringName, context: Dictionary = {}) -> PackedStringArray:
	var normalized := cue_id if not String(cue_id).is_empty() else &"hit_confirmed"
	var resolved_cue := _resolve_material_cue(normalized, context)
	var profile := _cue_profile(resolved_cue)
	var paths := PackedStringArray()
	var profile_files: Variant = profile.get("files", PackedStringArray())
	if profile_files is PackedStringArray or profile_files is Array:
		for raw_path: Variant in profile_files:
			var path := String(raw_path)
			if not path.is_empty():
				paths.append(path)
	if paths.is_empty():
		var relative_path := String(profile.get("file", "hit_flesh.wav"))
		paths.append(relative_path if relative_path.begins_with("res://") else LEGACY_AUDIO_ROOT + relative_path)
	return paths


func _select_variant_path(cue_id: StringName, paths: PackedStringArray) -> String:
	if paths.size() == 1:
		_last_variant_by_cue[cue_id] = 0
		return paths[0]
	var previous := int(_last_variant_by_cue.get(cue_id, -1))
	var selected := _rng.randi_range(0, paths.size() - 1)
	if selected == previous:
		# Selecting from count - 1 alternatives guarantees a different variant
		# without retry loops or a biased "roll until different" hot path.
		selected = _rng.randi_range(0, paths.size() - 2)
		if selected >= previous:
			selected += 1
	_last_variant_by_cue[cue_id] = selected
	return paths[selected]


static func _resolve_material_cue(cue_id: StringName, context: Dictionary) -> StringName:
	if cue_id not in [&"hit_confirmed", &"sword_hit", &"material_hit"]:
		return cue_id
	var material := StringName(String(context.get("material", "")).to_snake_case())
	if material == &"":
		return cue_id
	var heavy := float(context.get("impact_strength", 1.0)) >= 1.25
	match material:
		&"bone", &"skeleton":
			return &"impact_bone_heavy" if heavy else &"impact_bone"
		&"flesh", &"blood", &"body":
			return &"impact_flesh_heavy" if heavy else &"impact_flesh"
		&"metal", &"armor", &"shield":
			return &"impact_metal_heavy" if heavy else &"impact_metal_medium"
		&"wood", &"door", &"chest":
			return &"impact_wood_heavy" if heavy else &"impact_wood_light"
		&"stone", &"rock", &"wall":
			return &"impact_stone"
		_:
			return &"impact_generic"


func _on_cue_requested(cue_id: StringName, world_position: Vector2, context: Dictionary) -> void:
	request_cue(cue_id, context, world_position)


func _build_player_pool() -> void:
	if not _players.is_empty():
		return
	for index: int in maxi(2, polyphony):
		var player := AudioStreamPlayer2D.new()
		player.name = "WorldVoice%02d" % index
		player.bus = &"SFX"
		player.process_mode = Node.PROCESS_MODE_ALWAYS
		player.max_distance = max_hearing_distance
		player.attenuation = 0.72
		player.panning_strength = 0.55
		add_child(player)
		_players.append(player)


static func _cue_profile(cue_id: StringName) -> Dictionary:
	match cue_id:
		&"sword_swing_1":
			return {"files": _rpg_files(PackedStringArray(["knifeSlice.ogg", "knifeSlice2.ogg"])), "pitch_scale": 1.08, "pitch_variation": 0.025, "volume_db": -15.0}
		&"sword_swing_2":
			return {"files": _rpg_files(PackedStringArray(["knifeSlice.ogg", "knifeSlice2.ogg"])), "pitch_scale": 1.14, "pitch_variation": 0.02, "volume_db": -15.0}
		&"sword_swing_3":
			return {"files": _rpg_files(PackedStringArray(["knifeSlice.ogg", "knifeSlice2.ogg"])), "pitch_scale": 0.96, "pitch_variation": 0.02, "volume_db": -14.0}
		&"sword_swing_4":
			return {"files": _rpg_files(PackedStringArray(["knifeSlice.ogg", "knifeSlice2.ogg"])), "pitch_scale": 0.9, "pitch_variation": 0.015, "volume_db": -13.0}
		&"sword_hit", &"hit_confirmed":
			return {"file": "impact_flesh.wav", "volume_db": -12.0}
		&"sword_wave":
			return {"file": "spirit_wind.wav", "pitch_scale": 1.08, "volume_db": -15.0}
		&"combo_finisher":
			return {"file": "heavy_impact.wav", "pitch_scale": 0.92, "volume_db": -11.0}
		&"soul_echo_activate":
			return {"file": "soul_teleport.wav", "pitch_scale": 1.12, "volume_db": -16.0}
		&"soul_echo_slash":
			return {"file": "sword_slash.wav", "pitch_scale": 1.18, "volume_db": -17.0}
		&"soul_echo_cross":
			return {"file": "spirit_wind.wav", "pitch_scale": 1.16, "volume_db": -16.0}
		&"soul_echo_wave":
			return {"file": "spirit_wind.wav", "pitch_scale": 0.96, "volume_db": -15.0}
		&"soul_echo_execution":
			return {"file": "heavy_impact.wav", "pitch_scale": 1.04, "volume_db": -12.0}
		&"soul_echo_hit":
			return {"file": "soul_absorb.wav", "pitch_scale": 1.18, "volume_db": -18.0}
		&"soul_relay", &"soul_interception_arrive":
			return {"file": "soul_teleport.wav", "pitch_scale": 1.0, "volume_db": -15.0}
		&"soul_interception_guard":
			return {"file": "guard_block.wav", "pitch_scale": 1.08, "volume_db": -13.0}
		&"soul_interception_cut":
			return {"file": "sword_slash.wav", "pitch_scale": 1.04, "volume_db": -14.0}
		&"returning_blade_launch":
			return {"file": "spirit_wind.wav", "pitch_scale": 0.9, "volume_db": -16.0}
		&"returning_blade_arrive":
			return {"file": "guard_block.wav", "pitch_scale": 1.16, "volume_db": -15.0}
		&"axe_charge":
			return {"file": "skill_charge.wav", "pitch_scale": 0.9, "volume_db": -17.0}
		&"axe_throw", &"axe_return":
			return {"file": "spirit_wind.wav", "pitch_scale": 0.82, "volume_db": -14.0}
		&"axe_cleave":
			return {"files": _rpg_files(PackedStringArray(["chop.ogg", "knifeSlice.ogg", "knifeSlice2.ogg"])), "pitch_scale": 0.84, "pitch_variation": 0.025, "volume_db": -12.0}
		&"axe_hit", &"axe_impact", &"axe_heavy":
			return {"files": _impact_files("impactMetal_heavy", 3), "pitch_scale": 0.88, "pitch_variation": 0.025, "volume_db": -10.5}
		&"axe_catch":
			return {"files": _impact_files("impactMetal_medium", 3), "pitch_scale": 0.94, "pitch_variation": 0.02, "volume_db": -14.0}
		&"bow_release", &"bow_volley":
			return {"file": "attack_miss.wav", "pitch_scale": 1.08, "volume_db": -15.0}
		&"dash", &"soul_ready":
			return {"file": "dash_ready.wav", "pitch_scale": 1.08, "volume_db": -18.0}
		&"footstep_stone":
			return {"files": _impact_files("footstep_concrete", 5), "pitch_variation": 0.018, "volume_db": -23.0}
		&"footstep_wood":
			return {"files": _impact_files("footstep_wood", 5), "pitch_variation": 0.018, "volume_db": -23.0}
		&"footstep_generic":
			return {"files": _rpg_numbered_files("footstep", 10), "pitch_variation": 0.02, "volume_db": -23.0}
		&"enemy_claw":
			return {"file": "enemy_claw.wav", "volume_db": -13.0}
		&"enemy_bite":
			return {"file": "enemy_bite.wav", "volume_db": -13.0}
		&"enemy_death":
			return {"file": "enemy_death.wav", "volume_db": -16.0}
		&"enemy_encounter":
			return {"file": "enemy_encounter.wav", "volume_db": -18.0}
		&"vampire_drain":
			return {"file": "vampire_drain.wav", "volume_db": -16.0}
		&"reaper_disc":
			return {"file": "spirit_wind.wav", "pitch_scale": 0.78, "volume_db": -15.0}
		&"player_hit":
			return {"file": "player_hit.wav", "volume_db": -12.0}
		&"player_death":
			return {"file": "enemy_death.wav", "pitch_scale": 0.86, "volume_db": -15.0}
		&"player_respawn", &"checkpoint":
			return {"file": "heal.wav", "pitch_scale": 1.02, "volume_db": -17.0}
		&"pickup_sigil":
			return {"file": "soul_absorb.wav", "pitch_scale": 1.12, "volume_db": -18.0}
		&"impact_generic", &"material_hit":
			return {"files": _impact_files("impactGeneric_light", 3), "pitch_variation": 0.025, "volume_db": -14.0}
		&"impact_bone", &"bone_impact", &"skeleton_hit":
			return {"files": _impact_files("impactPlate_medium", 3), "pitch_scale": 1.06, "pitch_variation": 0.025, "volume_db": -13.5}
		&"impact_bone_heavy", &"bone_break":
			return {"files": _combined_impact_files(PackedStringArray(["impactPlate_heavy", "impactMining"]), 3), "pitch_scale": 0.94, "pitch_variation": 0.025, "volume_db": -11.0}
		&"impact_flesh", &"flesh_impact":
			return {"files": _combined_impact_files(PackedStringArray(["impactPunch_medium", "impactSoft_medium"]), 3), "pitch_variation": 0.025, "volume_db": -13.5}
		&"impact_flesh_heavy":
			return {"files": _combined_impact_files(PackedStringArray(["impactPunch_heavy", "impactSoft_heavy"]), 3), "pitch_scale": 0.94, "pitch_variation": 0.02, "volume_db": -11.5}
		&"impact_metal_light":
			return {"files": _impact_files("impactMetal_light", 3), "pitch_variation": 0.025, "volume_db": -15.0}
		&"impact_metal_medium":
			return {"files": _impact_files("impactMetal_medium", 3), "pitch_variation": 0.02, "volume_db": -13.0}
		&"impact_metal_heavy":
			return {"files": _impact_files("impactMetal_heavy", 3), "pitch_scale": 0.92, "pitch_variation": 0.02, "volume_db": -11.0}
		&"impact_wood_light":
			return {"files": _impact_files("impactWood_light", 3), "pitch_variation": 0.025, "volume_db": -15.0}
		&"impact_wood_heavy":
			return {"files": _impact_files("impactWood_heavy", 3), "pitch_scale": 0.94, "pitch_variation": 0.02, "volume_db": -12.0}
		&"impact_stone":
			return {"files": _impact_files("impactMining", 3), "pitch_scale": 0.96, "pitch_variation": 0.025, "volume_db": -12.5}
		&"door_open":
			return {"files": _rpg_files(PackedStringArray(["doorOpen_1.ogg", "doorOpen_2.ogg"])), "pitch_variation": 0.015, "volume_db": -16.0}
		&"door_close":
			return {"files": _rpg_files(PackedStringArray(["doorClose_1.ogg", "doorClose_2.ogg"])), "pitch_variation": 0.015, "volume_db": -15.0}
		&"chest_open":
			return {"files": _rpg_files(PackedStringArray(["creak1.ogg", "creak2.ogg", "doorOpen_1.ogg", "doorOpen_2.ogg"])), "pitch_scale": 1.06, "pitch_variation": 0.02, "volume_db": -17.0}
		&"chest_close":
			return {"files": _rpg_files(PackedStringArray(["doorClose_1.ogg", "doorClose_2.ogg"])), "pitch_scale": 1.08, "pitch_variation": 0.02, "volume_db": -17.0}
		&"loot_land":
			return {"files": _impact_files("impactGeneric_light", 3), "pitch_scale": 1.12, "pitch_variation": 0.04, "volume_db": -21.0}
		&"loot_pickup":
			return {"files": _rpg_files(PackedStringArray(["handleCoins.ogg", "handleCoins2.ogg"])), "pitch_scale": 1.18, "pitch_variation": 0.035, "volume_db": -16.5}
		&"loot_jackpot":
			return {"file": "ui_buy_sell.wav", "pitch_scale": 0.94, "pitch_variation": 0.02, "volume_db": -9.5, "bus": &"UI"}
		&"coin_pickup", &"coin_reward":
			return {"files": _rpg_files(PackedStringArray(["handleCoins.ogg", "handleCoins2.ogg"])), "pitch_scale": 1.1, "pitch_variation": 0.03, "volume_db": -18.0}
		&"torch_pickup":
			return {"files": _rpg_files(PackedStringArray(["cloth1.ogg", "cloth2.ogg", "cloth3.ogg", "cloth4.ogg", "clothBelt.ogg"])), "pitch_scale": 1.04, "pitch_variation": 0.025, "volume_db": -20.0}
		&"torch_place":
			return {"files": _impact_files("impactWood_light", 3), "pitch_scale": 1.08, "pitch_variation": 0.025, "volume_db": -18.0}
		&"torch_toggle", &"world_latch":
			return {"files": _rpg_files(PackedStringArray(["metalClick.ogg", "metalLatch.ogg"])), "pitch_variation": 0.02, "volume_db": -19.0}
		&"book_open":
			return {"file": KENNEY_RPG_ROOT + "bookOpen.ogg", "volume_db": -19.0}
		&"book_close":
			return {"file": KENNEY_RPG_ROOT + "bookClose.ogg", "volume_db": -19.0}
		&"book_page":
			return {"files": _rpg_files(PackedStringArray(["bookFlip1.ogg", "bookFlip2.ogg"])), "pitch_variation": 0.02, "volume_db": -21.0}
		&"weapon_unlock":
			return {"file": "ui_equip.wav", "volume_db": -18.0, "bus": &"UI"}
		&"objective_complete":
			return {"file": "ui_confirm.wav", "pitch_scale": 0.96, "volume_db": -18.0, "bus": &"UI"}
		&"ui_combo":
			return {"file": "ui_hover.wav", "pitch_scale": 1.08, "volume_db": -20.0, "bus": &"UI"}
		_:
			return {"file": "hit_flesh.wav", "volume_db": -14.0}


static func _rpg_files(file_names: PackedStringArray) -> PackedStringArray:
	var paths := PackedStringArray()
	for file_name: String in file_names:
		paths.append(KENNEY_RPG_ROOT + file_name)
	return paths


static func _rpg_numbered_files(stem: String, count: int) -> PackedStringArray:
	var paths := PackedStringArray()
	for index: int in count:
		paths.append(KENNEY_RPG_ROOT + stem + "%02d.ogg" % index)
	return paths


static func _impact_files(stem: String, count: int) -> PackedStringArray:
	var paths := PackedStringArray()
	for index: int in count:
		paths.append(KENNEY_IMPACT_ROOT + stem + "_%03d.ogg" % index)
	return paths


static func _combined_impact_files(stems: PackedStringArray, count: int) -> PackedStringArray:
	var paths := PackedStringArray()
	for stem: String in stems:
		paths.append_array(_impact_files(stem, count))
	return paths
