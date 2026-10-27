class_name GoldS01WorldPressureSheets
extends Node2D

## The SAME 14 exact source Gold S01 plate descriptors, geometry and shader
## used in the 480x270 gold fixture, with one world-space translation.
## This does not modify gameplay TileMap cells, collision or art resources.
const PLATES = preload("res://prototypes/gold_fidelity/gold_hairline_plate_factory.gd")
const GOLD_SHADER = preload("res://prototypes/gold_fidelity/hairline_plate.gdshader")

var _meshes: Array[MeshInstance2D] = []
var _materials: Array[ShaderMaterial] = []
var _current_time := 0.0

func _ready() -> void:
    for i in range(PLATES.PLATES.size()):
        var item := MeshInstance2D.new()
        item.name = "GoldPressureSheet_%02d" % (i+1)
        item.z_index = 4
        item.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
        var shader := ShaderMaterial.new()
        shader.shader = GOLD_SHADER
        item.material = shader
        add_child(item)
        _meshes.append(item)
        _materials.append(shader)
    seek_source_time(_current_time)

func seek_source_time(world_time: float) -> void:
    _current_time = world_time
    if _meshes.is_empty():
        return
    var live: bool = PLATES.is_alive(world_time) and PLATES.opacity_at(world_time)>0.02
    for i in range(_meshes.size()):
        var plate := _meshes[i]
        plate.visible=live
        if not live:
            continue
        var vertices: PackedVector2Array = PLATES.vertices_at(i,world_time)
        plate.mesh=_triangles(vertices)
        var width := (vertices[0].distance_to(vertices[1])+vertices[2].distance_to(vertices[3]))/2.0
        var height := (vertices[0].distance_to(vertices[3])+vertices[1].distance_to(vertices[2]))/2.0
        var src: Array=PLATES.PLATES[i]
        var mat: ShaderMaterial=_materials[i]
        mat.set_shader_parameter(&"u_time",world_time)
        mat.set_shader_parameter(&"u_prog",(world_time-PLATES.CREATED_AT)/PLATES.LIFE)
        mat.set_shader_parameter(&"u_seed",float(src[7]))
        mat.set_shader_parameter(&"u_wpx",width)
        mat.set_shader_parameter(&"u_hpx",height)
        mat.set_shader_parameter(&"u_crack",PLATES.crack_at(i,world_time))
        mat.set_shader_parameter(&"u_alpha",PLATES.opacity_at(world_time))
        mat.set_shader_parameter(&"u_mask",int(src[6]))

static func _triangles(v: PackedVector2Array) -> ArrayMesh:
    var arrays: Array = []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX]=PackedVector2Array([v[0],v[1],v[2],v[0],v[2],v[3]])
    arrays[Mesh.ARRAY_TEX_UV]=PackedVector2Array([
        Vector2(0,0),Vector2(1,0),Vector2(1,1),
        Vector2(0,0),Vector2(1,1),Vector2(0,1)])
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays,[],{},
        Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    return mesh

func visible_source_plates() -> int:
    var live_count := 0
    for item in _meshes:
        if item.visible:
            live_count += 1
    return live_count
