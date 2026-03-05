import { defineConfig } from "vite";
import { resolve } from "path";

// Use dynamic import for ESM-only plugins when Vite loads config via CJS
export default defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;
  return {
    plugins: [react()],
    build: {
      // produce readable, non-minified output to aid debugging
      sourcemap: false,
      minify: true,
      // keep code formatting readable
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "src/popup.html"),
          // content script and background are entry point TS files
          content: resolve(__dirname, "src/contentScript.ts"),
          background: resolve(__dirname, "src/background.ts"),
        },
        output: {
          // keep file names deterministic for manifest and readable
          entryFileNames: (chunk: any) => {
            if (chunk.name === "content") return "contentScript.js";
            if (chunk.name === "background") return "background.js";
            return "[name].js";
          },
          chunkFileNames: "[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
  };
});
