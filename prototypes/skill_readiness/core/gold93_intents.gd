class_name Gold93Intents
extends RefCounted

## Typed, engine-neutral output vocabulary emitted by native Gold casts.
##
## A native skill never mutates the game directly. It publishes intents; the
## injected ports (CombatDamagePort, TerrainPort, SoundPort, CameraPort, ...)
## decide what an intent means for the host scene. That keeps VFX cosmetic by
## construction and lets the overworld adopt the library later without edits.

const KIND_DAMAGE: StringName = &"DamageIntent"
const KIND_STATUS: StringName = &"StatusIntent"
const KIND_PROJECTILE: StringName = &"ProjectileIntent"
const KIND_SPAWN: StringName = &"SpawnIntent"
const KIND_ENEMY_VISUAL: StringName = &"EnemyVisualIntent"
const KIND_TERRAIN_VISUAL: StringName = &"TerrainVisualIntent"
const KIND_COLLISION: StringName = &"CollisionIntent"
const KIND_SOUND: StringName = &"SoundIntent"
const KIND_CAMERA: StringName = &"CameraIntent"

const ALL_KINDS: Array[StringName] = [
	KIND_DAMAGE,
	KIND_STATUS,
	KIND_PROJECTILE,
	KIND_SPAWN,
	KIND_ENEMY_VISUAL,
	KIND_TERRAIN_VISUAL,
	KIND_COLLISION,
	KIND_SOUND,
	KIND_CAMERA,
]


static func _base(kind: StringName, cast_id: StringName, source_tick: int,
		source_cursor: int) -> Dictionary:
	return {
		"kind": kind,
		"cast_id": cast_id,
		"source_tick": source_tick,
		"source_cursor": source_cursor,
		"source_to_world": Transform2D.IDENTITY,
	}


## Hit intent. `amount` is the ORIGINAL source value only; the port alone
## decides whether it reaches CombatDamage, and only with a user config.
static func damage(cast_id: StringName, source_tick: int, source_cursor: int,
		target_key: String, amount: float, source_pos: Vector2,
		source_to_world: Transform2D, cue: StringName = &"",
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_DAMAGE, cast_id, source_tick, source_cursor)
	i["target_key"] = target_key
	i["amount"] = amount
	i["source_pos"] = source_pos
	i["source_to_world"] = source_to_world
	i["cue"] = cue
	i["extra"] = extra.duplicate(true)
	return i


static func status(cast_id: StringName, source_tick: int, source_cursor: int,
		target_key: String, status_id: StringName, duration: float,
		magnitude: float = 0.0, extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_STATUS, cast_id, source_tick, source_cursor)
	i["target_key"] = target_key
	i["status_id"] = status_id
	i["duration"] = duration
	i["magnitude"] = magnitude
	i["extra"] = extra.duplicate(true)
	return i


static func projectile(cast_id: StringName, source_tick: int, source_cursor: int,
		source_from: Vector2, source_to: Vector2, kind: StringName,
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_PROJECTILE, cast_id, source_tick, source_cursor)
	i["source_from"] = source_from
	i["source_to"] = source_to
	i["projectile_kind"] = kind
	i["extra"] = extra.duplicate(true)
	return i


static func spawn(cast_id: StringName, source_tick: int, source_cursor: int,
		source_pos: Vector2, spawn_kind: StringName,
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_SPAWN, cast_id, source_tick, source_cursor)
	i["source_pos"] = source_pos
	i["spawn_kind"] = spawn_kind
	i["extra"] = extra.duplicate(true)
	return i


static func enemy_visual(cast_id: StringName, source_tick: int, source_cursor: int,
		target_key: String, visual_id: StringName, attach: StringName = &"body",
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_ENEMY_VISUAL, cast_id, source_tick, source_cursor)
	i["target_key"] = target_key
	i["visual_id"] = visual_id
	i["attach"] = attach
	i["extra"] = extra.duplicate(true)
	return i


## Cosmetic ground change. Never a collision or TileMap mutation unless the
## host TerrainPort explicitly proves the original Gold authored one.
static func terrain_visual(cast_id: StringName, source_tick: int,
		source_cursor: int, source_pos: Vector2, op: StringName,
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_TERRAIN_VISUAL, cast_id, source_tick, source_cursor)
	i["source_pos"] = source_pos
	i["op"] = op
	i["extra"] = extra.duplicate(true)
	return i


