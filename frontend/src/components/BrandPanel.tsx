const FEATURES = [
  {
    title: "Ordens organizadas",
    description: "Acompanhe cada equipamento do recebimento até a entrega.",
  },
  {
    title: "Equipe em sintonia",
    description: "Dono, técnicos e recepção trabalhando no mesmo fluxo.",
  },
  {
    title: "Dados protegidos",
    description: "Cada assistência acessa somente as próprias informações.",
  },
] as const;

export function BrandPanel() {
  return (
    <section className="brand-panel" aria-label="Apresentação do LuAssists">
      <div className="brand-glow brand-glow-one" />
      <div className="brand-glow brand-glow-two" />

      <div className="brand-content">
        <a className="brand-lockup" href="/" aria-label="LuAssists, página inicial">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="img">
              <path d="M24.8 7.3a8.6 8.6 0 0 0-9.7 11.9L6.6 27.7a3.8 3.8 0 0 0 5.4 5.4l8.5-8.5a8.6 8.6 0 0 0 11.8-9.8l-5 5-5.7-1.5-1.5-5.7 4.7-5.3Z" />
            </svg>
          </span>
          <span>LuAssists</span>
        </a>

        <div className="brand-copy">
          <p className="eyebrow">Sua assistência, mais simples</p>
          <h1>Controle o serviço.<br />Cuide do cliente.</h1>
          <p className="brand-lead">
            Uma visão clara da operação para sua equipe trabalhar melhor todos os dias.
          </p>
        </div>

        <ul className="feature-list">
          {FEATURES.map((feature, index) => (
            <li key={feature.title}>
              <span className="feature-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{feature.title}</strong>
                <small>{feature.description}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="brand-footer">Gestão feita para quem resolve.</p>
    </section>
  );
}
