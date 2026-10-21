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

export default function Greeting() {
  const now = new Date();
  return (
    <p className="page-bar-greet">
      <b>{salutation(now.getHours())}</b> · {dateFormat.format(now)}
    </p>
  );
}
