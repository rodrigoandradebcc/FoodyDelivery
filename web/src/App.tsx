import { Route, Routes } from "react-router";
import { RequireAuth } from "./auth/auth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function BoardPlaceholder() {
  return <p>Quadro de pedidos — chega na Task 5.</p>;
}

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
        <Route index element={<BoardPlaceholder />} />
      </Route>
    </Routes>
  );
}
