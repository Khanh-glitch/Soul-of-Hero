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
const JOURNEY_DEFINITION_PATHS := [
	"res://data/survival/world_content/sites/south_quarry.json",
	"res://data/survival/world_content/sites/south_orchard_ruin.json",
	"res://data/survival/world_content/sites/south_crown_mill.json",
]
const SHELL_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry_overworld.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin_overworld.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill_overworld.tscn"
]
const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const JOURNEY_FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_journey_authority_fixture.gd"
)
const HERO_SCENE: PackedScene = preload("res://game/characters/knight/knight.tscn")
const BASE_VIEWPORT_SIZE := Vector2(1280.0, 720.0)

## Enabled only by the frame-driven A8 native journey test. Its owner seed is
## test-only and never writes to SaveService or the production economy.
@export var journey_test_mode := false
@export var journey_owner_projection_seed: Dictionary = {}

var _authority: PoiAuthorityFixture
var _journey_authority: PoiJourneyAuthorityFixture
var _journey_trace: Array[Dictionary] = []
var _site: NativePoiSite
var _shell: NativePoiShell
var _active_scene: Node2D
var _hero: CharacterBody2D
var _camera: Camera2D
var _site_index := 0
var _feedback_hold_seconds := 0.0
var _feedback: Label
var _site_title: Label
var _details: Label


func _ready() -> void:
	_install_fixture_inputs()
	if journey_test_mode:
		_journey_authority = JOURNEY_FIXTURE_SCRIPT.new() as PoiJourneyAuthorityFixture
		_journey_authority.configure(_load_site_definitions(), journey_owner_projection_seed)
	else:
		_authority = FIXTURE_SCRIPT.new() as PoiAuthorityFixture
		_authority.name = "S2TestAuthorityFixture"
		_authority.configure()
		add_child(_authority)
	_build_ui()
	var current_hero := HERO_SCENE.instantiate()
	_hero = current_hero as CharacterBody2D
	if _hero == null:
		push_error("The current Hero scene did not instantiate a CharacterBody2D.")
		return
	_hero.name = "CurrentHeroScene_A8ProjectionFixture"
	add_child(_hero)
	_camera = _hero.get_node_or_null("Camera") as Camera2D
	if _camera == null:
		_camera = Camera2D.new()
		_camera.name = "A8HeroCameraFallback"
		_hero.add_child(_camera)
	_camera.position_smoothing_enabled = false
	_camera.enabled = true
	_mount_site(0)
	set_process_unhandled_input(true)


