import { defineConfig } from "vite";

// Phase 1 (editor + highlighting) needs no special plugins.
//
// Phase 2 (loading the Fletch VM as wasm) needs wasm + top-level-await support.
// When you get there, install and enable them:
//
//   npm install -D vite-plugin-wasm vite-plugin-top-level-await rollup
//
//   import wasm from "vite-plugin-wasm";
//   import topLevelAwait from "vite-plugin-top-level-await";
//   export default defineConfig({ plugins: [wasm(), topLevelAwait()], ... });
//
// (vite-plugin-top-level-await currently needs `rollup` present as a peer dep.)
export default defineConfig({
  server: {
    open: true,
    fs: {
      allow: [".", "../fletch"],
    },
  },
});
