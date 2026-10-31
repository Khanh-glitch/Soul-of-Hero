## Original D SpriteBatch quad and fragment shader as a native GPU candidate.
## Isolated diagnostic only; it is not integrated into the world source pass.
extends RefCounted
class_name DSpriteGPU
const SHADER = preload("res://prototypes/arcana_fusion20/renderer/source_d/d_sprite_gpu.gdshader")
static func create(x: float, y: float, size: float, color: Color, shape: int, opts: Dictionary, time: float, coverage := false) -> MeshInstance2D:
    var sx := float(opts.get("sx", roundi(size)))
    var sy := float(opts.get("sy", roundi(size)))
    assert(sx > 0.0 and sy > 0.0)
    var verts := PackedVector3Array([Vector3(-sx,-sy,0),Vector3(sx,-sy,0),Vector3(-sx,sy,0),Vector3(sx,sy,0)])
    var uvs := PackedVector2Array([Vector2(-sx,-sy),Vector2(sx,-sy),Vector2(-sx,sy),Vector2(sx,sy)])
    var colors := PackedColorArray([color,color,color,color])
    var arrays := []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX] = verts
    arrays[Mesh.ARRAY_TEX_UV] = uvs
    arrays[Mesh.ARRAY_COLOR] = colors
    arrays[Mesh.ARRAY_INDEX] = PackedInt32Array([0,1,2,1,3,2])
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
    var mat := ShaderMaterial.new()
    mat.shader = SHADER
    mat.set_shader_parameter("half_size", Vector2(maxf(sx,0.75),maxf(sy,0.75)))
    mat.set_shader_parameter("rotation_angle", float(opts.get("rot",0.0)))
    mat.set_shader_parameter("shape_id", shape)
    mat.set_shader_parameter("sprite_seed", float(opts.get("seed",x*0.173+y*0.31)))
    mat.set_shader_parameter("sprite_hard", float(opts.get("hard",0.9)))
    mat.set_shader_parameter("glow", float(opts.get("glow",0.3)))
    mat.set_shader_parameter("edge", float(opts.get("edge",0.0)))
    mat.set_shader_parameter("flags", float(opts.get("flags",0.0)))
    mat.set_shader_parameter("source_time", time)
    mat.set_shader_parameter("coverage_only", coverage)
    var item := MeshInstance2D.new()
    item.mesh = mesh
    item.material = mat
    item.position = Vector2(roundi(x),roundi(y))
    return item
