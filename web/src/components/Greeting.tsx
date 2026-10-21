import { greetingFor } from "../lib/greeting";

export function Greeting() {
  const { salutation, date } = greetingFor(new Date());
  return (
    <p className="page-bar-greet">
      <b>{salutation}</b> · {date}
    </p>
  );
}
