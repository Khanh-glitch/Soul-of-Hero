extends SceneTree

## Smoke of the ACTUAL source formula staged as Godot GLSL canvas material.
## Distinguish shader compile/feedback tests from still-missing browser Pixi
## GLSL-vs-Godot whole-frame equality and final Gold full cast replay.
const POST=preload("res://prototypes/gold_pair/venom_source_display_post.gd")

func _initialize()->void:
    call_deferred("_run")

func _run()->void:
    var cases:int=0
    for density in [1,2]:
        var w:int=600*density
        var h:int=340*density
        var viewport:=SubViewport.new()
        viewport.size=Vector2i(w,h)
        viewport.transparent_bg=false
        viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
        root.add_child(viewport)
        var scene_image:=Image.create(w,h,false,Image.FORMAT_RGBA8)
        var glow_image:=Image.create(w,h,false,Image.FORMAT_RGBA8)
        scene_image.fill(Color(0.09,0.13,0.18,1.0))
        glow_image.fill(Color(0.0,0.0,0.0,1.0))
        for y in range(h/2-5*density,h/2+5*density):
            for x in range(w/2-6*density,w/2+6*density):
                scene_image.set_pixel(x,y,Color(0.25,0.7,0.42,1.0))
                glow_image.set_pixel(x,y,Color(0.45,0.9,0.75,1.0))
        var scene_texture:=ImageTexture.create_from_image(scene_image)
        var glow_texture:=ImageTexture.create_from_image(glow_image)
        var post=POST.new()
        viewport.add_child(post)
        post.bind_source_layers(scene_texture,glow_texture,density)
        if post.size!=Vector2(w,h) or post.source_density!=density:
            _fail("Gold source output resolution drift")
            return
        post.present_source_feedback(1.23,Vector2(1.5,-2.25),
            [Vector4(200,160,25,3)],Vector4(0.0,0.0,0.0,0.0),
            Vector4(0.0,0.35,0.0,1.0))
        var shake:Vector2=post.post_material.get_shader_parameter("u_shake")
        var shocks:PackedVector4Array=post.post_material.get_shader_parameter("u_shock")
        if shake!=Vector2(1.5,-2.25)*float(density) or shocks.size()!=4:
            _fail("source Display.present k scaling or four shocks changed")
            return
        if shocks[0]!=Vector4(200,160,25,3)*float(density):
            _fail("original first shock ring k scaling changed")
            return
        await process_frame
        await process_frame
        await RenderingServer.frame_post_draw
        var image:Image=viewport.get_texture().get_image()
        if image.get_width()!=w or image.get_height()!=h:
            _fail("source post viewport dimension mismatch")
            return
        var center:Color=image.get_pixel(w/2,h/2)
        var corner:Color=image.get_pixel(20,20)
        if center.a<0.99 or corner.a<0.99:
            _fail("original post framebuffer must be opaque")
            return
        if center.g<=corner.g:
            _fail("original glow/scene gather did not render visual central glow")
            return
        if image.save_png("/tmp/venom-source-post-"+str(density)+".png")!=OK:
            _fail("cannot publish post GLSL GPU evidence")
            return
        post.present_source_feedback(1.24,Vector2.ZERO,[],Vector4(0.9,0.2,0.1,1.0),
            Vector4(0.2,0.8,0.7,0.4))
        await process_frame
        await process_frame
        await RenderingServer.frame_post_draw
        var with_flash:Color=viewport.get_texture().get_image().get_pixel(w/2,h/2)
        if with_flash==center:
            _fail("source flash/desat/grade uniforms not applied")
            return
        cases+=1
        viewport.queue_free()
    if cases!=2:
        _fail("not both Gold source quality densities tested")
        return
    print("VENOM_SOURCE_POST: PASS / original source GLSL Godot native OpenGL shader compiles / k1+k2 / shock-shake scaling / glow gather / flash-grade / screenshots")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_SOURCE_POST: "+message)
    quit(1)
