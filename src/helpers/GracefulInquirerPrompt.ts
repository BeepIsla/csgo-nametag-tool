type Fn = () => void;

let sigintHandler: Fn | null = null;

export function setGracefulInquirerPromptExitHandler(fn: Fn): void {
	sigintHandler = fn;
}

export async function gracefulInquirerPrompt<T>(
	promise: Promise<T>,
): Promise<T | null> {
	const result = await promise.catch(async (e) => {
		if (e.name === "AbortPromptError" || e.name === "ExitPromptError") {
			if (
				sigintHandler &&
				e.message === "User force closed the prompt with SIGINT"
			) {
				sigintHandler();
			}

			return null;
		}

		throw e;
	});
	return result;
}
