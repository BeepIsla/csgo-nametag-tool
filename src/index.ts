import assert from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { confirm, editor, input, search, select } from "@inquirer/prompts";
import { gameCoordinator } from "./components/GameCoordinator.js";
import { defaultItems } from "./components/ItemSchema.js";
import { sharedCache } from "./components/SharedCache.js";
import { steam } from "./components/Steam.js";
import { arrayCount } from "./helpers/ArrayCount.js";
import {
	gracefulInquirerPrompt,
	setGracefulInquirerPromptExitHandler,
} from "./helpers/GracefulInquirerPrompt.js";
import { ParseItemID } from "./helpers/ParseItemID.js";
import { unescapeUnicode } from "./helpers/UnescapeUnicode.js";
import { CMsgModifyItemStringAttr } from "./protobufs/csgo/base_gcmessages.js";
import { EGCItemMsg } from "./protobufs/csgo/econ_gcmessages.js";

sharedCache.setOwnerID(steam.getSteamID());

while (!gameCoordinator.isConnectedToGC) {
	console.log(
		"Waiting for GameCoordinator to send our player data... Please make sure Counter-Strike 2 is running.",
	);
	await new Promise((p) => setTimeout(p, 2500));
}

let inventoryUpdateAbortController = new AbortController();
sharedCache.on("inventoryChanged", () => {
	inventoryUpdateAbortController.abort("InventoryChanged");
});

let sigintAbortController = new AbortController();
process.on("SIGINT", () => {
	// This event doesn't fire while we are in a prompt
	sigintAbortController.abort("SIGINT");
});

setGracefulInquirerPromptExitHandler(() => {
	sigintAbortController.abort("SIGINT");
});

// This entire thing needs an overhaul but I don't care enough
while (!sigintAbortController.signal.aborted) {
	if (inventoryUpdateAbortController.signal.aborted) {
		console.log("Inventory updated");
	}

	console.log("");
	console.log("Press CTRL+C to abort the current prompt");

	inventoryUpdateAbortController = new AbortController();
	sigintAbortController = new AbortController();

	const nameTagCount = arrayCount(sharedCache.items, (i) => i.isNameTag);
	const freeToRenameCount = arrayCount(
		sharedCache.items,
		(i) => i.canBeRenamed && !i.requiresNameTag,
	);
	const petsCount = arrayCount(sharedCache.items, (i) => i.isPet);
	const storageUnitCount = arrayCount(
		sharedCache.items,
		(i) => i.isStorageUnit,
	);
	console.log(`We have ${nameTagCount} name tags`);
	console.log(
		`We have ${freeToRenameCount} items that can be renamed for free`,
	);
	console.log(`- Pets: ${petsCount}`);
	console.log(`- Storage Units: ${storageUnitCount}`);
	console.log("");

	const choice = await gracefulInquirerPrompt(
		select(
			{
				message: "What would you like to do?",
				choices: [
					{
						name: "List Storage Units",
						value: "list_storage_units",
						disabled: storageUnitCount <= 0,
					},
					{
						name: "List Pets",
						value: "list_pets",
						disabled: petsCount <= 0,
					},
					{
						name: "Rename Item/Pet/Storage Unit",
						value: "rename_item",
						disabled: nameTagCount <= 0 && freeToRenameCount <= 0,
					},
					{
						name: "Name Default Item",
						value: "name_default_item",
						disabled: nameTagCount <= 0,
					},
					{
						name: "Exit",
						value: "exit",
					},
				],
			},
			{
				signal: inventoryUpdateAbortController.signal,
			},
		),
	);
	switch (choice) {
		case "list_storage_units": {
			for (const item of sharedCache.items) {
				if (!item.isStorageUnit) {
					continue;
				}

				console.log(
					`- ${item.id}: ${item.getCustomName() || "Unnamed Storage Unit"}`,
				);
			}
			break;
		}
		case "list_pets": {
			for (const item of sharedCache.items) {
				if (!item.isPet) {
					continue;
				}

				const name = item.getCustomName() || "Unnamed Pet";
				console.log(
					`- ${item.id}: ${name} (${item.canBeRenamed ? "Rename available" : "Cannot be renamed"})`,
				);
			}
			break;
		}
		case "rename_item": {
			const choice = await gracefulInquirerPrompt(
				input(
					{
						message: "Enter the ItemID, Inspect Link, or Steam Inventory Link",
					},
					{
						signal: inventoryUpdateAbortController.signal,
					},
				),
			);
			if (choice === null) {
				// We are in a nested prompt, CTRL+C just goes back to the start
				if (sigintAbortController.signal.aborted) {
					console.log("Current prompt aborted");
					sigintAbortController = new AbortController();
				}
				break;
			}

			const itemID = ParseItemID(choice);
			if (itemID === 0n) {
				console.log("Failed to get ItemID from input");
				console.log("Your input must be one of:");
				console.log("- ItemID (53299775858)");
				console.log(
					"- Inspect Link (csgo_econ_action_preview 4050B2D2E8878641586260FD4B6843704478E58E92B443002128E44130578E0850B4)",
				);
				console.log("- Steam Inventory Link (/inventory/#730_2_53299775858)");
				break;
			}

			const item = sharedCache.items.find((i) => i.id === itemID);
			if (!item) {
				console.log(
					`Parsed ItemID ${itemID} from your input but the item does not appear in your inventory`,
				);
				break;
			}

			if (!item.canBeRenamed) {
				console.log(
					`Parsed ItemID ${itemID} exists in your inventory but cannot be renamed right now, the exact reason depends on the item`,
				);
				console.log(
					"For example pet chickens can only be renamed once per growth stage",
				);
				break;
			}

			await renameItem(item.id, item.requiresNameTag);
			break;
		}
		case "name_default_item": {
			const choice = await gracefulInquirerPrompt(
				search(
					{
						message: "Select an item to rename",
						source: async (input: string | undefined) => {
							if (!input) {
								return defaultItems.map((item) => {
									return {
										name: item.name,
										value: item.id,
									};
								});
							}

							return defaultItems
								.filter((i) =>
									i.name.toLowerCase().includes(input.toLowerCase()),
								)
								.map((item) => {
									return {
										name: item.name,
										value: item.id,
									};
								});
						},
					},
					{
						signal: inventoryUpdateAbortController.signal,
					},
				),
			);
			if (choice === null) {
				// We are in a nested prompt, CTRL+C just goes back to the start
				if (sigintAbortController.signal.aborted) {
					console.log("Current prompt aborted");
					sigintAbortController = new AbortController();
				}
				break;
			}

			await renameItem(choice, true);
			break;
		}
		case "exit": {
			sigintAbortController.abort("Exit");
			break;
		}
		case null: {
			break;
		}
	}
}

