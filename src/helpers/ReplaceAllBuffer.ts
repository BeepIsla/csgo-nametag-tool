/**
 * Creates a copy of the buffer
 */
export function replaceAllBuffer(
	input: Buffer,
	find: Buffer,
	replace: Buffer,
): Buffer<ArrayBuffer> {
	if (find.length === 0) {
		return Buffer.copyBytesFrom(input);
	}

	const chunks: Buffer[] = [];
	let offset = 0;
	while (offset <= input.length - find.length) {
		const index = input.indexOf(find, offset);
		if (index === -1) {
			break;
		}

		if (index > offset) {
			chunks.push(input.subarray(offset, index));
		}

		if (replace.length > 0) {
			chunks.push(replace);
		}

		offset = index + find.length;
	}

	if (chunks.length <= 0 && offset === 0) {
		return Buffer.copyBytesFrom(input);
	}

	if (offset < input.length) {
		chunks.push(input.subarray(offset));
	}

	return Buffer.concat(chunks);
}
