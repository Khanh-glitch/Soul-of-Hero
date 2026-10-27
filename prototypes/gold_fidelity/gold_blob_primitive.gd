class_name GoldBlobPrimitive
extends Node2D

## Runtime visual object translating original World.Blob from gold,
## including source quad UVs, easing, age/fade and smoke update callback.
const SHADER: Shader = preload("res://prototypes/gold_fidelity/gold_s01_blob.gdshader")
var source: Dictionary
var age := 0.0
var dead := false
var visual: MeshInstance2D
var source_material: ShaderMaterial

func configure(attrs: Dictionary) -> void:
    source = attrs.duplicate(true)
    age = float(source.get("t",0.0))
    z_index = int(source.get("layer",3))
    visual = MeshInstance2D.new()
    var points := PackedVector2Array()
    var uv := PackedVector2Array()
    var corners := [Vector2(-1,-1),Vector2(1,-1),Vector2(1,1),Vector2(-1,1)]
    for i in [0,1,2,0,2,3]:
        var p: Vector2 = corners[i]
        points.append(p)
        uv.append(p)
    var arrays := []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX] = points
    arrays[Mesh.ARRAY_TEX_UV] = uv
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays,[],{},Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    visual.mesh = mesh
    visual.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    source_material = ShaderMaterial.new()
    source_material.shader = SHADER
    visual.material = source_material
    add_child(visual)
    update_gold_pose(0.0)

func step_gold(dt: float, world_time: float) -> void:
    if dead:
        return
    age += dt
    if source.has("gold_upd_vx"):
        source["x"] = float(source["x"]) + float(source["gold_upd_vx"]) * 0.016
        source["y"] = float(source["y"]) + float(source["gold_upd_vy"]) * 0.016
        source["z"] = float(source.get("z",0.0)) + float(source["gold_upd_rise"]) * 0.016
    if age >= float(source["life"]):
        dead = true
        visible = false
        queue_free()
        return
    update_gold_pose(world_time)

func update_gold_pose(world_time: float) -> void:
    var progress: float = clampf(age / float(source["life"]),0.0,1.0)
    var mode: int = int(source.get("ease",1))
    var eased: float = 1.0-pow(1.0-progress,3.0) if mode==1 else (progress*progress*progress if mode==3 else progress)
    var width: float = float(source.get("w",10.0))
    var height: float = float(source.get("h",10.0))
    if float(source.get("w1",-1.0)) >= 0.0:
        width = lerpf(width,float(source["w1"]),eased)
    if float(source.get("h1",-1.0)) >= 0.0:
        height = lerpf(height,float(source["h1"]),eased)
    position = Vector2(float(source["x"]),float(source["y"])-float(source.get("z",0.0)))
    rotation = float(source.get("rot",0.0))
    visual.scale = Vector2(width,height)
    var fade_start: float = float(source.get("fadeStart",0.55))
    var alpha: float = float(source.get("alpha",1.0))
    if progress > fade_start:
        alpha *= 1.0-(progress-fade_start)/(1.0-fade_start)
    source_material.set_shader_parameter(&"u_time",world_time)
    source_material.set_shader_parameter(&"u_progress",progress)
    source_material.set_shader_parameter(&"u_alpha",alpha)
    source_material.set_shader_parameter(&"u_seed",float(source.get("seed",0.0)))
    source_material.set_shader_parameter(&"u_shape",int(source.get("shape",2)))
    source_material.set_shader_parameter(&"u_palette",int(source.get("pal",1)))
    source_material.set_shader_parameter(&"u_heat",float(source.get("heat",1.0)))
    source_material.set_shader_parameter(&"u_k1",float(source.get("k1",0.3)))
    source_material.set_shader_parameter(&"u_k2",float(source.get("k2",0.0)))
