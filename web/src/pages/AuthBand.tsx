export default function AuthBand() {
  return (
    <header className="auth-band">
      <h1 className="auth-brand">
        <span className="auth-ticket" aria-hidden="true">F</span>
        <span>Foody<span className="auth-dot">.</span></span>
      </h1>
      <p className="auth-tagline display">O balcão inteiro num quadro só.</p>
      <div className="auth-mini" aria-hidden="true">
        <div className="auth-mini-card"><i className="auth-mini-bar auth-mini-recebido" /><i className="auth-mini-line" /></div>
        <div className="auth-mini-card"><i className="auth-mini-bar auth-mini-preparo" /><i className="auth-mini-line" /></div>
        <div className="auth-mini-card"><i className="auth-mini-bar auth-mini-saiu" /><i className="auth-mini-line" /></div>
      </div>
    </header>
  );
}
