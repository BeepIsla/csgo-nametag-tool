import * as path from "path";
import SteamUser from "steam-user";
import inquirer from "inquirer";
import ProtobufJS from "protobufjs";
import * as fs from "fs";
import { Items, defaultItems, english } from "./helpers/Items.js";

const steam = new SteamUser();
const protobufs = new ProtobufJS.Root().loadSync([
	path.join(process.cwd(), "protobufs", "csgo", "base_gcmessages.proto"),
	path.join(process.cwd(), "protobufs", "csgo", "gcsystemmsgs.proto"),
	path.join(process.cwd(), "protobufs", "csgo", "gcsdk_gcmessages.proto"),
	path.join(process.cwd(), "protobufs", "csgo", "econ_gcmessages.proto")
], {
	keepCase: true
});
const items = new Items();
const INVENTORY_LINK_REGEX = /730_2_(?<itemID>\d+)/i;
let loginPersonaCheck = false;
let gcConnectInterval = null;
let gcFirstConnect = true;
let gcListeners = {
	/**
	 * @callback GCListenerCallback
	 * @param {Object} data
	 */

	/**
	 * @param {String} msgPath
	 * @param {String} type
	 * @param {GCListenerCallback} callback
	 * @param {Boolean} once
	 */
	add: function (msgPath, type, callback, once = false) {
		let parts = msgPath.split(".");
		let msgType = protobufs.lookupEnum(parts[0]).values[parts[1]];
		if (!msgType) {
			throw new Error(`Could not find message type for "${parts[0]}.${parts[1]}"`);
		}

		let decoder = protobufs.lookupType(type);
		if (!gcListeners[msgType]) {
			gcListeners[msgType] = [];
		}

		gcListeners[msgType].push({
			decoderName: type,
			decoder: decoder,
			callback: callback,
			once: once
		});
	}
};

let { username, password } = await inquirer.prompt([
	{
		type: "input",
		name: "username",
		message: "Enter your Steam account username",
		when: process.argv.length <= 2
	},
	{
		type: "password",
		name: "password",
		message: "Enter your Steam account password",
		when: process.argv.length <= 3
	}
]);
if (!username && process.argv.length > 2) {
	username = process.argv[2];
} else if (!username) {
	throw new Error("You did not enter a valid username");
}

if (!password && process.argv.length > 3) {
	password = process.argv[3];
} else if (!password) {
	throw new Error("You did not enter a valid password");
}

console.log("Logging into Steam...");
steam.logOn({
	accountName: username,
	password: password
});

steam.on("loggedOn", async () => {
	console.log(`Logged into Steam as ${steam.steamID.getSteamID64()}`);
	console.log("Waiting for user information...");
	loginPersonaCheck = false;
	steam.setPersona(SteamUser.EPersonaState.Online);
});

steam.on("user", (sid, user) => {
	if (sid.accountid !== steam.steamID.accountid) {
		return;
	}

	if (loginPersonaCheck) {
		return;
	}
	loginPersonaCheck = true;

	if (user.gameid !== "0") {
		// Someone else is already playing
		console.log("Someone is already playing on this account. You must close all games and stop all idlers.");
		steam.logOff();
		return;
	}

	console.log("Connecting to CSGO backend...");

	steam.gamesPlayed([730]);
	clearInterval(gcConnectInterval);
	gcConnectInterval = setInterval(() => {
		sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {});
	}, 1000).unref();
});

steam.on("playingState", (blocked, playingApp) => {
	if (blocked) {
		console.log("Someone started playing on this account. Logging off...");
		steam.logOff();
	}
});

steam.on("steamGuard", async (domain, callback, lastCodeWrong) => {
	let { code } = await inquirer.prompt([
		{
			type: "input",
			name: "code",
			message: `Steam Guard required${lastCodeWrong ? " (Last code wrong)" : ""}`
		}
	]);

	console.log("Logging into Steam...");
	callback(code);
});

steam.on("receivedFromGC", (appID, msgType, payload) => {
	if (appID !== 730 || !gcListeners[msgType]) {
		return;
	}

	let cache = {};
	for (let i = gcListeners[msgType].length - 1; i >= 0; i--) {
		let listener = gcListeners[msgType][i];
		let obj = cache[listener.decoderName] ?? listener.decoder.toObject(listener.decoder.decode(payload));
		cache[listener.decoderName] = obj;

		if (listener.once) {
			gcListeners[msgType].splice(i, 1);
		}
		listener.callback(obj);
	}
});

steam.on("error", (err) => {
	console.log("An unrecoverable error has occured: ", err.toString());
	steam.logOff();
	process.exit(1);
});

