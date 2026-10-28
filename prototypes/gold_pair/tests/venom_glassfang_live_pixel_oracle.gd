extends SceneTree

## Source TS full-cast World.step() + original Fang.shd/up/lit rendering.
## Tests live state-driven three-pass procedural images, no prerecorded sprite.
const MOTION=preload("res://prototypes/gold_pair/venom_glassfang_motion.gd")
const CANVAS=preload("res://prototypes/gold_pair/venom_source_fang_canvas.gd")
const F:float=1.0/60.0
const PASSES=["shd","up","lit"]
const CASES=[
    ["tracking_elite",[
        [8, "9a554cfaf0fa76a24b08673e0c7e84c97a775e797cdfd8026758589064a7e042","7a9da793a6127dec11a9388f49403405c3cd6207fe685aafe2764a2f335c3d9a","df863d2320f2fbfa2b4fc91ee631289cd99e15848dea6eb26d1f83e472af8bbc"],
        [31,"1a428feee279b38951ad512267b3fb3605081472c9a6481f12a9d49bb715a260","8c5353c05cf1de4284547ea12f38e6631a0fb28bf1a19ab1c2624d2477fce48b","cd8c8cb5d82b8abf6c90c8d0b68125c697dd67ac8e378f5e536fd68af3657860"],
        [80,"54196ef025364b42f7bc93729534526a66e37e9a6a119f368c12b0d37156a96e","892e0fc66b7b780bb1dd21f4f9dfe93100780440170fe61c61ebb3a70eec3501","28a963576b8541109970f6c1ee9ba09a8bb5268ab81b6615ff66836701d12a09"],
        [145,"c897d137086976611bb717bab651a80ba00348ba18ff702cd8e573c18ccef59c","955d48912431601bd31de7469f53128541c3c9ce66a71677f8287bfedb60d592","5f6a38938f8f03959b4712fc2b737ad5c9bf3cd069711de959fb009852b65387"]
    ]],
    ["kill_and_retarget",[
        [8,"9a554cfaf0fa76a24b08673e0c7e84c97a775e797cdfd8026758589064a7e042","14f6c9a0e3ba55f8963a328582d163a38dcd5d630e17075dcc9cc31fcf6882c0","510cfebc2c017735c30ab2e77bbd34164a57ebbe2cf6ae1c569debe6adb7e03b"],
        [31,"8cb1e69519ab7d183ae94310d5489df74c0390239688f1ead094d0eeb0d65aa6","f35c81b1eea526faa5783dbcdb64ea95177f3d24056d3d78841ad65df22ae6c0","fe89e1fd64da82f4736dbaff7df47e7c80a6945d4f75f30e4652ebe6b70ee69a"],
        [80,"6c3ad45f0476944233ed84d0cdf32036eb372e1d0863d2435e2dc38ead7d7024","457a946e2537ac7146018d7254a915a94be8dbdd8ffa204718adc20f823cc724","56935c0a10788eb17be6b20cfc194b163a640d1b34ebfae1167bbe95af3a8022"],
        [129,"782732b351b7cc2d31b3e9da25ed777e51f0e21fa8e9f2c8678c3a4c91914fe5d","370585ee14c8aba57197fc965eefc4136748693ffdfadd88ae2a9f422f62ed26","436ee99f167f0218db074b4a7729ca06f7ff5b899afa76421e2a070bb75fac79"]
    ]]
]

static func _hash(bytes:PackedByteArray)->String:
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(bytes)
    return ctx.finish().hex_encode()

func _initialize()->void:
    call_deferred("_run")

