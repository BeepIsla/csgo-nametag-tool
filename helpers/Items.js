import * as VDF from "vdf-parser";

let itemsGame = VDF.parse(await fetch("https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/e63fc7fdb8dfb4f1873f0db214c0cc16613d5beb/csgo/scripts/items/items_game.txt").then(r => r.text())).items_game;
let english = {
	_raw_tokens_: VDF.parse(await fetch("https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/e63fc7fdb8dfb4f1873f0db214c0cc16613d5beb/csgo/resource/csgo_english.txt").then(r => r.text())).lang.Tokens,
	get: function (key) {
		let internalKey = key;
		if (internalKey.startsWith("#")) {
			internalKey = internalKey.slice(1);
		}

		return this[internalKey.toLowerCase()] ?? key;
	}
};
for (let key in english._raw_tokens_) {	
	english[key.toLowerCase()] = english._raw_tokens_[key];
}

let defaultItems = itemsGame.items.reduce((prev, cur) => {
	for (let key in cur) {
		let item = cur[key];
		if (item.baseitem === 1) {
			// Agents and gloves count as base items as well, so we must expand the current item with all its prefabs
			let prefabsToGet = item.prefab.split(" ");
			while (prefabsToGet.length > 0) {
				delete item.prefab;

				for (let prefabs of itemsGame.prefabs) {
					if (prefabs[prefabsToGet[0]]) {
						prefabsToGet[0] = prefabs[prefabsToGet[0]];
					}
				}

				if (typeof prefabsToGet[0] === "string") {
					throw new Error(`Could not find prefab "${prefabsToGet[0]}"`);
				}

				item = {
					...item,
					...prefabsToGet[0]
				};
				prefabsToGet.shift();
				if (item.prefab) {
					prefabsToGet.push(...item.prefab.split(" "));
				}
			}

			if (item.capabilities && item.capabilities.nameable && item.craft_class === "weapon") {
				// Keep the definition index around
				item._definition_index_ = key;
				prev.push(item);
			}
		}
	}
	return prev;
}, []);

export { defaultItems };
export { english };
export class Items {
	static CAttribute_String = null;

	constructor(items) {
		this._items = items;
	}

	getItem(id) {
		if (!this._items) {
			return undefined;
		}

		return this._items.find((item) => {
			return item.id.toString() === id.toString();
		});
	}

	isNameTag(id) {
		let item = this.getItem(id);
		if (!item) {
			return false;
		}

		return item.def_index === 1200;
	}

	isItemStorageUnit(id) {
		let item = this.getItem(id);
		if (!item) {
			return false;
		}

		return item.def_index === 1201;
	}

	isPet(id) {
		let item = this.getItem(id);
		if (!item) {
			return false;
		}

		return item.def_index === 4681;
	}

	canNameForFree(id) {
		return this.isItemStorageUnit(id) || this.isPet(id);
	}

	getCustomName(id) {
		const item = this.getItem(id);
		if (!item) {
			return null;
		}

		// Priority order:
		// 329: custom name attr 3
		// 328: custom name attr 2
		// 111: custom name attr
		for (const attributeID of [329, 328, 111]) {
			const attrib = item.attribute?.find(a => a.def_index == attributeID);
			if (attrib) {
				return Items.CAttribute_String.toObject(Items.CAttribute_String.decode(attrib.value_bytes)).value;
			}
		}

		return null;
	}

	getNameTagID() {
		if (!this._items) {
			return undefined;
		}

		return BigInt(this._items.find((item) => {
			return item.def_index === 1200;
		})?.id.toString());
	}
}