steam.on("disconnected", (eResult, msg) => {
	console.log(`Disconnected from Steam with code: ${eResult}${msg && msg.length > 0 ? ` / ${msg}` : ""}`);
	process.exit(1);
});

/**
 * @param {String} type
 * @param {Buffer} data
 * @returns {Object}
 */
function decodeProtobuf(type, data) {
	let decoder = protobufs.lookupType(type);
	return decoder.toObject(decoder.decode(data));
}

/**
 * @param {String} msgPath
 * @param {?String} type
 * @param {?Object} header
 * @param {Object | Buffer} data
 * @param {Function} callback
 */
function sendGCMessage(msgPath, type, header, data, callback = undefined) {
	let parts = msgPath.split(".");
	let msgType = protobufs.lookupEnum(parts[0]).values[parts[1]];
	if (!msgType) {
		throw new Error(`Could not find message type for "${parts[0]}.${parts[1]}"`);
	}

	let encoder = typeof type === "string" ? protobufs.lookupType(type) : undefined;
	steam.sendToGC(730, msgType, header, encoder ? encoder.encode(data).finish() : data, callback);
}

gcListeners.add("EGCBaseClientMsg.k_EMsgGCClientWelcome", "CMsgClientWelcome", async (data) => {
	if (!gcConnectInterval) {
		return;
	}
	clearInterval(gcConnectInterval);
	gcConnectInterval = null;

	if (gcFirstConnect) {
		console.log(`Connected to CSGO backend, server time: ${new Date(data.rtime32_gc_welcome_timestamp * 1000).toLocaleString()}`);
		gcFirstConnect = false;
	}

	items._items = data.outofdate_subscribed_caches.map((cache) => {
		cache.objects = cache.objects.filter((object) => {
			return object.type_id === 1;
		}).map((object) => {
			return object.object_data.map((data) => {
				return decodeProtobuf("CSOEconItem", data);
			});
		});
		return cache;
	}).reduce((prev, cur) => {
		for (let object of cur.objects) {
			prev.push(...object);
		}
		return prev;
	}, []);
	console.log(`We have ${items._items.length} item${items._items.length === 1 ? "" : "s"}`);
	if (items._items.length <= 0) {
		console.log("You do not have any items, buy a name tag first");
		steam.logOff();
		return;
	}

	let nameTags = items._items.filter(i => i.def_index === 1200);
	let storageUnits = items._items.filter(i => i.def_index === 1201);
	console.log(`We have ${nameTags.length} name tag${nameTags.length === 1 ? "" : "s"}`);
	console.log(`We have ${storageUnits.length} storage unit${storageUnits.length === 1 ? "" : "s"}`);
	if (nameTags.length <= 0 && storageUnits.length <= 0) {
		console.log("You have no name tags or storage units, buy some first");
		steam.logOff();
		return;
	}

	getUserRenameInput(nameTags.length > 0);
});

