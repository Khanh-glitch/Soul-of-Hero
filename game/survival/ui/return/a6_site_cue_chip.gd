class_name A6SiteCueChip
extends PanelContainer

## The two D061 cues a player may legitimately see: a trace something left near
## the base, and a threat close enough to hear.
##
## It deliberately has no "safe" and no "hidden" line. An empty projection renders
## nothing at all, so silence never becomes "your house is secure". The world owner
## must publish what was *observed*; A6 will not extrapolate an age forward, because
## pretending to know what happened after the last look is the omniscient meter
## D061 forbids.

const TRAIL_COLOR := Color(1, 0.74, 0.42, 1)
const THREAT_COLOR := Color(1, 0.45, 0.38, 1)

@onready var trail_label: Label = %TrailLine
@onready var threat_label: Label = %ThreatLine

var _last_view: Dictionary = {}


func _ready() -> void:
	clear()


static func build_view(cues: Dictionary) -> Dictionary:
	if not bool(cues.get("available", false)):
		return {"visible": false, "reason": String(cues.get("reason", ""))}
	var trail: Dictionary = cues.get("trail", {})
	var threat_rows: Array = cues.get("threats", [])
	var trail_line := ""
	if bool(trail.get("present", false)):
		trail_line = "Dấu vết còn mới · %s trước" % A6TimeFormat.away(int(trail.get("age_seconds", 0)))
	var threat_line := ""
	if not threat_rows.is_empty():
		var nearest: Dictionary = threat_rows[0]
		var distance := int(round(float(nearest.get("distance_m", 0.0))))
		var label := String(nearest.get("label", "")).strip_edges()
		threat_line = "%s · %d m" % [label, distance] if not label.is_empty() else "Có tiếng động · %d m" % distance
	# Nothing observed means nothing shown. No "clear" verdict is ever printed.
	if trail_line.is_empty() and threat_line.is_empty():
		return {"visible": false, "reason": "no_signs"}
	return {
		"visible": true,
		"reason": "",
		"trail": trail_line,
		"threat": threat_line,
	}


func present(cues: Dictionary) -> Dictionary:
	var view := build_view(cues)
	_last_view = view
	if not bool(view.get("visible", false)):
		clear()
		return view
	trail_label.text = String(view["trail"])
	trail_label.visible = not trail_label.text.is_empty()
	threat_label.text = String(view["threat"])
	threat_label.visible = not threat_label.text.is_empty()
	trail_label.add_theme_color_override("font_color", TRAIL_COLOR)
	threat_label.add_theme_color_override("font_color", THREAT_COLOR)
	visible = true
	return view


func clear() -> void:
	_last_view = {"visible": false}
	visible = false


func view() -> Dictionary:
	return _last_view
