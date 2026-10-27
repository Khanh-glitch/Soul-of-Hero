extends SceneTree

## Direct source World.updateCam, World.hitstop and World.slow numeric tests.
const CAMERA = preload("res://prototypes/gold_fidelity/gold_source_camera_fx.gd")
const CLOCK = preload("res://prototypes/gold_fidelity/gold_source_hitstop_clock.gd")
const POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const DT := 1.0/60.0

func _initialize() -> void:
    var failures := 0
    var camera = CAMERA.new()
    var clock = CLOCK.new()
    camera.request_shake(9.0,4.0)
    camera.request_flash(0.45,Vector3(0.85,0.92,1.0),5.0)
    camera.ambient_target=0.8
    camera.haze_target=0.3
    # Original World.update() freezes simulation when hitstop>0 but advances camera.
    clock.request_hitstop(0.03)
    for i in range(2):
        var advance: float = clock.advance(DT)
        camera.advance(DT,0.75,0.25)
        if advance!=0.0 or not clock.frozen or clock.world_time!=0.0:
            push_error("GOLD_TIME_FX: hitstop leaked simulation time at tick%d" % i)
            failures+=1
    if clock.hitstop_remaining>0.0 or camera.source_real_elapsed<2.0*DT:
        push_error("GOLD_TIME_FX: camera not updated during frozen world")
        failures+=1
    var game_dt: float = clock.advance(DT)
    camera.advance(DT,0.75,0.25)
    if absf(game_dt-DT)>0.000001 or absf(clock.world_time-DT)>0.000001 or clock.frozen:
        push_error("GOLD_TIME_FX: unfreeze tick does not match original World.update")
        failures+=1
    # Three camera frames with shake amplitude 9, decay4, formula dA/dt = -4A-2.
    var amp := 9.0
    for i in range(3):
        amp = maxf(0.0,amp-amp*4.0*DT-2.0*DT)
    if absf(camera.shake_amplitude-amp)>0.00001:
        push_error("GOLD_TIME_FX: camera shake decay drift")
        failures+=1
    if camera.shake_offset != Vector2(roundf(amp*0.5),roundf(-amp*0.5)):
        push_error("GOLD_TIME_FX: source shake rounding/direction drift")
        failures+=1
    if absf(camera.flash_alpha-(0.45-3.0*5.0*DT))>0.00001:
        push_error("GOLD_TIME_FX: source flash fade drift")
        failures+=1
    var expected_amb := 0.95
    var expected_haze := 0.0
    for i in range(3):
        expected_amb += (0.8-expected_amb)*minf(1.0,3.0*DT)
        expected_haze += (0.3-expected_haze)*minf(1.0,3.0*DT)
    if absf(camera.ambient-expected_amb)>0.00001 or absf(camera.haze-expected_haze)>0.00001:
        push_error("GOLD_TIME_FX: source ambient/haze easing drift")
        failures+=1
    var shader_mat := ShaderMaterial.new()
    shader_mat.shader = POST
    camera.apply_to_post_shader(shader_mat)
    if shader_mat.get_shader_parameter(&"u_shake") != camera.shake_offset:
        push_error("GOLD_TIME_FX: post shader binding not applied")
        failures+=1
    clock.request_slow(0.2,DT*2.0)
    if absf(clock.advance(DT)-0.2*DT)>0.00001:
        push_error("GOLD_TIME_FX: source slow scale first tick drift")
        failures+=1
    # On second tick, source updates duration BEFORE computing dt.
    if absf(clock.advance(DT)-DT)>0.00001:
        push_error("GOLD_TIME_FX: source slow scale expiry drift")
        failures+=1
    print("GOLD_SOURCE_CAMERA_CLOCK: %s / shake flash amb haze hitstop slow post" % ("PASS" if failures==0 else "FAIL "+str(failures)))
    quit(0 if failures==0 else 1)
