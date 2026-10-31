extends SceneTree
## Fault-injected production SaveService; not a power cut or full gameplay.
## Invariant: a post-rename unknown outcome must not be erased by an unrelated
## successful write based on the stale in-memory generation. A safe design may
## preserve it directly or refuse later writes until the disk is reloaded.
const PATH := "user://tests/a0_ambiguous_write.json"
var save: Node
var checks := 0
var failures := 0

func _initialize() -> void:
	_run.call_deferred()

func _check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures += 1
	print("  %s  %s" % ["ok  " if value else "FAIL", label])

func _disk() -> Dictionary:
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	return parsed if parsed is Dictionary else {}

func _quantity(doc: Dictionary, item: String) -> int:
	var stacks: Dictionary = (doc.get("inventory", {}) as Dictionary).get("item_stacks", {})
	var count := 0
	for key: Variant in stacks:
		var record: Dictionary = stacks[key]
		if String(record.get("item_id", key)) == item:
			count += int(record.get("quantity", 0))
	return count

func _run() -> void:
	save = root.get_node("SaveService")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	_check(bool(save.call(&"configure_storage", PATH, true)), "isolated authoritative profile opens")
	_check(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 2, "ambiguous.original")), "original inventory and receipt commit")
	_check(bool(save.call(&"configure_test_save_interruption", "after_primary_renamed")), "fault armed after rename")
	_check(not bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 3, "ambiguous.candidate")), "candidate reports unknown outcome")
	var before: Dictionary = _disk()
	var receipt_before := (before.get("applied_transactions", {}) as Dictionary).has("ambiguous.candidate")
	_check(receipt_before and _quantity(before, "stone_chunk") == 3, "renamed file actually contains candidate and matching receipt")
	var unrelated := bool(save.call(&"update_settings", {"master_volume": 0.42}))
	var after := _disk()
	var receipt_after := (after.get("applied_transactions", {}) as Dictionary).has("ambiguous.candidate")
	var quantity_after := _quantity(after, "stone_chunk")
	print("AMBIGUOUS_WRITE_TRACE disk_before_qty=%d disk_before_receipt=%s unrelated_accepted=%s disk_after_qty=%d disk_after_receipt=%s memory_qty=%d" % [_quantity(before, "stone_chunk"), receipt_before, unrelated, quantity_after, receipt_after, int((save.call(&"inventory_totals") as Dictionary).get("stone_chunk", 0))])
	_check(receipt_after and quantity_after == 3, "unrelated commit cannot erase a complete renamed transaction")
	_check(bool(save.call(&"reload_save")), "disk generation reloads")
	_check(int((save.call(&"inventory_totals") as Dictionary).get("stone_chunk", 0)) == 3 and bool(save.call(&"is_transaction_applied", "ambiguous.candidate")), "reload preserves exact candidate custody and receipt")
	_check(int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 2 and bool(save.call(&"is_transaction_applied", "ambiguous.original")), "original custody and receipt also survive")
	print("A0 AMBIGUOUS WRITE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
