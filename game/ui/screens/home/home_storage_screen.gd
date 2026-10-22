extends VBoxContainer

const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

@onready var capacity_label: Label = %CapacityLabel
@onready var xp_hero_selector: OptionButton = %XpHeroSelector
@onready var bag_list: VBoxContainer = %BagList
@onready var storage_list: VBoxContainer = %StorageList

var _save: Node
var _transaction_serial := 0


func _ready() -> void:
	_save = get_node_or_null("/root/SaveService")
	if _save != null and _save.has_signal(&"save_committed"):
		_save.connect(&"save_committed", _on_save_committed)
	refresh()


func refresh() -> void:
	_clear_list(bag_list)
	_clear_list(storage_list)
	if _save == null:
		capacity_label.text = "Không thể đọc kho."
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	_refresh_xp_hero_selector(snapshot)
	var capacity: Dictionary = _save.call(&"get_inventory_capacity_snapshot")
	capacity_label.text = "TÚI  %d / %d     â€¢     KHO  %d / %d     â€¢     CHỜ NHẬN  %d" % [
		int(capacity.get("bag_used", 0)), int(capacity.get("bag_capacity", 30)),
		int(capacity.get("storage_used", 0)), int(capacity.get("storage_capacity", 50)),
		int(capacity.get("pending_rewards", 0)),
	]
	var inventory: Dictionary = snapshot.get("inventory", {})
	var storage: Dictionary = snapshot.get("storage", {})
	_add_weapon_rows(bag_list, inventory.get("hero_souls", []), true)
	_add_equipment_rows(bag_list, inventory.get("auxiliary_equipment", []), true)
	_add_stack_rows(bag_list, inventory.get("item_stacks", {}), true)
	_add_weapon_rows(storage_list, storage.get("hero_weapons", []), false)
	_add_equipment_rows(storage_list, storage.get("auxiliary_equipment", []), false)
	_add_stack_rows(storage_list, storage.get("item_stacks", {}), false)
	if bag_list.get_child_count() == 0:
		_add_empty_row(bag_list)
	if storage_list.get_child_count() == 0:
		_add_empty_row(storage_list)


func _add_weapon_rows(parent: VBoxContainer, value: Variant, in_bag: bool) -> void:
	if not value is Array:
		return
	for raw: Variant in value:
		if not raw is Dictionary:
			continue
		var item := raw as Dictionary
		var ranks: Dictionary = item.get("skill_ranks", {})
		_add_item_row(
			parent,
			"HERO WEAPON  â€¢  %s  â€¢  %s  â€¢  Skill %d/%d" % [
				String(item.get("hero_id", "hero")).replace("_hero", "").capitalize(),
				String(item.get("rarity_display_name", "Normal")),
				int(ranks.get("active_1", 1)), int(ranks.get("active_2", 1)),
			],
			&"hero_weapon", String(item.get("instance_id", "")), in_bag,
			bool(item.get("equipped", false)),
		)


func _add_equipment_rows(parent: VBoxContainer, value: Variant, in_bag: bool) -> void:
	if not value is Array:
		return
	for raw: Variant in value:
		if raw is Dictionary:
			var item := raw as Dictionary
			_add_item_row(
				parent,
				"%s  â€¢  %s  â€¢  Lv%d" % [
					String(item.get("slot", "equipment")).replace("soul_", "").capitalize(),
					String(item.get("rarity", "normal")).capitalize(),
					int(item.get("item_level", 1)),
				],
				&"equipment", String(item.get("uuid", "")), in_bag, false,
			)


func _add_stack_rows(parent: VBoxContainer, value: Variant, in_bag: bool) -> void:
	if not value is Dictionary:
		return
	for raw_key: Variant in (value as Dictionary).keys():
		var record: Dictionary = (value as Dictionary)[raw_key]
		var item_id := String(record.get("item_id", raw_key))
		var definition := STACK_ITEM_CATALOG.find(StringName(item_id))
		var xp_value := definition.hero_xp_value if definition != null else 0
		_add_item_row(
			parent,
			"%s  x%d" % [String(record.get("display_name", raw_key)), int(record.get("quantity", 0))],
			&"item_stack", String(raw_key), in_bag, false, item_id, xp_value,
		)


