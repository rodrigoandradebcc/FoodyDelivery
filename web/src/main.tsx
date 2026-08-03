import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/auth";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element "#root" was not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
