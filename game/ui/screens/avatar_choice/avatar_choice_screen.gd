extends Control

## New Game's one authored identity step. The player picks the authentic CraftPix
## base character (male 555940 or female 419402); the choice is written to A0's
## SaveService exactly once, and every later screen reads it back as the single
## source of truth. This screen never invents a character, never falls back to
## the Knight, and never grants items.

const PRIVATE_MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"
const PUBLIC_MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
const SOURCE_FRAME := Vector2(64.0, 64.0)
const SUPPORTED_GENDERS := ["male", "female"]

@onready var male_button: Button = %MaleButton
@onready var female_button: Button = %FemaleButton
@onready var back_button: Button = %BackButton
@onready var male_preview: TextureRect = %MalePreview
@onready var female_preview: TextureRect = %FemalePreview
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
	var staged := _manifest_has_staged_art(manifest)
	if not staged:
		status_label.text = "Chưa cài art nhân vật (private staging). Bạn vẫn có thể chọn danh tính."
		status_label.show()
	var male_texture := _idle_texture(manifest, "male")
	if male_texture != null:
		male_preview.texture = male_texture
		male_preview.visible = true
		male_caption.text = "NAM • 555940\nIdle / Walk / Run / Kiếm"
	else:
		male_preview.visible = false
		male_caption.text = "NAM • 555940\n(art chưa cài)"
	var female_texture := _idle_texture(manifest, "female")
	if female_texture != null:
		female_preview.texture = female_texture
		female_preview.visible = true
		female_caption.text = "NỮ • 419402\nIdle / Walk / Run / Kiếm"
	else:
		female_preview.visible = false
		female_caption.text = "NỮ • 419402\n(art chưa cài)"


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
		if grade_zero is Dictionary and not ((grade_zero as Dictionary).get("runtime_action_sheets", {}) as Dictionary).is_empty():
			return true
	return false


## Preview uses the staged idle sheet's front row, first cell. Preview textures
## are read-only and never exported or offered as downloadable art.
func _idle_texture(manifest: Dictionary, gender: String) -> Texture2D:
	var characters: Variant = manifest.get("characters", {})
	if not characters is Dictionary:
		return null
	var record: Variant = (characters as Dictionary).get(gender, {})
	if not record is Dictionary:
		return null
	var grades: Variant = (record as Dictionary).get("armor_grades", {})
	if not grades is Dictionary:
		return null
	var grade_zero: Variant = (grades as Dictionary).get("0", {})
	if not grade_zero is Dictionary:
		return null
	var sheet_path := String((grade_zero as Dictionary).get("idle_sheet", ""))
	if sheet_path.is_empty() or not ResourceLoader.exists(sheet_path):
		return null
	var texture := load(sheet_path) as Texture2D
	if texture == null:
		return null
	var preview := AtlasTexture.new()
	preview.atlas = texture
	preview.region = Rect2(Vector2.ZERO, SOURCE_FRAME)
	return preview
