extends Node2D

## Visual-only pilot. No combat, map or save authority.
const TIMELINE = preload("res://prototypes/vfx_lab/vfx_timeline.gd")
const NAMES := ["", "K-Night #07 RV — Severed Formation", "Venomwright #16 — Crystal Rot", "Sword #01 — Hairline Rupture"]
const CUTS := [
  [Vector2(110, 150), Vector2(510, 150), 0.35],
  [Vector2(462, 55), Vector2(266, 305), 1.05],
  [Vector2(180, 55), Vector2(470, 300), 1.75]
]
@onready var hud: Label = $HUD/Label
@onready var camera: Camera2D = $Camera2D
var skill := 1
var clock := 0.0
var speed := 1.0
var playing := true
var moving_enemy := false
var moving_camera := false
var caster := Vector2(100, 180)
var enemy := Vector2(320, 180)
var cues: Array[String] = []

func _ready() -> void:
  camera.make_current()

func _process(delta: float) -> void:
  if playing:
    _seek(clock + minf(delta, 0.1) * speed, true)
    if clock >= TIMELINE.duration_of(skill):
      playing = false
  if moving_enemy and skill == 2:
    enemy = Vector2(320 + 43 * sin(clock * 2.4), 180 + 17 * sin(clock * 1.3))
  var d := Vector2.ZERO
  if Input.is_key_pressed(KEY_A): d.x -= 1
  if Input.is_key_pressed(KEY_D): d.x += 1
  if Input.is_key_pressed(KEY_W): d.y -= 1
  if Input.is_key_pressed(KEY_S): d.y += 1
  caster = (caster + d.normalized() * delta * 85.0).clamp(Vector2(25, 45), Vector2(620, 340))
  camera.position = caster if moving_camera else Vector2(320, 180)
  hud.text = "%s  |  %s  %.2f/%.2f  x%.2f  FPS:%d\n1/2/3 switch  SPACE pause  LEFT/RIGHT step  +/- speed  R reset  M moving enemy  C camera  WASD caster  click retarget\n%s" % [NAMES[skill], "PLAY" if playing else "PAUSE", clock, TIMELINE.duration_of(skill), speed, Engine.get_frames_per_second(), " | ".join(cues)]
  queue_redraw()

func _seek(next: float, forward: bool = false) -> void:
  var old := clock
  clock = TIMELINE.clamp_time(skill, next)
  if not forward or clock < old:
    old = -0.001
    cues.clear()
  for event: Dictionary in TIMELINE.events_between(skill, old, clock):
    cues.push_front("%.2fs %s" % [float(event["t"]), String(event["cue"])])
    if cues.size() > 4: cues.pop_back()

func _reset(id: int) -> void:
  skill = id
  clock = 0.0
  speed = 1.0
  playing = true
  moving_enemy = false
  caster = Vector2(100, 180)
  enemy = Vector2(320, 180)
  cues.clear()

func _unhandled_key_input(e: InputEvent) -> void:
  if not e is InputEventKey or not e.pressed or e.echo: return
  match e.keycode:
    KEY_1, KEY_2, KEY_3: _reset(e.keycode - KEY_0)
    KEY_SPACE: playing = not playing
    KEY_R: _reset(skill)
    KEY_M: moving_enemy = not moving_enemy
    KEY_C: moving_camera = not moving_camera
    KEY_LEFT: _seek(clock - 1.0 / 30.0)
    KEY_RIGHT: _seek(clock + 1.0 / 30.0)
    KEY_EQUAL, KEY_KP_ADD: speed = minf(speed * 2.0, 4.0)
    KEY_MINUS, KEY_KP_SUBTRACT: speed = maxf(speed * 0.5, 0.25)

func _unhandled_input(e: InputEvent) -> void:
  if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
    enemy = get_global_mouse_position()

func _draw() -> void:
  draw_rect(Rect2(0, 0, 640, 360), Color("151728"))
  for y in range(0, 360, 24):
    for x in range(0, 640, 24):
      var p := Vector2(x, y)
      if skill == 1:
        for i in CUTS.size():
          var cut: Array = CUTS[i]
          if clock >= float(cut[2]):
            var axis: Vector2 = cut[1] - cut[0]
            var sign_side := 1.0 if (p - cut[0]).cross(axis) > 0.0 else -1.0
            var phase := clampf((clock - float(cut[2])) / 0.5, 0, 1) * (1.0 - clampf((clock - 3.2) / 1.5, 0, 1))
            p += Vector2(-axis.y, axis.x).normalized() * sign_side * phase * (1.0 + i * 0.3)
      draw_rect(Rect2(p.round(), Vector2(23, 23)), Color("303245") if (int(x / 24) + int(y / 24)) % 2 == 0 else Color("282b3d"))
  match skill:
    1: _knight()
    2: _crystal()
    3: _sword()
  _actor(caster, Color("6c9fd0"))
  _actor(enemy, Color("abb0be"))
  if skill == 2: _body_crystals()

