class_name GoldSourceCameraFx
extends RefCounted

## Direct translation: source World.shake(), World.flash(), World.updateCam().
## One shared source-faithful presentation component for S01 and future skills.
## Real combat time remains authoritative elsewhere; this class has no gameplay writes.
## random_x and random_y MUST be supplied by the original skill's global RNG stream.
var shake_amplitude := 0.0
var shake_decay := 8.0
var shake_offset := Vector2.ZERO
var flash_alpha := 0.0
var flash_color := Vector3.ONE
var flash_decay := 6.0
var ambient := 0.95
var ambient_target := 0.95
var haze := 0.0
var haze_target := 0.0
var source_real_elapsed := 0.0

func reset() -> void:
    shake_amplitude = 0.0
    shake_decay = 8.0
    shake_offset = Vector2.ZERO
    flash_alpha = 0.0
    flash_color = Vector3.ONE
    flash_decay = 6.0
    ambient = 0.95
    ambient_target = 0.95
    haze = 0.0
    haze_target = 0.0
    source_real_elapsed = 0.0

func request_shake(amount: float, decay: float = 8.0) -> void:
    shake_amplitude = maxf(shake_amplitude,amount)
    shake_decay = decay

func request_flash(amount: float, color: Vector3 = Vector3.ONE, decay: float = 6.0) -> void:
    flash_alpha = maxf(flash_alpha,amount)
    flash_color = color
    flash_decay = decay

func advance(real_dt: float, random_x: float, random_y: float) -> void:
    # Original World.updateCam uses REAL time even during hitstop.
    source_real_elapsed += real_dt
    shake_amplitude = maxf(0.0,shake_amplitude-shake_amplitude*shake_decay*real_dt-real_dt*2.0)
    shake_offset = Vector2(
        roundf((random_x-0.5)*2.0*shake_amplitude),
        roundf((random_y-0.5)*2.0*shake_amplitude))
    flash_alpha = maxf(0.0,flash_alpha-real_dt*flash_decay)
    ambient += (ambient_target-ambient)*minf(1.0,real_dt*3.0)
    haze += (haze_target-haze)*minf(1.0,real_dt*3.0)

func apply_to_post_shader(post: ShaderMaterial) -> void:
    # These uniforms are the original uShake/uFlash/uAmb/uHaze ported in Gate 2.
    post.set_shader_parameter(&"u_shake",shake_offset)
    post.set_shader_parameter(&"u_flash",Color(flash_color.x,flash_color.y,flash_color.z,flash_alpha))
    post.set_shader_parameter(&"u_amb",ambient)
    post.set_shader_parameter(&"u_haze",haze)

func snapshot() -> Dictionary:
    return {"shake_amplitude":shake_amplitude,"shake_offset":shake_offset,
        "flash_alpha":flash_alpha,"flash_color":flash_color,
        "ambient":ambient,"haze":haze,"real_elapsed":source_real_elapsed}
