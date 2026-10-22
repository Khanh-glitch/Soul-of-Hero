class_name HeroLibraryCatalog
extends RefCounted

const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const K_NIGHT: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const SKILL_KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const OTHER_HEROES := {
	"archer_hero": preload("res://game/heroes/data/archer_hero.tres"),
	"axe_hero": preload("res://game/heroes/data/axe_hero.tres"),
	"wizard_hero": preload("res://game/heroes/data/wizard_hero.tres"),
}
const PORTRAIT_FRAMES := {
	"archer_hero": {"path": "res://assets/characters/archer/archer_player_sheet.png", "size": Vector2(64, 64)},
	"axe_hero": {"path": "res://assets/characters/axe_warrior/_Idle.png", "size": Vector2(120, 80)},
	"wizard_hero": {"path": "res://assets/library/downloaded/wizard_pack/Idle.png", "size": Vector2(231, 190)},
}


static func hero_ids() -> Array[StringName]:
	return [&"sword_hero", &"archer_hero", &"axe_hero", &"wizard_hero"]


static func profile(hero_id: StringName) -> Dictionary:
	if hero_id != &"sword_hero":
		return _other_hero_profile(hero_id)
	return {
		"hero_id": K_NIGHT.hero_id,
		"display_name": K_NIGHT.display_name,
		"title": K_NIGHT.title,
		"role": "Đấu sĩ cận chiến • Kiếm • Truy kích / Hành quyết",
		"summary": K_NIGHT.role_summary,
		"portrait": "res://assets/characters/knight/_Idle.png",
		"portrait_frame_size": Vector2(120, 80),
		"combo_title": "NỘI TẠI • TỨ KIẾM ÂM GIỚI",
		"stats": {
			"HP": int(K_NIGHT.base_max_hp),
			"MP": int(K_NIGHT.base_max_mana),
			"DMG": int(K_NIGHT.base_power),
			"Di chuyển": "Trung bình",
			"Tăng trưởng": "HP / MP / DMG: Trung bình",
		},
		"identity": [
			"Combo bốn hit được giữ bằng cửa sổ 2 giây.",
			"Hit 3 gắn Truy Kích; Hit 4 lao tới và cộng 80% HP mục tiêu đã mất.",
			"Dư ảnh chụp đúng tổng sát thương đòn gốc rồi mới áp hệ số.",
			"Binh đoàn đổi khoảng cách tới tường thành sát thương hoặc khống chế.",
		],
		"combo": [
			{"name": "Hit 1 • Khai Kiếm", "copy": "Chém gần phía trước • 100% DMG."},
			{"name": "Hit 2 • Áp Sát", "copy": "Lao ngắn • 120% DMG • chậm 30% trong 1 giây."},
			{"name": "Hit 3 • Sóng Truy Kích", "copy": "Sóng kiếm 50% DMG • một mục tiêu • bị tường chặn • giật lùi nhẹ."},
			{"name": "Hit 4 • Đoạt Mệnh", "copy": "Lao tới dấu Truy Kích • 100% DMG + 80% HP đã mất."},
		],
		"basic_skills": [
			{"name": "E • Linh Hồn Chiến Binh", "copy": "1/1/2/2/3 dư ảnh • 3–7 giây • hồi chiêu tính từ lúc hết hiệu lực."},
			{"name": "R • Đoạt Hồn Trảm", "copy": "Chém bán nguyệt tức thời • hồi phục nhẹ • thao tác nhanh, không tụ lực."},
		],
		"advanced_skills": [
			{"name": "E • Hư Ảnh", "copy": "Dư ảnh tiếp cận từ nhiều góc phía sau mục tiêu • +10 MP • +3 giây hồi."},
			{"name": "R • Binh Đoàn Âm Giới", "copy": "5/7/9/12/15 kỵ binh • 10 tick/0,2 giây • tường gần choáng lâu hơn."},
		],
		"soul_skills": [
			{"name": "Q • Hộ Vệ Linh Tử", "copy": "Bậc Thường–Huyền thoại • 1–5 ảo ảnh • đẩy mục tiêu rồi thực hiện đủ combo."},
			{"name": "Q • Binh Đoàn Báo Thù", "copy": "Bậc Kim cương–Bất tử • 5 giây • sát thương dựa trên cửa sổ nhận damage 10 giây."},
		],
		"departure_skills": [
			{"name": "Hơi Thở Cuối Cùng", "copy": "Sóng kiếm gây đúng lượng HP K-Night đã mất trước khi rời sân."},
			{"name": "Oán Hồn", "copy": "Bậc Kim cương+ • toàn màn hình • 300% tốc đánh • ưu tiên HP thấp nhất trong 5 giây."},
		],
		"rarities": KNightRules.RARITY_NAMES,
		"rarity_colors": KNightRules.RARITY_COLORS,
		"lore": K_NIGHT.lore,
		"lore_pending": K_NIGHT.lore_pending,
	}


