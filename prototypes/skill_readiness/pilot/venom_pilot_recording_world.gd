class_name VenomPilotRecordingWorld
extends "res://prototypes/skill_readiness/native/venom/venom_world.gd"

## Authored-event recorder for the Venomwright pilot.
##
## This is a verbatim copy of the differential's `ProbeWorld` recorder (the
## methods below are generated from `gold93_venom_differential_test.gd`, not
## retyped), so the pilot records hits and cues with EXACTLY the same field set
## and rounding the original-source differential compared against
## `docs/vfx/skill_readiness/oracle/venomwright_NNN.json`. It only observes; it
## never changes what the generator does. The differential file is not edited.

var hits: Array = []
var cues: Array = []

func _r6(v: float) -> float:
	return snappedf(v, 1e-6)

func _p3(v: float) -> float:
	return snappedf(v, 1e-6)

## The oracle records shock positions with `toFixed(3)`, so those two fields
## are compared at that precision; everything else is compared at 1e-6.
func _shock_v(v: float) -> float:
	return snappedf(v, 1e-3)

func hit(e, amt: float, o: Dictionary) -> bool:
	var r: bool = super.hit(e, amt, o)
	hits.append({
		"t": _r6(time), "e": e.id, "amt": snappedf(amt, 1e-4),
		"kind": String(o.get("kind", "impact")), "src": o.get("src", null),
		"at": o.get("at", null), "kx": _p3(float(o.get("kx", 0.0))),
		"ky": _p3(float(o.get("ky", 0.0))), "stag": _p3(float(o.get("stagger", 0.0))),
		"big": bool(o.get("big", false)), "heal": _p3(float(o.get("heal", 0.0))),
		"killed": r,
	})
	return r

func mark(e, key: String, dur: float, k: float = 1.0) -> void:
	cues.append({"t": _r6(time), "k": "mark", "e": e.id, "key": key,
			"dur": _p3(dur)})
	super.mark(e, key, dur, k)

func poison(e, total: float, dur: float, key: int, src: int,
		every: float = 0.5) -> void:
	cues.append({"t": _r6(time), "k": "poison", "e": e.id,
			"total": _p3(total), "dur": _p3(dur), "src": src})
	super.poison(e, total, dur, key, src, every)

func shake(m: float, d: float = 0.25) -> void:
	cues.append({"t": _r6(time), "k": "shake", "m": _p3(m), "d": _p3(d)})
	super.shake(m, d)

func shock(x: float, y: float, max_: float, dur: float, amp: float = 3) -> void:
	cues.append({"t": _r6(time), "k": "shock", "x": _shock_v(x),
			"y": _shock_v(y), "max": _p3(max_), "dur": _p3(dur),
			"amp": _p3(amp)})
	super.shock(x, y, max_, dur, amp)

func screen_flash(c: int, a: float, dur: float = 0.2) -> void:
	cues.append({"t": _r6(time), "k": "flash", "c": c & 0xFFFFFFFF,
			"a": _p3(a), "dur": _p3(dur)})
	super.screen_flash(c, a, dur)
