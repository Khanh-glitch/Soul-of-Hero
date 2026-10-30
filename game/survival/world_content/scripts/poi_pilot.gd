extends Node2D

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const PHASE_FIXTURE := preload(
	"res://tests/survival/world_content/a8_run_phase_projection_fixture.gd"
)

## Isolated S2 harness. It is not mounted in the release overworld and its
## authority fixture is explicitly not SaveService, inventory, or A3 economy.

const SITE_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill.tscn",
	"res://game/survival/world_content/scenes/fourth_salt_lookout_test.tscn"
]
const SHELL_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry_overworld.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin_overworld.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill_overworld.tscn"
]
const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const PROBE_SCRIPT := preload("res://game/survival/world_content/scripts/player_probe.gd")

var _authority: PoiAuthorityFixture
var _site: NativePoiSite
var _shell: NativePoiShell
var _active_scene: Node2D
var _probe: CharacterBody2D
var _camera: Camera2D
var _site_index := 0
var _feedback: Label
var _site_title: Label
var _details: Label


func _ready() -> void:
	_install_fixture_inputs()
	_authority = FIXTURE_SCRIPT.new() as PoiAuthorityFixture
	_authority.name = "S2TestAuthorityFixture"
	_authority.configure()
	add_child(_authority)
	_build_ui()
	_probe = CharacterBody2D.new()
	_probe.name = "InvisibleHarnessNavigationProbe"
	_probe.set_script(PROBE_SCRIPT)
	_probe.collision_layer = 2
	_probe.collision_mask = 1
	var shape := CircleShape2D.new()
	shape.radius = 10.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	_probe.add_child(collision)
	_camera = Camera2D.new()
	_camera.zoom = Vector2(2.2, 2.2)
	_camera.position_smoothing_enabled = false
	_camera.enabled = true
	_probe.add_child(_camera)
	add_child(_probe)
	_mount_site(0)
	set_process_unhandled_input(true)