gameCoordinator.close();
steam.close();

async function renameItem(
	id: bigint | number,
	requiresNameTag: boolean,
): Promise<void> {
	let nameTagID = 0n;
	if (requiresNameTag) {
		nameTagID = sharedCache.items.find((i) => i.isNameTag)?.id ?? 0n;
		assert(nameTagID > 0n, "Renaming requires a name tag but none was found");
	}

	const choice = await gracefulInquirerPrompt(
		select(
			{
				message: "Select input method",
				choices: [
					{
						name: "Text Input",
						value: "text_input",
					},
					{
						name: "File (Editor)",
						value: "file_editor",
					},
					{
						name: "File (Path)",
						value: "file_path",
					},
				],
			},
			{
				signal: inventoryUpdateAbortController.signal,
			},
		),
	);
	if (choice === null) {
		// We are in a nested prompt, CTRL+C just goes back to the start
		if (sigintAbortController.signal.aborted) {
			console.log("Current prompt aborted");
			sigintAbortController = new AbortController();
		}
		return;
	}

	console.log("Unicode codepoints are automatically unescaped:");
	console.log(
		"- '\\u{200F}' => Right-to-left mark unicode character https://unicode-explorer.com/c/200F",
	);
	console.log(
		"- '\\u{2029}' => Paragraph separator unicode character https://unicode-explorer.com/c/2029",
	);
	console.log(
		"- 'm\\u{2029}e\\u{2029}o\\u{2029}w' => 'meow' with each character on its own line",
	);
	console.log(
		"- '\\uD83D\\uDE00' => '\uD83D\uDE00' (Panorama does not display this correctly, just an example)",
	);
	console.log(
		"You can use https://unicode-explorer.com for a list of unicode characters and their codepoint",
	);
	console.log(
		"Panorama may not display all unicode correctly, the ones that don't work will be invisible",
	);
	console.log(
		"For convenience all new line characters (Including typing '\\n') are automatically replaced with paragraph separators, which has the same visual effect of creating a new line",
	);

	let newName = "";
	switch (choice) {
		case "text_input": {
			const text = await gracefulInquirerPrompt(
				input(
					{
						message: "Enter the new item name",
					},
					{
						signal: inventoryUpdateAbortController.signal,
					},
				),
			);
			if (text === null) {
				// We are in a nested prompt, CTRL+C just goes back to the start
				if (sigintAbortController.signal.aborted) {
					console.log("Current prompt aborted");
					sigintAbortController = new AbortController();
				}
				return;
			}

			newName = text;
			break;
		}
		case "file_editor": {
			const text = await gracefulInquirerPrompt(
				editor(
					{
						message: [
							"1. Press <enter> to open your default editor",
							"  2. Enter the new item name",
							"  3. Close the editor to continue",
						].join("\n"),
						file: {
							prefix: "csgo_nametag_tool_",
						},
						validate: (text) => {
							if (text.length <= 0) {
								return "You did not write anything. If you want to abort press CTRL+C";
							}
							return true;
						},
					},
					{
						signal: inventoryUpdateAbortController.signal,
					},
				),
			);
			if (text === null) {
				// We are in a nested prompt, CTRL+C just goes back to the start
				if (sigintAbortController.signal.aborted) {
					console.log("Current prompt aborted");
					sigintAbortController = new AbortController();
				}
				return;
			}

			newName = text;
			break;
		}
		case "file_path": {
			const path = await gracefulInquirerPrompt(
				input(
					{
						message: "Please enter the name of the file you want to use",
						validate: (text) => {
							if (text.length <= 0) {
								return "You did not write anything. If you want to abort press CTRL+C";
							}

							if (!existsSync(text)) {
								return `File '${text}' does not exist. If you want to abort press CTRL+C`;
							}

							return true;
						},
					},
					{
						signal: inventoryUpdateAbortController.signal,
					},
				),
			);
			if (path === null) {
				// We are in a nested prompt, CTRL+C just goes back to the start
				if (sigintAbortController.signal.aborted) {
					console.log("Current prompt aborted");
					sigintAbortController = new AbortController();
				}
				return;
			}

			newName = await readFile(path, "utf8");
			break;
		}
	}

	try {
		// Unescape unicode
		newName = unescapeUnicode(newName);

		// Replace \r with nothing
		newName = newName.replaceAll("\r", "");
		newName = newName.replaceAll("\\r", "");

		// Replace \n with the paragraph separator
		newName = newName.replaceAll("\\n", "\u{2029}");
		newName = newName.replaceAll("\n", "\u{2029}");
	} catch (err) {
		console.log(`Failed to unescape unicode: ${err}`);
		return;
	}

	const newNameLength = Buffer.byteLength(newName, "utf8");
	if (newNameLength > 20) {
		console.log(
			`WARNING: Your name might be too long! (${newNameLength}/20 bytes | ${newName.length} characters)`,
		);
	}

	// We warn for everything except Storage Units
	if (!sharedCache.items.find((i) => i.id === id)?.isStorageUnit) {
		const confirmation = await gracefulInquirerPrompt(
			confirm({
				message: [
					requiresNameTag
						? `WARNING: You are about to use a name tag. Name tags can only be used once.`
						: [],
					`${requiresNameTag ? "        " : "WARNING:"} Make sure everything you have select and input is accurate.`,
					"         Always test on a Storage Unit first, however it is not guaranteed that",
					"         whatever you are renaming will work and look identical to a Storage Unit.",
					"         Some items can only be renamed once, for example pet chickens.",
					"",
					"If you wish to continue press <enter>",
					"If you wish to abort press CTRL+C",
					"",
				]
					.flat()
					.join("\n"),
			}),
		);
		if (!confirmation) {
			// We are in a nested prompt, CTRL+C just goes back to the start
			if (sigintAbortController.signal.aborted) {
				console.log("Current prompt aborted");
				sigintAbortController = new AbortController();
			} else {
				console.log("Rename cancelled");
			}
			return;
		}
	}

	gameCoordinator.send(
		typeof id === "number"
			? EGCItemMsg.k_EMsgGCNameBaseItem
			: EGCItemMsg.k_EMsgGCNameItem,
		CMsgModifyItemStringAttr,
		{
			tool_item_id: nameTagID,
			subject_item_id:
				typeof id === "bigint" ? id : BigInt(id) | 0xf000000000000000n,
			attr_value: newName,
		},
	);

	// Wait 5 seconds or until we get an inventory update
	// Technically the correct way is listening to "k_EMsgGCItemCustomizationNotification" but whatever
	const signal = AbortSignal.any([
		inventoryUpdateAbortController.signal,
		sigintAbortController.signal,
		AbortSignal.timeout(5000),
	]);
	while (!signal.aborted) {
		await new Promise((p) => setTimeout(p, 1));
	}

	if (inventoryUpdateAbortController.signal.aborted) {
		if (typeof id === "number") {
			// Would have to check for an item creation and check if def_index matches
			console.log("Inventory update received, item naming likely succeeded");
		} else {
			const item = sharedCache.items.find((i) => i.id === id);
			if (!item) {
				console.log("Can no longer find the item that was being renamed");
			} else {
				console.log(`Item is now named: ${item.getCustomName()}`);
			}
		}
	} else if (sigintAbortController.signal.aborted) {
		console.log("Waiting for item rename to finish aborted");
	} else {
		console.log("Did not receive inventory update, renaming might have failed");
	}
}
