## A source-space frame for a world compositor; no Gold floor, actors or HUD.
## Packed arrays are copy-on-write snapshots. Hold only as long as necessary:
## retaining one while its source renders again forces copies on the next tick.
## All pixel arrays are row-major and untransformed. The owner applies
## source_to_world first, then the current Camera2D/viewport transform.
## These are VISUAL DATA, never damage or resource-authority instructions.
extends RefCounted
class_name Arcana20SourcePassFrame

var family: StringName
var variant: StringName
var tick: int
var source_time: float
var seeds: PackedInt32Array
var source_size: Vector2i
var source_to_world: Transform2D
var caster_world: Vector2
var target_world: Vector2

# C: ground RGB (premultiplied RGBA8 with independent coverage), source
# ink premultiplied RGBA float, signed HDR light RGBA float, displacement
# RGBA float = dx,dy,shade,chroma, and optional live-world fragment mapping
# RGBA float = source x, source y, remaining coverage, unused.
var c_ground: PackedByteArray
var c_ground_coverage: PackedFloat32Array
var c_ink: PackedFloat32Array
var c_light: PackedFloat32Array
var c_disp: PackedFloat32Array
var c_world_fragment: PackedFloat32Array
var c_influence: PackedByteArray

# B: ink/emissive RGB float + coverage; ground marks RGB float + coverage;
# shade, HDR light and post warp (destination->source pixel offset).
var b_ink_rgb: PackedFloat32Array
var b_ink_coverage: PackedFloat32Array
var b_ground_rgb: PackedFloat32Array
var b_ground_coverage: PackedFloat32Array
var b_shade: PackedFloat32Array
var b_light: PackedFloat32Array
var b_world_warp: PackedFloat32Array
var b_influence: PackedByteArray
var b_ambient: float
var b_tint: Vector3

# A: additive HDR and blend coverage produced by the existing A framebuffer;
# these omit unported original terrain/refraction and bloom world passes.
var a_rgb: PackedFloat32Array
var a_coverage: PackedFloat32Array
var a_multiplier: PackedFloat32Array
var a_world_warp: PackedFloat32Array
var a_influence: PackedByteArray
var a_exposure: float
var a_bloom: float
var a_bloom_rgb: PackedFloat32Array
var a_bloom_size: Vector2i
var a_impact_frames: int
var a_impact_tint: Vector3

# D: the currently ported additive layer and recorded authored bend calls;
# bloom, decal and full WebGL post remain unresolved, not source parity.
var d_rgb: PackedFloat32Array
var d_influence: PackedByteArray
var d_bends: Array[Dictionary]
var d_bloom_gain: float
var d_shake_amplitude: float

# Presentation state is per cast; consumer arbitrates overlap and cleanup and
# must keep HUD outside the world post. C-local vs B-local ticks are explicit.
var flash: Vector3
var shake: Vector2
var chroma: float
var invert: float
var desat: float
