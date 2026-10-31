extends Control

## New Game's one authored identity step.
##
## The player picks one of the two authentic staged survivors; the choice is written
## to A0's SaveService exactly once, and every later screen reads it back as the
## single source of truth. This screen never invents a character, never falls back to
## the Knight, and never grants items.
##
## Layout budget: the viewport is 640x360 *layout* units (it stretches to 720p/1440p/
## 2160p by whole multiples), so everything here has to fit 360 units tall. The first
## version stacked an emblem, two headings, an explanatory paragraph, 192-unit cards
## and a footer, and at 720p the headline was clipped at the top while the NAM/NỮ
## captions fell below the viewport. The budget below is explicit and the capture
## driver asserts `.name`/`Title` style nodes stay inside the screen rect.

const PRIVATE_MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"
const PUBLIC_MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
const SUPPORTED_GENDERS := ["male", "female"]

@onready var male_button: Button = %MaleButton
@onready var female_button: Button = %FemaleButton
@onready var back_button: Button = %BackButton
@onready var male_preview: A6AvatarPreview = %MalePreview
@onready var female_preview: A6AvatarPreview = %FemalePreview
@onready var male_caption: Label = %MaleCaption
@onready var female_caption: Label = %FemaleCaption
@onready var status_label: Label = %StatusLabel

## The two identity cards, so the surface they are drawn on can follow the direction
## (parchment ledger vs dark board) without a second scene.
@onready var male_card: PanelContainer = %MaleCard
@onready var female_card: PanelContainer = %FemaleCard


func _ready() -> void:
	male_button.pressed.connect(_choose.bind("male"))
	female_button.pressed.connect(_choose.bind("female"))
	back_button.pressed.connect(_back_to_title)
	status_label.hide()
	_apply_previews()
	male_button.grab_focus()


func configure(_payload: Dictionary = {}) -> void:
	pass


func _apply_previews() -> void:
	_skin_cards()
	var manifest := _load_manifest()
	if not _manifest_has_staged_art(manifest):
		# Straight talk instead of a stand-in character: the player can still choose,
		# but they are told the preview art is not staged in this build.
		status_label.text = "Bản cài này chưa có hình nhân vật. Bạn vẫn chọn được danh tính."
		status_label.show()
	_start_preview(male_preview, "male", "idle")
	_start_preview(female_preview, "female", "walk")
	var male_ready := _preview_missing(male_preview).is_empty()
	var female_ready := _preview_missing(female_preview).is_empty()
	male_caption.text = "NAM"
	female_caption.text = "NỮ"
	if not male_ready:
		_mark_missing(male_preview, male_caption, "NAM", "male")
	if not female_ready:
		_mark_missing(female_preview, female_caption, "NỮ", "female")


## The card surface follows the direction, and each identity carries its own accent so
## two unillustrated cards are still distinguishable at a glance.
func _skin_cards() -> void:
	for pair: Array in [[male_card, "male"], [female_card, "female"]]:
		var card: PanelContainer = pair[0]
		if card == null:
			continue
		card.add_theme_stylebox_override("panel", A6UiKit.card_style())
		# The accent band lives inside the card's column: a PanelContainer stretches every
		# child to its own rect, so a sibling band would cover the whole card instead of
		# ruling its top edge.
		var box := card.get_child(0) as VBoxContainer
		if box == null or box.get_node_or_null("Accent") != null:
			continue
		var accent := ColorRect.new()
		accent.name = "Accent"
		accent.color = _accent(String(pair[1]))
		accent.custom_minimum_size = Vector2(0, 3)
		accent.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(accent)
		box.move_child(accent, 0)


func _accent(gender: String) -> Color:
	return Color(0.36, 0.6, 0.72) if gender == "male" else Color(0.78, 0.54, 0.32)


