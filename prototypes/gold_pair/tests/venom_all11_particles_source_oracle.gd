extends SceneTree

## Original unchanged user ZIP src/game/fx.ts Particles.shadows/draw/glows
## all 11 Gold particle shapes at original Ultra k2 1200x680.
## Original full scene and additive glow sources were hashed independently in
## real TypeScript World/Gfx, NOT approximations or drawn snapshots.
const PORT=preload("res://prototypes/gold_pair/venom_glassfang_source_particles.gd")
const GOLD=[
    [0.02,"e6dd061ab7d22e1d746f33caca7341346b88305d6d726a27eebbb5977e5a7088",
          "75390645e169ec1eff34eb11beb60e1476074901110c28d13c0f41e4eb40878a"],
    [0.12,"d1d7c3df19d10291564cae9a2334ba5b5b76ff00503eaedd97834c101c93bb94",
          "75390645e169ec1eff34eb11beb60e1476074901110c28d13c0f41e4eb40878a"],
    [0.32,"b3efb0041d467168eb6846c3a863e2d530a030d870b8df5d9cf585f43af6236b",
          "75390645e169ec1eff34eb11beb60e1476074901110c28d13c0f41e4eb40878a"]
]
const PARTS=[
    ["drop",345.0,155.0,3.0,3.0,0.25,11.0,12.0,87.0,4281395878,4288741358,4282871578,2.0,1],
    ["shard",352.0,163.0,4.0,6.1,0.62,-10.0,10.0,70.0,4294768596,4285627686,4288723026,0.0,3],
    ["chip",355.0,169.0,7.0,2.5,1.6,4.0,11.0,60.0,4283603495,4281683218,4281395878,0.0,3],
    ["bubble",342.0,179.0,2.5,2.0,0.0,1.0,0.0,9.0,4283603495,4281395878,4288741358,0.0,0],
    ["spore",363.0,165.0,5.0,2.0,0.0,10.0,9.0,10.0,4281395878,4283603495,4288741358,1.0,0],
    ["steam",336.0,181.0,6.0,3.1,0.0,12.0,3.0,8.0,4282871578,4280464751,4281683218,0.0,0],
    ["spark",369.0,191.0,7.0,0.8,0.0,20.0,-5.0,15.0,4284021460,4283603495,4288741358,1.0,0],
    ["petal",375.0,193.0,4.0,4.6,0.82,-7.0,2.0,8.0,4284012274,4281395878,4282871578,0.0,0],
    ["dust",326.0,169.0,3.0,3.8,0.0,1.0,3.0,5.0,4283196014,4285435806,4281683218,0.0,0],
    ["ember",365.0,178.0,5.0,1.0,0.0,2.0,4.0,8.0,4283603495,4288741358,4281683218,0.0,0],
    ["mote",384.0,168.0,5.0,1.0,0.0,5.0,5.0,8.0,4293648526,4284021460,4281395878,0.0,0]
]
func _initialize()->void:
    var render=PORT.new(2)
    if PARTS.size()!=11 or GOLD.size()!=3:
        push_error("VENOM_ALL11_PARTICLES: original Gold source fixture incomplete")
        quit(1)
        return
    var n:int=0
    for row in GOLD:
        var particles:Array=[]
        var seed:int=0
        for data in PARTS:
            seed+=1
            particles.append({
                "k":String(data[0]),"x":float(data[1]),"y":float(data[2]),
                "z":float(data[3]),"size":float(data[4]),"rot":float(data[5]),
                "vx":float(data[6]),"vy":float(data[7]),"vz":float(data[8]),
                "c1":int(data[9]),"c2":int(data[10]),"c3":int(data[11]),
                "glow":float(data[12]),"trail":int(data[13]),
                "age":float(row[0]),"max":0.35 if String(data[0])=="spark" else 2.0,
                "seed":seed
            })
        render.render_source_particles(particles)
        for key in ["scene","glow"]:
            var got:String=render.hash(key)
            var original:String=String(row[1]) if key=="scene" else String(row[2])
            if got!=original:
                push_error("VENOM_ALL11_PARTICLES: age=%.3f sourcePass=%s original=%s Godot=%s" %
                    [float(row[0]),key,original,got])
                quit(1)
                return
            var rgba:PackedByteArray=render.buffers()[key]
            if rgba.size()!=1200*680*4:
                push_error("VENOM_ALL11_PARTICLES: native Ultra k2 pixel resolution drift")
                quit(1)
                return
            n+=1
    if n!=6:
        push_error("VENOM_ALL11_PARTICLES: only %d source original checks" % n)
        quit(1)
        return
    print("VENOM_ALL11_PARTICLES: PASS / 11 original Gold source particle kinds / 3 times / 6 complete 1200x680 scene-glow SHA")
    quit(0)
