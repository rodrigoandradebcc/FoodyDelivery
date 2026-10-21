import type { ReactNode } from "react";
import Greeting from "./Greeting";

export default function PageHeader({
  title,
  eyebrow,
  aside,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="page-bar">
      <div className="page-bar-heading">
        {eyebrow != null && <p className="page-bar-eyebrow">{eyebrow}</p>}
        <h1 className="page-bar-title display">{title}</h1>
      </div>
      <div className="page-bar-aside">{aside ?? <Greeting />}</div>
    </header>
  );
}
