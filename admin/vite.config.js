import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/zastavka-admin/",
  server: {
    port: 5174,
    proxy: {
      "/zastavka-api": "http://127.0.0.1:3050",
    },
  },
});
