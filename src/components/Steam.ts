import { EventEmitter } from "node:events";
import { type DynamicLibraryResult, dlopen, toArrayBuffer } from "node:ffi";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";
import { getAsset, isSea } from "node:sea";
import { BinaryWriter } from "@bufbuild/protobuf/wire";
import { CMsgProtoBufHeader } from "../protobufs/csgo/steammessages.js";
import { EMsg } from "../protobufs/steam/enums_clientserver.js";
import { CMsgGCClient } from "../protobufs/steam/steammessages_clientserver_2.js";

const PROTO_MASK = 0x80000000;

function getSharedLibExt(): string {
	switch (platform) {
		case "win32": {
			return "dll";
		}
		case "darwin": {
			return "dylib";
		}
		default: {
			return "so";
		}
	}
}

class Steam extends EventEmitter<{
	gcMessage: [number, number, CMsgProtoBufHeader, Buffer];
}> {
	private _lib: DynamicLibraryResult<{
		readonly Init: {
			readonly arguments: readonly ["string"];
			readonly return: "bool";
		};
		readonly Close: {
			readonly arguments: readonly [];
			readonly return: "void";
		};
		readonly GCSendMessage: {
			readonly arguments: readonly ["uint32", "uint32", "pointer", "uint32"];
			readonly return: "void";
		};
		readonly RetrieveMessage: {
			readonly arguments: readonly ["function"];
			readonly return: "void";
		};
		readonly GetSteamID: {
			readonly arguments: readonly [];
			readonly return: "uint64";
		};
	}>;
	private _receiveCallback: bigint;
	private _interval: NodeJS.Timeout;

	constructor(steamInstallPath?: string) {
		super();

		let path: string;
		const filename = `csgo-nametag-tool-extension.${getSharedLibExt()}`;
		if (isSea()) {
			const bin = getAsset(filename);
			path = join(tmpdir(), filename);
			writeFileSync(path, Buffer.from(bin));
		} else {
			// The compiler combines all files into a single .js file, so only go up the "dist" directory
			const basePath = join(import.meta.dirname, "..", "extension", "build");
			path = join(basePath, "release", filename);
			if (!existsSync(path)) {
				path = join(basePath, "debug", filename);
			}
		}

		this._lib = dlopen(path, {
			Init: {
				arguments: ["string"],
				return: "bool",
			},
			Close: {
				arguments: [],
				return: "void",
			},
			GCSendMessage: {
				arguments: ["uint32", "uint32", "pointer", "uint32"],
				return: "void",
			},
			RetrieveMessage: {
				arguments: ["function"],
				return: "void",
			},
			GetSteamID: {
				arguments: [],
				return: "uint64",
			},
		});
		if (!this._lib.functions.Init(steamInstallPath ?? null)) {
			this._lib.lib.close();
			throw new Error("Failed to initialise library");
		}

		this._receiveCallback = this._lib.lib.registerCallback(
			{
				arguments: ["pointer", "uint32"],
				return: "void",
			},
			this._onCallback.bind(this),
		);
		this._interval = setInterval(this._onInterval.bind(this), 25);
	}

	close(): void {
		clearInterval(this._interval);
		this._lib.functions.Close();
		this._lib.lib.unregisterCallback(this._receiveCallback);
		this._lib.lib.close();
	}

	getSteamID(): bigint {
		return this._lib.functions.GetSteamID();
	}

	send(
		appID: number,
		msgType: number,
		header: CMsgProtoBufHeader,
		bodyBytes: Uint8Array | BinaryWriter,
	): void {
		msgType = (msgType | PROTO_MASK) >>> 0;
		const headerBytes = CMsgProtoBufHeader.encode(header).finish();
		if (bodyBytes instanceof BinaryWriter) {
			bodyBytes = bodyBytes.finish();
		}

		const data = Buffer.alloc(4 + 4);
		data.writeUInt32LE(msgType, 0);
		data.writeUInt32LE(headerBytes.byteLength, 4);

		const send = Buffer.concat([data, headerBytes, bodyBytes]);
		this._lib.functions.GCSendMessage(appID, msgType, send, send.byteLength);
	}

	private _onInterval(): void {
		this._lib.functions.RetrieveMessage(this._receiveCallback);
	}

	private _onCallback(
		data:
			| string
			| bigint
			| ArrayBuffer
			| NodeJS.ArrayBufferView<ArrayBufferLike>
			| null,
		size: number,
	): void {
		if (!data) {
			// Ignore null pointer
			return;
		} else if (typeof data === "bigint") {
			data = toArrayBuffer(data, size);
		} else if (typeof data === "string") {
			data = Buffer.from(data, "utf8");
		} else if (ArrayBuffer.isView(data)) {
			data = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
		} else {
			data = Buffer.from(data);
		}
		data = new Uint8Array(data);

		// This the raw network message, we first have to parse it
		const buf = Buffer.from(data);
		const msgType = buf.readUInt32LE(0);
		if ((msgType & PROTO_MASK) >>> 0 !== PROTO_MASK) {
			// We only care about protobufs
			return;
		}

		// We don't care about the Steam header
		const headerLength = buf.readUInt32LE(4);
		const body = buf.subarray(8 + headerLength);

		switch ((msgType & ~PROTO_MASK) >>> 0) {
			case EMsg.k_EMsgClientFromGC: {
				const msg = CMsgGCClient.decode(body);
				if ((msg.msgtype & PROTO_MASK) >>> 0 !== PROTO_MASK) {
					// We only care about protobufs
					break;
				}

				// First 4 bytes is just msgtype repeated
				const gcHeaderLength = msg.payload.readUInt32LE(4);
				const gcHeader = msg.payload.subarray(8, 8 + gcHeaderLength);
				const gcBody = msg.payload.subarray(8 + gcHeaderLength);

				this.emit(
					"gcMessage",
					msg.appid,
					(msg.msgtype & ~PROTO_MASK) >>> 0,
					CMsgProtoBufHeader.decode(gcHeader),
					gcBody,
				);
				break;
			}
			default: {
				break;
			}
		}
	}
}

export const steam = new Steam();
