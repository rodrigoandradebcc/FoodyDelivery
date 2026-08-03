import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/auth";
import "./appshell.css";

export default function AppShell() {
  const { signOut } = useAuth();
  return (
    <div className="shell">
      <header className="shell-header">
        <NavLink to="/" className="brand">
          Foody<span className="brand-dot">.</span>
        </NavLink>
        <nav className="shell-nav" aria-label="Principal">
          <Link to="/orders/new" className="btn btn-primary">
            Novo pedido
          </Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sair
          </button>
        </nav>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
