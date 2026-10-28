extends SceneTree
## FULL source Graphics draw-call parity of original crackScar and draw.disc:
## no Pixi render emulation; source-generated SHA256 from actual TS code.
const LEDGER=preload("res://prototypes/gold_pair/arcana_source_scar_draw_ledger.gd")
const AGES=[0.0,1.1,3.5,5.2]
const CASES=[
    [1,[
        "44e8776067fc8b62f1bc99178ece9411ae6ccad6aaecc964779b98bbd12b9cbf",
        "1cb6d82cf86e75b47c19830409655df7d55506eb8329ad81c30aae0a3a5e8146",
        "2a60192dab9074c4d52f26d6598be7a4a51d87dc3b0869a1bcc9261b922199c2",
        "a51e3078cac354c1043d2f9287c6a510a2e3658a440791e8cda523b8d5af17d5"
    ],[53,53,45,30]],
    [20261027,[
        "5a747533c601b001d7df03572488fd6b845005db508a683d950f47e8873d3285",
        "5aa37e8e1a0413884e43d89c43dce0e6dcd66ee4c8a05af701c10edb499b0a6e",
        "a2b198ae92b93fe93f41e0d1f7d8d7a5b54663e17a8d27bfb2de56dbd72a73b9",
        "d51236f3530a00d8ce986ceb81cf3be8b5fd475567df5aef33c3b777d11b6408"
    ],[55,55,47,31]],
    [0,[
        "44e8776067fc8b62f1bc99178ece9411ae6ccad6aaecc964779b98bbd12b9cbf",
        "1cb6d82cf86e75b47c19830409655df7d55506eb8329ad81c30aae0a3a5e8146",
        "2a60192dab9074c4d52f26d6598be7a4a51d87dc3b0869a1bcc9261b922199c2",
        "a51e3078cac354c1043d2f9287c6a510a2e3658a440791e8cda523b8d5af17d5"
    ],[53,53,45,30]]
]
func _initialize()->void:
    var tested:int=0
    for c in CASES:
        var ledger=LEDGER.new()
        ledger.configure(int(c[0]),240.0,174.0,8,68.0,5.5,0xff5a1f,0.7)
        for i in range(AGES.size()):
            var commands:PackedStringArray=ledger.draw_trace(float(AGES[i]))
            if commands.size()!=int(c[2][i]):
                push_error("ARCANA_SCAR_DRAW: command count drift seed=%s age=%s expected=%s actual=%d" % [str(c[0]),str(AGES[i]),str(c[2][i]),commands.size()])
                quit(1)
                return
            var expected:String=String(c[1][i])
            var actual:String=ledger.draw_sha256(float(AGES[i]))
            if actual!=expected:
                var preview:String=""
                for k in range(mini(3,commands.size())):
                    preview+=commands[k]+"\n"
                push_error("ARCANA_SCAR_DRAW: SHA drift seed=%s age=%s expected=%s got=%s first=%s" % [str(c[0]),str(AGES[i]),expected,actual,preview])
                quit(1)
                return
            tested+=1
    if tested!=12:
        push_error("ARCANA_SCAR_DRAW: insufficient original source checks")
        quit(1)
        return
    print("ARCANA_SCAR_DRAW: PASS / 12 original source complete draw-call SHA256 / pit, fissures, rubble, RGB, alpha")
    quit(0)
