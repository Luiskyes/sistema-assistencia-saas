import { LSAssistLogo } from "./LSAssistLogo";

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
          <p className="eyebrow">Gestão para assistência técnica</p>
          <h1>Seu atendimento,<br />mais simples.</h1>
          <p className="brand-lead">
            Clientes, equipamentos e ordens de serviço em um só lugar.
          </p>
        </div>

        <div className="brand-note">
          <span aria-hidden="true" />
          Operação conectada e dados protegidos.
        </div>
      </div>
    </section>
  );
}