## The Library is a read-only compendium, not the source of ownership or unlocks.
## Derive non-K-Night cards from the same HeroDefinition / kit data as combat;
## showing a designed kit does not imply the player owns a Hero or that an
## untested combat path has passed production playtesting.
static func _other_hero_profile(hero_id: StringName) -> Dictionary:
	var key := String(hero_id)
	var hero := OTHER_HEROES.get(key) as HeroDefinition
	if hero == null:
		return {}
	var kit: Dictionary = SKILL_KITS.KIT_CATALOG.get(key, {})
	var portrait: Dictionary = PORTRAIT_FRAMES.get(key, {})
	if kit.is_empty() or portrait.is_empty():
		return {}
	var basic: Dictionary = kit.get("basic", {})
	var advanced: Dictionary = kit.get("advanced", {})
	var legendary: Dictionary = kit.get("legendary_plus", {})
	var combo: Array[Dictionary] = []
	for index: int in hero.combo_names.size():
		combo.append({
			"name": "%d • %s" % [index + 1, hero.combo_names[index]],
			"copy": "Đòn trong chuỗi chiến đấu • hiệu lực cuối phụ thuộc build đang trang bị.",
		})
	if combo.is_empty():
		combo.append({
			"name": "Đòn đánh cơ bản",
			"copy": "Xem hành vi thực tế trong combat và Hero Weapon đang trang bị.",
		})
	return {
		"hero_id": hero.hero_id,
		"display_name": hero.display_name,
		"title": "HERO • %s" % hero.affinity.to_upper(),
		"role": String(kit.get("strength", "")),
		"summary": String(kit.get("strength", "")),
		"portrait": String(portrait["path"]),
		"portrait_frame_size": portrait["size"],
		"stats": {
			"HP": int(hero.base_max_hp),
			"MP": int(hero.base_max_mana),
			"DMG": int(hero.base_power),
			"Di chuyển": "%.2fx" % hero.base_move_speed_multiplier,
			"Tăng trưởng": "Chỉ số gốc • chưa cộng Level, Soul hay trang bị.",
		},
		"identity": [
			"Vai trò: %s" % String(kit.get("strength", "")),
			"Thư viện mô tả Hero và các bậc skill kit; sở hữu và hiệu lực thực tế xem tại Đội hình.",
		],
		"combo_title": "CHUỖI TẤN CÔNG",
		"combo": combo,
		"basic_skills": _skill_pair_entries(basic),
		"advanced_skills": _skill_pair_entries(advanced),
		"soul_skills": [
			{"name": "Triệu hồi • %s" % hero.summon_skill_name,
			 "copy": "Kỹ năng Soul của Hero; tình trạng Ready/Relay theo gameplay."},
			_skill_entry(legendary.get("soul", {}), "Legendary+"),
		],
		"departure_skills": [
			{"name": "Rời sân • %s" % hero.departure_skill_name,
			 "copy": "Hành vi đổi Hero phụ thuộc Soul Team đang trang bị."},
			_skill_entry(legendary.get("departure", {}), "Legendary+"),
		],
		"rarities": KNightRules.RARITY_NAMES,
		"rarity_colors": KNightRules.RARITY_COLORS,
		"lore": hero.lore,
		"lore_pending": hero.lore_pending or hero.lore.is_empty(),
	}


static func _skill_pair_entries(kit_band: Dictionary) -> Array[Dictionary]:
	return [
		_skill_entry(kit_band.get("active_1", {}), "Kỹ năng 1"),
		_skill_entry(kit_band.get("active_2", {}), "Kỹ năng 2"),
	]


static func _skill_entry(raw_skill: Variant, label: String) -> Dictionary:
	var skill: Dictionary = raw_skill if raw_skill is Dictionary else {}
	var name := String(skill.get("name", "Chưa định nghĩa"))
	var details: Array[String] = []
	if skill.has("mana"):
		details.append("%.0f Mana" % float(skill["mana"]))
	if skill.has("cooldown"):
		details.append("Hồi %.1fs" % float(skill["cooldown"]))
	if skill.has("charge"):
		details.append("Tụ lực %.1fs" % float(skill["charge"]))
	if details.is_empty():
		details.append("Chỉ số thực tế phụ thuộc rarity, rank và Hero Weapon.")
	return {
		"name": "%s • %s" % [label, name],
		"copy": " • ".join(details),
	}
