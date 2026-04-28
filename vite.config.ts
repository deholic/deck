import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [svgr(), react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
