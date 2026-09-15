import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const mobile = process.env.VITE_MOBILE === "1";

export default defineConfig({
  plugins: [react()],
  base: mobile ? "./" : "/zastavka/",
  server: {
    port: 5173,
    proxy: {
      "/zastavka-api": "http://127.0.0.1:3050",
    },
  },
});
