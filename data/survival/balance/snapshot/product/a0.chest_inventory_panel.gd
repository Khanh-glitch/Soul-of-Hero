extends CanvasLayer
## A0 selective storage surface over the existing SurvivalService. It holds no
## inventory: every button invokes one atomic SaveService-backed transfer.
## Coupled A3 instances are visible but generic transfer is deliberately disabled.
var _root: Control
var _list: VBoxContainer
var _notice: Label
var _quantity: SpinBox
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
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.02, 0.03, 0.8)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(shade)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	panel.position = Vector2(-220, -155)
	panel.custom_minimum_size = Vector2(440, 310)
	_root.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	var title := Label.new()
	title.text = "CHEST — choose an item and amount"
	column.add_child(title)
	_notice = Label.new()
	_notice.text = "Protected unique items stay in your bag."
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_notice)
	var controls := HBoxContainer.new()
	column.add_child(controls)
	var amount_label := Label.new()
	amount_label.text = "Amount:"
	controls.add_child(amount_label)
	_quantity = SpinBox.new()
	_quantity.name = "Quantity"
	_quantity.min_value = 1
	_quantity.max_value = 50
	_quantity.step = 1
	_quantity.value = 1
	controls.add_child(_quantity)
	var close := Button.new()
	close.name = "CloseChest"
	close.text = "Close [V]"
	close.pressed.connect(close_panel)
	controls.add_child(close)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
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
	_add_items("Bag", _service.call(&"inventory_totals"), true)
	_add_items("Chest", _service.call(&"container_contents", _chest.entity_id), false)

func _add_items(title: String, items: Dictionary, deposit: bool) -> void:
	var header := Label.new()
	header.text = title
	_list.add_child(header)
	var ids := items.keys()
	ids.sort()
	for value: Variant in ids:
		var item := String(value)
		var row := HBoxContainer.new()
		_list.add_child(row)
		var label := Label.new()
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.text = "%s × %d" % [item.replace("_", " "), int(items[value])]
		row.add_child(label)
		var button := Button.new()
		button.name = ("Deposit_" if deposit else "Take_") + item
		button.text = "Deposit" if deposit else "Take"
		button.disabled = not bool(_service.call(&"is_sweepable_item", item))
		button.pressed.connect(_transfer.bind(item, deposit))
		row.add_child(button)

func _transfer(item: String, deposit: bool) -> void:
	if not _valid_context():
		close_panel()
		return
	_serial += 1
	var key := "survival.chest.ui.%s.%d" % [_session_id, _serial]
	var method := &"transfer_to_container" if deposit else &"transfer_from_container"
	var ok := bool(_service.call(method, _chest.entity_id, item, int(_quantity.value), key))
	_notice.text = "Transfer complete." if ok else "Cannot transfer: check amount or available space."
	_refresh()
