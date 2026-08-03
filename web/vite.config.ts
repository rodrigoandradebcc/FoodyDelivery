/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
//
// The ports are NOT incidental. The Spring Boot API allows exactly
// http://localhost:5173 (dev) and http://localhost:4173 (preview) in its CORS
// configuration. `strictPort` makes Vite fail loudly instead of silently
// hopping to the next free port, which would surface as an auth failure
// rather than a CORS failure.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  // The api/ and lib/ modules under test are pure TypeScript: no DOM, no React.
  // `node` keeps the suite fast and forces the fetch layer to stay free of
  // browser-only assumptions.
  test: {
    environment: "node",
  },
});
