## Original RibbonBatch vertex construction as a native 2D GPU mesh. This is
## an isolated source-primitive candidate until compared and integrated with
## the real-world source pass. It does not create a battlefield or HUD.
extends RefCounted
class_name DRibbonGPU
const SHADER = preload("res://prototypes/arcana_fusion20/renderer/source_d/d_ribbon_gpu.gdshader")

static func create(pts: Array, width: Variant, color: Variant, opts: Dictionary, time: float, coverage := false) -> MeshInstance2D:
    var count := int(pts.size() / 2)
    assert(count >= 2)
    var verts := PackedVector3Array()
    var uvs := PackedVector2Array()
    var colors := PackedColorArray()
    var indices := PackedInt32Array()
    var along := 0.0
    var alpha := float(opts.get("alpha", 1.0))
    for i in range(count):
        var x := float(pts[i * 2])
        var y := float(pts[i * 2 + 1])
        if i > 0:
            var dx := x - float(pts[(i - 1) * 2])
            var dy := y - float(pts[(i - 1) * 2 + 1])
            along += sqrt(dx * dx + dy * dy)
        var before := maxi(0, i - 1)
        var after := mini(count - 1, i + 1)
        var dx := float(pts[after * 2]) - float(pts[before * 2])
        var dy := float(pts[after * 2 + 1]) - float(pts[before * 2 + 1])
        var length := sqrt(dx * dx + dy * dy)
        if length == 0.0: length = 1.0
        var w := maxf(0.02, float(width[mini(i, width.size() - 1)]) if width is Array else float(width))
        var c: Color = color[mini(i, color.size() - 1)] if color is Array else color
        c.a *= alpha
        for side in [-1.0, 1.0]:
            verts.append(Vector3(x - dy / length * w * side, y + dx / length * w * side, 0.0))
            uvs.append(Vector2(side, along))
            colors.append(c)
    for i in range(count * 2 - 2):
        indices.append(i)
        indices.append(i + 1)
        indices.append(i + 2)
    var arrays := []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX] = verts
    arrays[Mesh.ARRAY_TEX_UV] = uvs
    arrays[Mesh.ARRAY_COLOR] = colors
    arrays[Mesh.ARRAY_INDEX] = indices
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
    var material := ShaderMaterial.new()
    material.shader = SHADER
    for key in ["hard", "glow", "flow", "flags", "seed"]:
        if opts.has(key): material.set_shader_parameter(key, opts[key])
    material.set_shader_parameter("source_time", time)
    material.set_shader_parameter("coverage_only", coverage)
    var item := MeshInstance2D.new()
    item.mesh = mesh
    item.material = material
    return item
