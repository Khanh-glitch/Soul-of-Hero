extends Node2D

## Source-derived render components ONLY, displayed in a 480x270 SubViewport.
## Gold source skill #01: exact floor pixel writes + 14 sheets + post segment.
## Hero/ribbon/explosion/shards/smoke/enemy impact NOT ported yet.
const Floor = preload("res://prototypes/gold_fidelity/hairline_source_floor.gd")
const Ground = preload("res://prototypes/gold_fidelity/hairline_ground.gd")
const Plates = preload("res://prototypes/gold_fidelity/gold_hairline_plate_factory.gd")
const PlateShader = preload("res://prototypes/gold_fidelity/hairline_plate.gdshader")
const PostShader = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const Segment = preload("res://prototypes/gold_fidelity/segment_math.gd")
const CRACKS = [
    [300,1.2616972261716168,2.5166666666666626],
    [278,0.9572913836829852,2.533333333333329],
    [322,2.1498163709559033,2.533333333333329],
    [256,0.7997319419079016,2.566666666666662],
    [344,2.2002795832373687,2.566666666666662],
    [234,1.3451744821530323,2.5999999999999956],
    [366,2.0556352677431446,2.5999999999999956],
    [212,1.0478246097129325,2.633333333333329],
    [190,1.2113824541822562,2.666666666666661],
    [168,1.2012104620367776,2.699999999999994],
    [146,1.3390725658882896,2.733333333333328],
    [124,1.2472226547685008,2.7666666666666604],
    [102,1.0917216290396194,2.799999999999995]
]
var _viewport: SubViewport
var _ground: GoldHairlineGround
var _baseline: PackedByteArray
var _ground_texture: ImageTexture
var _meshes: Array[MeshInstance2D] = []
var _materials: Array[ShaderMaterial] = []
var _post_material: ShaderMaterial
var _event_index := 0
var _events: Array[Dictionary] = []
var _time := 0.0
var _playing := true
var _speed := 1.0

func _ready() -> void:
    _viewport = SubViewport.new()
    _viewport.size = Vector2i(480,270)
    _viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    add_child(_viewport)
    var stage := Node2D.new()
    _viewport.add_child(stage)
    _ground = Ground.new()
    Floor.new().build(_ground)
    _baseline = _ground.pixels.duplicate()
    _ground_texture = ImageTexture.create_from_image(_ground.as_image())
    var ground_sprite := Sprite2D.new()
    ground_sprite.centered = false
    ground_sprite.texture = _ground_texture
    ground_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    stage.add_child(ground_sprite)
    for i in Plates.PLATES.size():
        var item := MeshInstance2D.new()
        item.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
        item.z_index = 4
        var shader := ShaderMaterial.new()
        shader.shader = PlateShader
        item.material = shader
        stage.add_child(item)
        _meshes.append(item)
        _materials.append(shader)
    var post := ColorRect.new()
    post.size = Vector2(480,270)
    post.color = Color.WHITE
    post.z_index = 100
    _post_material = ShaderMaterial.new()
    _post_material.shader = PostShader
    post.material = _post_material
    stage.add_child(post)
    _events.append({"t":0.85,"kind":"groove_a"})
    _events.append({"t":2.5,"kind":"groove_b"})
    for c in CRACKS:
        _events.append({"t":float(c[2]),"kind":"crack","x":int(c[0]),"angle":float(c[1])})
        _events.append({"t":float(c[2]),"kind":"rubble","x":int(c[0])})
    var display := Sprite2D.new()
    display.centered = false
    display.texture = _viewport.get_texture()
    display.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    display.position = Vector2(80,45)
    display.z_index = 0
    add_child(display)
    set_gold_time(0.0)

func _process(delta: float) -> void:
    if _playing:
        set_gold_time(minf(7.0,_time+minf(delta,0.1)*_speed))
    if _time>=7.0:_playing=false