func _process(_delta: float) -> void:
	if is_instance_valid(_shell):
		_feedback.text = _shell.get_context_hint(_probe)
	elif is_instance_valid(_site):
		var hint := _site.get_context_hint(_probe)
		if not hint.is_empty():
			_feedback.text = hint


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("poi_interact"):
		if is_instance_valid(_shell):
			_shell.try_enter(_probe)
		elif is_instance_valid(_site):
			if _site.is_at_exit(_probe):
				_site.try_exit(_probe)
			else:
				_site.try_interact(_probe)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_action_0") and is_instance_valid(_site):
		_site.try_interact(_probe, 0)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_action_1") and is_instance_valid(_site):
		_site.try_interact(_probe, 1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_choice_prev") and is_instance_valid(_site):
		_site.cycle_choice(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_choice_next") and is_instance_valid(_site):
		_site.cycle_choice(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_fixture_capability") and is_instance_valid(_site):
		var granted: Array[String] = []
		if not _authority.has_capability("cap_salvage"):
			granted.append("cap_salvage")
		_authority.set_capabilities(granted)
		_site.set_projection(_authority.project_state(_site.get_source_id()))
		_feedback.text = (
			"TEST FIXTURE ONLY: cap_salvage %s."
			% ("enabled" if not granted.is_empty() else "removed")
		)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_site_1"):
		_mount_site(0)
	elif event.is_action_pressed("poi_site_2"):
		_mount_site(1)
	elif event.is_action_pressed("poi_site_3"):
		_mount_site(2)
	elif event.is_action_pressed("poi_site_4"):
		_mount_site(3)


func _mount_site(index: int) -> void:
	_site_index = clampi(index, 0, SITE_SCENES.size() - 1)
	_clear_active_scene()
	if _site_index < SHELL_SCENES.size():
		var packed_shell := load(SHELL_SCENES[_site_index]) as PackedScene
		if packed_shell == null:
			_feedback.text = "This exterior could not be loaded."
			return
		_shell = packed_shell.instantiate() as NativePoiShell
		_shell.name = "CompactPOIShell_%d" % (_site_index + 1)
		_active_scene = _shell
		add_child(_shell)
		_shell.apply_run_phase_projection(PHASE_FIXTURE.project(_shell.definition))
		_shell.transition_requested.connect(_on_transition_requested)
		_shell.player_feedback.connect(_on_player_feedback)
		_probe.global_position = (
			_shell.global_position + _shell.get_entry_position() + Vector2(0, 40)
		)
		_camera.zoom = Vector2(2.2, 2.2)
		_update_site_header(_shell.definition)
		_feedback.text = "Walk through the south doorway to enter this local worksite."
		return
	_mount_worksite(SITE_SCENES[_site_index], Vector2.ZERO)


func _mount_worksite(scene_path: String, spawn_override: Vector2) -> void:
	_clear_active_scene()
	var packed := load(scene_path) as PackedScene
	if packed == null:
		_feedback.text = "This local worksite could not be loaded."
		return
	_site = packed.instantiate() as NativePoiSite
	_site.name = "LocalPOIWorksite_%d" % (_site_index + 1)
	_site.test_harness_only = true
	_active_scene = _site
	add_child(_site)
	_site.intent_requested.connect(_on_intent_requested)
	_site.player_feedback.connect(_on_player_feedback)
	_site.transition_requested.connect(_on_transition_requested)
	_site.set_projection(_authority.project_state(_site.get_source_id()))
	_site.apply_run_phase_projection(PHASE_FIXTURE.project(_site.definition))
	_probe.global_position = (
		spawn_override if spawn_override != Vector2.ZERO else _site.get_spawn_position()
	)
	_camera.zoom = Vector2(0.68, 0.68)
	_update_site_header(_site.definition)
	_feedback.text = "Follow the marked route. G returns through the physical doorway."


func _clear_active_scene() -> void:
	if is_instance_valid(_active_scene):
		_active_scene.queue_free()
	_active_scene = null
	_site = null
	_shell = null


func _update_site_header(definition: Dictionary) -> void:
	_site_title.text = str(definition.get("display_name", "Worksite"))
	var source: Dictionary = definition.get("source", {})
	var canonical := (
		"non-canonical authoring fixture"
		if bool(definition.get("test_only", false))
		else "%s · A1 cell %s" % [source.get("poi_id", ""), str(source.get("canonical_cell", []))]
	)
	_details.text = "%s  |  %s" % [canonical, str(definition.get("return_hook", ""))]


# gdlint: disable=max-returns
func _on_transition_requested(request: Dictionary) -> void:
	if (
		str(request.get("contract_id", "")) != "soh.native_poi.transition.v2"
		or int(request.get("contract_version", 0)) != 2
	):
		_feedback.text = "The doorway request was not understood."
		return
	var active_context: Dictionary = {}
	if is_instance_valid(_shell):
		active_context = _shell.get_run_phase_context()
	elif is_instance_valid(_site):
		active_context = _site.get_run_phase_context()
	for context_key: String in [
		"world_id",
		"run_id",
		"run_epoch",
		"phase_id",
		"observed_phase_projection_revision",
		"site_instance_id"
	]:
		if request.get(context_key, null) != active_context.get(context_key, null):
			_feedback.text = "The doorway request no longer matches the owner-projected run."
			return
	var destination := str(request.get("to_scene", ""))
	if str(request.get("direction", "")) == "enter" and is_instance_valid(_shell):
		if str(request.get("poi_id", "")) != _shell.get_source_id():
			_feedback.text = "This entrance does not match the selected site."
			return
		var return_anchor: Dictionary = request.get("return_anchor", {})
		var shell_cell := _shell.get_canonical_cell()
		var expected_worksite := str(_shell.definition.local_transition.worksite_scene)
		if (
			return_anchor.get("canonical_cell", []) != [shell_cell.x, shell_cell.y]
			or str(return_anchor.get("poi_id", "")) != _shell.get_source_id()
			or destination != expected_worksite
		):
			_feedback.text = "The exterior return point was rejected."
			return
		var interior_spawn: Variant = request.get("interior_spawn", Vector2.ZERO)
		_mount_worksite(destination, interior_spawn if interior_spawn is Vector2 else Vector2.ZERO)
		return
	if str(request.get("direction", "")) == "exit" and is_instance_valid(_site):
		if str(request.get("poi_id", "")) != _site.get_source_id():
			_feedback.text = "This return request does not match the active site."
			return
		var return_to: Dictionary = request.get("return_anchor", {})
		var packed_shell := load(destination) as PackedScene
		if (
			packed_shell == null
			or destination != str(return_to.get("shell_scene", ""))
			or str(return_to.get("poi_id", "")) != _site.get_source_id()
			or return_to.get("canonical_cell", []) != _site.definition.source.canonical_cell
		):
			_feedback.text = "The canonical exterior return point could not be restored."
			return
		_clear_active_scene()
		_shell = packed_shell.instantiate() as NativePoiShell
		_active_scene = _shell
		add_child(_shell)
		_shell.apply_run_phase_projection(PHASE_FIXTURE.project(_shell.definition))
		_shell.transition_requested.connect(_on_transition_requested)
		_shell.player_feedback.connect(_on_player_feedback)
		var shell_return_position := VECTOR_UTIL.from_pair(
			return_to.get("shell_local_position", [64, 108])
		)
		_probe.global_position = _shell.global_position + shell_return_position
		_camera.zoom = Vector2(2.2, 2.2)
		_update_site_header(_shell.definition)
		_feedback.text = "You are back at the exterior entrance."


func _on_intent_requested(intent: Dictionary) -> void:
	var result: Dictionary = _authority.submit_intent(intent)
	var next_projection := _authority.project_state(str(intent.get("source_id", "")))
	_site.receive_authoritative_result(str(intent.get("intent_id", "")), result, next_projection)
	print("S2 fixture authority: ", JSON.stringify({"intent": intent, "result": result}))


func _on_player_feedback(message: String) -> void:
	_feedback.text = message


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "HarnessOnlyHud"
	add_child(layer)
	var panel := ColorRect.new()
	panel.position = Vector2(10, 8)
	panel.size = Vector2(620, 66)
	panel.color = Color(0.055, 0.08, 0.075, 0.90)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(panel)
	_site_title = _label("", Vector2(20, 10), 18, Color("#f1d79a"))
	layer.add_child(_site_title)
	var harness_label := _label(
		"S2 TEST HARNESS · fixture transactions only · no live inventory/save",
		Vector2(20, 34),
		11,
		Color("#c5d4c6")
	)
	layer.add_child(harness_label)
	var bottom := ColorRect.new()
	bottom.position = Vector2(10, 308)
	bottom.size = Vector2(620, 44)
	bottom.color = Color(0.055, 0.08, 0.075, 0.90)
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(bottom)
	_feedback = _label("", Vector2(20, 312), 12, Color("#fff0c6"))
	layer.add_child(_feedback)
	var controls := _label(
		"WASD move · face mark + G work · [ / ] choose · H / Y other action · F1-F4 sites · C test cap",
		Vector2(20, 332),
		10,
		Color("#bdc8bc")
	)
	layer.add_child(controls)
	_details = _label("", Vector2(12, 80), 10, Color("#e0e6db"))
	_details.size = Vector2(616, 34)
	_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layer.add_child(_details)


func _label(text_value: String, at: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text_value
	label.position = at
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color.BLACK)
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _install_fixture_inputs() -> void:
	_add_key_action("poi_interact", KEY_G)
	_add_key_action("poi_action_0", KEY_H)
	_add_key_action("poi_action_1", KEY_Y)
	_add_key_action("poi_choice_prev", KEY_BRACKETLEFT)
	_add_key_action("poi_choice_next", KEY_BRACKETRIGHT)
	_add_key_action("poi_site_1", KEY_F1)
	_add_key_action("poi_site_2", KEY_F2)
	_add_key_action("poi_site_3", KEY_F3)
	_add_key_action("poi_site_4", KEY_F4)
	_add_key_action("poi_fixture_capability", KEY_C)


func _add_key_action(action: StringName, key: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event := InputEventKey.new()
	event.physical_keycode = key
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)
