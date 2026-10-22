class_name AuxiliaryEquipmentPresentation
extends RefCounted

## Semantic presentation catalog for universal equipment. Instances are not
## Hero-restricted, but one instance can only be worn by one Hero at a time.
##
## The persisted item remains the gameplay authority.  Its stable UUID selects
## one authored silhouette while rarity selects the visual grade.  This keeps
## names/icons deterministic across save reloads without duplicating cosmetic
## data in every item instance.

const DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")

const ICON_ROOT := "res://assets/library/downloaded/rpg_icons_400/Icon%d.png"

const SLOT_DISPLAY_NAMES := {
	"soul_vessel": "Giáp",
	"soul_boots": "Giày",
	"soul_trace": "Trang Sức",
}
const SLOT_FUNCTIONS := {
	"soul_vessel": "Tăng HP hoặc tạo Giáp ảo nhìn thấy; không giảm damage ẩn.",
	"soul_boots": "Tăng tốc độ, nhịp Lướt và Né hiển thị 0 DAMAGE.",
	"soul_trace": "Tăng Power, Mana và nhịp kỹ năng cho Hero đang đeo.",
}
const SLOT_FAMILIES := {
	"soul_vessel": "armor",
	"soul_boots": "boots",
	"soul_trace": "ring_or_chain",
}

# Every icon from 151 through 200 is intentionally classified once.  The
# pools are curated by silhouette, material and ornament rather than numeric
# proximity; rarity aura/label remains the final canonical rarity signal.
const ARMOR_RARITY_POOLS := [
	[152, 162, 163, 164, 165, 182, 184, 192],
	[153, 161, 166, 169, 172, 173, 181, 183, 185],
	[151, 168, 170, 178, 186, 188, 190],
	[154, 174, 176, 179, 187, 194, 199],
	[155, 167, 175, 189, 195],
	[157, 158, 177, 180, 197, 198],
	[159, 171, 191, 193, 196],
	[156, 160, 200],
]
const ARMOR_NAMES := {
	151: "Khiên Lục Ấn",
	152: "Khiên Sắt Tập Sự",
	153: "Khiên Khắc Cổ Tự",
	154: "Khiên Lam Băng",
	155: "Khiên Nhật Tâm",
	156: "Khiên Vương Miện Xám",
	157: "Khiên Pha Lê",
	158: "Khiên Ngân Quang",
	159: "Khiên Ma Giác",
	160: "Khiên Thiên Thành",
	161: "Mũ Pháp Hỏa",
	162: "Mũ Da Hầm Mộ",
	163: "Mũ Da Du Hành",
	164: "Mũ Da Hộ Vệ",
	165: "Mũ Sắt Viền Da",
	166: "Mũ Sừng Phương Bắc",
	167: "Mũ Kỵ Sĩ Đỏ",
	168: "Mũ Hiệp Sĩ Bạc",
	169: "Mũ Rêu Cổ",
	170: "Mũ Thép Kín",
	171: "Mũ Lục Hồn",
	172: "Mũ Tro Lang",
	173: "Mũ Vệ Binh",
	174: "Mũ Lam Thép",
	175: "Mũ Hoàng Kim",
	176: "Mũ Oán Cốt",
	177: "Mũ Tinh Thể",
	178: "Mũ Xích Bạc",
	179: "Mũ Tử Cốt",
	180: "Mũ Băng Nha",
	181: "Áo Choàng Huyết",
	182: "Giáp Da Khâu",
	183: "Giáp Da Đấu Sĩ",
	184: "Giáp Da Lữ Khách",
	185: "Giáp Thợ Săn",
	186: "Giáp Kỵ Sĩ",
	187: "Giáp Huyết Vương",
	188: "Giáp Ngân Tu",
	189: "Giáp Rêu Vàng",
	190: "Giáp Bạch Ngân",
	191: "Giáp Lục Tinh",
	192: "Giáp Sừng Da",
	193: "Giáp Cánh Thép",
	194: "Giáp Long Lam",
	195: "Giáp Thánh Tâm",
	196: "Giáp Song Long",
	197: "Tinh Giáp Thiên Lam",
	198: "Giáp Ngân Cương",
	199: "Giáp Oán Cốt",
	200: "Giáp Thiên Long",
}

