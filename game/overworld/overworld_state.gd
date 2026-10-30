class_name OverworldState
extends RefCounted
## Persistent state for the Hollow Marches.
##
## Everything here is a *resume* concern: where the player stood, which camps
## are lit, which ruins they have found, which shortcuts they have opened and how
## many provisions they carry. It is written through
## `SaveService.patch_state_path`, which overwrites one subtree and appends no
## transaction receipt — a walking player would otherwise append a receipt every
## time they crossed a valley.
##
## One-shot entitlements (a discovery's reward) do NOT live here: they go
## through `transact_once` so they can never be granted twice. That split is the
## whole reason this class stays small.

signal provisions_changed(current: int, maximum: int)
signal discovery_found(discovery_id: StringName)
signal shortcut_opened(shortcut_id: StringName)
signal camp_activated(camp_id: StringName)
signal state_saved(ok: bool)

const STATE_ROOT := "overworld"
const STATE_KEY := "hollow_marches"
const SCHEMA_VERSION := 2
## Position is written at most this often while walking.
const POSITION_SAVE_INTERVAL_SECONDS := 3.0
## A save failure is retried, but never more aggressively than this.
const RETRY_SECONDS := 1.5

var provisions: int = 80
var max_provisions: int = 100
var last_camp_id: StringName = &"camp_refuge"
var last_position: Vector2 = Vector2.ZERO
var discoveries: Dictionary = {}
var shortcuts: Dictionary = {}
var camps: Dictionary = {}
var last_level_id: StringName = &""

var _world: Dictionary = {}
var _dirty := false
var _seconds_since_position_save := 0.0
var _retry_timer := 0.0
var _provision_accumulator := 0.0
var _save_service: Node
var _last_error := ""


func configure(world_data: Dictionary, spawn: Vector2, spawn_camp: StringName, save_service: Node) -> void:
	_world = world_data
	_save_service = save_service
	var survival: Dictionary = _world.get("survival", {})
	max_provisions = maxi(1, int(survival.get("max", 100)))
	provisions = clampi(int(survival.get("start", 80)), 0, max_provisions)
	last_position = spawn
	last_camp_id = spawn_camp
	camps[String(spawn_camp)] = true
	_load()


func snapshot() -> Dictionary:
	return {
		"schema": SCHEMA_VERSION,
		"provisions": provisions,
		"max_provisions": max_provisions,
		"last_camp": String(last_camp_id),
		"last_position": [last_position.x, last_position.y],
		"discoveries": discoveries.duplicate(true),
		"shortcuts": shortcuts.duplicate(true),
		"camps": camps.duplicate(true),
		"last_level": String(last_level_id),
	}


func is_dirty() -> bool:
	return _dirty


func last_error() -> String:
	return _last_error


# ---------------------------------------------------------------------------
# load / save
# ---------------------------------------------------------------------------
func _load() -> void:
	if _save_service == null or not _save_service.has_method(&"get_value"):
		return
	# SaveService.get_value takes a typed Array[String]; an untyped literal is a
	# runtime type error, not a coercion.
	var path: Array[String] = [STATE_ROOT, STATE_KEY]
	var raw: Variant = _save_service.call(&"get_value", path, {})
	if not raw is Dictionary:
		return
	var doc: Dictionary = raw
	# A newer schema is not silently reinterpreted; the player keeps their
	# defaults for anything this build cannot read.
	if int(doc.get("schema", 0)) > SCHEMA_VERSION:
		return
	if doc.has("provisions"):
		provisions = clampi(int(doc.get("provisions", provisions)), 0, max_provisions)
	if doc.has("max_provisions"):
		max_provisions = maxi(1, int(doc.get("max_provisions", max_provisions)))
	if doc.has("last_camp"):
		var camp := StringName(doc.get("last_camp", ""))
		if not String(camp).is_empty():
			last_camp_id = camp
	var pos: Variant = doc.get("last_position", [])
	if pos is Array and (pos as Array).size() >= 2:
		var candidate := Vector2(float(pos[0]), float(pos[1]))
		if candidate != Vector2.ZERO:
			last_position = candidate
	var loaded_level := String(doc.get("last_level", ""))
	if not loaded_level.is_empty():
		last_level_id = StringName(loaded_level)
	if doc.get("discoveries") is Dictionary:
		discoveries = (doc.get("discoveries", {}) as Dictionary).duplicate(true)
	if doc.get("shortcuts") is Dictionary:
		shortcuts = (doc.get("shortcuts", {}) as Dictionary).duplicate(true)
	if doc.get("camps") is Dictionary:
		camps = (doc.get("camps", {}) as Dictionary).duplicate(true)


## Persist now. Returns false when the write failed, in which case the dirty
## flag stays set so the next tick retries instead of dropping the change.
func save_now() -> bool:
	if _save_service == null or not _save_service.has_method(&"patch_state_path"):
		_last_error = "SaveService is unavailable."
		return false
	var path: Array[String] = [STATE_ROOT, STATE_KEY]
	var ok := bool(_save_service.call(&"patch_state_path", path, snapshot()))
	if ok:
		_dirty = false
		_seconds_since_position_save = 0.0
		_retry_timer = 0.0
		_last_error = ""
	else:
		_last_error = "SaveService rejected the overworld snapshot."
		_retry_timer = RETRY_SECONDS
	state_saved.emit(ok)
	return ok


