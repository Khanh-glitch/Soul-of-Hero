class_name A6GuidancePanel
extends PanelContainer

## The starter checklist (D057), rendered from real committed progress.
##
## Two shapes, both small:
##   * first run — the whole five-step chain, one line each, current step hinted;
##   * later runs — only the first unfinished step, because a returning player does
##     not need the tour again and D052 forbids clutter.
##
## The panel never blocks: it is a corner card with no scrim, the world keeps
## running underneath, and it can be dismissed for the session.

signal dismissed

const DONE_COLOR := Color(0.46, 0.9, 0.66, 1)
const OPEN_COLOR := Color(0.94, 0.9, 0.82, 1)
const CLOSED_COLOR := Color(0.49, 0.46, 0.52, 1)

@onready var kicker_label: Label = %Kicker
@onready var progress_label: Label = %Progress
@onready var step_list: VBoxContainer = %StepList
@onready var footnote_label: Label = %Footnote
@onready var dismiss_button: Button = %Dismiss

var _last_view: Dictionary = {}


func _ready() -> void:
	dismiss_button.pressed.connect(_on_dismiss_pressed)
	clear()


## Pure view model. `dismissed` is passed in rather than stored so the caller owns
## the once-per-session decision and tests cannot leak state between cases.
static func build_view(model: Dictionary, dismissed: bool) -> Dictionary:
	if dismissed or not bool(model.get("available", false)):
		return {"visible": false, "reason": "dismissed" if dismissed else String(model.get("reason", ""))}
	var steps: Array = model.get("steps", [])
	var completed := int(model.get("completed", 0))
	var total := int(model.get("total", steps.size()))
	var mode := String(model.get("mode", "first_run"))
	var current := -1
	for index in range(steps.size()):
		var step: Dictionary = steps[index]
		if not bool(step.get("done", false)):
			current = index
			break
	if current < 0:
		# A finished chain is not worth a card. The player already proved it.
		return {"visible": false, "reason": "chain_complete"}
	var rows: Array[Dictionary] = []
	var shown: Array = steps if mode == "first_run" else [steps[current]]
	for step_value: Variant in shown:
		var step: Dictionary = step_value
		var is_done := bool(step.get("done", false))
		rows.append({
			"marker": "✓" if is_done else "•",
			"title": String(step.get("title", "")),
			"hint": "" if is_done else String(step.get("hint", "")),
			"evidence": String(step.get("evidence", "")),
			"done": is_done,
			"is_current": String(step.get("id", "")) == String((steps[current] as Dictionary).get("id", "")),
		})
	var kicker := "BẮT ĐẦU" if mode == "first_run" else "GỢI Ý"
	var footnote := "Mẹo: mọi bước đều tự đánh dấu khi bạn đã làm" if mode == "first_run" else ""
	return {
		"visible": true,
		"reason": "",
		"kicker": kicker,
		"progress": "%d/%d" % [completed, total],
		"rows": rows,
		"footnote": footnote,
		"mode": mode,
	}


func present(model: Dictionary, dismissed: bool) -> Dictionary:
	var view := build_view(model, dismissed)
	_last_view = view
	if not bool(view.get("visible", false)):
		clear()
		return view
	kicker_label.text = String(view["kicker"])
	progress_label.text = String(view["progress"])
	footnote_label.text = String(view["footnote"])
	footnote_label.visible = not footnote_label.text.is_empty()
	_rebuild_rows(view["rows"])
	visible = true
	return view


func clear() -> void:
	_last_view = {"visible": false}
	visible = false


func view() -> Dictionary:
	return _last_view


func _rebuild_rows(rows: Array) -> void:
	for child: Node in step_list.get_children():
		child.queue_free()
		step_list.remove_child(child)
	for row_value: Variant in rows:
		var row: Dictionary = row_value
		step_list.add_child(_row_control(row))


func _row_control(row: Dictionary) -> Control:
	var line := HBoxContainer.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_constant_override("separation", 6)
	var marker := Label.new()
	marker.text = String(row.get("marker", "•"))
	marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marker.custom_minimum_size = Vector2(12, 0)
	marker.add_theme_color_override("font_color", DONE_COLOR if bool(row.get("done", false)) else OPEN_COLOR)
	line.add_child(marker)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 0)
	var title := Label.new()
	title.text = String(row.get("title", ""))
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title.add_theme_color_override("font_color", CLOSED_COLOR if bool(row.get("done", false)) else OPEN_COLOR)
	column.add_child(title)
	var hint := String(row.get("hint", ""))
	if not hint.is_empty() and bool(row.get("is_current", false)):
		var hint_label := Label.new()
		hint_label.text = hint
		hint_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		hint_label.theme_type_variation = &"MutedLabel"
		column.add_child(hint_label)
	var evidence := String(row.get("evidence", ""))
	if not evidence.is_empty():
		var evidence_label := Label.new()
		evidence_label.text = evidence
		evidence_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		evidence_label.theme_type_variation = &"MutedLabel"
		column.add_child(evidence_label)
	line.add_child(column)
	return line


func _on_dismiss_pressed() -> void:
	clear()
	dismissed.emit()