# Rings 241-250 and chains 251-260 stay in one offensive slot, but their
# individual names preserve the visual distinction instead of calling every
# drop the same generic "Soul Trace".
const TRACE_RARITY_POOLS := [
	[241, 242, 251],
	[243, 252],
	[245, 253],
	[246, 254],
	[244, 257],
	[249, 258],
	[250, 259],
	[247, 248, 255, 256, 260],
]
const TRACE_NAMES := {
	241: "Nhẫn Đồng Chiến Ý",
	242: "Nhẫn Sắt Trầm",
	243: "Nhẫn Thép Khắc",
	244: "Nhẫn Hoàng Kim",
	245: "Nhẫn Lam Ngân",
	246: "Nhẫn Hỏa Văn",
	247: "Nhẫn Thành Lũy",
	248: "Nhẫn Hắc Miện",
	249: "Nhẫn Lam Châu",
	250: "Nhẫn Tam Tinh",
	251: "Dây Chuyền Hổ Phách",
	252: "Mặt Dây Hắc Nguyệt",
	253: "Mặt Dây Nguyệt Nha",
	254: "Mặt Dây Nhật Ấn",
	255: "Mặt Dây Cổ Tự",
	256: "Kiềng Hỏa Tâm",
	257: "Dây Chuyền Hồng Tâm",
	258: "Chuỗi Bạch Tinh",
	259: "Dây Chuyền Vương Giả",
	260: "Chuỗi Ngũ Sắc",
}

# The crystal atlas is ten colour/affinity families with exactly eight shapes
# per family.  The source sheet wraps the white and frost families across rows;
# these explicit sequences restore the real grouping.  Rarity chooses shape,
# UUID chooses affinity, so all 80 assets remain useful and deterministic.
const CRYSTAL_FAMILIES := [
	{"id": "radiant", "name": "Quang Hồn Tinh", "icons": [321, 322, 323, 324, 341, 342, 343, 344]},
	{"id": "ember", "name": "Hỏa Hồn Tinh", "icons": [325, 326, 327, 328, 329, 330, 331, 332]},
	{"id": "azure", "name": "Lam Hồn Tinh", "icons": [333, 334, 335, 336, 337, 338, 339, 340]},
	{"id": "verdant", "name": "Lục Hồn Tinh", "icons": [345, 346, 347, 348, 349, 350, 351, 352]},
	{"id": "earth", "name": "Địa Hồn Tinh", "icons": [353, 354, 355, 356, 357, 358, 359, 360]},
	{"id": "frost", "name": "Băng Hồn Tinh", "icons": [361, 362, 363, 364, 381, 382, 383, 384]},
	{"id": "void", "name": "Hư Không Tinh", "icons": [365, 366, 367, 368, 369, 370, 371, 372]},
	{"id": "blood", "name": "Huyết Hồn Tinh", "icons": [373, 374, 375, 376, 377, 378, 379, 380]},
	{"id": "ancient", "name": "Cổ Hồn Tinh", "icons": [385, 386, 387, 388, 389, 390, 391, 392]},
	{"id": "dusk", "name": "U Hồn Tinh", "icons": [393, 394, 395, 396, 397, 398, 399, 400]},
]
const CRYSTAL_GRADE_NAMES := [
	"Mầm", "Trụ", "Hạch", "Lăng", "Ấn", "Tinh Lệ", "Tinh Tâm", "Tinh Quan",
]

