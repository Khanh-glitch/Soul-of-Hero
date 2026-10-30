class_name A6SiteCueChip
extends PanelContainer

## The D061 signs a player may legitimately check before logging off: a trace
## something left, a noise they heard, a shape they saw.
##
## This is deliberately **not** a monster radar. An earlier version printed
## "Tiếng bước chân · 42 m" from an arbitrary 400 m radius, which is a sensor the
## player never had and a certainty the game never earned. The contract now carries
## the perception channel and the owner's freshness window instead of metres:
##
##   * `trace` — a physical mark that exists in the world;
##   * `sound` — something audible from where the player stood;
##   * `sight` — something visible on screen.
##
## Every cue is aged forward from the owner's observation and disappears once the
## owner's freshness window has passed, so old evidence cannot keep looking
## current. There is no "safe" or "clear" state: no cues means silence, never a
## promise that the base is protected.

const TRACE_COLOR := Color(1, 0.74, 0.42, 1)
const PERCEIVED_COLOR := Color(1, 0.45, 0.38, 1)

const DEFAULT_LABELS := {
	"trace": "Dấu vết",
	"sound": "Có tiếng động",
	"sight": "Thoáng thấy động",
}
const DIRECTION_WORDS := {
	"": "",
	"left": "bên trái",
	"right": "bên phải",
	"ahead": "phía trước",
	"behind": "phía sau",
	"ahead_left": "trước bên trái",
	"ahead_right": "trước bên phải",
	"behind_left": "sau bên trái",
	"behind_right": "sau bên phải",
}

@onready var trail_label: Label = %TrailLine
@onready var threat_label: Label = %ThreatLine

var _last_view: Dictionary = {}


func _ready() -> void:
	clear()


static func build_view(cues: Dictionary, now_unix: int) -> Dictionary:
	if not bool(cues.get("available", false)):
		return {"visible": false, "reason": String(cues.get("reason", ""))}
	var observed_at := int(cues.get("observed_at_unix", 0))
	var trail_line := ""
	var perceived_line := ""
	for cue_value: Variant in cues.get("cues", []):
		if not cue_value is Dictionary:
			continue
		var cue: Dictionary = cue_value
		var age := A6ProjectionContract.cue_age_at(cue, observed_at, now_unix)
		if age < 0:
			# The owner's freshness window closed. Silence is the only honest output.
			continue
		var line := _cue_line(cue, age)
		if line.is_empty():
			continue
		if String(cue.get("channel", "")) == "trace":
			if trail_line.is_empty():
				trail_line = line
		elif perceived_line.is_empty():
			perceived_line = line
	if trail_line.is_empty() and perceived_line.is_empty():
		return {"visible": false, "reason": "no_fresh_signs"}
	return {"visible": true, "reason": "", "trail": trail_line, "perceived": perceived_line}


static func _cue_line(cue: Dictionary, age: int) -> String:
	var channel := String(cue.get("channel", ""))
	var label := String(cue.get("label", "")).strip_edges()
	if label.is_empty():
		label = String(DEFAULT_LABELS.get(channel, ""))
	if label.is_empty():
		return ""
	var parts: Array[String] = [label]
	var direction := String(DIRECTION_WORDS.get(String(cue.get("direction", "")), ""))
	if not direction.is_empty():
		parts.append(direction)
	parts.append(A6TimeFormat.ago(age))
	return " · ".join(parts)


func present(cues: Dictionary, now_unix: int) -> Dictionary:
	var view := build_view(cues, now_unix)
	_last_view = view
	if not bool(view.get("visible", false)):
		clear()
		return view
	trail_label.text = String(view["trail"])
	trail_label.visible = not trail_label.text.is_empty()
	threat_label.text = String(view["perceived"])
	threat_label.visible = not threat_label.text.is_empty()
	trail_label.add_theme_color_override("font_color", TRACE_COLOR)
	threat_label.add_theme_color_override("font_color", PERCEIVED_COLOR)
	visible = true
	return view


func clear() -> void:
	_last_view = {"visible": false}
	visible = false


func view() -> Dictionary:
	return _last_view
