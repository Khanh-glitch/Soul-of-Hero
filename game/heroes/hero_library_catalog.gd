class_name HeroLibraryCatalog
extends RefCounted

const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const K_NIGHT: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")


static func hero_ids() -> Array[StringName]:
	return [&"sword_hero"]


static func profile(hero_id: StringName) -> Dictionary:
	if hero_id != &"sword_hero":
		return {}
	return {
		"hero_id": K_NIGHT.hero_id,
		"display_name": K_NIGHT.display_name,
		"title": K_NIGHT.title,
		"role": "Đấu sĩ cận chiến • Kiếm • Truy kích / Hành quyết",
		"summary": K_NIGHT.role_summary,
		"portrait": "res://assets/characters/knight/_Idle.png",
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
