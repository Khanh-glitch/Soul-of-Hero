extends CanvasLayer
## A0 selective storage surface over the existing SurvivalService. It holds no
## inventory: every button invokes one atomic SaveService-backed transfer.
##
## The list is the pack and the chest side by side, each row showing the item's
## authored icon, its catalog name, and how many are there. Coupled A3 instances are
## visible but generic transfer is deliberately disabled, and says why - "cannot move
## this" is information, not a dead button with no explanation.

const TRANSFER_AMOUNT_DEFAULT := 1

var _root: Control
var _list: VBoxContainer
var _notice: Label
var _quantity: SpinBox
var _bag_capacity: Label
var _chest: SurvivalStructure
var _hero: Node2D
var _service: Node
var _session_id := ""
var _serial := 0


func _ready() -> void:
	layer = 21
	_session_id = Crypto.new().generate_random_bytes(16).hex_encode()
	_root = Control.new()
	_root.name = "ChestInventoryOverlay"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_to_group(&"gameplay_modal")
	_root.visible = false
	add_child(_root)
	A6UiKit.dress(_root)

	var shade := ColorRect.new()
	shade.name = "Shade"
	shade.color = Color(0.03, 0.02, 0.02, 0.72)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(shade)

	var panel := A6UiKit.window()
	panel.name = "Window"
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	panel.position = Vector2(-230, -160)
	panel.custom_minimum_size = Vector2(460, 320)
	_root.add_child(panel)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 5)
	panel.add_child(column)

	var header := HBoxContainer.new()
	header.name = "Header"
	column.add_child(header)
	var title := A6UiKit.label("CHEST", "heading", 17)
	title.name = "Title"
	title.add_theme_color_override("font_color", A6UiKit.GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	_bag_capacity = A6UiKit.label("", "number", 11)
	_bag_capacity.name = "BagCapacity"
	_bag_capacity.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(_bag_capacity)

	var controls := HBoxContainer.new()
	controls.name = "Controls"
	controls.add_theme_constant_override("separation", 5)
	column.add_child(controls)
	var amount_label := A6UiKit.label("AMOUNT", "caption", 10)
	amount_label.add_theme_color_override("font_color", A6UiKit.INK)
	controls.add_child(amount_label)
	_quantity = SpinBox.new()
	_quantity.name = "Quantity"
	_quantity.min_value = 1
	_quantity.max_value = 50
	_quantity.step = 1
	_quantity.value = TRANSFER_AMOUNT_DEFAULT
	_quantity.custom_minimum_size = Vector2(64, 18)
	_quantity.add_theme_font_size_override("font_size", 10)
	controls.add_child(_quantity)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	controls.add_child(spacer)
	var close := Button.new()
	close.name = "CloseChest"
	close.text = "CLOSE [V]"
	close.custom_minimum_size = Vector2(0, 20)
	close.add_theme_font_size_override("font_size", 11)
	close.pressed.connect(close_panel)
	controls.add_child(close)

	_notice = A6UiKit.label("Protected unique items stay in your bag.", "caption", 10)
	_notice.name = "Notice"
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_notice.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	column.add_child(_notice)

	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_list = VBoxContainer.new()
	_list.name = "Items"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 3)
	scroll.add_child(_list)


func open_chest(chest: SurvivalStructure, hero: Node2D, service: Node) -> bool:
	if _root == null or not is_instance_valid(chest) or not is_instance_valid(hero) or service == null \
			or chest.piece_id != SurvivalStructure.PIECE_CHEST \
			or chest.global_position.distance_to(hero.global_position) > SurvivalStructure.REACH:
		return false
	_chest = chest
	_hero = hero
	_service = service
	_root.visible = true
	_refresh()
	return true


func is_open() -> bool:
	return _root != null and _root.is_visible_in_tree()


func close_panel() -> void:
	if _root != null:
		_root.visible = false
	_chest = null
	_hero = null
	_service = null


func _valid_context() -> bool:
	return is_instance_valid(_chest) and is_instance_valid(_hero) and is_instance_valid(_service) \
		and _chest.global_position.distance_to(_hero.global_position) <= SurvivalStructure.REACH \
		and not bool(_hero.get("dead"))