func _process(delta: float) -> void:
	if _feedback_hold_seconds > 0.0:
		_feedback_hold_seconds = maxf(0.0, _feedback_hold_seconds - delta)
		return
	if is_instance_valid(_shell):
		_feedback.text = _shell.get_context_hint(_hero)
	elif is_instance_valid(_site):
		var hint := _site.get_context_hint(_hero)
		if not hint.is_empty():
			_feedback.text = hint


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("poi_interact"):
		if is_instance_valid(_shell):
			var entry_shell := _shell
			var entry_source_id := entry_shell.get_source_id()
			var entry_position := _hero.global_position
			var entry_facing := _get_actor_facing(_hero)
			var entry_context := entry_shell.get_run_phase_context()
			var entry_accepted := entry_shell.try_enter(_hero)
			if journey_test_mode:
				_record_journey_event(
					{
						"kind": "doorway_input",
						"accepted": entry_accepted,
						"poi_id": entry_source_id,
						"actor_position": entry_position,
						"actor_facing": entry_facing,
						"feedback": _feedback.text,
						"run_context": entry_context,
						"input_pressed": Input.is_action_pressed("poi_interact")
					}
				)
		elif is_instance_valid(_site):
			if _site.is_at_exit(_hero):
				_site.try_exit(_hero)
			else:
				_site.try_interact(_hero)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_action_0") and is_instance_valid(_site):
		_site.try_interact(_hero, 0)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_action_1") and is_instance_valid(_site):
		_site.try_interact(_hero, 1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_choice_prev") and is_instance_valid(_site):
		_site.cycle_choice(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_choice_next") and is_instance_valid(_site):
		_site.cycle_choice(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("poi_fixture_capability") and is_instance_valid(_site):
		if journey_test_mode:
			_feedback.text = "Owner projection is read-only in frame journeys."
			get_viewport().set_input_as_handled()
			return
		var granted: Array[String] = []
		if not _authority.has_capability("cap_salvage"):
			granted.append("cap_salvage")
		_authority.set_capabilities(granted)
		_site.set_projection(_project_state(_site.get_source_id()))
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
		_hero.global_position = (
			_shell.global_position + _shell.get_entry_position() + Vector2(0, 40)
		)
		_configure_camera(true)
		_update_site_header(_shell.definition)
		_feedback.text = "Walk through the south doorway to enter this local worksite."
		return
	_mount_worksite(SITE_SCENES[_site_index], Vector2.ZERO)


func _configure_camera(shell_mode: bool) -> void:
	if not is_instance_valid(_camera):
		return
	var viewport_size := get_viewport().get_visible_rect().size
	var scale_factor := floorf(
		minf(viewport_size.x / BASE_VIEWPORT_SIZE.x, viewport_size.y / BASE_VIEWPORT_SIZE.y)
	)
	var integer_scale := maxf(1.0, scale_factor)
	_camera.zoom = Vector2(integer_scale, integer_scale)
	_camera.position = Vector2.ZERO
	_camera.position_smoothing_enabled = false
	_camera.limit_smoothed = false
	_camera.limit_enabled = true
	_camera.limit_left = 0
	_camera.limit_top = 0
	_camera.limit_right = 128 if shell_mode else 960
	_camera.limit_bottom = 128 if shell_mode else 608
	_camera.reset_smoothing()


func _mount_worksite(scene_path: String, spawn_override: Vector2) -> void:
	_clear_active_scene()
	var packed := load(scene_path) as PackedScene
	if packed == null:
		_feedback.text = "This local worksite could not be loaded."
		return
	_site = packed.instantiate() as NativePoiSite
	_site.name = "LocalPOIWorksite_%d" % (_site_index + 1)
	_active_scene = _site
	add_child(_site)
	_site.intent_requested.connect(_on_intent_requested)
	_site.player_feedback.connect(_on_player_feedback)
	_site.transition_requested.connect(_on_transition_requested)
	_site.set_projection(_project_state(_site.get_source_id()))
	_site.apply_run_phase_projection(PHASE_FIXTURE.project(_site.definition))
	_hero.global_position = (
		spawn_override if spawn_override != Vector2.ZERO else _site.get_spawn_position()
	)
	_configure_camera(false)
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
	if bool(definition.get("test_only", false)):
		_details.text = "Non-canonical authoring fixture"
	else:
		_details.text = (
			"%s · A1 cell %s"
			% [str(source.get("poi_id", "")), str(source.get("canonical_cell", []))]
		)


func _get_actor_facing(actor: CharacterBody2D) -> Vector2:
	if actor.has_method("get_facing_direction"):
		var method_direction: Variant = actor.call("get_facing_direction")
		if method_direction is Vector2 and method_direction.length_squared() > 0.01:
			return method_direction.normalized()
	for property: Dictionary in actor.get_property_list():
		if str(property.get("name", "")) == "facing_direction":
			var property_direction: Variant = actor.get(str(property.name))
			if property_direction is Vector2 and property_direction.length_squared() > 0.01:
				return property_direction.normalized()
	if actor.velocity.length_squared() > 0.01:
		return actor.velocity.normalized()
	return Vector2.UP


# gdlint: disable=max-returns
func _on_transition_requested(request: Dictionary) -> void:
	if (
		str(request.get("contract_id", "")) != "soh.native_poi.transition.v2"
		or int(request.get("contract_version", 0)) != 2
	):
		_reject_transition("The doorway request was not understood.", request)
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
			_reject_transition(
				"The doorway request no longer matches the owner-projected run.", request
			)
			return
	var destination := str(request.get("to_scene", ""))
	if str(request.get("direction", "")) == "enter" and is_instance_valid(_shell):
		if str(request.get("poi_id", "")) != _shell.get_source_id():
			_reject_transition("This entrance does not match the selected site.", request)
			return
		var return_anchor: Dictionary = request.get("return_anchor", {})
		var shell_cell := _shell.get_canonical_cell()
		var anchor_cell := VECTOR_UTIL.from_int_pair(
			return_anchor.get("canonical_cell", []), Vector2i(-1, -1)
		)
		var expected_worksite := str(_shell.definition.local_transition.worksite_scene)
		if (
			anchor_cell != shell_cell
			or str(return_anchor.get("poi_id", "")) != _shell.get_source_id()
			or destination != expected_worksite
		):
			_reject_transition("The exterior return point was rejected.", request)
			return
		var interior_spawn: Variant = request.get("interior_spawn", Vector2.ZERO)
		if journey_test_mode:
			_record_journey_event(
				{
					"kind": "transition",
					"direction": "enter",
					"poi_id": _shell.get_source_id(),
					"from_scene": str(request.get("from_scene", "")),
					"to_scene": destination,
					"actor_local_position": request.get("actor_local_position", Vector2.ZERO),
					"actor_facing": request.get("actor_facing", Vector2.ZERO),
					"run_id": str(request.get("run_id", "")),
					"run_epoch": int(request.get("run_epoch", -1)),
					"phase_id": str(request.get("phase_id", "")),
					"observed_phase_projection_revision":
					int(request.get("observed_phase_projection_revision", -1)),
					"site_instance_id": str(request.get("site_instance_id", "")),
				}
			)
		_mount_worksite(destination, interior_spawn if interior_spawn is Vector2 else Vector2.ZERO)
		return
	if str(request.get("direction", "")) == "exit" and is_instance_valid(_site):
		if str(request.get("poi_id", "")) != _site.get_source_id():
			_reject_transition("This return request does not match the active site.", request)
			return
		var return_to: Dictionary = request.get("return_anchor", {})
		var site_cell := VECTOR_UTIL.from_int_pair(
			_site.definition.get("source", {}).get("canonical_cell", []), Vector2i(-1, -1)
		)
		var return_cell := VECTOR_UTIL.from_int_pair(
			return_to.get("canonical_cell", []), Vector2i(-1, -1)
		)
		var packed_shell := load(destination) as PackedScene
		if (
			packed_shell == null
			or destination != str(return_to.get("shell_scene", ""))
			or str(return_to.get("poi_id", "")) != _site.get_source_id()
			or return_cell != site_cell
		):
			_reject_transition(
				"The canonical exterior return point could not be restored.", request
			)
			return
		if journey_test_mode:
			_record_journey_event(
				{
					"kind": "transition",
					"direction": "exit",
					"poi_id": _site.get_source_id(),
					"from_scene": str(request.get("from_scene", "")),
					"to_scene": destination,
					"actor_local_position": request.get("actor_local_position", Vector2.ZERO),
					"actor_facing": request.get("actor_facing", Vector2.ZERO),
					"run_id": str(request.get("run_id", "")),
					"run_epoch": int(request.get("run_epoch", -1)),
					"phase_id": str(request.get("phase_id", "")),
					"observed_phase_projection_revision":
					int(request.get("observed_phase_projection_revision", -1)),
					"site_instance_id": str(request.get("site_instance_id", "")),
				}
			)
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
		_hero.global_position = _shell.global_position + shell_return_position
		_configure_camera(true)
		_update_site_header(_shell.definition)
		_feedback.text = "You are back at the exterior entrance."


func _reject_transition(reason: String, request: Dictionary) -> void:
	_feedback.text = reason
	if journey_test_mode:
		_record_journey_event(
			{
				"kind": "transition_rejected",
				"reason": reason,
				"transition_id": str(request.get("transition_id", "")),
				"direction": str(request.get("direction", "")),
				"poi_id": str(request.get("poi_id", "")),
				"request_context":
				{
					"run_id": str(request.get("run_id", "")),
					"run_epoch": int(request.get("run_epoch", -1)),
					"phase_id": str(request.get("phase_id", "")),
					"site_instance_id": str(request.get("site_instance_id", "")),
				}
			}
		)


func _on_intent_requested(intent: Dictionary) -> void:
	var source_id := str(intent.get("source_id", ""))
	var result: Dictionary = {}
	var next_projection: Dictionary = {}
	if journey_test_mode:
		result = _journey_authority.submit_intent(intent)
		next_projection = _journey_authority.project_state(source_id)
	else:
		result = _authority.submit_intent(intent)
		next_projection = _authority.project_state(source_id)
	if str(result.get("status", "")) == "committed":
		result["feedback"] = _projection_feedback(str(intent.get("action_id", "")))
	_site.receive_authoritative_result(str(intent.get("intent_id", "")), result, next_projection)
	if journey_test_mode:
		_record_journey_event(
			{
				"kind": "intent",
				"source_id": source_id,
				"action_id": str(intent.get("action_id", "")),
				"result": str(result.get("status", "")),
				"position": _hero.global_position,
				"phase_id": str(intent.get("phase_id", "")),
				"run_id": str(intent.get("run_id", "")),
				"run_epoch": int(intent.get("run_epoch", -1)),
				"observed_projection_revision": int(intent.get("observed_projection_revision", -1)),
			}
		)
	else:
		print("S2 fixture authority: ", JSON.stringify({"intent": intent, "result": result}))


func _projection_feedback(action_id: String) -> String:
	var consequence := "The owner-projected site state changed."
	match action_id:
		"brace_east_shelf":
			consequence = "The east shelf is braced; the west ramp remains blocked."
		"chock_west_ramp":
			consequence = "The west ramp is chocked; the east shelf remains blocked."
		"leave_seam_unworked":
			consequence = "You leave the unstable seam alone; the south retreat stays open."
		"clear_irrigation":
			consequence = "Water now runs through the sluice; the fixed boardwalk stays safe."
		"leave_for_safety":
			consequence = "The channel stays blocked; the south return remains open."
		"read_water_marks":
			consequence = "The flowing channel reveals the old graft marks."
		"repair_waterwheel":
			consequence = "The wheel turns and the race runs; the retreat remains open."
		"leave_wheel":
			consequence = "The wheel stays seized; the safe south return remains open."
		"observe_race":
			consequence = "The stopped race marks are visible from the dry bank."
	return "A8 projection fixture only: %s No live item, currency, or save effect." % consequence


func _record_journey_event(event: Dictionary) -> void:
	_journey_trace.append(event.duplicate(true))


func _project_state(source_id: String) -> Dictionary:
	if journey_test_mode:
		return _journey_authority.project_state(source_id)
	return _authority.project_state(source_id)


func _load_site_definitions() -> Dictionary:
	var definitions: Dictionary = {}
	for definition_path: String in JOURNEY_DEFINITION_PATHS:
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(definition_path))
		if parsed is Dictionary:
			var source_id := str(parsed.get("source", {}).get("poi_id", ""))
			if not source_id.is_empty():
				definitions[source_id] = parsed
	return definitions


func get_journey_snapshot() -> Dictionary:
	var active_kind := "none"
	var source_id := ""
	var projection: Dictionary = {}
	if is_instance_valid(_shell):
		active_kind = "shell"
		source_id = _shell.get_source_id()
	elif is_instance_valid(_site):
		active_kind = "site"
		source_id = _site.get_source_id()
		projection = _site.projection.duplicate(true)
	var actor_script_path := ""
	var actor_body_size := Vector2.ZERO
	var actor_move_speed := -1.0
	if is_instance_valid(_hero):
		var actor_script := _hero.get_script() as Script
		if actor_script != null:
			actor_script_path = actor_script.resource_path
		if _hero.get("move_speed") is float or _hero.get("move_speed") is int:
			actor_move_speed = float(_hero.get("move_speed"))
		var body_shape := _hero.get_node_or_null("BodyShape") as CollisionShape2D
		if body_shape != null and body_shape.shape is RectangleShape2D:
			actor_body_size = (body_shape.shape as RectangleShape2D).size
	return {
		"journey_mode": journey_test_mode,
		"hero_scene_path": HERO_SCENE.resource_path,
		"hero_script_path": actor_script_path,
		"hero_body_collider_size": actor_body_size,
		"hero_move_speed": actor_move_speed,
		"viewport_size": get_viewport().get_visible_rect().size,
		"camera_zoom": _camera.zoom if is_instance_valid(_camera) else Vector2.ZERO,
		"active_kind": active_kind,
		"source_id": source_id,
		"feedback": _feedback.text if is_instance_valid(_feedback) else "",
		"position": _hero.global_position if is_instance_valid(_hero) else Vector2.ZERO,
		"velocity": _hero.velocity if is_instance_valid(_hero) else Vector2.ZERO,
		"slide_collision_count":
		_hero.get_slide_collision_count() if is_instance_valid(_hero) else 0,
		"site_state": projection.get("site_state", {}).duplicate(true),
		"projection_revision": int(projection.get("projection_revision", -1)),
		"fixture_state": _journey_authority.snapshot() if journey_test_mode else {},
		"trace": _journey_trace.duplicate(true),
	}


func _on_player_feedback(message: String) -> void:
	_feedback.text = message
	_feedback_hold_seconds = 3.0


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "HarnessOnlyHud"
	add_child(layer)
	var viewport_size := get_viewport().get_visible_rect().size
	var scale_factor := floorf(
		minf(viewport_size.x / BASE_VIEWPORT_SIZE.x, viewport_size.y / BASE_VIEWPORT_SIZE.y)
	)
	var ui_scale := maxf(1.0, scale_factor)
	var panel_color := Color(0.035, 0.065, 0.055, 0.90)
	var border_color := Color("#8b9b78")
	var header := PanelContainer.new()
	header.name = "SiteIdentityCard"
	header.position = Vector2(16.0, 14.0) * ui_scale
	header.size = Vector2(630.0, 92.0) * ui_scale
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	header.add_theme_stylebox_override("panel", _panel_style(panel_color, border_color, ui_scale))
	layer.add_child(header)
	var header_content := Control.new()
	header_content.custom_minimum_size = header.size
	header.add_child(header_content)
	_site_title = _label(
		"",
		Vector2(16.0, 7.0) * ui_scale,
		int(24.0 * ui_scale),
		Color("#f3d99c"),
		Vector2(590.0, 32.0) * ui_scale
	)
	header_content.add_child(_site_title)
	var proof_text := (
		"A8 NATIVE INPUT · PROJECTION FIXTURE · NO LIVE SAVE / ECONOMY"
		if journey_test_mode
		else "A8 PREVIEW · TEST AUTHORITY · NO LIVE INVENTORY / SAVE"
	)
	var proof_label := _label(
		proof_text,
		Vector2(17.0, 40.0) * ui_scale,
		int(14.0 * ui_scale),
		Color("#c7d9c5"),
		Vector2(590.0, 20.0) * ui_scale
	)
	header_content.add_child(proof_label)
	_details = _label(
		"",
		Vector2(17.0, 63.0) * ui_scale,
		int(14.0 * ui_scale),
		Color("#e0e6db"),
		Vector2(590.0, 20.0) * ui_scale
	)
	header_content.add_child(_details)
	var footer := PanelContainer.new()
	footer.name = "ContextAndControlsCard"
	footer.position = Vector2(16.0, viewport_size.y / ui_scale - 88.0 - 14.0) * ui_scale
	footer.size = Vector2(960.0, 88.0) * ui_scale
	footer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	footer.add_theme_stylebox_override("panel", _panel_style(panel_color, border_color, ui_scale))
	layer.add_child(footer)
	var footer_content := Control.new()
	footer_content.custom_minimum_size = footer.size
	footer.add_child(footer_content)
	_feedback = _label(
		"",
		Vector2(18.0, 11.0) * ui_scale,
		int(19.0 * ui_scale),
		Color("#fff0c6"),
		Vector2(920.0, 30.0) * ui_scale
	)
	footer_content.add_child(_feedback)
	var controls_text := (
		"WASD move · G work / doorway · [ ] choose · H / Y action · F1–F3 sites"
		if journey_test_mode
		else (
			"WASD move · G work / doorway · [ ] choose · H / Y action · "
			+ "F1–F4 sites · C fixture capability"
		)
	)
	var controls := _label(
		controls_text,
		Vector2(18.0, 48.0) * ui_scale,
		int(14.0 * ui_scale),
		Color("#c7d1c5"),
		Vector2(920.0, 22.0) * ui_scale
	)
	footer_content.add_child(controls)


func _panel_style(fill: Color, outline: Color, ui_scale: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = outline
	style.set_border_width_all(maxi(1, roundi(ui_scale)))
	style.set_corner_radius_all(roundi(5.0 * ui_scale))
	style.content_margin_left = 8.0 * ui_scale
	style.content_margin_right = 8.0 * ui_scale
	style.content_margin_top = 5.0 * ui_scale
	style.content_margin_bottom = 5.0 * ui_scale
	return style


func _label(
	text_value: String, at: Vector2, font_size: int, color: Color, label_size: Vector2
) -> Label:
	var label := Label.new()
	label.text = text_value
	label.position = at
	label.size = label_size
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.8))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.clip_text = true
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
