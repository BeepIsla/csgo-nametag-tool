import { CEconItemPreviewDataBlock } from "../protobufs/csgo/cstrike15_gcmessages.js";

export function ParseItemID(text: string): bigint {
	if (/^\d+$/.test(text)) {
		return BigInt(text);
	}

	const steamInventoryLinkMatch = text.match(/#730_\d+_(\d+)/i);
	if (steamInventoryLinkMatch?.[1]) {
		return BigInt(steamInventoryLinkMatch[1]);
	}

	const idx = text.indexOf("csgo_econ_action_preview");
	if (idx >= 0) {
		let hex = text.slice(idx + "csgo_econ_action_preview".length);
		if (hex.startsWith("%20")) {
			hex = hex.slice(3);
		}
		hex = hex.trim();

		if (/[0-9A-F]+/i.test(hex)) {
			// Last 4 bytes is a CRC
			const buf = Buffer.from(hex, "hex").subarray(0, -4);
			if (buf.byteLength > 1) {
				// biome-ignore lint/style/noNonNullAssertion: Length checked
				const xorKey = buf[0]!;
				for (let i = 1; i < buf.byteLength; i++) {
					// biome-ignore lint/style/noNonNullAssertion: Length checked
					buf[i]! ^= xorKey;
				}

				// Remember to skip the xor key
				const item = CEconItemPreviewDataBlock.decode(buf.subarray(1));
				if (item.itemid > 0n) {
					return item.itemid;
				}
			}
		}
	}

	return 0n;
}
