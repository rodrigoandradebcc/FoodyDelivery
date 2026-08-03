# Foody — web

React + TypeScript + Vite frontend for the Foody Delivery API.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview  # http://localhost:4173
npm test
```

> **The ports are fixed.** The Spring Boot API's CORS configuration allows
> exactly `http://localhost:5173` (dev) and `http://localhost:4173` (preview).
> `strictPort` is enabled in `vite.config.ts` so Vite fails loudly instead of
> silently moving to another port — a port change surfaces as an auth failure,
> not an obvious CORS error.

The design tokens and shared component classes live in `src/index.css`.

Fuller documentation is added in a later task.