async function getUserRenameInput(haveNameTags) {
	let itemSelection = await inquirer.prompt([
		{
			type: "list",
			name: "type",
			message: "Do you want to rename a default item or a normal item?",
			choices: [
				{
					name: "Default Item",
					value: "default",
					disabled: !haveNameTags
				},
				{
					name: "Normal Item",
					value: "normal"
				},
				{
					name: "Log out and exit program",
					value: "quit"
				}
			]
		},
		{
			type: "input",
			name: "itemLink",
			message: "Enter the item link from your Steam inventory of the item you want to rename",
			when: (answers) => {
				return answers.type === "normal";
			},
			transformer: (input, answers, flags) => {
				if (flags.isFinal) {
					if (typeof input === "string") {
						let match = input.match(INVENTORY_LINK_REGEX);
						if (match) {
							return BigInt(match.groups.itemID);
						}
					}

					return "";
				}

				return input;
			},
			validate: (input, answers) => {
				if (typeof input === "string") {
					let match = input.match(INVENTORY_LINK_REGEX);
					if (match) {
						return true;
					}
				}

				return "You must copy paste the full Steam inventory item link";
			}
		},
		{
			type: "list",
			name: "defIndex",
			message: "Select the default weapon you want to rename",
			choices: defaultItems.map((item) => {
				return {
					name: english.get(item.item_name),
					value: item._definition_index_
				};
			}).sort((a, b) => {
				if (a.name < b.name) {
					return -1;
				}

				if (a.name > b.name) {
					return 1;
				}

				return 0;
			}),
			when: (answers) => {
				return answers.type === "default";
			}
		}
	]);
	if (itemSelection.type === "quit") {
		steam.logOff();
		return;
	}

	if (itemSelection.defIndex) {
		if (!haveNameTags) {
			console.log("You have no name tags, you can only rename storage units");

			// We do it the lazy way and just request our inventory again
			gcConnectInterval = setInterval(async () => {
				const text = await fetch("https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/steam.inf").then(r => r.text());
				const lines = text.split("\n").map(l => l.replace(/\r/g, "").trim());
				const idx = lines.findIndex(l => l.startsWith("ClientVersion="));
				let version = undefined;
				if (idx >= 0) {
					const versionStr = lines[idx].split("=").pop();
					version = parseInt(versionStr);
					if (isNaN(version)) {
						console.log(`Warning: Failed to parse required client version from steam.inf`);
						version = undefined;
					}
				}
				sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {
					version: version
				});
			}, 1000).unref();
			return;
		}

		// We are renaming a default item with a name tag
		console.log("WARNING: Continuing will result in one of your name tags being used up!");
		console.log("WARNING: If you do not wish to do this stop NOW by pressing CTRL + C or closing the window!");
		console.log("WARNING: The developer(s) of this tool are NOT responsible for any lost name tags, items, or money!");
		console.log("WARNING: CSGO's backend might restrict you from entering certain things or go above certain limits this tool cannot account for!");
		console.log("WARNING: Always test on a Storage Unit first, they have infinite free name changes!");
		doItemRename(parseInt(itemSelection.defIndex));
	} else if (itemSelection.itemLink) {
		// We are renaming an item with a name tag or renaming a storage unit
		let match = itemSelection.itemLink.match(INVENTORY_LINK_REGEX);
		let itemID = BigInt(match.groups.itemID);

		// If we have no name tags then this must be a storage unit
		if (!haveNameTags && !items.isItemStorageUnit(itemID)) {
			console.log("You have no name tags, you can only rename storage units");

			// We do it the lazy way and just request our inventory again
			gcConnectInterval = setInterval(() => {
				sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {});
			}, 1000).unref();
			return;
		}

		// This is either a storage unit or we have a name tag
		if (!items.isItemStorageUnit(itemID)) {
			console.log("WARNING: Continuing will result in one of your name tags being used up!");
			console.log("WARNING: If you do not wish to do this stop NOW by pressing CTRL + C or closing the window!");
			console.log("WARNING: The developer(s) of this tool are NOT responsible for any lost name tags, items, or money!");
			console.log("WARNING: CSGO's backend might restrict you from entering certain things or go above certain limits this tool cannot account for!");
			console.log("WARNING: Always test on a Storage Unit first, they have infinite free name changes!");
		}
		doItemRename(itemID);
	}
}

/* Renaming (First example taken by renaming a Storage Unit, second example filled in manually but not tested)

The way renaming works for a item, using a non-protobuf message of ID 1006 (k_EMsgGCNameItem - MsgGCNameItem_t)
Variable name     (Type)   - Example value        [Note]
m_nHdrVersion     (uint16) - 1                    [Always 1]
m_JobIDSource     (uint64) - 18446744073709551615 [Always k_GIDNil]
m_JobIDTarget     (uint64) - 18446744073709551615 [Always k_GIDNil]
// The above is part of the header, auto-filled for us by steam-user
m_unToolItemID    (uint64) - 0                    [The tool item ID used to rename this item with, 0 for Storage Units]
m_unSubjectItemID (uint64) - 17242456691          [The item we are changing]
m_bDescription    (bool)   - 0                    [If the tool is a description tag or not, does not exist in CSGO at the current moment]
*Extra data*      (string) - The actual name we are giving this item, null terminated

The way renaming works for a default item, using a non-protobuf message of ID 1019 (k_EMsgGCNameBaseItem - MsgGCNameBaseItem_t)
Variable name            (Type)   - Example value        [Note]
m_nHdrVersion            (uint16) - 1                    [Always 1]
m_JobIDSource            (uint64) - 18446744073709551615 [Always k_GIDNil]
m_JobIDTarget            (uint64) - 18446744073709551615 [Always k_GIDNil]
// The above is part of the header, auto-filled for us by steam-user
m_unToolItemID           (uint64) - 17242421651          [The tool item ID used to rename this item with, 0 for Storage Units]
m_unBaseItemDefinitionID (uint32) - 7                    [The item we are changing]
m_bDescription           (bool)   - 0                    [If the tool is a description tag or not, does not exist in CSGO at the current moment]
*Extra data*             (string) - The actual name we are giving this item, null terminated
*/

