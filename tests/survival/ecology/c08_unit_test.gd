extends SceneTree
## LW1 C08 UNIT fixtures. These are NOT player-native acceptance. They attack the
## trace store's negative invariants with stub seats; the real-input gate lives in
## c08_real_input_test.gd and never calls these fixtures.

const STORE := preload("res://game/survival/ecology/trace_store.gd")
const POLICY := preload("res://game/survival/ecology/trace_policy.gd")

var checks := 0
var failures: Array[String] = []


class StubNav:
	extends OverworldTraversability
	func _init() -> void:
		width = 512
		height = 512
	func in_bounds(_cell: Vector2i) -> bool:
		return true
	func is_free(_cell: Vector2i) -> bool:
		return true


class StubHero:
	extends CharacterBody2D
	var move_input := Vector2.ZERO
	var dead := false


class StubWorld:
	extends Node
	var build_stage := 6
	func _has_gameplay_modal() -> bool:
		return false


class StubSave:
	extends Node
	signal save_loaded(snapshot: Dictionary)
	signal save_reset()
	var data := {}
	func get_value(path: Array, fallback: Variant = null) -> Variant:
		var cursor: Variant = data
		for segment: Variant in path:
			if not cursor is Dictionary or not (cursor as Dictionary).has(segment):
				return fallback
			cursor = (cursor as Dictionary)[segment]
		return cursor
	func patch_state_path(path: Array, value: Variant) -> bool:
		if path.is_empty():
			return false
		data[path[0]] = value
		return true


class StubLifecycle:
	extends Node
	signal run_started(run: Dictionary)
	signal run_ended(run: Dictionary, reason: String)
	var now := 1000
	var run_id := "run-1"
	func phase() -> Dictionary:
		return {"state": "active", "run_id": run_id, "now_unix": now,
			"run_started_at_unix": 900, "run_expires_at_unix": 100000}


func _initialize() -> void:
	_run.call_deferred()


func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)


func _make_store(save: StubSave, lifecycle: StubLifecycle, hero: StubHero) -> Node:
	var world := StubWorld.new()
	var nav := StubNav.new()
	var build := Node.new()
	root.add_child(world)
	root.add_child(hero)
	var store := STORE.new()
	root.add_child(store)
	store.set_physics_process(false)
	var ok := bool(store.call(&"configure", world, hero, nav, build, null, save, lifecycle))
	_expect(ok, "store configures with authoritative seats")
	return store


func _run() -> void:
	var save := StubSave.new()
	var lifecycle := StubLifecycle.new()
	var hero := StubHero.new()
	root.add_child(save)
	root.add_child(lifecycle)
	var store := _make_store(save, lifecycle, hero)
	hero.global_position = Vector2(100, 100)
	hero.move_input = Vector2.RIGHT
	store.call(&"_physics_process", 0.016)
	_expect(int(store.call(&"trace_count")) == 0, "standing still emits no trace")
	hero.global_position = Vector2(112, 100)
	store.call(&"_physics_process", 0.016)
	_expect(int(store.call(&"trace_count")) == 1, "real displacement emits one trace")
	hero.global_position = Vector2(124, 100)
	store.call(&"_physics_process", 0.016)
	var traces: Array = store.call(&"all_traces")
	_expect(traces.size() == 2 and String(traces[1]["prev_id"]) == String(traces[0]["id"]), "contiguous movement links previous trace")
	hero.move_input = Vector2.ZERO
	store.call(&"_physics_process", 0.016)
	_expect(int(store.call(&"trace_count")) == 2, "no input does not emit while stationary")
	hero.move_input = Vector2.RIGHT
	hero.global_position = Vector2(400, 100)
	store.call(&"_physics_process", 0.016)
	_expect(int(store.call(&"trace_count")) == 2, "teleport-sized discontinuity emits no trace")
	hero.global_position = Vector2(412, 100)
	store.call(&"_physics_process", 0.016)
	traces = store.call(&"all_traces")
	_expect(traces.size() == 3 and String(traces[2]["prev_id"]).is_empty(), "teleport breaks the causal chain")
	var first_id := String(traces[0]["id"])
	var second_id := String(traces[1]["id"])
	var next: Dictionary = store.call(&"successor", first_id)
	_expect(String(next.get("status", "")) == "ok" and String((next.get("record", {}) as Dictionary).get("id", "")) == second_id, "successor follows prev identity, not nearest guess")
	var near: Array = store.call(&"sense_near", Vector2(118, 100), 20.0)
	_expect(near.size() == 2, "spatial sensing is local")
	var far: Array = store.call(&"sense_near", Vector2(1000, 1000), 20.0)
	_expect(far.is_empty(), "distant monster senses nothing")
	# Ambiguous branch and cycle are unit-only crafted records.
	var branch_a := {"id": "ba", "seq": 90, "run_id": "run-1", "source": "player", "position": [130.0, 100.0], "cell": [8, 6], "direction": [1.0, 0.0], "surface": "UNAVAILABLE", "created_at": 1000, "expires_at": 1090, "prev_id": second_id}
	var branch_b := {"id": "bb", "seq": 91, "run_id": "run-1", "source": "player", "position": [130.0, 106.0], "cell": [8, 6], "direction": [1.0, 0.0], "surface": "UNAVAILABLE", "created_at": 1000, "expires_at": 1090, "prev_id": second_id}
	store.call(&"_add_record", branch_a)
	store.call(&"_add_record", branch_b)
	_expect(String((store.call(&"successor", second_id) as Dictionary).get("status", "")) == "ambiguous", "ambiguous branch is refused")
	var cycle := {"id": "cy", "seq": 92, "run_id": "run-1", "source": "player", "position": [140.0, 100.0], "cell": [8, 6], "direction": [1.0, 0.0], "surface": "UNAVAILABLE", "created_at": 1000, "expires_at": 1090, "prev_id": "cy"}
	store.call(&"_add_record", cycle)
	store.set(&"_seq", 92)
	_expect(String((store.call(&"successor", "cy") as Dictionary).get("status", "")) in ["cycle", "ambiguous"], "self cycle is refused")
	# Persistence round trip in the same run.
	_expect(bool(store.call(&"flush")), "flush commits through SaveService port")
	var saved_count := int(store.call(&"trace_count"))
	var store2 := _make_store(save, lifecycle, hero)
	_expect(int(store2.call(&"trace_count")) == saved_count, "reload restores the same trace count without duplication")
	# New run wipes evidence.
	lifecycle.run_id = "run-2"
	var store3 := _make_store(save, lifecycle, hero)
	_expect(int(store3.call(&"trace_count")) == 0, "foreign run evidence is not restored")
	# Expiry uses the authoritative clock.
	lifecycle.run_id = "run-1"
	var store4 := _make_store(save, lifecycle, hero)
	lifecycle.now = 2000
	store4.call(&"_physics_process", 0.016)
	_expect(int(store4.call(&"trace_count")) == 0, "expired traces are pruned by run clock")
	# Clock rollback suspends sensing rather than extending life.
	lifecycle.now = 1000
	var store5 := _make_store(save, lifecycle, hero)
	lifecycle.now = 999
	store5.call(&"_physics_process", 0.016)
	_expect((store5.call(&"sense_near", Vector2(112, 100), 50.0) as Array).is_empty(), "clock rollback fails closed for perception")
	print("LW1 C08 UNIT %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)
