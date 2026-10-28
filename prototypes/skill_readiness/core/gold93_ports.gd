class_name Gold93Ports
extends RefCounted

## Dependency-injection seams between native Gold VFX and any host scene.
##
## Default implementations are NO-OP and read-only: a native cast must run to
## completion in the isolated laboratory without a real hero, real enemies, a
## real map or an audio bus. Production behaviour is opted in by injecting a
## different port, never by the VFX reaching into the game.

## ---------------------------------------------------------------------------
## Combat: the single authority for health mutation.
## ---------------------------------------------------------------------------
class CombatPort extends RefCounted:
	func is_alive(_target_key: String) -> bool:
		return false

	## Must return false when gameplay rules are unconfigured. A VFX module may
	## never invent damage.
	func is_configured() -> bool:
		return false

	func apply_damage(_target_key: String, _amount: float, _hit_world: Vector2,
			_cue: StringName, _intent: Dictionary) -> bool:
		return false

	func apply_status(_target_key: String, _status_id: StringName,
			_duration: float, _magnitude: float, _intent: Dictionary) -> bool:
		return false

	func stats() -> Dictionary:
		return {"applied": 0, "rejected": 0, "configured": is_configured()}


## Records every admitted hit without touching any game system. Used by the LAB
## and by CI to prove once-only hit admission and zero HP mutation.
class RecordingCombatPort extends CombatPort:
	var applied: Array[Dictionary] = []
	var rejected: int = 0
	var duplicates: int = 0
	var configured: bool = false
	var alive_keys: Dictionary = {}
	var _admitted: Dictionary = {}

	func set_alive(target_key: String, alive: bool = true) -> void:
		alive_keys[target_key] = alive

	func is_alive(target_key: String) -> bool:
		return bool(alive_keys.get(target_key, false))

	func is_configured() -> bool:
		return configured

	## Defence in depth: even if a host calls the port twice with the same
	## source hit, the once-only identity stops a second application. The bus is
	## the primary gate; this makes the guarantee hold at the authority itself.
	func _once(kind: StringName, target_key: String, intent: Dictionary) -> bool:
		var cast_id := StringName(intent.get("cast_id", &""))
		var cursor: int = int(intent.get("source_cursor", -1))
		var identity := Gold93Intents.hit_identity(cast_id, kind, cursor, target_key)
		if _admitted.has(identity):
			duplicates += 1
			return false
		_admitted[identity] = true
		return true

	func apply_damage(target_key: String, amount: float, hit_world: Vector2,
			cue: StringName, intent: Dictionary) -> bool:
		if not configured:
			rejected += 1
			return false
		if not is_alive(target_key):
			rejected += 1
			return false
		if not _once(&"damage", target_key, intent):
			rejected += 1
			return false
		applied.append({
			"target_key": target_key,
			"amount": amount,
			"hit_world": hit_world,
			"cue": String(cue),
			"source_cursor": int(intent.get("source_cursor", -1)),
			"source_tick": int(intent.get("source_tick", -1)),
		})
		return true

	func apply_status(target_key: String, status_id: StringName, duration: float,
			magnitude: float, intent: Dictionary) -> bool:
		if not configured or not is_alive(target_key):
			rejected += 1
			return false
		if not _once(StringName("status:" + String(status_id)), target_key, intent):
			rejected += 1
			return false
		applied.append({
			"target_key": target_key,
			"status_id": String(status_id),
			"duration": duration,
			"magnitude": magnitude,
			"source_cursor": int(intent.get("source_cursor", -1)),
			"source_tick": int(intent.get("source_tick", -1)),
		})
		return true

	func stats() -> Dictionary:
		return {
			"applied": applied.size(),
			"rejected": rejected,
			"duplicates_blocked": duplicates,
			"configured": configured,
		}


## ---------------------------------------------------------------------------
## Terrain: read-only occupancy sampling + cosmetic ground writes.
## ---------------------------------------------------------------------------
class TerrainPort extends RefCounted:
	## true when the sampled source-space point is solid/occupied in the host map.
	func is_solid(_source_pos: Vector2) -> bool:
		return false

	## Cosmetic-only ground mark. Implementations must not alter TileMap
	## collision unless the original Gold authored a real collision change.
	func write_visual(_source_pos: Vector2, _op: StringName, _payload: Dictionary) -> bool:
		return false

	func clear_visuals(_owner_id: StringName) -> int:
		return 0

	## Must be true before any collision-affecting operation is allowed.
	func can_mutate_collision() -> bool:
		return false

	func stats() -> Dictionary:
		return {"writes": 0, "cleared": 0, "collision_mutations": 0}


