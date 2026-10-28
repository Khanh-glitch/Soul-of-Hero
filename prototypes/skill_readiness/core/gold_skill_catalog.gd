class_name Gold93SkillCatalog
extends RefCounted

## Authoritative scoped inventory for ARCANA III + Venomwright readiness.
## Important: catalog presence MUST NOT be interpreted as a native cast.
const MANIFEST_PATH:String="res://docs/vfx/skill_readiness/readiness_manifest.json"
const SUPPORTED_FAMILIES:PackedStringArray=PackedStringArray(["arcana_iii","venomwright"])
var _by_key:Dictionary={}
var _error:String=""

func _init()->void:
    var raw:String=FileAccess.get_file_as_string(MANIFEST_PATH)
    if raw.is_empty():
        _error="READINESS_MANIFEST_MISSING"
        return
    var parsed:Variant=JSON.parse_string(raw)
    if not parsed is Dictionary:
        _error="READINESS_MANIFEST_NOT_OBJECT"
        return
    var rows:Variant=parsed.get("entries",[])
    if not rows is Array:
        _error="READINESS_MANIFEST_ENTRIES_NOT_ARRAY"
        return
    for row in rows:
        if not row is Dictionary:
            _error="READINESS_MANIFEST_BAD_ENTRY"
            return
        var key:String=String(row.get("key",""))
        var family:String=String(row.get("family",""))
        if key.is_empty() or _by_key.has(key) or not SUPPORTED_FAMILIES.has(family):
            _error="READINESS_MANIFEST_INVALID_OR_DUPLICATE_ID"
            return
        _by_key[key]=row.duplicate(true)
    if _by_key.size()!=93:
        _error="READINESS_MANIFEST_EXPECTED_93_GOT_"+str(_by_key.size())

func is_valid()->bool:
    return _error.is_empty()

func error_message()->String:
    return _error

func ids()->PackedStringArray:
    var result:=PackedStringArray()
    for key in _by_key:
        result.append(String(key))
    result.sort()
    return result

func has_skill(key:String)->bool:
    return _by_key.has(key)

func skill(key:String)->Dictionary:
    if not _by_key.has(key):
        return {}
    var out:Dictionary=_by_key[key]
    return out.duplicate(true)

func family_count(family:String)->int:
    var count:int=0
    for row in _by_key.values():
        if String(row.get("family",""))==family:
            count+=1
    return count

func count_ready()->int:
    var count:int=0
    for row in _by_key.values():
        if bool(row.get("native_port_ready",false)):
            count+=1
    return count

func can_cast_in_lab(key:String)->bool:
    # Do not synthesize any Gold skill when only its registry row exists.
    return _by_key.has(key) and bool((_by_key[key] as Dictionary).get("native_port_ready",false))

func can_cast_in_production(key:String)->bool:
    if not can_cast_in_lab(key):
        return false
    var entry:Dictionary=_by_key[key]
    return bool(entry.get("gameplay_configured",false)) and bool(entry.get("production_integrated",false))
