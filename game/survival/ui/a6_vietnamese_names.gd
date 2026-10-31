class_name A6VietnameseNames
extends RefCounted

## The player-facing Vietnamese name for everything the survival loop shows.
##
## A3 owns the catalog and its `label` field is English ("Field Meal", "Stone Pick").
## The creator read the workshop at 1x and reported exactly that: English nouns sitting
## inside a Vietnamese interface. Translating the catalog itself would rewrite A3 data
## and break every consumer that matches on the English label, so the translation lives
## here instead: one table, presentation only, keyed by the catalog's own ids.
##
## The rules this file follows:
##   * no invented content - every entry maps an id the shipped catalog defines;
##   * no silent guessing - an id with no entry returns "" and the caller falls back to
##     the catalog's English label, which is still real data;
##   * no gameplay meaning - nothing here grants, prices or unlocks anything.

## Every item id in `data/survival/items/items.json`, in the catalog's own vocabulary.
const ITEMS := {
	"oak_wood": "Gỗ sồi",
	"stone_chunk": "Đá vụn",
	"iron_scrap": "Sắt vụn",
	"reed_fibre": "Sợi lau",
	"crypt_bone_shard": "Mảnh xương hầm",
	"reaper_essence": "Tinh chất Tử thần",
	"venom_spine": "Gai nọc",
	"soul_ember": "Than hồn",
	"predator_jaw": "Hàm thú săn",
	"fractured_axe_insignia": "Huy hiệu rìu vỡ",
	"blood_crucible_blueprint": "Bản vẽ Nồi máu",
	"iron_ore": "Quặng sắt",
	"coal": "Than đá",
	"clay": "Đất sét",
	"sulfur": "Pha lê lưu huỳnh",
	"frost_shard": "Mảnh băng",
	"ancient_catalyst": "Xúc tác cổ",
	"moonleaf": "Lá nguyệt",
	"moonleaf_seed": "Hạt lá nguyệt",
	"wild_berries": "Quả dại",
	"grain": "Thóc",
	"charcoal": "Than củi",
	"iron_ingot": "Thỏi sắt",
	"steel_ingot": "Thỏi thép",
	"iron_parts": "Phụ tùng sắt",
	"spring": "Lò xo",
	"binding_cloth": "Vải quấn",
	"venom_extract": "Dịch nọc",
	"frost_extract": "Dịch băng",
	"core_blank": "Lõi trống",
	"charged_blank": "Lõi tích điện",
	"knowledge_spares": "Phụ tùng tri thức",
	"research_notes": "Ghi chép nghiên cứu",
	"compost": "Phân ủ",
	"furnace_kit": "Bộ lò rèn",
	"workbench_kit": "Bộ bàn thợ",
	"research_kit": "Bộ bàn nghiên cứu",
	"garden_kit": "Bộ luống vườn",
	"advanced_furnace_kit": "Bộ lò rèn cao cấp",
	"core_venom": "Lõi nọc",
	"plan_venom_core": "Bản vẽ lõi nọc",
	"core_frost": "Lõi băng",
	"plan_frost_core": "Bản vẽ lõi băng",
	"core_ember": "Lõi than hồn",
	"plan_ember_core": "Bản vẽ lõi than hồn",
	"toxin_mask": "Mặt nạ lọc độc",
	"frost_cloak": "Áo choàng băng",
	"stone_pick": "Cuốc đá",
	"iron_pick": "Cuốc sắt",
	"salvage_hammer": "Búa trục vớt",
	"field_meal": "Bữa ăn dã chiến",
	"minor_salve": "Thuốc xoa nhẹ",
	"grain_seed": "Hạt thóc",
	"green_seal": "Ấn xanh",
	"blue_seal": "Ấn lam",
	"purple_seal": "Ấn tím",
}

## The primary output of every recipe the catalog defines. A3 names a job by the
## *recipe* it came from (`{"target": "burn_charcoal", "kind": "craft"}`), so a queue row
## that printed the target verbatim showed "burn charcoal" - an id - instead of the thing
## being made. This table is the catalog's own outputs, not a second opinion about them.
const RECIPE_OUTPUTS := {
	"burn_charcoal": "charcoal",
	"smelt_iron": "iron_ingot",
	"smelt_ore": "iron_ingot",
	"alloy_steel": "steel_ingot",
	"make_parts": "iron_parts",
	"make_spring": "spring",
	"weave_cloth": "binding_cloth",
	"make_spares": "knowledge_spares",
	"make_notes": "research_notes",
	"make_compost": "compost",
	"furnace_kit": "furnace_kit",
	"workbench_kit": "workbench_kit",
	"research_kit": "research_kit",
	"garden_kit": "garden_kit",
	"advanced_furnace_kit": "advanced_furnace_kit",
	"stone_pick": "stone_pick",
	"iron_pick": "iron_pick",
	"salvage_hammer": "salvage_hammer",
	"extract_venom": "venom_extract",
	"extract_frost": "frost_extract",
	"core_blank": "core_blank",
	"charge_blank": "charged_blank",
	"craft_core_venom": "core_venom",
	"craft_core_frost": "core_frost",
	"craft_core_ember": "core_ember",
	"toxin_mask": "toxin_mask",
	"frost_cloak": "frost_cloak",
	"field_meal": "field_meal",
	"minor_salve": "minor_salve",
	"grow_moonleaf": "moonleaf",
	"grow_grain": "grain",
	"rebuild_core_venom": "core_venom",
	"rebuild_core_frost": "core_frost",
	"rebuild_core_ember": "core_ember",
	"study_predator_jaw": "knowledge_spares",
	"study_axe_insignia": "knowledge_spares",
}

## Station kinds, as `survival_catalog.json` / `stations.json` name them.
const STATIONS := {
	"hand": "Chế tay",
	"workbench": "Bàn thợ",
	"furnace": "Lò rèn",
	"research": "Bàn nghiên cứu",
	"garden": "Luống vườn",
}

## The economy session's own job statuses. An unknown status is shown verbatim by the
## caller rather than smoothed into a word the owner never said.
const JOB_STATUS := {
	"queued": "đã xếp",
	"running": "đang làm",
	"paused": "tạm dừng",
	"ready": "xong",
	"cancelled": "đã huỷ",
}


## The Vietnamese name for an item id, or "" when the table has no entry. Callers fall
## back to the catalog label so nothing is hidden and nothing is invented.
static func item(id: String) -> String:
	return String(ITEMS.get(id, ""))


## What a craft job for `recipe_id` will produce, or "" when the catalog has no such
## recipe. A job names its recipe; players name what they are going to hold.
static func recipe_product(recipe_id: String) -> String:
	return String(RECIPE_OUTPUTS.get(recipe_id, ""))


## The Vietnamese name for a station kind, or "" when unknown.
static func station(kind: String) -> String:
	return String(STATIONS.get(kind, ""))


## The Vietnamese word for a job status, or "" when the session uses a status this
## table does not know yet.
static func job_status(status: String) -> String:
	return String(JOB_STATUS.get(status, ""))


## How many catalog ids this table currently covers. Printed by the capture driver so a
## published report can state the coverage instead of claiming "localised".
static func coverage() -> int:
	return ITEMS.size()