static func collision(cast_id: StringName, source_tick: int, source_cursor: int,
		source_pos: Vector2, radius: float, mask: StringName = &"ground",
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_COLLISION, cast_id, source_tick, source_cursor)
	i["source_pos"] = source_pos
	i["radius"] = radius
	i["mask"] = mask
	i["extra"] = extra.duplicate(true)
	return i


static func sound(cast_id: StringName, source_tick: int, source_cursor: int,
		cue_id: StringName, source_pos: Vector2 = Vector2.ZERO,
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_SOUND, cast_id, source_tick, source_cursor)
	i["cue_id"] = cue_id
	i["source_pos"] = source_pos
	i["extra"] = extra.duplicate(true)
	return i


static func camera(cast_id: StringName, source_tick: int, source_cursor: int,
		op: StringName, strength: float = 0.0, duration: float = 0.0,
		extra: Dictionary = {}) -> Dictionary:
	var i := _base(KIND_CAMERA, cast_id, source_tick, source_cursor)
	i["op"] = op
	i["strength"] = strength
	i["duration"] = duration
	i["extra"] = extra.duplicate(true)
	return i


static func hit_identity(cast_id: StringName, kind: StringName, source_cursor: int,
		target_key: String) -> StringName:
	## Stable, once-only identity for a hit so overlapping pools, repeated cues
	## and replayed casts can never apply the same source hit twice.
	return StringName("%s|%s|%d|%s" % [cast_id, kind, source_cursor, target_key])


## ---------------------------------------------------------------------------
## Bus: collects emitted intents per cast, enforces once-only hit admission and
## keeps a deterministic, hashable trace for replay/regression evidence.
## ---------------------------------------------------------------------------

class Bus extends RefCounted:
	var cast_id: StringName = &""
	var emitted: Array[Dictionary] = []
	var _admitted: Dictionary = {}
	var admitted_hits: Array[StringName] = []
	var rejected_duplicates: int = 0

	func _init(id: StringName) -> void:
		cast_id = id

	func emit(intent: Dictionary) -> Dictionary:
		emitted.append(intent)
		return intent

	## Returns true only the first time a given source hit identity is admitted.
	func admit_hit(kind: StringName, source_cursor: int, target_key: String) -> bool:
		var identity := Gold93Intents.hit_identity(cast_id, kind, source_cursor,
				target_key)
		if _admitted.has(identity):
			rejected_duplicates += 1
			return false
		_admitted[identity] = true
		admitted_hits.append(identity)
		return true

	func by_kind(kind: StringName) -> Array[Dictionary]:
		var out: Array[Dictionary] = []
		for i in emitted:
			if StringName(i.get("kind", &"")) == kind:
				out.append(i)
		return out

	## Order-sensitive digest of the whole cast trace; identical for a replay
	## with the same seed, same aim and same target movement.
	func trace_digest() -> String:
		var ctx := HashingContext.new()
		ctx.start(HashingContext.HASH_SHA256)
		for i in emitted:
			var kind := String(i.get("kind", ""))
			var cursor := int(i.get("source_cursor", 0))
			var tick := int(i.get("source_tick", 0))
			var target_key := String(i.get("target_key", ""))
			var line := "%s|%d|%d|%s|%s" % [
				kind, tick, cursor, target_key,
				_stringify_sorted(i.get("extra", {})),
			]
			ctx.update(line.to_utf8_buffer())
		return ctx.finish().hex_encode()

	static func _stringify_sorted(d: Dictionary) -> String:
		var keys: Array = d.keys()
		keys.sort()
		var parts := PackedStringArray()
		for k in keys:
			parts.append("%s=%s" % [str(k), _num(d[k])])
		return ",".join(parts)

	static func _num(v: Variant) -> String:
		if v is Vector2:
			var p := v as Vector2
			return "(%.6f,%.6f)" % [p.x, p.y]
		if v is Transform2D:
			var t := v as Transform2D
			return "[%.6f,%.6f,%.6f,%.6f,%.6f,%.6f]" % [
				t.x.x, t.x.y, t.y.x, t.y.y, t.origin.x, t.origin.y,
			]
		if typeof(v) == TYPE_FLOAT:
			return "%.6f" % float(v)
		return str(v)

	func stats() -> Dictionary:
		var counts: Dictionary = {}
		for kind in Gold93Intents.ALL_KINDS:
			counts[String(kind)] = 0
		for i in emitted:
			var k := String(i.get("kind", ""))
			counts[k] = int(counts.get(k, 0)) + 1
		return {
			"cast_id": String(cast_id),
			"emitted": emitted.size(),
			"by_kind": counts,
			"admitted_hits": admitted_hits.size(),
			"rejected_duplicate_hits": rejected_duplicates,
		}
