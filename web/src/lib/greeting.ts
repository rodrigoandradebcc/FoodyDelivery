const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function salutation(hour: number): string {
  if (hour >= 5 && hour <= 11) return "Bom dia";
  if (hour >= 12 && hour <= 17) return "Boa tarde";
  return "Boa noite";
}

export function greetingFor(date: Date): { salutation: string; date: string } {
  return { salutation: salutation(date.getHours()), date: dateFormat.format(date) };
}
