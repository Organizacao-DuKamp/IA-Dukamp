import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: process.cwd(),
  resolve: { alias: { "@": process.cwd() + "/src" } },
  plugins: [tailwindcss(), react()],
  server: { host: "127.0.0.1", port: 5180 },
});
