import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    watch: {
      usePolling: process.env.FILE_WATCH_POLLING === "true",
    },
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:3001",
    },
  },
})