func _add_item_row(
		parent: VBoxContainer,
		copy: String,
		kind: StringName,
		instance_id: String,
	in_bag: bool,
	equipped: bool,
	xp_item_id: String = "",
	xp_value: int = 0,
) -> void:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = copy
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	row.add_child(label)
	if in_bag and xp_value > 0:
		var use_button := Button.new()
		use_button.text = "DUNG +%d XP" % xp_value
		use_button.tooltip_text = "Cong XP cho Hero dang chon; khong the vuot cap quai trung binh cua ai cao nhat da mo."
		use_button.pressed.connect(_use_xp_stone.bind(xp_item_id))
		row.add_child(use_button)
	var button := Button.new()
	button.text = "ĐANG MANG" if equipped else "CẤT â†’" if in_bag else "â† LẤY"
	button.disabled = equipped
	button.pressed.connect(_transfer.bind(kind, instance_id, in_bag))
	row.add_child(button)
	parent.add_child(row)


func _refresh_xp_hero_selector(snapshot: Dictionary) -> void:
	var previous := _selected_xp_hero()
	xp_hero_selector.clear()
	var unlocked: Dictionary = (snapshot.get("progression", {}) as Dictionary).get("unlocked_heroes", {})
	for hero_id: String in ["sword_hero", "archer_hero", "axe_hero", "wizard_hero"]:
		if not bool(unlocked.get(hero_id, false)):
			continue
		var progression: Dictionary = _save.call(&"get_hero_progression_snapshot", StringName(hero_id))
		var index := xp_hero_selector.item_count
		xp_hero_selector.add_item("%s - Lv%d / %d" % [
			hero_id.trim_suffix("_hero").capitalize(),
			int(progression.get("level", 1)), int(progression.get("level_cap", 1)),
		])
		xp_hero_selector.set_item_metadata(index, hero_id)
		if hero_id == previous:
			xp_hero_selector.select(index)


func _selected_xp_hero() -> String:
	if xp_hero_selector == null or xp_hero_selector.item_count <= 0:
		return ""
	return String(xp_hero_selector.get_item_metadata(xp_hero_selector.selected))


func _use_xp_stone(item_id: String) -> void:
	var hero_id := _selected_xp_hero()
	if hero_id.is_empty():
		GameEvents.toast_requested.emit("Chua co Hero hop le de nhan XP.")
		return
	_transaction_serial += 1
	var result: Dictionary = _save.call(
		&"consume_hero_xp_stone", StringName(hero_id), StringName(item_id), 1,
		"home_xp_stone:%s:%s:%d" % [hero_id, item_id, _transaction_serial],
	)
	if bool(result.get("applied", false)):
		GameEvents.toast_requested.emit("%s nhan +%d XP." % [hero_id.trim_suffix("_hero").capitalize(), int(result.get("xp_applied", 0))])
	else:
		GameEvents.toast_requested.emit("Khong dung da: Hero da cham tran ai hoac vat pham khong con trong tui.")


func _transfer(kind: StringName, instance_id: String, from_bag: bool) -> void:
	_transaction_serial += 1
	var method := &"home_transfer_to_storage" if from_bag else &"home_transfer_to_bag"
	var key := "home_storage:%s:%s:%d" % [kind, instance_id, _transaction_serial]
	if not bool(_save.call(method, kind, instance_id, key)):
		GameEvents.toast_requested.emit("Không thể chuyển: kiểm tra chỗ trống hoặc trang bị đang mang.")


func _clear_list(parent: VBoxContainer) -> void:
	for child: Node in parent.get_children():
		child.queue_free()


func _add_empty_row(parent: VBoxContainer) -> void:
	var label := Label.new()
	label.text = "Trống"
	label.modulate = Color(1, 1, 1, 0.55)
	parent.add_child(label)


func _on_save_committed(_snapshot: Dictionary) -> void:
	refresh.call_deferred()
