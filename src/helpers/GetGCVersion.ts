export async function GetGCVersion(): Promise<number> {
	try {
		const res = await fetch(
			"https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/steam.inf",
		);
		if (res.status !== 200) {
			throw new Error(`Expected status code 200 but got ${res.status}`);
		}

		const text = await res.text();
		const lines = text.split("\n");
		for (const line of lines) {
			const [key, value] = line.split("=");
			if (key === "ClientVersion" && value) {
				return Number.parseInt(value, 10);
			}
		}

		throw new Error("'ClientVersion' not found");
	} catch {
		// This one should work as a fallback
		return 2000943;
	}
}