class RecordingTerrainPort extends TerrainPort:
	var writes: Array[Dictionary] = []
	var cleared: int = 0
	var collision_mutations: int = 0
	var solid_rects: Array[Rect2] = []

	func mark_solid(rect: Rect2) -> void:
		solid_rects.append(rect)

	func is_solid(source_pos: Vector2) -> bool:
		for r in solid_rects:
			if (r as Rect2).has_point(source_pos):
				return true
		return false

	func write_visual(source_pos: Vector2, op: StringName, payload: Dictionary) -> bool:
		writes.append({
			"source_pos": source_pos,
			"op": String(op),
			"payload": payload.duplicate(true),
		})
		return true

	func clear_visuals(_owner_id: StringName) -> int:
		var n: int = writes.size()
		writes.clear()
		cleared += n
		return n

	func stats() -> Dictionary:
		return {
			"writes": writes.size(),
			"cleared": cleared,
			"collision_mutations": collision_mutations,
		}


## ---------------------------------------------------------------------------
## Sound / camera / resource-sink ports.
## ---------------------------------------------------------------------------
class SoundPort extends RefCounted:
	func play(_cue_id: StringName, _source_pos: Vector2, _payload: Dictionary) -> bool:
		return false

	func stop_all(_owner_id: StringName) -> int:
		return 0

	func stats() -> Dictionary:
		return {"played": 0}


class RecordingSoundPort extends SoundPort:
	var played: Array[Dictionary] = []
	var stopped: int = 0

	func play(cue_id: StringName, source_pos: Vector2, payload: Dictionary) -> bool:
		played.append({
			"cue_id": String(cue_id),
			"source_pos": source_pos,
			"payload": payload.duplicate(true),
		})
		return true

	func stop_all(_owner_id: StringName) -> int:
		var n: int = played.size()
		played.clear()
		stopped += n
		return n

	func stats() -> Dictionary:
		return {"played": played.size(), "stopped": stopped}


class CameraPort extends RefCounted:
	func apply(_op: StringName, _strength: float, _duration: float,
			_payload: Dictionary) -> bool:
		return false

	func stats() -> Dictionary:
		return {"ops": 0}


class RecordingCameraPort extends CameraPort:
	var ops: Array[Dictionary] = []

	func apply(op: StringName, strength: float, duration: float,
			payload: Dictionary) -> bool:
		ops.append({
			"op": String(op),
			"strength": strength,
			"duration": duration,
			"payload": payload.duplicate(true),
		})
		return true

	func stats() -> Dictionary:
		return {"ops": ops.size()}


## ---------------------------------------------------------------------------
## Target resolution: maps live host actors into the source-space actor list.
## ---------------------------------------------------------------------------
class TargetResolver extends RefCounted:
	## Hosts feed live actors in ORIGINAL source actor shape:
	##   {id:int, x:float, y:float, r:float, exists:bool, dying:float}
	var actors: Array[Dictionary] = []
	var key_prefix: String = "source"

	func set_actors(rows: Array) -> void:
		actors.clear()
		for row in rows:
			if not row is Dictionary:
				continue
			var copy: Dictionary = (row as Dictionary).duplicate(true)
			copy["exists"] = bool(copy.get("exists", true))
			copy["dying"] = float(copy.get("dying", 0.0))
			copy["id"] = int(copy.get("id", 0))
			copy["x"] = float(copy.get("x", 0.0))
			copy["y"] = float(copy.get("y", 0.0))
			copy["r"] = float(copy.get("r", 6.0))
			actors.append(copy)

	func resolve(_source_to_world: Transform2D, _caster_source: Vector2) -> Array:
		return actors.duplicate(true)

	func target_key_for(source_id: int) -> String:
		return "%s:%d" % [key_prefix, source_id]


## Laboratory resolver: synthetic deterministic actors, no production actors.
class LabTargetResolver extends TargetResolver:
	## Synthetic deterministic actors for the isolated laboratory.
	func _init() -> void:
		key_prefix = "lab"


## ---------------------------------------------------------------------------
## Ready-made port bundle.
## ---------------------------------------------------------------------------
class Bundle extends RefCounted:
	# Untyped on purpose: hosts inject their own subclasses and the bundle is
	# consumed dynamically, so static typing here would reject valid ports.
	var combat
	var terrain
	var sound
	var camera
	var targets

	func _init(recording: bool = true) -> void:
		if recording:
			combat = RecordingCombatPort.new()
			terrain = RecordingTerrainPort.new()
			sound = RecordingSoundPort.new()
			camera = RecordingCameraPort.new()
		else:
			combat = CombatPort.new()
			terrain = TerrainPort.new()
			sound = SoundPort.new()
			camera = CameraPort.new()
		targets = LabTargetResolver.new()

	func stats() -> Dictionary:
		return {
			"combat": combat.stats(),
			"terrain": terrain.stats(),
			"sound": sound.stats(),
			"camera": camera.stats(),
		}
