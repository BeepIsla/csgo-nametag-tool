export function unescapeUnicode(str: string): string {
	const unescaped = str.replace(
		/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g,
		(match: string, braceHex?: string, stdHex?: string) => {
			const code = Number.parseInt(braceHex || stdHex || "", 16);

			if (braceHex) {
				if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
					throw new Error(`Invalid Unicode code point: ${match}`);
				}
				return String.fromCodePoint(code);
			}

			return String.fromCharCode(code);
		},
	);

	if (!unescaped.isWellFormed()) {
		throw new Error("Invalid Unicode string: contains unpaired surrogate");
	}

	return unescaped;
}
