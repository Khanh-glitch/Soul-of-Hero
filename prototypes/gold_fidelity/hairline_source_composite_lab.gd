extends "res://prototypes/gold_fidelity/hairline_source_components_lab.gd"

## Gate 6 COMPOSITE of three previously source-validated systems:
## floor CPU writes, original 14 pressure sheets, and 13 live rupture waves.
## Source full-hero sword ribbon, enemy contact, hitstop, camera and center extras
## are NOT ported and intentionally remain unimplemented.
const WAVE_LAYER = preload("res://prototypes/gold_fidelity/gold_s01_live_wave_layer.gd")
const RUPTURE_START := 2.5
var _live_waves: GoldS01LiveWaveLayer

func _ready() -> void:
    super._ready()
    # Same 480x270 SubViewport and same post shader as the source components.
    var source_stage: Node = _viewport.get_child(0)
    _live_waves = WAVE_LAYER.new()
    _live_waves.name = "LiveSourceRuptureWaves"
    source_stage.add_child(_live_waves)
    _live_waves.bind_post(_post_material)
    set_gold_time(_time)

func set_gold_time(t: float) -> void:
    super.set_gold_time(t)
    if _live_waves != null:
        _live_waves.seek_seconds(maxf(0.0,_time-RUPTURE_START))

func wave_diagnostics() -> Dictionary:
    return _live_waves.diagnostics() if _live_waves != null else {}