/**
 * @param {BigInt | Number} targetItemID
 */
async function doItemRename(targetItemID) {
	let input = await inquirer.prompt([
		{
			type: "list",
			name: "method",
			message: "Select input method",
			choices: [
				"Text",
				"File"
			]
		}
	]);
	switch (input.method) {
		case "Text": {
			let result = await inquirer.prompt([
				{
					type: "input",
					name: "name",
					message: "Enter the new name of this item",
					validate: (input, answers) => {
						if (typeof input === "string" && input.length > 0) {
							return true;
						}
		
						return "You must enter a valid name";
					}
				}
			]);
			console.log(`Attempting to rename item to: ${result.name}`);
			sendItemRename(items.isItemStorageUnit(targetItemID) ? 0n : items.getNameTagID(), targetItemID, result.name);
			break;
		}
		case "File": {
			fs.writeFileSync("new_name.txt", "");
			await inquirer.prompt([
				{
					type: "input",
					name: "confirm",
					message: "Please edit the file called 'new_name.txt', when done save it and press enter",
					transformer: () => ""
				}
			]);

			if (!fs.existsSync("new_name.txt")) {
				console.log(`Missing new_name.txt, did you delete it?`);

				gcConnectInterval = setInterval(() => {
					sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {});
				}, 1000).unref();
				break;
			}

			let name = fs.readFileSync("new_name.txt");
			fs.unlinkSync("new_name.txt");
			console.log(`Attempting to rename item to: ${name}`);

			// Replace new lines with this special thing and Windows weirdness with nothing
			name = replaceBuffer(name, Buffer.from("0A", "hex"), Buffer.from("E280A9", "hex"));
			name = replaceBuffer(name, Buffer.from("0D", "hex"), Buffer.alloc(0));
			sendItemRename(items.isItemStorageUnit(targetItemID) ? 0n : items.getNameTagID(), targetItemID, name);
			break;
		}
		default: {
			console.log(`Invalid selection: ${result}`);

			gcConnectInterval = setInterval(() => {
				sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {});
			}, 1000).unref();
			break;
		}
	}
}

/**
 * @param {BigInt} nameTagID
 * @param {BigInt | Number} targetItemID If `BigInt` its a normal item, if `Number` its a default item
 * @param {String | Buffer} newName
 */
function sendItemRename(nameTagID, targetItemID, newName) {
	if (!Buffer.isBuffer(newName)) {
		newName = Buffer.from(newName, "utf8");
	}

	// This depends on the UTF8 characters not on the amount of bytes!
	let utf8Name = newName.toString("utf8");
	if (utf8Name.length > 21) {
		console.log(`WARNING: Your name might be too long! ${utf8Name.length}/21`);
	}

	let offset = 0;
	let buf = Buffer.alloc(8 + (typeof targetItemID === "number" ? 4 : 8) + 1 + (newName.length + 1));
	buf.writeBigUInt64LE(nameTagID, offset); offset += 8; // m_unToolItemID

	if (typeof targetItemID === "number") {
		buf.writeUInt32LE(targetItemID, offset); offset += 4; // m_unBaseItemDefinitionID
	} else {
		buf.writeBigUInt64LE(targetItemID, offset); offset += 8; // m_unSubjectItemID
	}

	buf.writeUInt8(0, offset); offset += 1; // m_bDescription

	for (let i = 0; i < newName.length; i++) {
		buf.writeUInt8(newName[i], offset); offset += 1;
	}
	buf.writeUInt8(0, offset); offset += 1;

	sendGCMessage(`EGCItemMsg.${typeof targetItemID === "number" ? "k_EMsgGCNameBaseItem" : "k_EMsgGCNameItem"}`, null, null, buf);

	// We do it the lazy way and just request our inventory again
	gcConnectInterval = setInterval(() => {
		sendGCMessage("EGCBaseClientMsg.k_EMsgGCClientHello", "CMsgClientHello", {}, {});
	}, 1000).unref();
}

/**
 * @param {Buffer} buf
 * @param {Buffer} search
 * @param {Buffer} replace
 * @returns {Buffer}
 */
function replaceBuffer(buf, search, replace) {
	let i = 0;
	while (true) {
		i = buf.indexOf(search, i);
		if (i >= 0) {
			let start = buf.subarray(0, i);
			let end = buf.subarray(i + search.length);
			buf = Buffer.concat([start, replace, end]);
			i += replace.length;
		} else {
			break;
		}
	}
	return buf;
}

process.once("SIGINT", () => {
	steam.logOff();
});