func mark_dirty() -> void:
	_dirty = true


## Called every frame by the controller (never by _process, so tests can drive
## time deterministically).
func tick(delta: float, hazard: bool, safe: bool) -> void:
	_drain(delta, hazard, safe)
	if not _dirty:
		return
	_seconds_since_position_save += delta
	if _retry_timer > 0.0:
		_retry_timer -= delta
		if _retry_timer > 0.0:
			return
	if _seconds_since_position_save < POSITION_SAVE_INTERVAL_SECONDS:
		return
	save_now()


# ---------------------------------------------------------------------------
# position / provisions
# ---------------------------------------------------------------------------
func set_world_position(position: Vector2, force_save := false) -> void:
	if last_position.distance_to(position) < 24.0 and not force_save:
		return
	last_position = position
	_dirty = true
	if force_save:
		save_now()


func _drain(delta: float, hazard: bool, safe: bool) -> void:
	if max_provisions <= 0:
		return
	var survival: Dictionary = _world.get("survival", {})
	var rate := float(survival.get("drain_per_second_wild", 0.2))
	if safe:
		rate = float(survival.get("drain_per_second_safe", 0.0))
	elif hazard:
		rate = float(survival.get("drain_per_second_hazard", 0.75))
	if rate <= 0.0:
		return
	_provision_accumulator += rate * delta
	var consumed := int(floor(_provision_accumulator))
	if consumed <= 0:
		return
	_provision_accumulator -= float(consumed)
	var before := provisions
	provisions = maxi(0, provisions - consumed)
	if provisions != before:
		_dirty = true
		provisions_changed.emit(provisions, max_provisions)


func restore_provisions(amount: int) -> void:
	var before := provisions
	provisions = clampi(provisions + amount, 0, max_provisions)
	if provisions != before:
		_dirty = true
		provisions_changed.emit(provisions, max_provisions)


func is_empty() -> bool:
	return provisions <= 0


# ---------------------------------------------------------------------------
# camps / discoveries / shortcuts
# ---------------------------------------------------------------------------
func activate_camp(camp_id: StringName, position: Vector2) -> bool:
	var key := String(camp_id)
	var first_time := not bool(camps.get(key, false))
	camps[key] = true
	last_camp_id = camp_id
	last_position = position
	_provision_accumulator = 0.0
	var survival: Dictionary = _world.get("survival", {})
	restore_provisions(int(survival.get("camp_restore", 60)))
	_dirty = true
	# A camp is an anchor: committing immediately means a crash never loses it.
	save_now()
	if first_time:
		camp_activated.emit(camp_id)
	return first_time


func is_camp_visited(camp_id: StringName) -> bool:
	return bool(camps.get(String(camp_id), false))


func collect_discovery(discovery_id: StringName) -> Dictionary:
	var key := String(discovery_id)
	if bool(discoveries.get(key, false)):
		return {}
	var entry := _discovery_entry(key)
	if entry.is_empty():
		return {}
	discoveries[key] = true
	var reward: Dictionary = (entry.get("reward", {}) as Dictionary).duplicate(true)
	var survival: Dictionary = _world.get("survival", {})
	if reward.has("restore"):
		var ratio := float(reward.get("restore", 0.0))
		restore_provisions(int(round(float(max_provisions) * ratio)))
	else:
		restore_provisions(int(survival.get("discovery_restore", 20)))
	_dirty = true
	save_now()
	discovery_found.emit(discovery_id)
	return reward


func is_discovery_found(discovery_id: StringName) -> bool:
	return bool(discoveries.get(String(discovery_id), false))


func open_shortcut(shortcut_id: StringName) -> bool:
	var key := String(shortcut_id)
	if bool(shortcuts.get(key, false)):
		return false
	shortcuts[key] = true
	_dirty = true
	save_now()
	shortcut_opened.emit(shortcut_id)
	return true


## A shortcut counts as open when it was opened in this profile *or* when the
## level that grants it is already cleared on this profile. The second rule is
## what makes a save that predates the overworld still accept its rewards.
func is_shortcut_open(shortcut_id: StringName, app_flow: Node) -> bool:
	var key := String(shortcut_id)
	if bool(shortcuts.get(key, false)):
		return true
	var entry := _shortcut_entry(key)
	if entry.is_empty():
		return false
	var granted_by := StringName(entry.get("granted_by", ""))
	if String(granted_by).is_empty() or app_flow == null:
		return false
	if not app_flow.has_method(&"is_campaign_level_completed"):
		return false
	return bool(app_flow.call(&"is_campaign_level_completed", granted_by))


func record_level_entry(level_id: StringName) -> void:
	last_level_id = level_id
	_dirty = true
	save_now()


func record_level_return(level_id: StringName, position: Vector2) -> void:
	last_level_id = level_id
	last_position = position
	_dirty = true
	save_now()


func discover_all_relief() -> int:
	return discoveries.size()


func _discovery_entry(key: String) -> Dictionary:
	for entry: Dictionary in _world.get("discoveries", []):
		if String(entry.get("id", "")) == key:
			return entry
	return {}


func _shortcut_entry(key: String) -> Dictionary:
	for entry: Dictionary in _world.get("shortcuts", []):
		if String(entry.get("id", "")) == key:
			return entry
	return {}
