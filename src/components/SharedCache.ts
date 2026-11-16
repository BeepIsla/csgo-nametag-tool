import EventEmitter from "node:events";
import { CSOEconItem } from "../protobufs/csgo/base_gcmessages.js";
import {
	CMsgClientWelcome,
	CMsgSOCacheSubscribed,
	CMsgSOCacheSubscriptionCheck,
	CMsgSOCacheSubscriptionRefresh,
	CMsgSOCacheUnsubscribed,
	type CMsgSOIDOwner,
	CMsgSOMultipleObjects,
	CMsgSOSingleObject,
} from "../protobufs/csgo/gcsdk_gcmessages.js";
import { EGCBaseClientMsg, ESOMsg } from "../protobufs/csgo/gcsystemmsgs.js";
import { CMsgProtoBufHeader } from "../protobufs/csgo/steammessages.js";
import { gameCoordinator } from "./GameCoordinator.js";
import { Item } from "./Item.js";

const OWNER_SOID_USER_TYPE = 1;
const SOCACHE_TYPE_ITEM = 1;

enum EProcessItemType {
	Create = 0,
	Update,
	Delete,
}

// Very simple version, we only care about about items and only our own
class SharedCache extends EventEmitter<{
	// Emits before the inventory cache is updated
	itemCreate: [Item];

	// Emits before the inventory cache is updated
	itemUpdate: [Item];

	// Emits before the inventory cache is updated
	itemDelete: [Item];

	// Emits after the inventory cache is updated
	inventoryChanged: [];
}> {
	private _owner: bigint;
	private _version: bigint;
	private _items: Item[];

	constructor() {
		super();

		this._owner = 0n;
		this._version = 0n;
		this._items = [];

		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_Create,
			CMsgSOSingleObject,
			this._onCreate.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_Update,
			CMsgSOSingleObject,
			this._onUpdate.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_Destroy,
			CMsgSOSingleObject,
			this._onDestroy.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_CacheSubscribed,
			CMsgSOCacheSubscribed,
			this._onSubscribed.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_CacheUnsubscribed,
			CMsgSOCacheUnsubscribed,
			this._onUnsubscribed.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_UpdateMultiple,
			CMsgSOMultipleObjects,
			this._onUpdateMultiple.bind(this),
		);
		gameCoordinator.listen(
			ESOMsg.k_ESOMsg_CacheSubscriptionCheck,
			CMsgSOCacheSubscriptionCheck,
			this._onSubscriptionCheck.bind(this),
		);
		gameCoordinator.listen(
			EGCBaseClientMsg.k_EMsgGCClientWelcome,
			CMsgClientWelcome,
			this._onClientWelcome.bind(this),
		);
	}

	get items(): Item[] {
		return this._items;
	}

	setOwnerID(owner: bigint): void {
		if (this._owner !== owner) {
			this._items = [];
			this._version = 0n;
		}
		this._owner = owner;
	}

	private _onSubscribed(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOCacheSubscribed,
	): void {
		if (!this._checkOwner(msg.owner_soid)) {
			return;
		}

		this._items = [];

		let inventoryChanged = false;
		for (const obj of msg.objects) {
			if (obj.type_id !== SOCACHE_TYPE_ITEM) {
				continue;
			}

			for (const o of obj.object_data) {
				const item = CSOEconItem.decode(o);
				if (this._processItem(item, EProcessItemType.Create)) {
					inventoryChanged = true;
				}
			}
		}

		this._version = msg.version;

		if (inventoryChanged) {
			this.emit("inventoryChanged");
		}
	}

	private _onUnsubscribed(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOCacheUnsubscribed,
	): void {
		if (!this._checkOwner(msg.owner_soid)) {
			return;
		}

		this._items = [];
		this._version = 0n;
	}

	private _onCreate(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOSingleObject,
	): void {
		if (msg.type_id !== SOCACHE_TYPE_ITEM) {
			return;
		}

		const item = CSOEconItem.decode(msg.object_data);
		let inventoryChanged = false;
		if (this._processItem(item, EProcessItemType.Create)) {
			inventoryChanged = true;
		}
		this._version = msg.version;

		if (inventoryChanged) {
			this.emit("inventoryChanged");
		}
	}

	private _onUpdate(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOSingleObject,
	): void {
		if (msg.type_id !== SOCACHE_TYPE_ITEM) {
			return;
		}

		const item = CSOEconItem.decode(msg.object_data);
		let inventoryChanged = false;
		if (this._processItem(item, EProcessItemType.Update)) {
			inventoryChanged = true;
		}
		this._version = msg.version;

		if (inventoryChanged) {
			this.emit("inventoryChanged");
		}
	}

	private _onUpdateMultiple(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOMultipleObjects,
	): void {
		if (!this._checkOwner(msg.owner_soid)) {
			return;
		}

		let inventoryChanged = false;
		for (const obj of msg.objects_modified) {
			if (obj.type_id !== SOCACHE_TYPE_ITEM) {
				continue;
			}

			const item = CSOEconItem.decode(obj.object_data);
			if (this._processItem(item, EProcessItemType.Update)) {
				inventoryChanged = true;
			}
		}

		this._version = msg.version;

		if (inventoryChanged) {
			this.emit("inventoryChanged");
		}
	}

	private _onDestroy(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOSingleObject,
	): void {
		if (msg.type_id !== SOCACHE_TYPE_ITEM) {
			return;
		}

		const item = CSOEconItem.decode(msg.object_data);
		let inventoryChanged = false;
		if (this._processItem(item, EProcessItemType.Delete)) {
			inventoryChanged = true;
		}
		this._version = msg.version;

		if (inventoryChanged) {
			this.emit("inventoryChanged");
		}
	}

	private _onSubscriptionCheck(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgSOCacheSubscriptionCheck,
	): void {
		if (!this._checkOwner(msg.owner_soid)) {
			return;
		}

		if (this._version !== msg.version) {
			return;
		}

		gameCoordinator.send(
			ESOMsg.k_ESOMsg_CacheSubscriptionRefresh,
			CMsgSOCacheSubscriptionRefresh,
			{
				owner_soid: msg.owner_soid,
			},
		);
	}

	private _onClientWelcome(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		msg: CMsgClientWelcome,
	): void {
		for (const cache of msg.outofdate_subscribed_caches) {
			this._onSubscribed(
				ESOMsg.k_ESOMsg_CacheSubscribed,
				CMsgProtoBufHeader.create({}),
				cache,
			);
		}
	}

	/**
	 * Returns `true` if an inventory update happened, `false` if not
	 */
	private _processItem(rawItem: CSOEconItem, type: EProcessItemType): boolean {
		const idx = this._items.findIndex((i) => i.id === rawItem.id);
		if (idx >= 0) {
			const item = new Item(rawItem);
			if (type === EProcessItemType.Delete) {
				this.emit("itemDelete", item);
				this._items.splice(idx, 1);
				return true;
			} else {
				this.emit("itemUpdate", item);
				this._items[idx] = item;
				return true;
			}
		} else if (type !== EProcessItemType.Delete) {
			const item = new Item(rawItem);
			this.emit("itemCreate", item);
			this._items.push(item);
			return true;
		}

		return false;
	}

	private _checkOwner(soid?: CMsgSOIDOwner): boolean {
		if (soid?.type !== OWNER_SOID_USER_TYPE) {
			return false;
		}

		if (this._owner !== soid.id) {
			return false;
		}

		return true;
	}
}
export const sharedCache = new SharedCache();
