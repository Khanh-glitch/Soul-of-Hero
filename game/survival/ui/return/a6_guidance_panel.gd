class_name A6GuidancePanel
extends PanelContainer

## The starter checklist (D057), rendered from the owner's durable run facts.
##
## Two shapes, both small:
##   * first run — the whole five-step chain, one line each, current step hinted;
##   * later runs — only the first unfinished step, because a returning player does
##     not need the tour again and D052 forbids clutter.
##
## Steps are tri-state. `✓` means the owner recorded the action as performed this
## run, `•` means it is known to still be open, and `?` means nobody has published
## that fact yet — which is not the same as "not done". A card full of unknowns
## prints its progress as "—/5" with a muted "Chưa ghi nhận: N bước" instead of
## claiming 0/5.
##
## The panel never blocks: it is a corner card with no scrim, the world keeps
## running underneath, and it can be dismissed for the session.

signal dismissed

const DONE_COLOR := Color(0.46, 0.9, 0.66, 1)
const OPEN_COLOR := Color(0.94, 0.9, 0.82, 1)
const UNKNOWN_COLOR := Color(0.62, 0.58, 0.66, 1)
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
	var unknown := int(model.get("unknown", 0))
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
		var state := String(step.get("state", "unknown"))
		rows.append({
			"marker": "✓" if state == "done" else ("?" if state == "unknown" else "•"),
			"title": String(step.get("title", "")),
			"hint": "" if state == "done" else String(step.get("hint", "")),
			"evidence": String(step.get("evidence", "")),
			"state": state,
			"done": state == "done",
			"unknown": state == "unknown",
			"is_current": String(step.get("id", "")) == String((steps[current] as Dictionary).get("id", "")),
		})
	var kicker := "BẮT ĐẦU" if mode == "first_run" else "GỢI Ý"
	# "0/5" would be a claim: with unknown steps we simply do not know how many are
	# done, so the progress reads "—/5" and the footnote says why.
	var progress := "—/%d" % total if unknown > 0 else "%d/%d" % [completed, total]
	var footnote := ""
	if unknown > 0:
		footnote = "Chưa ghi nhận: %d bước" % unknown
	elif mode == "first_run":
		footnote = "Mẹo: mọi bước đều tự đánh dấu khi bạn đã làm"
	return {
		"visible": true,
		"reason": "",
		"kicker": kicker,
		"progress": progress,
		"rows": rows,
		"footnote": footnote,
		"mode": mode,
		"provisional": unknown > 0,
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
	marker.add_theme_color_override("font_color", _state_color(String(row.get("state", "unknown"))))
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


func _state_color(state: String) -> Color:
	match state:
		"done":
			return DONE_COLOR
		"unknown":
			return UNKNOWN_COLOR
		_:
			return OPEN_COLOR


func _on_dismiss_pressed() -> void:
	clear()
	dismissed.emit()
