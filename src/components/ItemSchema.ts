// Parsing the entire items_game.txt and csgo_english.txt is too much effort
// Especially since Valve moved to a non-standard ICU message syntax
// So instead we just hardcode all the default items
export const defaultItems: {
	id: number;
	name: string;
}[] = [
	{
		id: 1,
		name: "Desert Eagle",
	},
	{
		id: 2,
		name: "Dual Berettas",
	},
	{
		id: 3,
		name: "Five-SeveN",
	},
	{
		id: 4,
		name: "Glock",
	},
	// 5
	// 6
	{
		id: 7,
		name: "AK-47",
	},
	{
		id: 8,
		name: "AUG",
	},
	{
		id: 9,
		name: "AWP",
	},
	{
		id: 10,
		name: "FAMAS",
	},
	{
		id: 11,
		name: "G3SG1",
	},
	// 12
	{
		id: 13,
		name: "Galil AR",
	},
	{
		id: 14,
		name: "M249",
	},
	// 15
	{
		id: 16,
		name: "M4A4",
	},
	{
		id: 17,
		name: "MAC-10",
	},
	// 18
	{
		id: 19,
		name: "P90",
	},
	// 20
	// 21
	// 22
	{
		id: 23,
		name: "MP5-SD",
	},
	{
		id: 24,
		name: "UMP-45",
	},
	{
		id: 25,
		name: "XM1014",
	},
	{
		id: 26,
		name: "PP-Bizon",
	},
	{
		id: 27,
		name: "MAG-7",
	},
	{
		id: 28,
		name: "Negev",
	},
	{
		id: 29,
		name: "Sawed-Off",
	},
	{
		id: 30,
		name: "Tec-9",
	},
	{
		id: 31,
		name: "Zeus x27",
	},
	{
		id: 32,
		name: "P2000",
	},
	{
		id: 33,
		name: "MP7",
	},
	{
		id: 34,
		name: "MP9",
	},
	{
		id: 35,
		name: "Nova",
	},
	{
		id: 36,
		name: "P250",
	},
	// 37
	{
		id: 38,
		name: "SCAR-20",
	},
	{
		id: 39,
		name: "SG 553",
	},
	{
		id: 40,
		name: "SSG 08",
	},
	// 41: Golden Arms Race Knife
	// 42: CT Knife
	// 43: Flashbang
	// 44: HE Grenade
	// 45: Smoke Grenade
	// 46: Molotov
	// 47: Decoy
	// 48: Incendiary Grenade
	{
		id: 49,
		name: "C4",
	},
	// 50: Kevlar
	// 51: Kevlar & Helmet
	// 52: Heavy Assault Suit
	// 53
	// 54: Night Vision
	// 55: Defuse Kit
	// 56: Rescue Kit
	// 57: Healthshot
	// 58: Music Kit
	// 59: T Knife
	{
		id: 60,
		name: "M4A1-S",
	},
	{
		id: 61,
		name: "USP-S",
	},
	// 62: Trade Up
	{
		id: 63,
		name: "CZ75-Auto",
	},
	{
		id: 64,
		name: "R8 Revolver",
	},
	// 65: Remove Keychain Tool
];