## What an unstaged identity card looks like on purpose.
##
## The previous build drew an empty 128x128 rectangle and printed "(chưa có hình)"
## underneath it, which reads as a broken image rather than a design. This draws the
## slot the portrait will occupy, framed in the identity's own accent, with the word the
## player is choosing and a tag that states the truth. It is deliberately not a
## character: no Knight, no silhouette that could be mistaken for staged art.
func _mark_missing(preview: TextureRect, caption: Label, word: String, gender: String) -> void:
	preview.hide()
	# The seal states the identity, so the caption under the button would say it twice -
	# and at 186 units of card height the duplicate was clipped by the card edge.
	caption.hide()
	var box := caption.get_parent() as VBoxContainer
	if box == null or box.get_node_or_null("NoArtSeal") != null:
		return
	var seal := PanelContainer.new()
	seal.name = "NoArtSeal"
	seal.custom_minimum_size = Vector2(128, 96)
	seal.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	seal.size_flags_vertical = Control.SIZE_EXPAND_FILL
	seal.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var frame := StyleBoxFlat.new()
	frame.bg_color = Color(0.09, 0.06, 0.05, 0.58) if A6UiKit.is_board() else Color(0.88, 0.81, 0.65, 0.9)
	frame.border_width_left = 2
	frame.border_width_right = 2
	frame.border_width_top = 2
	frame.border_width_bottom = 2
	frame.border_color = _accent(gender)
	frame.content_margin_left = 4.0
	frame.content_margin_right = 4.0
	frame.content_margin_top = 4.0
	frame.content_margin_bottom = 4.0
	seal.add_theme_stylebox_override("panel", frame)
	box.add_child(seal)
	box.move_child(seal, clampi(preview.get_index(), 0, box.get_child_count() - 1))

	var stack := VBoxContainer.new()
	stack.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.add_theme_constant_override("separation", 2)
	seal.add_child(stack)

	# "heading", not "title": the title variation carries a 2px drop shadow, which on a
	# single word reads as a doubled, broken glyph at 1x.
	var mark := A6UiKit.face_label(word, "heading", 24, _accent(gender))
	mark.name = "SealWord"
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(mark)

	var tag := A6UiKit.face_label("CHƯA CÓ HÌNH", "caption", 11, A6UiKit.quiet_colour())
	tag.name = "SealTag"
	tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(tag)


func _start_preview(preview: A6AvatarPreview, gender: String, action: String) -> void:
	if preview == null:
		return
	preview.gender = gender
	preview.action = action
	preview.direction = "front"
	if preview.is_inside_tree():
		preview.play(action, "front")


func _preview_missing(preview: A6AvatarPreview) -> String:
	if preview == null:
		return "preview node missing"
	return preview.missing_reason()


func _choose(gender: String) -> void:
	if gender not in SUPPORTED_GENDERS:
		return
	_set_actions_enabled(false)
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"set_player_avatar"):
		_show_error("Không thể truy cập dữ liệu lưu.")
		return
	if not bool(save_service.call(&"set_player_avatar", gender, "avatar_choice")):
		_show_error("Không thể lưu nhân vật đã chọn. Hồ sơ cũ vẫn được giữ nguyên.")
		return
	AppFlow.open_home()


func _back_to_title() -> void:
	AppFlow.open_title()


func _set_actions_enabled(enabled: bool) -> void:
	male_button.disabled = not enabled
	female_button.disabled = not enabled
	back_button.disabled = not enabled


func _show_error(message: String) -> void:
	status_label.text = message
	status_label.show()
	_set_actions_enabled(true)
	male_button.grab_focus()


func _load_manifest() -> Dictionary:
	for path: String in [PRIVATE_MANIFEST_PATH, PUBLIC_MANIFEST_PATH]:
		if not FileAccess.file_exists(path):
			continue
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			return parsed
	return {}


## Whether the private staging manifest actually carries grade-0 action sheets for
## at least one identity. Kept as one function: the previous revision of this file had
## it twice (a bad edit), which is a hard parse error and stopped the game booting.
func _manifest_has_staged_art(manifest: Dictionary) -> bool:
	var characters: Variant = manifest.get("characters", {})
	if not characters is Dictionary:
		return false
	for gender: String in SUPPORTED_GENDERS:
		var record: Variant = (characters as Dictionary).get(gender, {})
		if not record is Dictionary:
			continue
		var grades: Variant = (record as Dictionary).get("armor_grades", {})
		if not grades is Dictionary:
			continue
		var grade_zero: Variant = (grades as Dictionary).get("0", {})
		if grade_zero is Dictionary \
				and not ((grade_zero as Dictionary).get("runtime_action_sheets", {}) as Dictionary).is_empty():
			return true
	return false
