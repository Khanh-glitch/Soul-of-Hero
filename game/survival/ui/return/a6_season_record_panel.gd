class_name A6SeasonRecordPanel
extends PanelContainer

## Account-level record: the seasons that ended and the achievements that outlived
## them (D056). This is the only place a run may be compared to another, and it
## still refuses to invent a score: a season is described by when it ran, how long
## it lasted and what the player marked as done.
##
## Ownership: A6 renders. A0 stores. Nothing here writes, awards or unlocks — a
## stored achievement that claimed to grant power would be dropped on the floor by
## `A6ProjectionContract.sanitize_run_history()`, because D056 says achievements
## must never become gameplay advantage.

signal closed

const EMPTY_RUNS := "Chưa có mùa nào khép lại"
const EMPTY_ACHIEVEMENTS := "Chưa có thành tựu nào"
## When A0 publishes no account history at all, the panel must not claim the player
## has never finished a season. It says it has nothing to show instead.
const UNPUBLISHED_RUNS := "Chưa có dữ liệu mùa"
const UNPUBLISHED_ACHIEVEMENTS := "Chưa có dữ liệu thành tựu"
const REASON_LABELS := {
	"deadline": "Hết 14 ngày",
	"abandoned": "Bạn khép sớm",
}

@onready var now_label: Label = %NowLine
@onready var run_list: VBoxContainer = %RunList
@onready var runs_empty: Label = %RunsEmpty
@onready var achievement_list: VBoxContainer = %AchievementList
@onready var achievements_empty: Label = %AchievementsEmpty
@onready var close_button: Button = %Close

var _last_view: Dictionary = {}


func _ready() -> void:
	close_button.pressed.connect(close)
	clear()


static func build_view(history: Dictionary, clock: Dictionary, now_unix: int) -> Dictionary:
	var history_available := bool(history.get("available", false))
	var clock_available := bool(clock.get("available", false))
	var now_line := ""
	if bool(clock.get("available", false)):
		if A6ProjectionContract.is_run_over(clock, now_unix):
			now_line = "Mùa %02d đã khép" % maxi(1, int(clock.get("run_number", 1)))
		else:
			now_line = "Mùa %02d còn %s" % [
				maxi(1, int(clock.get("run_number", 1))),
				A6TimeFormat.countdown(A6ProjectionContract.remaining_seconds(clock, now_unix)),
			]
	var runs: Array[Dictionary] = []
	for record_value: Variant in history.get("runs", []) if history_available else []:
		var record: Dictionary = record_value
		var started := int(record.get("started_at_unix", 0))
		var ended := int(record.get("ended_at_unix", 0))
		var length := A6TimeFormat.season_length(started, ended)
		var title := "%s → %s" % [A6TimeFormat.day_month(started), A6TimeFormat.day_month(ended)]
		var note := String(REASON_LABELS.get(String(record.get("end_reason", "")), ""))
		if not length.is_empty():
			note = "%s · %s" % [note, length] if not note.is_empty() else length
		var milestones: Array[String] = []
		for milestone_value: Variant in record.get("milestones", []):
			var milestone := String(milestone_value).strip_edges()
			if not milestone.is_empty():
				milestones.append(milestone)
		runs.append({
			"title": title,
			"note": note,
			"milestones": " · ".join(milestones),
		})
	var achievements: Array[Dictionary] = []
	for achievement_value: Variant in history.get("achievements", []) if history_available else []:
		var achievement: Dictionary = achievement_value
		var earned := int(achievement.get("earned_at_unix", 0))
		achievements.append({
			"title": String(achievement.get("title", "")),
			"detail": String(achievement.get("detail", "")),
			"note": A6TimeFormat.day_month(earned) if earned > 0 else "",
		})
	return {
		"available": clock_available or history_available,
		"reason": "" if (clock_available or history_available) else "record_unpublished",
		"now_line": now_line,
		"runs": runs,
		"achievements": achievements,
		"history_available": history_available,
		"runs_empty": EMPTY_RUNS if history_available else UNPUBLISHED_RUNS,
		"achievements_empty": EMPTY_ACHIEVEMENTS if history_available else UNPUBLISHED_ACHIEVEMENTS,
	}


func present(history: Dictionary, clock: Dictionary, now_unix: int) -> Dictionary:
	var view := build_view(history, clock, now_unix)
	_last_view = view
	if not bool(view.get("available", false)):
		clear()
		return view
	now_label.text = String(view["now_line"])
	now_label.visible = not now_label.text.is_empty()
	_fill(run_list, view["runs"], "run")
	runs_empty.text = String(view["runs_empty"])
	runs_empty.visible = (view["runs"] as Array).is_empty()
	_fill(achievement_list, view["achievements"], "achievement")
	achievements_empty.text = String(view["achievements_empty"])
	achievements_empty.visible = (view["achievements"] as Array).is_empty()
	return view


func open(history: Dictionary, clock: Dictionary, now_unix: int) -> Dictionary:
	# The record is always openable. An account with no history yet gets an
	# explicit "nothing published" line rather than a fabricated first season.
	var view := present(history, clock, now_unix)
	visible = true
	close_button.grab_focus()
	return view


func close() -> void:
	visible = false
	closed.emit()


func clear() -> void:
	_last_view = {}
	visible = false


func view() -> Dictionary:
	return _last_view


func _fill(target: VBoxContainer, rows: Array, kind: String) -> void:
	for child: Node in target.get_children():
		target.remove_child(child)
		child.queue_free()
	for row_value: Variant in rows:
		var row: Dictionary = row_value
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
		head.add_child(title)
		var note := String(row.get("note", ""))
		if not note.is_empty():
			var note_label := Label.new()
			note_label.text = note
			note_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
			note_label.theme_type_variation = &"MutedLabel"
			head.add_child(note_label)
		line.add_child(head)
		if kind == "run":
			var milestones := String(row.get("milestones", ""))
			if not milestones.is_empty():
				var milestone_label := Label.new()
				milestone_label.text = milestones
				milestone_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
				milestone_label.theme_type_variation = &"MutedLabel"
				milestone_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				line.add_child(milestone_label)
		else:
			var detail := String(row.get("detail", ""))
			if not detail.is_empty():
				var detail_label := Label.new()
				detail_label.text = detail
				detail_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
				detail_label.theme_type_variation = &"MutedLabel"
				detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				line.add_child(detail_label)
		target.add_child(line)
