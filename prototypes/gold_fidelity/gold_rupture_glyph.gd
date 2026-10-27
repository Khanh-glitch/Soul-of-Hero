class_name GoldRuptureGlyph
extends Node2D

## Source-derived Part.draw() / Chunk.draw() from top-down-sword-vfx-laboratory:
## engine/world.ts. The procedural vertices are recalculated every live tick.
## Not a baked flipbook. One isolated non-center wave is the fidelity target.
const DYNAMICS = preload("res://prototypes/gold_fidelity/gold_fx_dynamics.gd")
const SHARD = [1.15, 0.0, -0.45, 0.17, -0.35, -0.12]
const CRIMSON_RAMP := [0xffd0c0, 0xff5a4a, 0xc01830, 0x6a0a20, 0x2a0818]
var kind := ""
var state: Dictionary = {}
var dead := false

func configure(source_kind: String, input: Dictionary) -> void:
    kind = source_kind
    if kind == "part":
        state = DYNAMICS.part(input)
    elif kind == "chunk":
        state = DYNAMICS.chunk(input)
        # Chunk.init('shard') is a fixed THREE-vertex polygon in original.
        if String(state.get("kind", "shard")) in ["shard", "crimson"]:
            state["shape"] = PackedFloat32Array(SHARD)
        else:
            push_error("GoldRuptureGlyph requires original randomized source shape for non-shards.")
            dead = true
            return
    else:
        push_error("Unsupported source primitive: " + kind)
        dead = true
        return
    z_index = int(state.get("layer", 3))
    update_gold_pose()

func step_gold(dt: float) -> void:
    if dead:
        return
    if kind == "part":
        DYNAMICS.step_part(state, dt)
    else:
        DYNAMICS.step_chunk(state, dt)
    dead = bool(state.get("dead", false))
    visible = not dead
    if not dead:
        update_gold_pose()

func update_gold_pose() -> void:
    # World uses x/y in logical 480x270 screen space; z is altitude.
    position = Vector2(roundf(float(state["x"])), roundf(float(state["y"]) - float(state["z"])))
    queue_redraw()

func _draw() -> void:
    if dead or state.is_empty():
        return
    if kind == "part":
        _part_draw()
    elif kind == "chunk":
        _chunk_draw()

static func _rgb(h: int) -> Color:
    return Color8((h >> 16) & 255, (h >> 8) & 255, h & 255)

func _part_draw() -> void:
    var p := clampf(float(state["t"]) / maxf(float(state["life"]), 0.0001), 0.0, 1.0)
    var color_index := mini(CRIMSON_RAMP.size()-1, int(floor(p * float(CRIMSON_RAMP.size()))))
    var col: Color = _rgb(CRIMSON_RAMP[color_index])
    var size: float = float(state.get("size", 1.0))
    var streak: float = float(state.get("streak", 0.0))
    if streak > 0.0:
        var dx: float = float(state["vx"]) * streak
        var dy: float = (float(state["vy"]) - float(state["vz"])) * streak
        var length := maxf(Vector2(dx, dy).length(), 1.0)
        var half: float = 0.5 * maxf(1.0, size * 0.8)
        var normal := Vector2(-dy, dx) / length * half
        var backwards := Vector2(dx, dy)
        draw_colored_polygon(PackedVector2Array([
            normal, -normal, -backwards-normal, -backwards+normal
        ]), col)
    else:
        var current_size := maxf(1.0, roundf(size * (1.0 - float(state.get("shrink", 0.5)) * p)))
        draw_rect(Rect2(Vector2(-current_size*0.5, -current_size*0.5), Vector2(current_size, current_size)), col)

func _source_poly(scale: float) -> PackedVector2Array:
    var out := PackedVector2Array()
    var rot: float = float(state["rot"])
    var cc := cos(rot)
    var ss := sin(rot)
    var extent: float = float(state.get("s", 3.0)) * scale
    var xy: PackedFloat32Array = state["shape"]
    for i in range(xy.size()/2):
        var px: float = xy[i*2] * extent * float(state.get("sx", 1.0))
        var py: float = xy[i*2+1] * extent * float(state.get("sy", 1.0))
        out.append(Vector2(px*cc-py*ss, px*ss+py*cc))
    return out

func _chunk_draw() -> void:
    var progress := float(state["t"]) / maxf(float(state["life"]), 0.0001)
    var fade := 1.0 if progress <= 0.8 else 1.0 - (progress - 0.8) / 0.2
    if fade <= 0.05:
        return
    var crimson := String(state.get("kind", "shard")) == "crimson"
    var side := Color8(0x20, 0x06, 0x0c) if crimson else Color8(0x0b, 0x0f, 0x18)
    var top := Color8(0xff, 0x5a, 0x50) if crimson else Color8(0xea, 0xf2, 0xff)
    var edge := Color8(0xff, 0xd8, 0xc8) if crimson else Color.WHITE
    side.a = fade
    top.a = fade
    edge.a = fade
    draw_colored_polygon(_source_poly(1.45), side)
    draw_colored_polygon(_source_poly(1.0), top)
    if float(state.get("s", 3.0)) > 3.0:
        draw_colored_polygon(_source_poly(0.45), edge)
