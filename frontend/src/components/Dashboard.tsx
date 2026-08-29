import { useEffect, useState } from "react";

import type { SessaoAtual } from "../lib/api";
import { disponibilidadePlataforma } from "../lib/api";
import { AtualizacoesPanel } from "./AtualizacoesPanel";
import { ClientesPanel } from "./ClientesPanel";
import { EquipamentosPanel } from "./EquipamentosPanel";
import { EstoquePanel } from "./EstoquePanel";
import { OrdensPanel } from "./OrdensPanel";
import { LSAssistLogo } from "./LSAssistLogo";
import { ThemeToggle } from "./ThemeToggle";

type DashboardProps = {
  sessao: SessaoAtual;
  accessToken: string;
  onLogout: () => Promise<void>;
};

type View = "resumo" | "clientes" | "equipamentos" | "estoque" | "ordens" | "atualizacoes";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

export function Dashboard({ sessao, accessToken, onLogout }: DashboardProps) {
  const { usuario, assistencia } = sessao;
  const [view, setView] = useState<View>("resumo");
  const [osClienteInicial, setOsClienteInicial] = useState<string | null>(null);
  const [novaOsNonce, setNovaOsNonce] = useState(0);
  const [platform, setPlatform] = useState({ homologacao: false, autorizado: false });
  useEffect(() => {
    let active = true;
    setPlatform({ homologacao: false, autorizado: false });
    void disponibilidadePlataforma(accessToken)
      .then((result) => { if (active) setPlatform(result); })
      .catch(() => { if (active) setPlatform({ homologacao: false, autorizado: false }); });
    return () => { active = false; };
  }, [accessToken]);

  const title =
    view === "resumo"
      ? "Resumo"
      : view === "clientes"
        ? "Clientes"
        : view === "equipamentos"
          ? "Equipamentos"
          : view === "estoque"
            ? "Estoque"
            : view === "atualizacoes" ? "Administração da plataforma" : "Ordens de Serviço";

  function abrirNovaOS(clienteId?: string) {
    setOsClienteInicial(clienteId ?? null);
    setNovaOsNonce((value) => value + 1);
    setView("ordens");
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <LSAssistLogo inverse />
          <small>Gestão para Assistências Técnicas</small>
        </div>

        <div className="tenant-card">
          {platform.homologacao ? <strong>HOMOLOGAÇÃO — DADOS DE TESTE</strong> : null}
          <span>Assistência atual</span>
          <strong>{assistencia.nome_assistencia}</strong>
        </div>

        <nav className="dashboard-navigation">
          <button
            className={`dashboard-nav-item ${view === "resumo" ? "dashboard-nav-item-active" : ""}`}
            onClick={() => setView("resumo")}
          >
            <span>⌂</span> Resumo
          </button>
          <button
            className={`dashboard-nav-item ${view === "clientes" ? "dashboard-nav-item-active" : ""}`}
            onClick={() => setView("clientes")}
          >
            <span>◎</span> Clientes
          </button>
          <button
            className={`dashboard-nav-item ${view === "equipamentos" ? "dashboard-nav-item-active" : ""}`}
            onClick={() => setView("equipamentos")}
          >
            <span>▣</span> Equipamentos
          </button>
          <button
            className={`dashboard-nav-item ${view === "estoque" ? "dashboard-nav-item-active" : ""}`}
            onClick={() => setView("estoque")}
          >
            <span>▤</span> Estoque
          </button>
          <button
            className={`dashboard-nav-item ${view === "ordens" ? "dashboard-nav-item-active" : ""}`}
            onClick={() => setView("ordens")}
          >
            <span>≡</span> Ordens de serviço
          </button>

          {platform.autorizado ? (
            <button className={`dashboard-nav-item ${view === "atualizacoes" ? "dashboard-nav-item-active" : ""}`}
              onClick={() => setView("atualizacoes")}>
              <span>♙</span> Versões da plataforma
            </button>
          ) : null}
          {usuario.funcao_usuario === "DONO" ? (
            <button className="dashboard-nav-item" disabled>
              <span>♙</span> Administração <em>em evolução</em>
            </button>
          ) : null}
        </nav>

        <div className="dashboard-sidebar-footer">
          <span className={assistencia.ativo ? "status-active" : "status-inactive"}>●</span>
          {assistencia.ativo ? " Assistência ativa" : " Assistência inativa"}
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p>{usuario.funcao_usuario === "DONO" ? "Gestão e operação" : "Operação da assistência"}</p>
            <h1>{title}</h1>
          </div>

          <div className="dashboard-header-actions">
            <button
              className="quick-os-button"
              type="button"
              onClick={() => abrirNovaOS()}
              title="Abrir nova Ordem de Serviço"
            >
              + Nova OS
            </button>
            <ThemeToggle compact />
            <div className="dashboard-user">
              <span className="dashboard-avatar">{initials(usuario.nome_usuario)}</span>
              <div className="dashboard-user-info">
                <strong>{usuario.nome_usuario}</strong>
                <span>{usuario.funcao_usuario}</span>
              </div>
              <button className="dashboard-logout" onClick={() => void onLogout()}>
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {view === "atualizacoes" ? (
            platform.autorizado ? <AtualizacoesPanel accessToken={accessToken} /> :
              <p role="alert">Acesso à plataforma indisponível para esta sessão.</p>
          ) : view === "clientes" ? (
            <ClientesPanel
              accessToken={accessToken}
              onNovaOS={(clienteId) => abrirNovaOS(clienteId)}
            />
          ) : view === "equipamentos" ? (
            <EquipamentosPanel accessToken={accessToken} />
          ) : view === "estoque" ? (
            <EstoquePanel accessToken={accessToken} funcao={usuario.funcao_usuario} />
          ) : view === "ordens" ? (
            <OrdensPanel
              accessToken={accessToken}
              funcao={usuario.funcao_usuario}
              nomeAssistencia={assistencia.nome_assistencia}
              clienteInicialId={osClienteInicial}
              abrirNovaNonce={novaOsNonce}
            />
          ) : (
            <section className="overview-page home-organized">
              <section className="home-hero">
                <div className="home-hero-copy">
                  <span className="page-kicker">
                    {usuario.funcao_usuario === "DONO"
                      ? "PAINEL ADMINISTRATIVO"
                      : "PAINEL OPERACIONAL"}
                  </span>
                  <h2>Olá, {usuario.nome_usuario.split(" ")[0]}.</h2>
                  <p>
                    Centralize o atendimento: abra a OS, acompanhe o diagnóstico,
                    consulte estoque e responda o cliente sem perder tempo entre telas.
                  </p>
                </div>

                <div className="home-main-actions">
                  <button
                    className="primary-action home-primary-action"
                    onClick={() => abrirNovaOS()}
                  >
                    <span>+</span>
                    <div>
                      <strong>Nova Ordem de Serviço</strong>
                      <small>Cliente → equipamento → atendimento</small>
                    </div>
                  </button>

                  <button
                    className="secondary-action home-secondary-action"
                    onClick={() => setView("clientes")}
                  >
                    <span>◎</span>
                    <div>
                      <strong>Localizar cliente</strong>
                      <small>Cadastro, histórico e nova OS</small>
                    </div>
                  </button>
                </div>
              </section>

              <section className="home-workspace">
                <div className="home-section-heading">
                  <div>
                    <span className="page-kicker">Área de trabalho</span>
                    <h3>Acesso rápido</h3>
                  </div>
                  <p>Os módulos seguem o fluxo real do atendimento.</p>
                </div>

                <div className="home-module-grid">
                  <button
                    type="button"
                    className="home-module-card"
                    onClick={() => setView("ordens")}
                  >
                    <span className="home-module-icon">≡</span>
                    <div>
                      <strong>Ordens de Serviço</strong>
                      <small>
                        Visualize situação, diagnóstico, orçamento e andamento.
                      </small>
                    </div>
                    <b>→</b>
                  </button>

                  <button
                    type="button"
                    className="home-module-card"
                    onClick={() => setView("clientes")}
                  >
                    <span className="home-module-icon">◎</span>
                    <div>
                      <strong>Clientes</strong>
                      <small>
                        Localize rapidamente ou abra nova OS direto do cliente.
                      </small>
                    </div>
                    <b>→</b>
                  </button>

                  <button
                    type="button"
                    className="home-module-card"
                    onClick={() => setView("equipamentos")}
                  >
                    <span className="home-module-icon">▣</span>
                    <div>
                      <strong>Equipamentos</strong>
                      <small>
                        Consulte aparelhos vinculados e histórico por cliente.
                      </small>
                    </div>
                    <b>→</b>
                  </button>

                  <button
                    type="button"
                    className="home-module-card"
                    onClick={() => setView("estoque")}
                  >
                    <span className="home-module-icon">▤</span>
                    <div>
                      <strong>Estoque</strong>
                      <small>
                        Veja disponibilidade antes de fechar o orçamento.
                      </small>
                    </div>
                    <b>→</b>
                  </button>
                </div>
              </section>

              <section className="home-flow-strip">
                <div>
                  <span className="page-kicker">Fluxo recomendado</span>
                  <h3>Do recebimento à aprovação sem voltar etapas.</h3>
                </div>

                <div className="home-flow-steps">
                  <span><b>1</b> Cliente</span>
                  <i>→</i>
                  <span><b>2</b> Equipamento</span>
                  <i>→</i>
                  <span><b>3</b> Diagnóstico</span>
                  <i>→</i>
                  <span><b>4</b> Orçamento</span>
                  <i>→</i>
                  <span><b>5</b> Aprovação</span>
                </div>
              </section>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
