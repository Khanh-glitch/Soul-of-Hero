## Real SOH-side binding of ALL 20 creator-authored ARCANA Fusion20 spell slots.
## Design is catalogued here; this is NOT a claim that any VFX renderer is Gold-approved.
extends RefCounted
class_name Arcana20SOHRegistry

## [ID, source visual lead, SOH on-body element, original vote approved]
## Six NONE candidates have a directed redesign brief, not a creator-voted Gold.
## #19 final D visual override supersedes initial A three-way vote.
const SPELLS: Array = [
    [1, "Cinder Crown", "A+C", "fire", true],
    [2, "Furnace Wyrm", "B", "fire", true],
    [3, "Meteor Loom", "B", "fire", true],
    [4, "Ashen Guillotine", "C+A_REDESIGN", "fire", false],
    [5, "Abyssal Bloom", "A+C", "water", true],
    [6, "Riptide Calligraphy", "C+A_REDESIGN", "water", false],
    [7, "Mirrorfrost Basilica", "C", "ice", true],
    [8, "Undertow Maw", "B", "water", true],
    [9, "Chain Verdict", "A+B+C", "volt", true],
    [10, "Thunderloom", "C", "volt", true],
    [11, "Volt Carousel", "A+C09", "volt", true],
    [12, "Skybreaker Script", "A+C09_REDESIGN", "volt", false],
    [13, "Rootwake", "B+C_REDESIGN", "verdant", false],
    [14, "Spore Nebula", "A+B+C_REDESIGN", "verdant", false],
    [15, "Thorn Opera", "C", "verdant", true],
    [16, "Worldseed", "A+C", "verdant", true],
    [17, "Event Horizon", "C", "astral", true],
    [18, "Chronoshard", "B_REDESIGN", "astral", false],
    [19, "Constellation Engine", "D", "astral", true],
    [20, "Reality Ripper", "A+C", "astral", true],
]

const SOURCE_ELEMENTS: Array[StringName] = [
    &"fire", &"water", &"ice", &"volt", &"verdant", &"astral"
]

static func canonical_id(id: int) -> StringName:
    return StringName("arcana_fusion20_%02d" % id)

static func index_of(skill: StringName) -> int:
    var s := String(skill)
    if not s.begins_with("arcana_fusion20_"):
        return -1
    var suffix := s.trim_prefix("arcana_fusion20_")
    if suffix.length() != 2 or not suffix.is_valid_int():
        return -1
    var id := int(suffix)
    return id if id >= 1 and id <= 20 else -1

static func lookup(skill: StringName) -> Dictionary:
    var id := index_of(skill)
    if id < 1:
        return {}
    var data: Array = SPELLS[id - 1]
    return {
        "id": id,
        "canonical_id": canonical_id(id),
        "name": String(data[1]),
        "source_visual_lead": String(data[2]),
        "source_element": StringName(data[3]),
        "creator_visual_voted": bool(data[4]),
        "status": "SOURCE_SELECTED_NOT_NATIVE_ACCEPTED" if bool(data[4]) else "REDESIGN_CANDIDATE_NOT_APPROVED",
    }

static func validate_catalog() -> Array[String]:
    var failures: Array[String] = []
    if SPELLS.size() != 20:
        failures.append("expected exactly 20 canonical skill slots")
        return failures
    var ids: Dictionary = {}
    var none := 0
    for row: Array in SPELLS:
        var id := int(row[0])
        if id < 1 or id > 20 or ids.has(id):
            failures.append("invalid/duplicate skill id %d" % id)
        ids[id] = true
        if not SOURCE_ELEMENTS.has(StringName(row[3])):
            failures.append("invalid element on %d" % id)
        if not bool(row[4]):
            none += 1
        if lookup(canonical_id(id)).is_empty():
            failures.append("unresolvable skill %d" % id)
    if none != 6:
        failures.append("six none-vote redesigns must remain explicit")
    if String(SPELLS[18][2]) != "D":
        failures.append("#19 must be the final D source visual override")
    return failures
