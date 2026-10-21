import type { ReactNode } from "react";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function salutation(hour: number) {
  if (hour >= 5 && hour <= 11) return "Bom dia";
  if (hour >= 12 && hour <= 17) return "Boa tarde";
  return "Boa noite";
}

function Greeting() {
  const now = new Date();
  return (
    <p className="page-bar-greet">
      <b>{salutation(now.getHours())}</b> · {dateFormat.format(now)}
    </p>
  );
}

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
