import assert from "node:assert";
import { GetGCVersion } from "../helpers/GetGCVersion.js";
import {
	CMsgClientHello,
	CMsgClientWelcome,
	CMsgConnectionStatus,
	GCConnectionStatus,
} from "../protobufs/csgo/gcsdk_gcmessages.js";
import { EGCBaseClientMsg } from "../protobufs/csgo/gcsystemmsgs.js";
import {
	CMsgProtoBufHeader,
	type DeepPartial,
	type Exact,
	type MessageFns,
} from "../protobufs/csgo/steammessages.js";
import { steam } from "./Steam.js";

export type GameCoordinatorListenCallback<TBody> = (
	msgType: number,
	header: CMsgProtoBufHeader,
	body: TBody,
) => void;

class GameCoordinator {
	private _callbacks: {
		msgType: number;
		callback: GameCoordinatorListenCallback<unknown>;
		protobuf: MessageFns<unknown>;
	}[];
	private _connectingToGCInterval: NodeJS.Timeout | null;

	constructor() {
		this._callbacks = [];
		this._connectingToGCInterval = null;

		steam.on("gcMessage", this._onGCMessage.bind(this));

		this.listen(
			EGCBaseClientMsg.k_EMsgGCClientConnectionStatus,
			CMsgConnectionStatus,
			this._onGCConnectionStatus.bind(this),
		);
		this.listen(
			EGCBaseClientMsg.k_EMsgGCClientWelcome,
			CMsgClientWelcome,
			this._onGCWelcome.bind(this),
		);

		this._setConnectedToGC(false);
	}

	get isConnectedToGC(): boolean {
		return this._connectingToGCInterval === null;
	}

	close(): void {
		if (this._connectingToGCInterval) {
			clearInterval(this._connectingToGCInterval);
		}
	}

	listen<TBody extends object>(
		msgType: number,
		protobuf: MessageFns<TBody>,
		callback: GameCoordinatorListenCallback<TBody>,
	): void {
		this._callbacks.push({
			msgType: msgType,
			callback: callback as GameCoordinatorListenCallback<unknown>,
			protobuf: protobuf,
		});
	}

	send<
		TBody extends object,
		TBodyPartial extends Exact<DeepPartial<TBody>, TBodyPartial>,
	>(
		msgType: number,
		protobuf: MessageFns<TBody>,
		header: CMsgProtoBufHeader,
		body: TBodyPartial,
	): void;
	send<
		TBody extends object,
		TBodyPartial extends Exact<DeepPartial<TBody>, TBodyPartial>,
	>(msgType: number, protobuf: MessageFns<TBody>, body: TBodyPartial): void;
	send<
		TBody extends object,
		TBodyPartial extends Exact<DeepPartial<TBody>, TBodyPartial>,
	>(
		msgType: number,
		protobuf: MessageFns<TBody>,
		bodyOrHeader: TBodyPartial | CMsgProtoBufHeader,
		body?: TBodyPartial,
	): void {
		let header = CMsgProtoBufHeader.create({});
		if ("client_steam_id" in bodyOrHeader) {
			header = bodyOrHeader;
		} else {
			body = bodyOrHeader;
		}
		assert(body);

		const bodyBuf = protobuf.encode(protobuf.fromPartial(body));
		steam.send(730, msgType, header, bodyBuf);
	}

	private _setConnectedToGC(isConnected: boolean): void {
		if (this._connectingToGCInterval && isConnected) {
			// Now connected
			clearInterval(this._connectingToGCInterval);
			this._connectingToGCInterval = null;
		} else if (!this._connectingToGCInterval && !isConnected) {
			// Now not connected
			this._connectingToGCInterval = setInterval(
				this._onGCConnectInterval.bind(this),
				2500,
			);
			this._onGCConnectInterval().catch(() => null);
		}
	}

	private async _onGCConnectInterval(): Promise<void> {
		const version = await GetGCVersion();
		this.send(EGCBaseClientMsg.k_EMsgGCClientHello, CMsgClientHello, {
			version: version,
		});
	}

	private _onGCMessage(
		appID: number,
		msgType: number,
		header: CMsgProtoBufHeader,
		body: Buffer,
	): void {
		if (appID !== 730) {
			return;
		}

		for (const cb of this._callbacks) {
			if (cb.msgType !== msgType) {
				continue;
			}

			const msg = cb.protobuf.decode(body);
			cb.callback(msgType, header, msg);
		}
	}

	private _onGCConnectionStatus(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		body: CMsgConnectionStatus,
	): void {
		if (body.status !== GCConnectionStatus.GCConnectionStatus_HAVE_SESSION) {
			this._setConnectedToGC(false);
		}
	}

	private _onGCWelcome(
		_msgType: number,
		_header: CMsgProtoBufHeader,
		_body: CMsgClientWelcome,
	): void {
		this._setConnectedToGC(true);
	}
}

export const gameCoordinator = new GameCoordinator();
