import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    assetsInlineLimit: 10000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});
