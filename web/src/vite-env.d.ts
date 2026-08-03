/// <reference types="vite/client" />

// Vite's own ImportMetaEnv extends Record<string, any>, so every VITE_* read
// would silently be `any`. Declaring the keys we actually use restores strict
// typing on them.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}