func _run()->void:
    var compared:int=0
    for case in CASES:
        var name:String=String(case[0])
        var retarget:bool=name=="kill_and_retarget"
        var e1:Dictionary={"id":17,"x":375.0,"y":190.0,"r":6.0 if retarget else 9.5,
            "dying":0.0,"hp":30 if retarget else 900,"exists":true}
        var e2:Dictionary={"id":18,"x":407.0,"y":166.0,"r":9.5,
            "dying":0.0,"hp":900,"exists":retarget}
        var enemies:Array=[e1,e2] if retarget else [e1]
        var motion=MOTION.new()
        motion.begin(260.0,160.0,atan2(30.0,115.0),17,1765485952)
        var viewport:=SubViewport.new()
        viewport.size=Vector2i(600,340)
        viewport.transparent_bg=true
        viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
        root.add_child(viewport)
        var canvas=CANVAS.new()
        viewport.add_child(canvas)
        var clock:float=0.0
        var next_index:int=0
        for frame in range(1,241):
            for enemy in enemies:
                if not bool(enemy.get("exists",true)):continue
                if int(enemy["id"])==17:
                    enemy["x"]=375.0+8.0*sin(float(frame)*0.070)
                    enemy["y"]=190.0+5.0*cos(float(frame)*0.055)
                else:
                    enemy["x"]=407.0+11.0*sin(float(frame)*0.049)
                    enemy["y"]=166.0+7.0*cos(float(frame)*0.035)
            clock+=F
            var last_bites:int=motion.bite_cues.size()
            motion.step_60hz(enemies)
            if next_index<int(case[1].size()) and frame==int(case[1][next_index][0]):
                if motion.fang==null:
                    _fail(name+" Fang missing at Gold image frame "+str(frame))
                    return
                var rgba:Dictionary=canvas.render_live_actor_frame(motion.fang,clock)
                for k in range(3):
                    var key:String=PASSES[k]
                    var expected:String=String(case[1][next_index][k+1])
                    var actual:String=_hash(rgba[key])
                    if actual!=expected:
                        _fail("%s frame=%d pass=%s Gold=%s Native=%s" % [name,frame,key,expected,actual])
                        return
                    compared+=1
                # Verify real native texture upload/readback on OpenGL, not dummy headless.
                await process_frame
                await process_frame
                await RenderingServer.frame_post_draw
                for key in PASSES:
                    var readback:PackedByteArray=canvas.textures[key].get_image().get_data()
                    if readback!=rgba[key]:
                        _fail("%s frame=%d native GPU buffer differs from Gold CPU pass %s" % [name,frame,key])
                        return
                if frame==31:
                    var screenshot:Image=viewport.get_texture().get_image()
                    var safe_name:String="single" if not retarget else "retarget"
                    if screenshot.save_png("/tmp/glassfang-live-"+safe_name+".png")!=OK:
                        _fail("native screenshot artifact save failed")
                        return
                next_index+=1
            for j in range(last_bites,motion.bite_cues.size()):
                var cue:Dictionary=motion.bite_cues[j]
                for enemy in enemies:
                    if int(enemy["id"])==int(cue["enemy"]):
                        enemy["hp"]=int(enemy["hp"])-int(cue["amount"])
                        if int(enemy["hp"])<=0:
                            enemy["hp"]=0
                            enemy["dying"]=0.16
                        break
            for enemy in enemies:
                if float(enemy.get("dying",0.0))>0.0:
                    enemy["dying"]=float(enemy["dying"])-F
                    if float(enemy["dying"])<=0.0:enemy["exists"]=false
            if motion.fang==null:
                canvas.release_source_actor()
        if next_index!=int(case[1].size()):
            _fail("missed original-source moving actor checkpoints for "+name)
            return
        if canvas.sprites["up"].visible or canvas.sprites["lit"].visible:
            _fail("source Fang continues rendering after finisher in "+name)
            return
        viewport.queue_free()
    if compared!=24:
        _fail("missing original Gold three-pass image comparisons: "+str(compared))
        return
    print("VENOM_GLASSFANG_LIVE_PIXELS: PASS / 24 native RGBA source hashes from real full cast / 2 moving-enemy scenarios / 3 OpenGL passes / finisher cleanup")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_GLASSFANG_LIVE_PIXELS: "+message)
    quit(1)
