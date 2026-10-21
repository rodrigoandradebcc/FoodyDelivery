/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.flow.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "flow",
          environment: "jsdom",
          include: ["src/**/*.flow.test.tsx"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
});
