class_name A6ReturnDigest
extends PanelContainer

## The "while you were away" card.
##
## It reports only what the owners actually settled for this return. If no owner
## published a digest — which is the state of the world today, because A1/A3 have
## no offline production yet — the card does not appear at all instead of showing
## a cheerful empty reward. "You found 0 apples" teaches players to distrust the
## screen, so the honest empty state is silence.
##
## Non-blocking by construction: a corner panel, no scrim, no pause, one primary
## button and a secondary link to the season record.

signal dismissed
signal history_requested

const KIND_TITLES := {
	"forge": "Lò rèn",
	"research": "Bàn nghiên cứu",
	"crop": "Vườn",
	"food": "Bếp",
	"water": "Giếng nước",
}
const STOP_NOTES := {
	"fuel_empty": "Đã hết nhiên liệu",
	"input_empty": "Đã hết nguyên liệu",
	"output_full": "Kho đã đầy",
	"no_water": "Đã hết nước",
	"queue_empty": "Hàng đợi đã xong",
	"capacity_full": "Đã đầy chỗ chứa",
	"season_ended": "Mùa đã khép",
	"unknown": "",
}
const GAIN_COLOR := Color(0.46, 0.9, 0.66, 1)
const NOTE_COLOR := Color(0.76, 0.61, 0.39, 1)
const ALERT_COLOR := Color(1, 0.45, 0.38, 1)

@onready var subtitle_label: Label = %Subtitle
@onready var row_list: VBoxContainer = %RowList
@onready var continue_button: Button = %Continue
@onready var history_button: Button = %History

var _last_view: Dictionary = {}


func _ready() -> void:
	continue_button.pressed.connect(func() -> void: dismiss())
	history_button.pressed.connect(func() -> void: history_requested.emit())
	clear()


static func build_view(digest: Dictionary) -> Dictionary:
	if not bool(digest.get("available", false)):
		return {"visible": false, "reason": String(digest.get("reason", ""))}
	var rows: Array[Dictionary] = []
	for entry_value: Variant in digest.get("production", []):
		var entry: Dictionary = entry_value
		var title := String(KIND_TITLES.get(String(entry.get("kind", "")), ""))
		if title.is_empty():
			continue
		var units := int(entry.get("completed_units", 0))
		var detail := "%d %s" % [units, String(entry.get("unit_label", ""))]
		var stop_note := String(STOP_NOTES.get(String(entry.get("stop_reason", "")), ""))
		rows.append({
			"title": title,
			"detail": detail,
			"note": stop_note,
			"tone": "gain",
		})
	var provisions: Dictionary = digest.get("provisions", {})
	var consumed := int(provisions.get("consumed", 0))
	if consumed > 0:
		rows.append({
			"title": "Lương thực đã dùng",
			"detail": "%d phần" % consumed,
			"note": "",
			"tone": "note",
		})
	if bool(provisions.get("hp_floor", false)):
		rows.append({
			"title": "Bạn gục trong nhà",
			"detail": "Tỉnh dậy với 1 máu",
			"note": "Mái nhà đã giữ bạn lại",
			"tone": "alert",
		})
	for change_value: Variant in digest.get("world_changes", []):
		var change := String(change_value).strip_edges()
		if change.is_empty():
			continue
		rows.append({"title": change, "detail": "", "note": "", "tone": "note"})
	if rows.is_empty():
		return {"visible": false, "reason": "digest_without_rows"}
	return {
		"visible": true,
		"reason": "",
		"subtitle": "Vắng %s" % A6TimeFormat.away(int(digest.get("away_seconds", 0))),
		"rows": rows,
	}


func present(digest: Dictionary) -> Dictionary:
	var view := build_view(digest)
	_last_view = view
	if not bool(view.get("visible", false)):
		clear()
		return view
	subtitle_label.text = String(view["subtitle"])
	_rebuild_rows(view["rows"])
	visible = true
	return view


func clear() -> void:
	_last_view = {"visible": false}
	visible = false


func dismiss() -> void:
	if not visible:
		return
	clear()
	dismissed.emit()


func view() -> Dictionary:
	return _last_view


func _rebuild_rows(rows: Array) -> void:
	for child: Node in row_list.get_children():
		row_list.remove_child(child)
		child.queue_free()
	for row_value: Variant in rows:
		row_list.add_child(_row_control(row_value))


func _row_control(row: Dictionary) -> Control:
	var line := VBoxContainer.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_constant_override("separation", 0)
	var head := HBoxContainer.new()
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_theme_constant_override("separation", 6)
	var title := Label.new()
	title.text = String(row.get("title", ""))
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_color_override("font_color", _tone_color(String(row.get("tone", "note"))))
	head.add_child(title)
	var detail := String(row.get("detail", ""))
	if not detail.is_empty():
		var detail_label := Label.new()
		detail_label.text = detail
		detail_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		detail_label.theme_type_variation = &"NumberLabel"
		detail_label.add_theme_font_size_override("font_size", 12)
		head.add_child(detail_label)
	line.add_child(head)
	var note := String(row.get("note", ""))
	if not note.is_empty():
		var note_label := Label.new()
		note_label.text = note
		note_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		note_label.theme_type_variation = &"MutedLabel"
		line.add_child(note_label)
	return line


func _tone_color(tone: String) -> Color:
	match tone:
		"gain":
			return GAIN_COLOR
		"alert":
			return ALERT_COLOR
		_:
			return NOTE_COLOR
