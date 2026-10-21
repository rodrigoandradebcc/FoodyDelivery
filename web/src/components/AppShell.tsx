import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/auth";
import "./appshell.css";

function BoardIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="5.5" height="14" rx="1.5" />
      <rect x="11.5" y="3" width="5.5" height="9" rx="1.5" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 6l4 4-4 4M16 10H8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="rail-chevron-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export default function AppShell() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell" data-rail={open ? "open" : "closed"}>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="rail">
        <NavLink to="/" end className="rail-brand" aria-label="Foody — quadro de pedidos">
          <span className="rail-mark" aria-hidden="true">
            F
          </span>
          <span className="rail-brand-name display" aria-hidden="true">
            Foody<span className="rail-brand-dot">.</span>
          </span>
        </NavLink>
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
