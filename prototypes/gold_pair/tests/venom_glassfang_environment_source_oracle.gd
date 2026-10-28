extends SceneTree

## Independent, immutable original user ZIP source oracle.
## Original TS fx.ts Splash,Flash,Ring,Embed, pixel.ts Layer at Gold Ultra k2.
## 4 procedural FX x 3 ages x 2 complete 1200x680 RGBA buffers.
## Do not loosen hashes or replace them with screenshots.
const PORT=preload("res://prototypes/gold_pair/venom_glassfang_source_environment.gd")
const EMPTY="2d417c2ed40641cd243f33989601b5a06c7a7c5b893c092c1868e0b9addd03e1"
const CHECKS=[
    ["splash",0.04,"4452b9dc49a85ccea1b07896e5550b0b6c207ee84edba008e9922f50a9236996",EMPTY],
    ["splash",0.14,"1c0a203b2e53b5e5cd5d50d757e376dd6422c0bb19a90f0d7a9b1d2040237c5e",EMPTY],
    ["splash",0.29,"2eb1b1f52fc50ac44b89be4bfbcaa6d3b87bbf472dfff98e03faf859ff86a4bd",EMPTY],
    ["flash",0.01,"a5a6eceb3d8b6b2ba0c43f685e96a4fd6ad5e8c3e01611cf5c1622de3284f9d5","e8db4a1288e760d822730501ec00143c747230f88dc6b81e57f7bd1112ff0050"],
    ["flash",0.09,"e8e6585448268d30f3cf5d7f06daea9c09c308ac5dc6052547d6c8d1a3275090","984c85abeb9a0ab53feea4ea102895915a126ac4f4cfde3e1b59b579c0a2670f"],
    ["flash",0.21,"28bbdd35412dcec198367f0bdee674bedaac89bd5b9d6ca875dac512133f5b7f","670ded0437e68367a6c36fec47bf0b6e9d3b72c4a630acfe936eee9aa5670b13"],
    ["ring",0.04,"f8944bb8bbf712aa3ef836dfc5fea74230c910fd88181f72086e20d6d1a29e69","43a87535b1c49e58ec6523d4891b5df7da905e5e4977bce747e1582e6c90cbb9"],
    ["ring",0.16,"e8cf644ee4a1ece6bdd66335f5cfa77ad78e763455de427c11b0f0a31d5656d4","f534ba889ba272e7b414e1271359f398a0e475c02a2abb773823c49ca1e8086f"],
    ["ring",0.30,"2b782d3b17aa2fe5abb4d25f604e79331779de609bd27791ea21577e68dd521c","974e704f711f1477a5bb52b924c9dd2e98dbb1475b519a9a4b041bb016c55c28"],
    ["embed",0.1,"3ccacaf06038f2f0791ff34c8da13dc217558824397f800ed200bb84df38d5fe",EMPTY],
    ["embed",2.5,"3ccacaf06038f2f0791ff34c8da13dc217558824397f800ed200bb84df38d5fe",EMPTY],
    ["embed",5.7,"784026f42464070ecfbc8c309cb55245c464eb186ac39756de0b2f36034960bc",EMPTY]
]

func _event(kind:String,age:float)->Dictionary:
    match kind:
        "splash":
            return {"kind":kind,"x":368.2,"y":190.1,"radius":4.0,
                "c1":0xFF30EAA6,"c2":0xFFA0FFEE,"age":age}
        "flash":
            return {"kind":kind,"x":366.5,"y":186.0,"radius":22.0,
                "color":0xFFA0FFEE,"duration":0.3,"z":8.0,"age":age}
        "ring":
            return {"kind":kind,"x":366.5,"y":190.0,"radius":34.0,
                "duration":0.35,"width":3.0,"colors":[0xFFFFFFFF,0xFF58FAD4,0xFF22B56F],"age":age}
        "embed":
            return {"kind":kind,"x":362.4,"y":196.5,"size":5.0,
                "lit":0xFFA0B852,"dark":0xFF494E18,"edge":0xFFFCF7D4,
                "duration":6.0,"age":age}
    return {}

func _initialize()->void:
    var n:int=0
    for case in CHECKS:
        var renderer=PORT.new(2)
        renderer.clear()
        renderer.render_source_event(_event(String(case[0]),float(case[1])))
        var src:Dictionary=renderer.buffers()
        for pass_name in ["scene","glow"]:
            var expected:String=String(case[2]) if pass_name=="scene" else String(case[3])
            if expected.length()!=64:
                push_error("VENOM_GLASSFANG_ENV: malformed original source SHA fixture")
                quit(1)
                return
            var raw:PackedByteArray=src[pass_name]
            if raw.size()!=1200*680*4:
                push_error("VENOM_GLASSFANG_ENV: wrong Ultra actual buffer size")
                quit(1)
                return
            var actual:String=renderer.source_sha(pass_name)
            if actual!=expected:
                push_error("VENOM_GLASSFANG_ENV: kind=%s age=%.3f pass=%s original=%s native=%s" %
                    [String(case[0]),float(case[1]),pass_name,expected,actual])
                quit(1)
                return
            n+=1
    if n!=24:
        push_error("VENOM_GLASSFANG_ENV: not all original FX validated")
        quit(1)
        return
    print("VENOM_GLASSFANG_ENV: PASS / 24 whole original Ultra 1200x680 RGBA SHA / 4 source FX / 3 ages each")
    quit(0)