func _refresh() -> void:
	if not _valid_context():
		close_panel()
		return
	for child: Node in _list.get_children():
		child.queue_free()
	_refresh_capacity()
	_add_items("IN YOUR BAG", _service.call(&"inventory_totals") as Dictionary, true)
	_add_items("IN THE CHEST", _service.call(&"container_contents", _chest.entity_id) as Dictionary, false)


## Bag capacity is an A0 projection, shown so a full pack is visible before a
## transfer is refused.
func _refresh_capacity() -> void:
	if _bag_capacity == null:
		return
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"get_inventory_capacity_snapshot"):
		_bag_capacity.text = ""
		return
	var snapshot: Dictionary = save.call(&"get_inventory_capacity_snapshot")
	_bag_capacity.text = "PACK %d/%d" % [
		int(snapshot.get("bag_used", 0)), int(snapshot.get("bag_capacity", 0)),
	]


func _add_items(title: String, items: Dictionary, deposit: bool) -> void:
	var plate := PanelContainer.new()
	plate.name = "Header_%s" % ("Bag" if deposit else "Chest")
	plate.theme_type_variation = &"A6HudBar"
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_list.add_child(plate)
	var heading := A6UiKit.label(title, "heading", 11)
	heading.add_theme_color_override("font_color", A6UiKit.CREAM)
	plate.add_child(heading)

	var ids: Array = items.keys()
	ids.sort()
	if ids.is_empty():
		# An empty chest is still a polished, informative state.
		var empty := A6UiKit.label(
			"Nothing here yet." if not deposit else "Your bag is empty.",
			"caption", 10
		)
		empty.name = "Empty_%s" % ("Bag" if deposit else "Chest")
		empty.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
		_list.add_child(empty)
		return

	for value: Variant in ids:
		var item_id := String(value)
		var quantity := int(items[value])
		var row := HBoxContainer.new()
		row.name = "Row_%s_%s" % ["Bag" if deposit else "Chest", item_id]
		row.add_theme_constant_override("separation", 4)
		_list.add_child(row)

		var frame := A6UiKit.socket()
		frame.custom_minimum_size = Vector2(20, 20)
		frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(frame)
		var picture := A6UiKit.icon(item_id, 16)
		if picture != null:
			frame.add_child(picture)

		var label := A6UiKit.label("", "body", 10)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.add_theme_color_override("font_color", A6UiKit.INK)
		var item_name := _item_label(item_id)
		if picture == null:
			# No authored icon for this id: say so honestly instead of borrowing the
			# nearest sprite and teaching the player the wrong material.
			label.text = "%s  ×%d  ·  no art" % [item_name, quantity]
		else:
			label.text = "%s  ×%d" % [item_name, quantity]
		row.add_child(label)

		var button := Button.new()
		button.name = ("Deposit_" if deposit else "Take_") + item_id
		var sweepable := bool(_service.call(&"is_sweepable_item", item_id))
		button.text = "STORE" if deposit else "TAKE"
		button.custom_minimum_size = Vector2(0, 18)
		button.add_theme_font_size_override("font_size", 10)
		button.disabled = not sweepable
		if not sweepable:
			button.tooltip_text = "Bound item - it must be handled by its own system."
		button.pressed.connect(_transfer.bind(item_id, deposit))
		row.add_child(button)


func _item_label(item_id: String) -> String:
	var service := get_node_or_null("/root/SurvivalService")
	if service != null and service.has_method(&"item_definition"):
		var definition: Dictionary = service.call(&"item_definition", item_id)
		var label := String(definition.get("label", ""))
		if not label.is_empty():
			return label
	return item_id.replace("_", " ").capitalize()


func _transfer(item: String, deposit: bool) -> void:
	if not _valid_context():
		close_panel()
		return
	_serial += 1
	var key := "survival.chest.ui.%s.%d" % [_session_id, _serial]
	var target := &"transfer_to_container" if deposit else &"transfer_from_container"
	var ok := bool(_service.call(target, _chest.entity_id, item, int(_quantity.value), key))
	_notice.text = "Transfer complete." if ok else "Cannot transfer: check amount or available space."
	_notice.add_theme_color_override(
		"font_color", A6UiKit.INK_SOFT if ok else A6UiKit.WARN
	)
	_refresh()
