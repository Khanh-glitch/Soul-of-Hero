extends SceneTree
## Unit-only synthetic motion samples. Not evidence of native input or C08 acceptance.
const Store := preload("res://game/survival/c08_trace_store.gd")

func _initialize() -> void:
	var store = Store.new()
	store.reset("run-a")
	assert(store.sample(Vector2.ZERO, 1.0, "ground", true, 10.0, 20.0, 15.0) == 0)
	var first: int = store.sample(Vector2(10, 0), 2.0, "ground", true, 10.0, 20.0, 15.0)
	var second: int = store.sample(Vector2(20, 0), 3.0, "ground", true, 10.0, 20.0, 15.0)
	assert(first > 0 and second > first)
	assert(store.successor(first, 3.0).get("id") == second)
	assert(store.nearby(Vector2(10, 0), 1.0, 3.0).size() == 1)
	assert(store.nearby(Vector2(10, 0), 1.0, 22.0).is_empty())
	assert(store.successor(first, 22.0).is_empty())
	store.sample(Vector2(1000, 0), 4.0, "ground", true, 10.0, 20.0, 15.0)
	var after_gap: int = store.sample(Vector2(1010, 0), 5.0, "ground", true, 10.0, 20.0, 15.0)
	assert(after_gap > 0 and store.successor(second, 5.0).is_empty())
	store.reset("run-b")
	assert(store.nearby(Vector2(10, 0), 128.0, 5.0).is_empty())
	print("C08_TRACE_STORE_UNIT_PASS (synthetic samples; not gameplay acceptance)")
	quit()
