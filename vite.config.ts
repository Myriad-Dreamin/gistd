import { defineConfig } from "vite";

export default defineConfig({
  build: {
    assetsInlineLimit: (id, content) =>
      id.endsWith(".css") || content.length < 4096,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
