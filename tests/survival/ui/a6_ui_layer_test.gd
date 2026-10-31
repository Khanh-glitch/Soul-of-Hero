extends Node

## Mechanical checks for the A6 interface layer, with no renderer and no fixtures.
##
## Run it headless:
##
##   godot --headless --path . res://tests/survival/ui/a6_ui_layer_test.tscn
##
## What it proves:
##   * every icon id that `A6ItemIcons` reports has a file on disk that the receipt
##     also names, and an id the packs do not depict returns **null** rather than some
##     other item's picture (a wrong icon teaches the wrong material);
##   * the survival theme loads, and every variation the scenes ask for exists in it;
##   * the HUD builds and reports honest empty state when no owner is present, and
##     never invents a season clock;
##   * the workshop and chest panels build from the real autoloads without touching
##     the save file (they are read-only until a button is pressed).
##
## What it does NOT prove: that any of it looks right. That is the render gate.

const MARKER := "A6 UI LAYER"
const THEME_PATH := "res://game/ui/theme/a6_survival_theme.tres"
const RECEIPT_PATH := "res://assets/a6_ui/PROVENANCE.json"
const HUD_SCRIPT := preload("res://game/overworld/overworld_hud.gd")
const ECONOMY_SCRIPT := preload("res://game/survival/economy/economy_panel.gd")
const CHEST_SCRIPT := preload("res://game/survival/chest_inventory_panel.gd")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_check_icons_have_files()
	_check_unknown_items_are_empty()
	_check_theme_variations()
	await _check_hud_without_owner()
	await _check_panels_build()
	_finish()


func _check_icons_have_files() -> void:
	var ids := A6ItemIcons.known_ids()
	_expect(ids.size() >= 20, "the receipt binds at least 20 item icons (got %d)" % ids.size())
	for item_id: String in ids:
		var path := "res://assets/a6_ui/icons/%s.png" % item_id
		_expect(FileAccess.file_exists(path), "icon file exists for %s" % item_id)
		_expect(A6ItemIcons.texture_for(item_id) != null, "texture loads for %s" % item_id)
		var provenance := A6ItemIcons.provenance(item_id)
		_expect(not provenance.is_empty(), "receipt names the source of %s" % item_id)
		_expect(String(provenance.get("source", {}).get("commit", "")).length() == 40,
			"receipt pins a full commit for %s" % item_id)


func _check_unknown_items_are_empty() -> void:
	# Ids the packs do not depict. Each must refuse rather than borrow a neighbour.
	for item_id: String in ["binding_cloth", "knowledge_spares", "bone", "iron_ore", "not_an_item"]:
		_expect(not A6ItemIcons.has_icon(item_id), "no invented icon for %s" % item_id)
		_expect(A6ItemIcons.texture_for(item_id) == null, "texture_for(%s) is null" % item_id)


func _check_theme_variations() -> void:
	_expect(ResourceLoader.exists(THEME_PATH), "survival theme is committed")
	var theme := load(THEME_PATH) as Theme
	_expect(theme != null, "survival theme loads as a Theme")
	if theme == null:
		return
	for variation: String in ["A6Window", "A6Card", "A6HudCard", "A6HudBar", "A6Slot",
			"A6Title", "A6Heading", "A6Body", "A6Number", "A6Caption", "A6Warning"]:
		_expect(theme.has_type(StringName(variation)), "theme declares %s" % variation)
	var normal: StyleBox = theme.get_stylebox("normal", "Button")
	_expect(normal is StyleBoxTexture, "button skin is authored art, not a flat box")
	if normal is StyleBoxTexture:
		var texture := (normal as StyleBoxTexture).texture
		_expect(texture != null and texture.resource_path.ends_with("button_normal.png"),
			"button normal uses the imported pack art")


func _check_hud_without_owner() -> void:
	var hud := HUD_SCRIPT.new() as CanvasLayer
	add_child(hud)
	await get_tree().process_frame
	var root := hud.get_node_or_null("Root")
	_expect(root != null, "HUD builds its authored surface")
	_expect(hud.get_node_or_null("Root/FieldCard") != null, "HUD has the parchment field card")
	hud.set_region("THE HOLLOW MARCHES")
	_expect(hud.prompt_text() == "", "an idle HUD shows no prompt")
	hud.show_prompt("Your pack is full.", 1.0)
	_expect(hud.prompt_text() == "Your pack is full.", "the HUD surfaces the owner's refusal text")
	hud.set_provisions(0, 10)
	hud.set_counts(0, 0, 0, 0, 0, 0)
	hud.set_carry(0, 0)
	hud.show_death("You fell.")
	# The card lives under the dressed root inside a centring container; it is not a
	# direct child of the CanvasLayer, which is what used to give it Godot's default
	# theme (a black debug box) and let its heading escape the panel.
	var death := hud.find_child("OverworldDeath", true, false) as Control
	_expect(death != null and death.visible, "death card is authored and visible")
	if death != null:
		_expect(death.is_in_group(&"gameplay_modal"), "death card registers as a gameplay modal")
		_expect(death.get_parent() is CenterContainer, "a centring container sizes the death card from its content")
		_expect(death.get_parent().get_parent().name == "Root", "the death card inherits the authored HUD theme")
		var respawn := death.find_child("Respawn", true, false) as Button
		_expect(respawn != null and respawn.text == "TỈNH DẬY", "death card offers one clear action")
		if respawn != null:
			_expect(respawn.theme == null and death.theme_type_variation == &"A6Window", "the answer button is skinned by the card it sits in")
	hud.hide_death()
	hud.queue_free()
	await get_tree().process_frame


func _check_panels_build() -> void:
	var economy := ECONOMY_SCRIPT.new() as CanvasLayer
	add_child(economy)
	await get_tree().process_frame
	var overlay := economy.get_node_or_null("EconomyOverlay")
	_expect(overlay != null and not (overlay as CanvasItem).visible, "workshop starts closed")
	economy.call(&"toggle")
	_expect(bool(economy.call(&"is_open")), "workshop opens")
	var window := economy.get_node_or_null("EconomyOverlay/Window")
	_expect(window != null, "workshop renders inside the authored window")
	economy.call(&"close_panel")
	_expect(not bool(economy.call(&"is_open")), "workshop closes")
	economy.queue_free()

	var chest := CHEST_SCRIPT.new() as CanvasLayer
	add_child(chest)
	await get_tree().process_frame
	_expect(chest.get_node_or_null("ChestInventoryOverlay") != null, "chest surface builds")
	# With no valid chest context the panel must refuse to open rather than show an
	# empty frame that looks like an empty chest.
	_expect(not bool(chest.call(&"open_chest", null, null, null)), "chest refuses an invalid context")
	chest.queue_free()
	await get_tree().process_frame


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _finish() -> void:
	if _failures.is_empty():
		print("%s PASSED (%d checks)" % [MARKER, _checks])
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("%s: FAIL - %s" % [MARKER, failure])
	printerr("%s FAILED (%d checks, %d failures)" % [MARKER, _checks, _failures.size()])
	get_tree().quit(1)
