import type { CSOEconItem } from "../protobufs/csgo/base_gcmessages.js";
import { CAttribute_String } from "../protobufs/csgo/cstrike15_gcmessages.js";

type AttributeKeys = "string" | "uint32" | "float";
type AttributeValue<TKey extends AttributeKeys> = TKey extends "string"
	? string
	: TKey extends "uint32"
		? number
		: TKey extends "float"
			? number
			: never;

export class Item {
	private _id: bigint;
	private _defIndex: number;
	private _attributes: Map<number, Buffer>;

	constructor(item: CSOEconItem) {
		this._id = item.id;
		this._defIndex = item.def_index;
		this._attributes = new Map();

		for (const attrib of item.attribute) {
			this._attributes.set(attrib.def_index, attrib.value_bytes);
		}
	}

	get id(): bigint {
		return this._id;
	}

	get defIndex(): number {
		return this._defIndex;
	}

	get isNameTag(): boolean {
		return this._defIndex === 1200;
	}

	get isPet(): boolean {
		return this._defIndex === 4681;
	}

	get isStorageUnit(): boolean {
		return this._defIndex === 1201;
	}

	get canBeRenamed(): boolean {
		if (this.isStorageUnit) {
			return true;
		}

		if (this.isPet) {
			const upgradeLevel = this.getAttribute(268 /*upgrade level*/, "uint32");

			// 0 = Egg (Cannot be named)
			// 1 = Chick
			// 2 = Pullet
			// 3 = Hen
			switch (upgradeLevel) {
				case 1: {
					// Can rename if we don't have "111: custom name attr"
					return !this.hasAttribute(111);
				}
				case 2: {
					// Can rename if we don't have "328: custom name attr 2"
					return !this.hasAttribute(328);
				}
				case 3: {
					// Can rename if we don't have "329: custom name attr 3"
					return !this.hasAttribute(329);
				}
				default: {
					return false;
				}
			}
		}

		// Some items cannot be renamed, like a name tag or a case, I am not going to manually filter out everything
		return false;
	}

	get requiresNameTag(): boolean {
		if (this.isStorageUnit || this.isPet) {
			return false;
		}

		return true;
	}

	getCustomName(): string | null {
		// Priority order:
		// 329: custom name attr 3
		// 328: custom name attr 2
		// 111: custom name attr
		for (const attribID of [329, 328, 111]) {
			const value = this.getAttribute(attribID, "string");
			if (typeof value === "string") {
				return value;
			}
		}
		return null;
	}

	hasAttribute(attribID: number): boolean {
		return this._attributes.has(attribID);
	}

	getAttribute<
		TKey extends AttributeKeys,
		TDefault extends AttributeValue<TKey> | null,
	>(
		attribID: number,
		attribType: TKey,
		defaultValue: TDefault = null as TDefault,
	): TDefault extends null
		? AttributeValue<TKey> | null
		: AttributeValue<TKey> {
		const bytes = this._attributes.get(attribID);
		if (!bytes || bytes.byteLength <= 0) {
			return defaultValue as AttributeValue<TKey>;
		}

		switch (attribType) {
			case "string": {
				return CAttribute_String.decode(bytes).value as AttributeValue<TKey>;
			}
			case "uint32": {
				return bytes.readUInt32LE(0) as AttributeValue<TKey>;
			}
			case "float": {
				return bytes.readFloatLE(0) as AttributeValue<TKey>;
			}
		}
	}
}
