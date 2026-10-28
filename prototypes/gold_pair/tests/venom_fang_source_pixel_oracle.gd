extends SceneTree
## Exact source ZIP Glassfang Fang actor RGBA SHA-256 at six source times.
const FANG=preload("res://prototypes/gold_pair/venom_source_fang.gd")
const CHECKPOINTS=[
[0,"ae13b497f8aa689f43488eec65f48a4794a6c885c4e007489e5cb5d26e205721","2871f69da2cdc8fb49ed2961f68e5368accf37d09035c30da307f80bd893bb53","c5a9a11940302a4d77a3d3490804fa8b64082e8ab704c0f228485bf697669629"],
[1,"856fa74077f947cfb35583b556696f19197a0c645deea1e1d0d60aeb1361f2bc","4854bfe78f0b7fe6b6d82a30b2076d2666b58139ec4515a5207ccec545c270b4","207e3b05d7169dde10fa425e7d855600341b49ab8d921f306242eb0d3fc01a48"],
[11,"e869a1b3586acb7366fd9dc0ee17cc32baad35da3b1e5c13d4f9c5d53a74a345","eb0c784fe9e4f127577d94d1fbc49d68a86dc0ecd930f6e774adeec8d5b2d6c9","251ab46fdf2c7c7c0b9ae9f395e099ad3ebd1e8202636778e7e64571c2a8a395"],
[29,"fc87ca686a6bac7088babf3dc29d9eef8cefdc649b85876fc6de1113cd78e040","42fa122ed67e8bf0c06d18b9686e84b140c711a2001239b273e24855d67ad8ff","43f853b0742c68e454dd9de790d98da2a9c8b9849f2bda531ca54c74f2bb5ec2"],
[53,"da0397577ed6e784c2779dbe92531236580b6b3675e50c0766f1d752b42f9ed1","378f3045b07b083237f5909e972b582892789ee8772a737a424e8b071bab170c","72d0defe485b10429bc6cd6bbe0797c4934e291f173fed5d47e23f9d1691c9f6"],
[90,"99c5f3ccfdb6aa476ee6e89fca1e6820fb4a1d19aa42a77c0013fe1420f487de","e6d2c68200af3a8051142f89988134673129d7f999e55e6fcbdf05638d5e55f8","168774c1cf0baf08fadcefb91f31834f6cd0f8ab9face9fc4cf5761cdcc8c3e1"]
]
func _hash(bytes:PackedByteArray)->String:
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(bytes)
    return ctx.finish().hex_encode()

func _initialize()->void:
    var fang=FANG.new(270.25,150.75,0.41)
    var count:int=0
    for tick in range(91):
        var tf:float=float(tick)
        if tick>0:
            fang.x=270.25+55.0*(1.0-exp(-tf/25.0))+cos(tf*0.16)*4.0
            fang.y=150.75+18.0*sin(tf*0.09)-8.0*sin(tf*0.06)
        fang.heading=0.41+tf*0.013
        fang.open=0.2+0.8*(0.5+0.5*sin(tf*0.11))
        fang.z=7.0+5.0*sin(tf*0.12)
        fang.scale=1.0+0.08*sin(tf*0.07)
        fang.update_chain()
        for check in CHECKPOINTS:
            if tick!=int(check[0]):continue
            for i in range(3):
                var pass_name:String=["shd","up","lit"][i]
                var bytes:PackedByteArray=fang.render_pass(pass_name,tf/60.0)
                if bytes.size()!=600*340*4:
                    push_error("VENOM_FANG: wrong 600x340 RGBA buffer")
                    quit(1)
                    return
                var actual:String=_hash(bytes)
                var expected:String=String(check[i+1])
                if actual!=expected:
                    push_error("VENOM_FANG_PIXEL: tick=%d pass=%s gold=%s native=%s" % [tick,pass_name,expected,actual])
                    quit(1)
                    return
                count+=1
    if count!=18:
        push_error("VENOM_FANG: 18 source checkpoints not all tested")
        quit(1)
        return
    print("VENOM_FANG_PIXEL: PASS / 18 original TS exact RGBA SHA-256 / 3 passes / 6 checkpoints")
    quit(0)
