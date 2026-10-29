extends Control

## SkillReadinessLab — isolated Godot 4.7 harness for the Gold-93 library.
##
## Search any of the 93 canonical ids, cast it with diagnostic parameters
## (visibly marked TEST_ONLY), aim freely in 360 degrees with click / hold /
## drag-release, step or run the ORIGINAL fixed source clock, cancel, replay and
## inspect emitted intents, ground layer writes and RNG state.
##
## The lab never touches `game/**`, `data/**`, `assets/**` or any production
## save. Everything it creates lives under this node and is freed on exit.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const INTENTS = preload("res://prototypes/skill_readiness/core/gold93_intents.gd")

const SOURCE_SEED: int = 20261028

@onready var _selector: OptionButton = %SkillSelector
@onready var _status: RichTextLabel = %StatusLabel
@onready var _stage: Node2D = %Stage

var runtime
var _handle = null
var _context: Gold93CastContext = null
var _caster: Node2D = null
var _drag_points: PackedVector2Array = PackedVector2Array()
var _dragging: bool = false
var _families_attached: Dictionary = {}


func _ready() -> void:
	runtime = RUNTIME.new()
	_caster = Node2D.new()
	_caster.name = "LabCaster"
	_stage.add_child(_caster)
	_populate_selector()
	_refresh_status()


func _populate_selector() -> void:
	_selector.clear()
	for id in runtime.catalog.ids():
		var entry: Dictionary = runtime.catalog.skill(id)
		var native_tag: String = "NATIVE" if runtime.can_cast(id) else "BLOCKED"
		_selector.add_item("%s [%s] %s" % [
			id, native_tag, String(entry.get("original_name", "")),
		])
		_selector.set_item_metadata(_selector.item_count - 1, id)


func _selected_id() -> String:
	var idx: int = _selector.selected
	if idx < 0:
		return ""
	return String(_selector.get_item_metadata(idx))


## --- casting -------------------------------------------------------------------

func _ensure_family(family: String):
	if _families_attached.has(family):
		return _families_attached[family]
	var family_runtime = runtime.family_runtime(family)
	if family_runtime == null:
		return null
	family_runtime.attach(_stage, family_runtime.default_density())
	family_runtime.set_source_to_map_transform(Transform2D.IDENTITY)
	_families_attached[family] = family_runtime
	return family_runtime


func cast_selected() -> void:
	_release_handle()
	var id := _selected_id()
	if id.is_empty():
		return
	var entry: Dictionary = runtime.catalog.skill(id)
	var family := String(entry.get("family", ""))
	_ensure_family(family)
	_context = CONTEXT.new()
	_context.initialize(_caster, Vector2(200.0, 170.0), SOURCE_SEED, true)
	_context.set_source_to_world(Transform2D.IDENTITY)
	_context.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors([
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 420.0, "y": 215.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 295.0, "y": 115.0, "r": 6.0, "exists": true, "dying": 0.0},
	])
	_context.set_ports(bundle)
	_handle = runtime.cast(StringName(id), _context, PARAMS.diagnostic(family))
	_handle.start()
	_refresh_status()


func _on_skill_selected(_index: int) -> void:
	_release_handle()
	_refresh_status()


## Selects a canonical id through the same OptionButton the player uses.
## Returns false if the id is not in the catalog. Used by the headless Lab tests.
func select_id(id: String) -> bool:
	for i in range(_selector.item_count):
		if String(_selector.get_item_metadata(i)) == id:
			_selector.select(i)
			_release_handle()
			_refresh_status()
			return true
	return false


## The handle the Lab currently drives (null when idle). Read-only for tests.
func current_handle():
	return _handle


func step_ticks(count: int) -> void:
	if _handle == null:
		return
	_handle.tick_source(count)
	_refresh_status()


func run_to_end() -> void:
	if _handle == null:
		return
	_handle.run_to_completion(4096)
	_refresh_status()


func cancel_cast() -> void:
	if _handle == null:
		return
	_handle.cancel()
	_refresh_status()


func release_all() -> void:
	_release_handle()
	for family in _families_attached.keys():
		var f = _families_attached[family]
		if f != null:
			f.detach()
	_families_attached.clear()
	_refresh_status()


