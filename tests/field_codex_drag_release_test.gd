extends SceneTree

const ENTRY_SCENE := preload("res://game/ui/field_codex_item_tile.tscn")
const SLOT_SCENE := preload("res://game/ui/field_codex_equipment_slot.tscn")

var _checks := 0
var _failures: Array[String] = []
var _entry_selection_count := 0
var _slot_selection_count := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var entry := ENTRY_SCENE.instantiate() as FieldCodexEntry
	root.add_child(entry)
	entry.configure(
		"Kiếm thử nghiệm",
		"(Hiếm)",
		&"rare",
		null,
		"",
		Callable(),
		false,
		{"kind": &"hero_soul", "item": {"instance_id": "test"}},
		Callable(self, "_on_entry_selected"),
	)
	await process_frame
	_expect(entry.custom_minimum_size == Vector2(38.0, 42.0), "inventory tile is compact at 38x42")
	var entry_rarity_state := entry.get_rarity_visual_state()
	_expect(
		StringName(entry_rarity_state.get("rarity", &"")) == &"rare"
			and int(entry_rarity_state.get("rarity_index", -1)) == RarityPalette.index(&"rare"),
		"inventory tile resolves its border tier through the shared rarity palette",
	)
	_expect(
		_same_rgb(_shader_tint(entry.get_node("%RarityBorder") as TextureRect), RarityPalette.color(&"rare")),
		"inventory tile border is recolored to the exact rare palette hue",
	)
	_expect(
		(entry.get_node("%RarityGlow") as TextureRect).visible
			and not bool(entry_rarity_state.get("is_pulsing", true)),
		"rare inventory tile has a static colored glow without a pulse loop",
	)

	entry.call(&"_gui_input", _left_button(true))
	_expect(_entry_selection_count == 0, "inventory press does not open detail")
	entry.call(&"_gui_input", _left_button(false))
	_expect(_entry_selection_count == 1, "inventory release opens detail")

	entry.call(&"_gui_input", _left_button(true))
	entry.call(&"_disarm_selection_for_drag")
	entry.call(&"_gui_input", _left_button(false))
	_expect(_entry_selection_count == 1, "inventory drag suppresses release selection")

	entry.configure(
		"Legendary test",
		"(Legendary)",
		&"legendary",
		null,
		"",
		Callable(),
		false,
		{"kind": &"hero_soul", "item": {"instance_id": "legendary_test"}},
		Callable(self, "_on_entry_selected"),
	)
	var entry_pulse_state := entry.get_rarity_visual_state()
	var entry_pulse_tween := entry.get("_rarity_effect_tween") as Tween
	_expect(
		bool(entry_pulse_state.get("is_pulsing", false))
			and entry_pulse_tween != null and entry_pulse_tween.is_valid(),
		"legendary inventory tile starts one restrained rarity pulse tween",
	)
	entry.configure("Normal test", "(Normal)", &"normal", null, "", Callable(), false, {"item": {}}, Callable())
	_expect(
		not bool(entry.get_rarity_visual_state().get("is_pulsing", true))
			and entry.get("_rarity_effect_tween") == null
			and not entry_pulse_tween.is_valid(),
		"reconfiguring an inventory tile stops the previous rarity pulse",
	)
	entry.configure("", "", &"eternal", null, "", Callable(), false, {}, Callable())
	var empty_entry_state := entry.get_rarity_visual_state()
	_expect(
		bool(empty_entry_state.get("is_empty", false))
			and not bool(empty_entry_state.get("is_pulsing", true))
			and not (entry.get_node("%RarityGlow") as TextureRect).visible,
		"empty inventory tile stays neutral even when configured with a high rarity value",
	)

	var soul := {
		"instance_id": "soul_drag_test",
		"hero_id": "sword_hero",
		"rarity": &"rare",
	}
	var source_slot := SLOT_SCENE.instantiate() as FieldCodexEquipmentSlot
	var target_slot := SLOT_SCENE.instantiate() as FieldCodexEquipmentSlot
	root.add_child(source_slot)
	root.add_child(target_slot)
	await process_frame
	source_slot.item_selected.connect(_on_slot_selected)
	source_slot.configure(
		&"soul_active", "SOUL CHÍNH", &"hero_soul", soul, null, true, "", "Kiếm Sĩ", "Hiếm",
	)
	target_slot.configure(
		&"soul_reserve_1", "DỰ BỊ", &"hero_soul", {}, null, true, "", "", "",
	)
	var source_rarity_state := source_slot.get_rarity_visual_state()
	var target_rarity_state := target_slot.get_rarity_visual_state()
	_expect(
		StringName(source_rarity_state.get("rarity", &"")) == &"rare"
			and not bool(source_rarity_state.get("is_pulsing", true)),
		"equipped rare item uses a static rare border",
	)
	_expect(
		bool(target_rarity_state.get("is_empty", false))
			and not (target_slot.get_node("%RarityGlow") as TextureRect).visible,
		"empty equipment slot keeps its neutral border and has no rarity glow",
	)
	_expect(
		_same_rgb(_shader_tint(source_slot.get_node("%RarityBorder") as TextureRect), RarityPalette.color(&"rare"))
			and not _same_rgb(
				_shader_tint(source_slot.get_node("%RarityBorder") as TextureRect),
				_shader_tint(target_slot.get_node("%RarityBorder") as TextureRect),
			),
		"rarity tint material is isolated per equipment-slot instance",
	)
	var equipped_payload := source_slot.get_drag_payload()
	_expect(
		StringName(equipped_payload.get("kind", &"")) == &"hero_soul"
			and (equipped_payload.get("item", {}) as Dictionary).get("instance_id", "") == "soul_drag_test",
		"equipped slot exposes the same kind/item drag contract as inventory",
	)
	_expect(target_slot.can_accept_payload(equipped_payload), "compatible equipped Soul can be dropped into another Soul slot")

	source_slot.call(&"_gui_input", _left_button(true))
	_expect(_slot_selection_count == 0, "equipped-slot press does not open detail")
	source_slot.call(&"_gui_input", _left_button(false))
	_expect(_slot_selection_count == 1, "equipped-slot release opens detail")
	source_slot.call(&"_gui_input", _left_button(true))
	source_slot.call(&"_disarm_selection_for_drag")
	source_slot.call(&"_gui_input", _left_button(false))
	_expect(_slot_selection_count == 1, "equipped-slot drag suppresses release selection")

	var legendary_soul := soul.duplicate(true)
	legendary_soul["rarity"] = &"legendary"
	source_slot.configure(
		&"soul_active", "Legendary slot", &"hero_soul", legendary_soul, null, true, "", "Test Soul", "Legendary",
	)
	var equipment_pulse_tween := source_slot.get("_rarity_effect_tween") as Tween
	_expect(
		bool(source_slot.get_rarity_visual_state().get("is_pulsing", false))
			and equipment_pulse_tween != null and equipment_pulse_tween.is_valid(),
		"legendary equipped item starts its restrained rarity pulse",
	)

	entry.queue_free()
	source_slot.queue_free()
	target_slot.queue_free()
	await process_frame
	_expect(
		not equipment_pulse_tween.is_valid(),
		"equipment-slot rarity pulse stops when the slot exits the tree",
	)
	if _failures.is_empty():
		print("FIELD CODEX DRAG RELEASE TEST PASSED (%d checks)" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("FIELD CODEX DRAG RELEASE TEST FAILED (%d failures / %d checks)" % [_failures.size(), _checks])
	quit(1)


func _left_button(pressed: bool) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	return event


func _on_entry_selected() -> void:
	_entry_selection_count += 1


func _on_slot_selected(_accepted_kind: StringName, _item: Dictionary) -> void:
	_slot_selection_count += 1


func _shader_tint(node: TextureRect) -> Color:
	var shader_material := node.material as ShaderMaterial
	if shader_material == null:
		return node.modulate
	var tint: Variant = shader_material.get_shader_parameter(&"tint_color")
	return tint if tint is Color else Color.TRANSPARENT


func _same_rgb(left: Color, right: Color) -> bool:
	return is_equal_approx(left.r, right.r) \
		and is_equal_approx(left.g, right.g) \
		and is_equal_approx(left.b, right.b)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
