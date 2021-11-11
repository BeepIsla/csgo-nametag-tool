import got from "got";
import * as VDF from "vdf-parser";

let itemsGame = VDF.parse(await got({
	url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game.txt",
	resolveBodyOnly: true
})).items_game;
let english = {
	_raw_tokens_: VDF.parse(await got({
		url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/resource/csgo_english.txt",
		resolveBodyOnly: true
	})).lang.Tokens,
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

	isItemStorageUnit(id) {
		let item = this.getItem(id);
		if (!item) {
			return false;
		}

		return item.def_index === 1201;
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
