## ARCANA Fusion20 immutable source-vote routing. This is a source contract,
## not 20/20 rendered spells. Durations are read from original A/B/C TS;
## D#19 uses the explicit creator override (D timeline still needs native port).
## NONE entries are design candidates and NEVER creator-approved Gold.
extends RefCounted
class_name Arcana20SourceCatalog

const SLOTS: Array[Dictionary] = [
    {"id":1,"name":"Cinder Crown","school":"fire","lead":"A+C","parts":["A:01","C:01"],"duration":7.8,"climax":4.82,"approved":true},
    {"id":2,"name":"Furnace Wyrm","school":"fire","lead":"B","parts":["B:02"],"duration":7.6,"climax":5.12,"approved":true},
    {"id":3,"name":"Meteor Loom","school":"fire","lead":"B","parts":["B:03"],"duration":10.0,"climax":7.25,"approved":true},
    {"id":4,"name":"Ashen Guillotine","school":"fire","lead":"NEW","parts":["C:04_STUDY","A:04_STUDY"],"duration":8.0,"climax":4.25,"approved":false,"redesign":"Diagonal slit > physical blade > one fast cut > delayed A cracks; C flame column study"},
    {"id":5,"name":"Abyssal Bloom","school":"water","lead":"A+C","parts":["A:05","C:05"],"duration":8.6,"climax":5.4,"approved":true},
    {"id":6,"name":"Riptide Calligraphy","school":"water","lead":"NEW","parts":["C:06_STUDY","A:06_STUDY"],"duration":8.8,"climax":6.15,"approved":false,"redesign":"C coherent water writing plus A smooth ribbons; readable glyph and moving tip contact"},
    {"id":7,"name":"Mirrorfrost Basilica","school":"ice","lead":"C","parts":["C:07"],"duration":9.2,"climax":6.62,"approved":true},
    {"id":8,"name":"Undertow Maw","school":"water","lead":"B","parts":["B:08"],"duration":8.5,"climax":5.3,"approved":true},
    {"id":9,"name":"Chain Verdict","school":"volt","lead":"A+B+C","parts":["A:09","B:09","C:09"],"duration":7.8,"climax":6.08,"approved":true},
    {"id":10,"name":"Thunderloom","school":"volt","lead":"C","parts":["C:10"],"duration":7.4,"climax":4.84,"approved":true},
    {"id":11,"name":"Volt Carousel","school":"volt","lead":"A+C09","parts":["A:11","C:09_ARCS"],"duration":8.2,"climax":6.12,"approved":true},
    {"id":12,"name":"Skybreaker Script","school":"volt","lead":"NEW","parts":["A:12_STUDY","C:09_ARCS_STUDY"],"duration":8.8,"climax":7.14,"approved":false,"redesign":"A glyph study, C09 coherent discharge, causal sky-to-ground writing"},
    {"id":13,"name":"Rootwake","school":"verdant","lead":"NEW","parts":["B:13_STUDY","C:13_STUDY"],"duration":9.4,"climax":6.72,"approved":false,"redesign":"Directed root growth with readable causality; B/C opening study"},
    {"id":14,"name":"Spore Nebula","school":"verdant","lead":"NEW","parts":["A:14_STUDY","B:14_STUDY","C:14_STUDY"],"duration":9.4,"climax":7.12,"approved":false,"redesign":"Causal fungal network and bioluminescence; not random particles"},
    {"id":15,"name":"Thorn Opera","school":"verdant","lead":"C","parts":["C:15"],"duration":8.4,"climax":6.0,"approved":true},
    {"id":16,"name":"Worldseed","school":"verdant","lead":"A+C","parts":["A:16","C:16"],"duration":10.2,"climax":7.72,"approved":true},
    {"id":17,"name":"Event Horizon","school":"astral","lead":"C","parts":["C:17"],"duration":8.8,"climax":6.45,"approved":true},
    {"id":18,"name":"Chronoshard","school":"astral","lead":"NEW","parts":["B:18_STUDY"],"duration":10.0,"climax":5.2,"approved":false,"redesign":"B crystal design study, replace incoherent bouncing with authored time fractures"},
    {"id":19,"name":"Constellation Engine","school":"astral","lead":"D","parts":["D:19","A:19_COMBAT"],"duration":9.8,"climax":8.15,"approved":true},
    {"id":20,"name":"Reality Ripper","school":"astral","lead":"A+C","parts":["A:20","C:20"],"duration":10.4,"climax":6.3,"approved":true}
]

const REDESIGN_IDS := [4,6,12,13,14,18]
const NATIVE_RENDERED_IDS := [2] # source B #02 in active native procedural port; not Gold accepted

static func slot(id: int) -> Dictionary:
    if id < 1 or id > SLOTS.size():
        return {}
    return SLOTS[id-1].duplicate(true)

static func canonical_id(id: int) -> StringName:
    return StringName("arcana_fusion20_%02d" % id)

static func phase(id: int, time_s: float) -> StringName:
    var item := slot(id)
    if item.is_empty() or float(item.duration) <= 0.0:
        return &"SOURCE_TIMELINE_NOT_PORTED"
    var dur: float = item.duration
    var climax: float = item.climax
    if time_s < 0.0:
        return &"PRECAST"
    if time_s >= dur:
        return &"CLEAN_OUT"
    if time_s < climax - 0.5:
        return &"OPENING_TRAVEL"
    if time_s < climax + 0.2:
        return &"CONTACT_PEAK"
    return &"AFTERMATH_OUT"

static func validate() -> Array[String]:
    var errors: Array[String] = []
    if SLOTS.size() != 20:
        errors.append("expected 20")
    var none := 0
    for i in range(SLOTS.size()):
        var item: Dictionary = SLOTS[i]
        if int(item.id) != i+1 or String(item.name).is_empty():
            errors.append("slot mismatch %d" % (i+1))
        if not bool(item.approved):
            none += 1
            if not REDESIGN_IDS.has(i+1) or not item.has("redesign"):
                errors.append("missing redesign direction %d" % (i+1))
        if bool(item.approved) and REDESIGN_IDS.has(i+1):
            errors.append("unapproved skill promoted %d" % (i+1))
    if none != 6 or String(SLOTS[18].lead) != "D":
        errors.append("creator vote / D override mismatch")
    return errors
