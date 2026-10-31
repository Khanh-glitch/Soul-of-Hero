class_name A6RunCard
extends Button

## The season chip: how much of the 14-real-day run is left, always on screen but
## never in the way. Pressing it opens the season record.
##
## The card is a Button on purpose. D052 asks for a small, contextual HUD that a
## controller can reach, and a Button is the only control that already has a focus
## ring, a hover state and a keyboard/joypad activation path in this project's
## theme. Its labels ignore the mouse so the whole plate is one target.
##
## Nothing is drawn when A0 publishes no season clock: an invented countdown would
## be worse than no countdown, because players plan around it.

signal activated

## Parchment ink. The card is a light authored plate now, so urgency is expressed by
## darkening towards red rather than lightening towards white.
const DEFAULT_CALM := Color(0.24, 0.14, 0.09, 1)
const DEFAULT_WARNING := Color(0.55, 0.3, 0.06, 1)
const DEFAULT_CRITICAL := Color(0.62, 0.13, 0.09, 1)
const DEFAULT_SPENT := Color(0.36, 0.32, 0.3, 1)

@onready var kicker_label: Label = %Kicker
@onready var countdown_label: Label = %Countdown
@onready var bar: ProgressBar = %RemainingBar
@onready var note_label: Label = %EndNote

var _last_view: Dictionary = {}


func _ready() -> void:
	pressed.connect(func() -> void: activated.emit())
	clear()


## Pure presentation model, kept static so tests can assert wording without a
## scene tree and without a renderer.
static func build_view(clock: Dictionary, now_unix: int) -> Dictionary:
	if not bool(clock.get("available", false)):
		return {"visible": false, "reason": String(clock.get("reason", ""))}
	var run_number := maxi(1, int(clock.get("run_number", 1)))
	var remaining := A6ProjectionContract.remaining_seconds(clock, now_unix)
	var over := A6ProjectionContract.is_run_over(clock, now_unix)
	var urgency := "calm"
	if over:
		urgency = "spent"
	elif remaining <= 6 * 3600:
		urgency = "critical"
	elif remaining <= 26 * 3600:
		urgency = "warning"
	var countdown := "Đã khép" if over else A6TimeFormat.countdown(remaining)
	var note := "Mùa mới chờ bạn mở" if over else "Hết mùa %s" % A6TimeFormat.day_month(int(clock.get("ends_at_unix", 0)))
	var progress := 0.0 if over else clampf(float(remaining) / float(A6ProjectionContract.RUN_SECONDS) * 100.0, 0.0, 100.0)
	return {
		"visible": true,
		"reason": "",
		"kicker": "MÙA %02d" % run_number,
		"countdown": countdown,
		"note": note,
		"progress": progress,
		"urgency": urgency,
		"run_number": run_number,
		"remaining_seconds": remaining,
		"over": over,
	}


func present(clock: Dictionary, now_unix: int) -> Dictionary:
	var view := build_view(clock, now_unix)
	_last_view = view
	if not bool(view.get("visible", false)):
		clear()
		return view
	kicker_label.text = String(view["kicker"])
	countdown_label.text = String(view["countdown"])
	note_label.text = String(view["note"])
	bar.value = float(view["progress"])
	countdown_label.add_theme_color_override("font_color", _color_for(String(view["urgency"])))
	tooltip_text = "Mùa hiện tại · %s còn lại" % String(view["countdown"]) if not bool(view["over"]) else "Mùa đã khép"
	visible = true
	return view


func clear() -> void:
	_last_view = {"visible": false}
	countdown_label.text = ""
	note_label.text = ""
	kicker_label.text = ""
	bar.value = 0.0
	tooltip_text = ""
	visible = false


func view() -> Dictionary:
	return _last_view


func _color_for(urgency: String) -> Color:
	match urgency:
		"critical":
			return DEFAULT_CRITICAL
		"warning":
			return DEFAULT_WARNING
		"spent":
			return DEFAULT_SPENT
		_:
			return DEFAULT_CALM
