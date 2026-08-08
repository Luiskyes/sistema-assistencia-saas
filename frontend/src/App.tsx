import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { BrandPanel } from "./components/BrandPanel";
import { Dashboard } from "./components/Dashboard";
import { InvitePasswordForm } from "./components/InvitePasswordForm";
import { LoginForm } from "./components/LoginForm";
import { ApiError, carregarSessaoAtual, type SessaoAtual } from "./lib/api";
import { getSupabaseClient } from "./lib/supabase";
import "./dashboard.css";

export default function App() {
  const isInviteRoute = window.location.pathname === "/auth/convite";

  const [authSession, setAuthSession] = useState<Session | null | undefined>(
    undefined,
  );
  const [sessaoAtual, setSessaoAtual] = useState<SessaoAtual | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(false);
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  const [tentativaSessao, setTentativaSessao] = useState(0);

  useEffect(() => {
    if (isInviteRoute) {
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const supabase = await getSupabaseClient();

        if (!mounted) {
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (error) {
          setErroSessao("Não foi possível verificar sua autenticação.");
          setAuthSession(null);
          return;
        }

        setAuthSession(data.session);

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) {
            return;
          }

          setAuthSession(session);
          setSessaoAtual(null);
          setErroSessao(null);
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch {
        if (!mounted) {
          return;
        }

        setErroSessao(
          "Não foi possível carregar a configuração de autenticação.",
        );
        setAuthSession(null);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [isInviteRoute]);

  useEffect(() => {
    if (isInviteRoute || authSession === undefined) {
      return;
    }

    if (authSession === null) {
      setSessaoAtual(null);
      setCarregandoSessao(false);
      return;
    }

    const controller = new AbortController();

    setCarregandoSessao(true);
    setErroSessao(null);

    void carregarSessaoAtual(authSession.access_token, controller.signal)
      .then((sessao) => {
        setSessaoAtual(sessao);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError) {
          setErroSessao(error.message);
          return;
        }

        setErroSessao(
          "Não foi possível conectar ao servidor. Verifique se o backend está em execução.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCarregandoSessao(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [authSession, isInviteRoute, tentativaSessao]);

  async function handleLogout() {
    setErroSessao(null);

    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();

    setAuthSession(null);
    setSessaoAtual(null);
  }

  if (isInviteRoute) {
    return (
      <main className="auth-page">
        <BrandPanel />

        <section className="form-panel" aria-label="Criar senha">
          <InvitePasswordForm />

          <footer className="form-footer">
            <span>© {new Date().getFullYear()} LuAssists</span>
            <span>Privacidade e segurança</span>
          </footer>
        </section>
      </main>
    );
  }

  if (authSession === undefined) {
    return (
      <main className="session-loading" aria-live="polite">
        <div className="session-loading-spinner" />
        <p>Verificando sua sessão...</p>
      </main>
    );
  }

  if (authSession === null) {
    return (
      <main className="auth-page">
        <BrandPanel />

        <section className="form-panel" aria-label="Entrar">
          <LoginForm />

          <footer className="form-footer">
            <span>© {new Date().getFullYear()} LuAssists</span>
            <span>Privacidade e segurança</span>
          </footer>
        </section>
      </main>
    );
  }

  if (carregandoSessao && !sessaoAtual) {
    return (
      <main className="session-loading" aria-live="polite">
        <div className="session-loading-spinner" />
        <p>Carregando sua assistência...</p>
      </main>
    );
  }

  if (erroSessao && !sessaoAtual) {
    return (
      <main className="session-error-page">
        <section className="session-error-card">
          <h1>Não foi possível abrir o painel</h1>

          <p className="session-error-message" role="alert">
            {erroSessao}
          </p>

          <div className="session-error-actions">
            <button
              type="button"
              className="session-primary-button"
              onClick={() =>
                setTentativaSessao((tentativa) => tentativa + 1)
              }
            >
              Tentar novamente
            </button>

            <button
              type="button"
              className="session-secondary-button"
              onClick={() => void handleLogout()}
            >
              Sair da conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!sessaoAtual) {
    return null;
  }

  return <Dashboard sessao={sessaoAtual} onLogout={handleLogout} />;
}