func _release_handle() -> void:
	if _handle != null:
		_handle.dispose()
		_handle = null


## --- free 360-degree input -------------------------------------------------------

func _gui_input(event: InputEvent) -> void:
	if _handle == null or _context == null:
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_dragging = true
				_drag_points = PackedVector2Array([mb.position])
			else:
				_dragging = false
				if _drag_points.size() >= 2:
					_handle.set_drag_path(_drag_points)
				else:
					_handle.update_aim(mb.position)
				_refresh_status()
	elif event is InputEventMouseMotion and _dragging:
		var mm := event as InputEventMouseMotion
		_drag_points.append(mm.position)
		_handle.update_aim(mm.position)


## --- status ----------------------------------------------------------------------

func _refresh_status() -> void:
	if _status == null:
		return
	var id := _selected_id()
	var lines: Array[String] = []
	if id.is_empty():
		_status.text = "No skill selected."
		return
	var entry: Dictionary = runtime.catalog.skill(id)
	lines.append("[b]%s[/b] — %s (%s)" % [
		id, String(entry.get("original_name", "")), String(entry.get("source_variant", "")),
	])
	lines.append("family=%s  target=%s  maturity=%s" % [
		String(entry.get("family", "")),
		String(entry.get("source_target_class", "")),
		runtime.catalog.maturity(id),
	])
	var controls: Dictionary = runtime.catalog.supported_controls(id)
	lines.append("controls: %s" % _format_controls(controls))
	if runtime.can_cast(id):
		lines.append("[color=#7CFC7C]native module: %s[/color]" % runtime.module_path_for(id))
	else:
		lines.append("[color=#FF8080]BLOCKED: %s[/color]" % runtime.catalog.blocker(id))
	if _handle != null:
		var r: Dictionary = _handle.result()
		lines.append("")
		lines.append("status=%s  source_tick=%d  cast_id=%s" % [
			String(r.get("status", "")), int(r.get("source_tick", 0)),
			String(r.get("cast_id", "")),
		])
		var mod: Dictionary = r.get("module", {})
		lines.append("bites=%d  acid=%d  terrain_ops=%d  pools=%d  particles=%d" % [
			int(mod.get("bites", 0)), int(mod.get("acid_candidates", 0)),
			int(mod.get("terrain_ops", 0)), int(mod.get("active_pools", 0)),
			int(mod.get("source_particles", 0)),
		])
		lines.append("intents=%s" % str(r.get("intents", {})))
		lines.append("terrain=%s" % str(r.get("terrain", {})))
		lines.append("combat=%s" % str(r.get("combat", {})))
		var p: Dictionary = r.get("parameters", {})
		lines.append("[color=#FFD479]parameters: %s (lab_only=%s)[/color]" % [
			String(p.get("provenance", "")), str(p.get("lab_only", true)),
		])
		lines.append("trace_digest=%s" % _handle.trace_digest().substr(0, 32))
	_status.text = "\n".join(lines)


func _format_controls(controls: Dictionary) -> String:
	var on: Array[String] = []
	for key in controls.keys():
		if bool(controls[key]):
			on.append(String(key))
	return ", ".join(on)


## --- headless probe used by CI ---------------------------------------------------

## Walks all 93 ids through the lab API without a display: proves the catalog,
## the control envelope and the fail-closed behaviour are all reachable.
static func headless_probe() -> Dictionary:
	var runtime = RUNTIME.new()
	var rows: Array = []
	var native: int = 0
	var blocked: int = 0
	for id in runtime.catalog.ids():
		var entry: Dictionary = runtime.catalog.skill(id)
		var row: Dictionary = {
			"key": id,
			"family": String(entry.get("family", "")),
			"original_name": String(entry.get("original_name", "")),
			"maturity": runtime.catalog.maturity(id),
			"controls": runtime.catalog.supported_controls(id),
			"dependency_count": runtime.catalog.dependency_graph(id).size(),
		}
		if runtime.can_cast(id):
			native += 1
		else:
			blocked += 1
			row["blocker"] = runtime.catalog.blocker(id)
		rows.append(row)
	return {
		"scope": runtime.catalog.ids().size(),
		"native": native,
		"blocked": blocked,
		"rows": rows,
	}


func _exit_tree() -> void:
	release_all()