func set_gold_time(t: float) -> void:
    if _ground == null: return
    var target := clampf(t,0.0,7.0)
    if target < _time:
        _ground.pixels = _baseline.duplicate()
        _event_index = 0
        _ground_texture.update(_ground.as_image())
    _time = target
    var changed := false
    while _event_index < _events.size() and float(_events[_event_index]["t"]) <= _time+0.000001:
        var op: Dictionary = _events[_event_index]
        match String(op["kind"]):
            "groove_a": _ground.source_first_groove()
            "groove_b": _ground.source_second_groove()
            "crack": _ground.crack(float(op["x"]),150.0,float(op["angle"]),16.0,1)
            "rubble": _ground.rubble(int(op["x"]),151,7)
        changed = true
        _event_index+=1
    if changed:
        _ground_texture.update(_ground.as_image())
    for i in _meshes.size():
        var mesh_node := _meshes[i]
        mesh_node.visible = Plates.is_alive(_time) and Plates.opacity_at(_time)>0.02
        if not mesh_node.visible: continue
        var vertices: PackedVector2Array = Plates.vertices_at(i,_time)
        mesh_node.mesh = _mesh_from_source_triangles(vertices)
        var width := (vertices[0].distance_to(vertices[1])+vertices[2].distance_to(vertices[3]))/2.0
        var height := (vertices[0].distance_to(vertices[3])+vertices[1].distance_to(vertices[2]))/2.0
        var source: Array = Plates.PLATES[i]
        var mat := _materials[i]
        mat.set_shader_parameter("u_time",_time)
        mat.set_shader_parameter("u_prog",(_time-Plates.CREATED_AT)/Plates.LIFE)
        mat.set_shader_parameter("u_seed",float(source[7]))
        mat.set_shader_parameter("u_wpx",width)
        mat.set_shader_parameter("u_hpx",height)
        mat.set_shader_parameter("u_crack",Plates.crack_at(i,_time))
        mat.set_shader_parameter("u_alpha",Plates.opacity_at(_time))
        mat.set_shader_parameter("u_mask",int(source[6]))
    _post_material.set_shader_parameter("u_time",_time)
    _post_material.set_shader_parameter("u_amb",0.95)
    var seg_age := _time-Plates.CREATED_AT
    var segs:=PackedVector4Array()
    var profiles:=PackedVector2Array()
    for i in 8:
        segs.append(Vector4(104,141,356,141) if i==0 else Vector4.ZERO)
        profiles.append(Vector2(14,Segment.strength_at(seg_age)) if i==0 else Vector2.ZERO)
    _post_material.set_shader_parameter("u_seg",segs)
    _post_material.set_shader_parameter("u_seg_p",profiles)
    _post_material.set_shader_parameter("u_ns",1 if Segment.strength_at(seg_age)>0.0 else 0)

static func _mesh_from_source_triangles(c: PackedVector2Array) -> ArrayMesh:
    var arrays:=Array()
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX]=PackedVector2Array([c[0],c[1],c[2],c[0],c[2],c[3]])
    arrays[Mesh.ARRAY_TEX_UV]=PackedVector2Array([Vector2(0,0),Vector2(1,0),Vector2(1,1),Vector2(0,0),Vector2(1,1),Vector2(0,1)])
    var mesh:=ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays,[],{},Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    return mesh

func get_gold_texture() -> Texture2D:
    return _viewport.get_texture()

func _unhandled_key_input(event: InputEvent) -> void:
    if not event is InputEventKey or not event.pressed or event.echo:return
    match event.keycode:
        KEY_SPACE: _playing=not _playing
        KEY_R: set_gold_time(0.0);_playing=true
        KEY_1: _playing=false;set_gold_time(1.466666666666667)
        KEY_2: _playing=false;set_gold_time(2.70)
        KEY_RIGHT: _playing=false;set_gold_time(_time+1.0/60.0)
        KEY_LEFT: _playing=false;set_gold_time(_time-1.0/60.0)
        KEY_EQUAL, KEY_KP_ADD: _speed=minf(4.0,_speed*2.0)
        KEY_MINUS, KEY_KP_SUBTRACT: _speed=maxf(0.25,_speed/2.0)