## Boots are a live equipment family. Lower tiers use practical leather and
## iron silhouettes; higher tiers progressively expose the authored magical
## silhouettes. Every icon remains deterministic from UUID + rarity.
const BOOTS_RARITY_POOLS := [
	[221, 222, 223, 224],
	[225, 226, 227],
	[228, 229, 230],
	[231, 232, 233],
	[234, 235],
	[236, 237],
	[238, 239],
	[240],
]
const BOOTS_NAMES := {
	221: "Hài Đỏ Lữ Hành",
	222: "Dép Da Nhẹ",
	223: "Ủng Da Gấp",
	224: "Ủng Da Đường Dài",
	225: "Ủng Đá Gót Sắt",
	226: "Ủng Da Chinh Chiến",
	227: "Ủng Da Bọc Mũi",
	228: "Ủng Da Gia Cố",
	229: "Hài Lục Kim",
	230: "Ủng Bạch Ngân",
	231: "Ủng Lục Tinh",
	232: "Ủng Tro Nhẹ",
	233: "Ủng Lam Thạch",
	234: "Hài Cánh Băng",
	235: "Hài Nhật Tâm",
	236: "Ủng Hắc Thạch",
	237: "Hài Lam Phong",
	238: "Ủng Băng Nha",
	239: "Ủng Oán Cốt",
	240: "Ủng Ngân Vệ",
}

## Crystals no longer occupy an equipment slot. One radiant silhouette per
## rarity is used for stackable upgrade stones; the wider 321-400 atlas stays
## catalogued below so later recipes can add affinities without schema churn.
const UPGRADE_STONE_ICON_IDS := [321, 322, 323, 324, 341, 342, 343, 344]
const UPGRADE_STONE_NAMES := [
	"Đá Nâng Cấp Thô",
	"Đá Nâng Cấp Ma Thuật",
	"Đá Nâng Cấp Hiếm",
	"Đá Nâng Cấp Sử Thi",
	"Đá Nâng Cấp Huyền Thoại",
	"Đá Nâng Cấp Pha Lê",
	"Đá Nâng Cấp Thần Thoại",
	"Đá Nâng Cấp Vĩnh Hằng",
]


static func presentation_for(item: Dictionary) -> Dictionary:
	var slot_id := String(item.get("slot", ""))
	if not DEFINITIONS.is_valid_slot(slot_id):
		return {}
	var rarity_id := String(item.get("rarity", "normal"))
	var rarity_index := maxi(0, DEFINITIONS.rarity_index(rarity_id))
	var identity_key := String(item.get("uuid", "")).strip_edges()
	if identity_key.is_empty():
		identity_key = "%s:%d" % [slot_id, int(item.get("item_level", 1))]
	var stable_key := "%s:%s:%s:%d" % [
		identity_key,
		slot_id,
		rarity_id,
		int(item.get("item_level", 1)),
	]
	var result := {
		"slot": slot_id,
		"slot_name": slot_display_name(slot_id),
		"function": slot_function(slot_id),
		"family": String(SLOT_FAMILIES[slot_id]),
		"rarity": rarity_id,
	}
	match slot_id:
		"soul_vessel":
			var pool: Array = ARMOR_RARITY_POOLS[rarity_index]
			var icon_id := int(pool[_stable_index(stable_key, pool.size())])
			result.merge(_icon_result(icon_id, String(ARMOR_NAMES[icon_id])))
		"soul_boots":
			var pool: Array = BOOTS_RARITY_POOLS[rarity_index]
			var icon_id := int(pool[_stable_index(stable_key, pool.size())])
			result.merge(_icon_result(icon_id, String(BOOTS_NAMES[icon_id])))
		"soul_trace":
			var pool: Array = TRACE_RARITY_POOLS[rarity_index]
			var icon_id := int(pool[_stable_index(stable_key, pool.size())])
			result.merge(_icon_result(icon_id, String(TRACE_NAMES[icon_id])))
	return result


static func upgrade_stone_presentation(rarity_id: String) -> Dictionary:
	var rarity_index := DEFINITIONS.rarity_index(rarity_id)
	if rarity_index < 0:
		return {}
	var icon_id := int(UPGRADE_STONE_ICON_IDS[rarity_index])
	var result := _icon_result(icon_id, String(UPGRADE_STONE_NAMES[rarity_index]))
	result["item_id"] = "soul_upgrade_stone_%s" % rarity_id
	result["kind"] = "material"
	result["rarity"] = rarity_id
	result["family"] = "upgrade_stone"
	return result


