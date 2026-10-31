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
	var manifest := _load_manifest()
	if not _manifest_has_staged_art(manifest):
		# Straight talk instead of a stand-in character: the player can still choose,
		# but they are told the preview art is not staged in this build.
		status_label.text = "Chưa có hình nhân vật trong bản cài này. Bạn vẫn chọn được danh tính."
		status_label.show()
	_start_preview(male_preview, "male", "idle")
	_start_preview(female_preview, "female", "walk")
	male_caption.text = "NAM" if _preview_missing(male_preview).is_empty() else "NAM\n(chưa có hình)"
	female_caption.text = "NỮ" if _preview_missing(female_preview).is_empty() else "NỮ\n(chưa có hình)"


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
