import { LSAssistLogo } from "./LSAssistLogo";

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
    <section className="brand-panel" aria-label="Apresentação do LSAssist">
      <div className="brand-glow brand-glow-one" />
      <div className="brand-glow brand-glow-two" />

      <div className="brand-content">
        <a className="brand-lockup" href="/" aria-label="LSAssist, página inicial">
          <LSAssistLogo inverse />
        </a>

        <div className="brand-copy">
          <p className="eyebrow">Gestão para assistências técnicas</p>
          <h1>Controle o serviço.<br />Cuide do cliente.</h1>
          <p className="brand-lead">
            Organização, clareza e segurança para sua equipe acompanhar cada atendimento.
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

      <p className="brand-footer">Clareza, eficiência e controle.</p>
    </section>
  );
}
