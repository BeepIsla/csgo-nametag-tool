import { defineConfig } from "vite";

export default defineConfig({
	build: {
		ssr: "./src/index.ts",
		outDir: "./dist",
		sourcemap: true,
	},
	ssr: {
		noExternal: true,
	},
});
