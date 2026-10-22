class_name RarityPalette
extends RefCounted

## One presentation palette shared by target plates, ground-loot prompts and
## the in-run Codex. Gameplay keeps rarity authority; UI only normalizes names.
const IDS := [
	"normal", "magic", "rare", "epic", "legendary", "crystal", "mythic", "eternal",
]
const DISPLAY_NAMES := [
	"THƯỜNG", "PHÉP THUẬT", "HIẾM", "SỬ THI", "HUYỀN THOẠI", "KIM CƯƠNG", "THẦN THÁNH", "BẤT TỬ",
]
const COLORS := [
	Color("e8edf2"), Color("4f8dff"), Color("ffd84a"), Color("a96cff"),
	Color("ff8a32"), Color("38c8ff"), Color("ed4b55"), Color("35e5a1"),
]
const ON_LIGHT_TEXT_COLORS := [
	Color("4d5359"), Color("174f9c"), Color("75610b"), Color("71329b"),
	Color("9a5008"), Color("15657f"), Color("901f2e"), Color("117052"),
]


static func normalize(value: Variant) -> StringName:
	if value is int or value is float:
		return StringName(IDS[clampi(int(value), 0, IDS.size() - 1)])
	var id := String(value).strip_edges().to_lower().replace(" ", "_")
	if id == "common":
		id = "normal"
	if id == "uncommon":
		id = "magic"
	return StringName(id if id in IDS else "normal")


static func index(value: Variant) -> int:
	return maxi(0, IDS.find(String(normalize(value))))


static func color(value: Variant) -> Color:
	return COLORS[index(value)]


static func on_light_text_color(value: Variant) -> Color:
	return ON_LIGHT_TEXT_COLORS[index(value)]


static func display_name(value: Variant) -> String:
	return DISPLAY_NAMES[index(value)]


static func glow(value: Variant, alpha := 0.52) -> Color:
	var result := color(value)
	result.a = clampf(alpha, 0.0, 1.0)
	return result
