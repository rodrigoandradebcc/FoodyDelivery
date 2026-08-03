import { Route, Routes } from "react-router";
import { RequireAuth } from "./auth/auth";
import AppShell from "./components/AppShell";
import BoardPage from "./features/orders/BoardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<BoardPage />} />
      </Route>
    </Routes>
  );
}