func _knight() -> void:
  for cut in CUTS:
    var start := float(cut[2])
    if clock < start: continue
    var u := clampf((clock - start) / 0.47, 0, 1)
    var fade := 1.0 - clampf((clock - start - 0.8) / 2.0, 0, 1)
    var point: Vector2 = (cut[0] as Vector2).lerp(cut[1], u)
    draw_line(cut[0], point, Color(0.35, 0.03, 0.08, fade), 12)
    draw_line(cut[0], point, Color(0.96, 0.42, 0.40, fade), 4)
    draw_line(cut[0], point, Color(1, 0.95, 0.81, fade), 1)
  if clock > 2.48 and clock < 3.38:
    var p := (clock - 2.48) / 0.9
    draw_arc(Vector2(340, 170), 92 * p, 0, TAU, 40, Color(0.9, 0.5, 0.59, 1 - p), 3)

func _crystal() -> void:
  if clock < 0.23:
    var p := clampf(clock / 0.23, 0, 1)
    draw_circle(caster.lerp(enemy, p) - Vector2(0, 22 * sin(PI * p)), 4, Color("e2c7fa"))
  for i in range(4):
    var t := 0.48 + i * 0.13
    if clock < t: continue
    var u := clampf((clock - t) / 0.8, 0, 1)
    var fade := 1.0 - clampf((clock - 2.84) / 0.52, 0, 1)
    var p := enemy + Vector2(cos(i * PI / 2) * 33, sin(i * PI / 2) * 30)
    draw_line(enemy, p, Color(0.54, 0.24, 0.74, fade), 2)
    for j in range(4):
      var base := p + Vector2(j * 6 - 10, 0)
      var tip := base - Vector2(0, float(10 + (i * 7 + j * 9) % 20) * u * fade)
      draw_colored_polygon(PackedVector2Array([base - Vector2(3, 0), tip, base + Vector2(4, 0)]), Color(0.77, 0.54, 0.95, fade))
  if clock >= 2.84 and clock < 3.6:
    var p := (clock - 2.84) / 0.76
    draw_arc(enemy, 70 * p, 0, TAU, 40, Color(0.87, 0.7, 1, 1 - p), 2)

func _body_crystals() -> void:
  var strength: float = TIMELINE.body_crystal_strength(clock)
  if strength <= 0: return
  for i in range(8):
    var a := i * 2.39996
    var p := enemy + Vector2(cos(a) * 8, -17 + sin(a) * 13)
    var tip := p + Vector2(cos(a) * 8, -float(6 + i % 4 * 2)) * strength
    draw_colored_polygon(PackedVector2Array([p - Vector2(3, 0), tip, p + Vector2(3, 0)]), Color("e4c9ff") if i % 2 == 0 else Color("9d70bb"))

func _sword() -> void:
  if clock < 0.55: return
  var u := clampf((clock - 0.55) / 0.36, 0, 1)
  var fade := 1.0 - clampf((clock - 2.8) / 1.7, 0, 1)
  var a := Vector2(95, 176)
  var b := a.lerp(Vector2(390, 176), u)
  draw_line(a, b, Color(0.3, 0.02, 0.06, fade), 11)
  draw_line(a, b, Color(0.95, 0.31, 0.26, fade), 4)
  draw_line(a, b, Color(1, 0.91, 0.73, fade), 1)
  if clock >= 1.1 and clock < 3.6:
    var k := clampf((clock - 1.1) / 0.8, 0, 1)
    var f := 1.0 - clampf((clock - 2.8) / 0.8, 0, 1)
    for i in range(7):
      for side in [-1, 1]:
        var x := 101 + i * 39
        var yy: float = 176.0 + float(side) * float(28 + (i * 13) % 24) * k
        draw_colored_polygon(PackedVector2Array([Vector2(x, 176), Vector2(x + 36, 176), Vector2(x + 28, yy), Vector2(x - 6, yy)]), Color(0.52, 0.2, 0.27, 0.75 * f))
  if clock >= 2.8 and clock < 3.5:
    var p := (clock - 2.8) / 0.7
    draw_arc(Vector2(300, 176), 112 * p, 0, TAU, 40, Color(1, 0.58, 0.35, 1 - p), 3)

func _actor(p: Vector2, col: Color) -> void:
  draw_rect(Rect2(p + Vector2(-9, -1), Vector2(18, 4)), Color(0, 0, 0, 0.6))
  draw_rect(Rect2(p + Vector2(-7, -24), Vector2(14, 20)), col.darkened(0.45))
  draw_rect(Rect2(p + Vector2(-6, -34), Vector2(12, 11)), col)
  draw_rect(Rect2(p + Vector2(-4, -30), Vector2(2, 2)), Color("171421"))
  draw_rect(Rect2(p + Vector2(2, -30), Vector2(2, 2)), Color("171421"))
