## Faithful port of original C engine/palette.ts — discrete banded ramps
## (lookups snap to bands; that is what keeps the pixel-art reading).
extends RefCounted
class_name CPalette

static func _hex(h: String) -> Vector3:
    var n := h.trim_prefix("#").hex_to_int()
    return Vector3(float((n >> 16) & 255) / 255.0, float((n >> 8) & 255) / 255.0, float(n & 255) / 255.0)

static func _r(list: Array) -> Array:
    var out: Array = []
    for h in list:
        out.append(_hex(h))
    return out

static var P: Dictionary = {}

static func _ensure() -> void:
    if not P.is_empty():
        return
    P = {
        "fire": _r(["#140608", "#3a0a10", "#6e0f16", "#a8180f", "#de4512", "#f7821b", "#ffbb3a", "#ffe58a", "#fffbe8"]),
        "ember": _r(["#2b0a0c", "#7a1410", "#d1400f", "#ff9a2a", "#ffe9a0"]),
        "ash": _r(["#0d0b0c", "#1f1a1a", "#383030", "#5a4d48", "#857268"]),
        "water": _r(["#040c1a", "#08203d", "#0d3a63", "#145f8e", "#1f8fb8", "#43c0dc", "#93e6f2", "#e8fdff"]),
        "deep": _r(["#02060f", "#041228", "#071f3e", "#0b3157", "#114a73"]),
        "ice": _r(["#101a33", "#1d3557", "#2f5d8a", "#4f8fc0", "#86c3e8", "#c4ecff", "#f4feff"]),
        "foam": _r(["#a9e9f4", "#d9f8ff", "#ffffff"]),
        "volt": _r(["#0a0a20", "#1b1c52", "#3134a6", "#5a72ff", "#93bdff", "#d8f0ff", "#ffffff"]),
        "plasma": _r(["#1c0a33", "#4b1a8a", "#8d4cff", "#c9a2ff", "#f3e6ff"]),
        "steel": _r(["#0d0f1a", "#1e2236", "#373d5c", "#5c6688", "#8d98b8"]),
        "leaf": _r(["#06140c", "#0f2e1b", "#1a4d2a", "#2a7536", "#4e9e3a", "#8ccc4c", "#d2f58a", "#f6ffd2"]),
        "bark": _r(["#120c09", "#2a1a12", "#46301e", "#6b4a2c", "#957043"]),
        "bloom": _r(["#3d0a2a", "#7a1652", "#c42f7e", "#ef6fa8", "#ffb6d3", "#fff0f6"]),
        "spore": _r(["#06231e", "#0b4a3e", "#14806a", "#33c4a0", "#86f2d2", "#e0fff6"]),
        "gold": _r(["#3a2206", "#7a4d0e", "#c08a1c", "#f2c54a", "#fff0a8"]),
        "void": _r(["#030209", "#0e0724", "#231048", "#43207e", "#7440c4", "#ad7cff", "#e3d0ff", "#ffffff"]),
        "star": _r(["#2a1a4a", "#6a52b0", "#b6a6ff", "#e8e4ff", "#fffef2"]),
        "rift": _r(["#ff3fc1", "#ff8ae0", "#7ff3ff", "#d6ffff"]),
    }

static func ramp(r: Array, t: float) -> Vector3:
    _ensure()
    var i := 0 if t <= 0.0 else (r.size() - 1 if t >= 1.0 else floori(t * float(r.size())))
    return r[i if i < r.size() else r.size() - 1]

static func ramp_d(r: Array, t: float, th: float) -> Vector3:
    _ensure()
    var f := t * float(r.size() - 1)
    var i := floori(f)
    if f - float(i) > th:
        i += 1
    return r[clampi(i, 0, r.size() - 1)]