## Compatibility seam for tooling authored before boots became a live slot.
## New callers should use presentation_for() with a soul_boots item.
static func speed_preview(stable_key: String) -> Dictionary:
	var pool: Array = BOOTS_RARITY_POOLS[0]
	var icon_id := int(pool[_stable_index(stable_key, pool.size())])
	var result := _icon_result(icon_id, String(BOOTS_NAMES[icon_id]))
	result["family"] = "boots"
	result["available_for_loot"] = true
	return result


static func slot_display_name(slot_id: String) -> String:
	return String(SLOT_DISPLAY_NAMES.get(slot_id, "Trang Bị Linh Hồn"))


static func slot_function(slot_id: String) -> String:
	return String(SLOT_FUNCTIONS.get(slot_id, "Hỗ trợ chiến đấu cho toàn đội Hero Soul."))


static func icon_path(icon_id: int) -> String:
	return ICON_ROOT % icon_id


static func get_catalog_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	_validate_exact_icon_family(errors, "armor", ARMOR_RARITY_POOLS, ARMOR_NAMES, 151, 200)
	_validate_exact_icon_family(errors, "ring_or_chain", TRACE_RARITY_POOLS, TRACE_NAMES, 241, 260)
	_validate_exact_icon_family(errors, "boots", BOOTS_RARITY_POOLS, BOOTS_NAMES, 221, 240)

	var crystal_groups: Array = []
	var crystal_names := {}
	for family_value: Variant in CRYSTAL_FAMILIES:
		if not family_value is Dictionary:
			errors.append("Crystal family entries must be Dictionaries.")
			continue
		var family := family_value as Dictionary
		var icons_value: Variant = family.get("icons", [])
		if not icons_value is Array or (icons_value as Array).size() != DEFINITIONS.RARITY_IDS.size():
			errors.append("Crystal family '%s' requires one icon per rarity." % family.get("id", "unknown"))
			continue
		var icons := icons_value as Array
		crystal_groups.append(icons)
		for raw_icon_id: Variant in icons:
			crystal_names[int(raw_icon_id)] = String(family.get("name", "Crystal"))
	_validate_exact_icon_family(errors, "crystal", crystal_groups, crystal_names, 321, 400)
	return errors


static func _icon_result(icon_id: int, display_name: String) -> Dictionary:
	return {
		"definition_id": "rpg400_%d" % icon_id,
		"display_name": display_name,
		"icon_id": icon_id,
		"icon_path": icon_path(icon_id),
	}


static func _stable_index(stable_key: String, size: int) -> int:
	if size <= 1:
		return 0
	var digest := stable_key.sha256_text()
	return posmod(digest.substr(0, 8).hex_to_int(), size)


static func _validate_exact_icon_family(
		errors: PackedStringArray,
		family_name: String,
		groups: Array,
		names: Dictionary,
		minimum: int,
		maximum: int,
) -> void:
	var flattened: Array = []
	for group_value: Variant in groups:
		if group_value is Array:
			flattened.append_array(group_value as Array)
		else:
			errors.append("%s icon pools must contain Arrays." % family_name)
	_validate_flat_icon_family(errors, family_name, flattened, names, minimum, maximum)


static func _validate_flat_icon_family(
		errors: PackedStringArray,
		family_name: String,
		icons: Array,
		names: Dictionary,
		minimum: int,
		maximum: int,
) -> void:
	var expected_count := maximum - minimum + 1
	var seen := {}
	for raw_icon_id: Variant in icons:
		var icon_id := int(raw_icon_id)
		if icon_id < minimum or icon_id > maximum:
			errors.append("%s icon %d is outside %d-%d." % [family_name, icon_id, minimum, maximum])
			continue
		if seen.has(icon_id):
			errors.append("%s icon %d is classified more than once." % [family_name, icon_id])
		seen[icon_id] = true
		if String(names.get(icon_id, "")).strip_edges().is_empty():
			errors.append("%s icon %d has no authored name." % [family_name, icon_id])
		if not ResourceLoader.exists(icon_path(icon_id)):
			errors.append("%s icon %d does not resolve at runtime." % [family_name, icon_id])
	if seen.size() != expected_count:
		errors.append("%s must classify every icon from %d through %d exactly once." % [
			family_name, minimum, maximum,
		])
