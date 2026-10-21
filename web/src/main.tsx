import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "./index.css";
import { ApiError } from "./api/http";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status > 0 && error.status < 500) &&
        failureCount < 2,
      staleTime: 5_000,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element "#root" was not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
