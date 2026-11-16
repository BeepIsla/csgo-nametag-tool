// Someone make Array.prototype.count(filterFn)
export function arrayCount<T>(ary: T[], filter: (value: T) => boolean): number {
	let count = 0;
	for (const element of ary) {
		if (filter(element)) {
			count++;
		}
	}
	return count;
}
