import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/useAuth";
import { BoardIcon } from "./icons/BoardIcon";
import { ChevronIcon } from "./icons/ChevronIcon";
import { SignOutIcon } from "./icons/SignOutIcon";
import { ThemeToggle } from "./ThemeToggle";
import "./appshell.css";

export function AppShell() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell" data-rail={open ? "open" : "closed"}>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="rail">
        <Link to="/" className="rail-brand" aria-label="Foody — quadro de pedidos">
          <span className="rail-mark" aria-hidden="true">
            F
          </span>
          <span className="rail-brand-name display" aria-hidden="true">
            Foody<span className="rail-brand-dot">.</span>
          </span>
        </Link>
        <button
          type="button"
          className="rail-toggle"
          aria-expanded={open}
          aria-controls="rail-nav"
          aria-label={open ? "Recolher menu" : "Expandir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="rail-chevron">
            <ChevronIcon />
          </span>
        </button>
        <nav className="rail-nav" id="rail-nav" aria-label="Principal">
          <NavLink to="/" end className="rail-item">
            <BoardIcon />
            <span className="rail-label">Quadro de pedidos</span>
          </NavLink>
        </nav>
        <ThemeToggle className="rail-item rail-theme" labelClassName="rail-label" iconClassName="rail-icon" />
        <button type="button" className="rail-item rail-signout" onClick={signOut}>
          <SignOutIcon />
          <span className="rail-label">Sair</span>
        </button>
      </aside>
      <main id="conteudo" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
