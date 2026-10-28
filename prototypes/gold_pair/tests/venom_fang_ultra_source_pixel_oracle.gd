extends SceneTree

## ORIGINAL ZIP src/game/skills/s1.ts Fang.shd/up/lit through original
## src/game/pixel.ts Layer at Ultra k=2; 1200x680 native CPU RGBA.
## 18 full-pass SHA256 from the ACTUAL unmodified original TS class.
## Corresponding k1 fixture is covered by existing separate test.
const FANG=preload("res://prototypes/gold_pair/venom_source_fang.gd")
const CASES=[
    [0,["dd8c780c1019fd30b3d36fed3bd2f483a751e060457b4643cf87653dca655f00","77a05a388c77b67e9065b11839d4310f1980e1dfe607ad215f0775714c9cdeb5","58db1f62c2d222730dfe264ee97bdbebf0783df06570662c6a54b0cf8f5ee382"]],
    [1,["d1f16aafc817a70c152b57365c0b8fc802f25f489f1674e179f506fea0de00b2","f41a39db1ed3ba17690bd19df05da008d93d971e44e95f15b96f3a05f8c9e35c","3ba6b6bbfc5a415b8c1f6b397a2046a8ab58879e235ad1ea80d42bf0436f6104"]],
    [11,["0da9abb91f5baf4e4e7ee1508904ba169b97de84e676c9a597f8fa704a16e11c","7e5c191885b5eda7f91cfbbb7cbb78cf8bc84136b03080c5095b0a9b5aaf92d4","db5faada0b94343dd2d62938be5988b31f1a7ea150b824357d758d232278392b"]],
    [29,["e092c96d3ab616509bb5601b6939a0111440dc921134dd4a39fc8505d5fee371","2b63acb0eb2e37330a94d7c41b849abe89eb0ba26e542ec6d9f1d2545f24b514","de162bc9c0477353d550a96c5a40ce45219a12d8d7474e0d78746f6092c1e9bf"]],
    [53,["e8918d1580152191d0c3a9c54e7ec93078458f7cf293661475fbdeb351e48c60","d4cb2aa0bcd9372a91066059c5faf0f6b72f4931e8afb74e975b46ee1d6a95bc","b6baa97252e9f5c878c952b101552217808796f1043f53b548b0634bfba9f538"]],
    [90,["2f81e2ae6a135ff555973fe4c2b4e47198f0559f0665edae82a1a40b346f282b","df2dbb995291c0ad7876ceb1144f38c45cdd8591b29054d8d63a74d3142084a1","b9fb9ad2eb9b20b42357a76404eb18a625febd3f74c927df1061dad6df5953e7"]]
]
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
        for c in CASES:
            if int(c[0])!=tick:continue
            for p in range(3):
                var key:String=["shd","up","lit"][p]
                var source:PackedByteArray=fang.render_pass(key,tf/60.0,2)
                if source.size()!=1200*680*4:
                    push_error("VENOM_FANG_ULTRA: source density not 1200x680")
                    quit(1)
                    return
                var ctx:=HashingContext.new()
                ctx.start(HashingContext.HASH_SHA256)
                ctx.update(source)
                var actual:String=ctx.finish().hex_encode()
                var expected:String=String(c[1][p])
                if expected.length()!=64 or actual!=expected:
                    push_error("VENOM_FANG_ULTRA: tick=%d pass=%s Gold=%s native=%s" % [tick,key,expected,actual])
                    quit(1)
                    return
                count+=1
    if count!=18:
        push_error("VENOM_FANG_ULTRA: checkpoint coverage %d of 18" % count)
        quit(1)
        return
    print("VENOM_FANG_ULTRA: PASS / 18 original-source complete 1200x680 RGBA SHA256 / real k2 geometry")
    quit(0)
