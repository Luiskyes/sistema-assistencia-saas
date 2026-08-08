import { type FormEvent, useEffect, useState } from "react";

import { getSupabaseClient } from "../lib/supabase";
import { PasswordInput } from "./PasswordInput";
import { StatusMessage } from "./StatusMessage";

type InviteState = "checking" | "ready" | "invalid" | "complete";

export function InvitePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<InviteState>("checking");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let invalidTimer: number | undefined;
    let unsubscribe: (() => void) | undefined;

    async function initializeInvite() {
      try {
        const supabase = await getSupabaseClient();
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (active && session) {
            if (invalidTimer) window.clearTimeout(invalidTimer);
            setState("ready");
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session && active) {
            setState("ready");
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data.session && active) {
          setState("ready");
          return;
        }

        invalidTimer = window.setTimeout(() => {
          if (active) setState("invalid");
        }, 2500);
      } catch {
        if (active) setState("invalid");
      }
    }

    void initializeInvite();

    return () => {
      active = false;
      if (invalidTimer) window.clearTimeout(invalidTimer);
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);

    if (password.length < 8) {
      setMessage("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas informadas não são iguais.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("Não foi possível definir a senha. Solicite um novo convite.");
        return;
      }
      await supabase.auth.signOut();
      setState("complete");
    } catch {
      setMessage("Não foi possível conectar ao sistema.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="auth-card centered-card" role="status">
        <span className="page-loader" aria-hidden="true" />
        <h2>Validando seu convite</h2>
        <p>Aguarde só um momento.</p>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="auth-card centered-card">
        <span className="state-icon state-icon-error" aria-hidden="true">!</span>
        <h2>Convite inválido ou expirado</h2>
        <p>Peça ao administrador para enviar um novo convite de acesso.</p>
        <a className="secondary-button" href="/">Voltar para o login</a>
      </div>
    );
  }

  if (state === "complete") {
    return (
      <div className="auth-card centered-card">
        <span className="state-icon state-icon-success" aria-hidden="true">✓</span>
        <h2>Senha criada com sucesso</h2>
        <p>Seu acesso está pronto. Agora você já pode entrar no sistema.</p>
        <a className="primary-button link-button" href="/">Ir para o login</a>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <header className="auth-header">
        <p className="eyebrow">Primeiro acesso</p>
        <h2>Crie sua senha</h2>
        <p>Use uma senha segura e que somente você conheça.</p>
      </header>

      <form onSubmit={handleSubmit} className="auth-form">
        <PasswordInput
          label="Nova senha"
          name="new-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          hint="Use pelo menos 8 caracteres."
        />
        <PasswordInput
          label="Confirme a nova senha"
          name="confirm-password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          minLength={8}
        />

        {message ? <StatusMessage type="error">{message}</StatusMessage> : null}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Criar minha senha"}
        </button>
      </form>
    </div>
  );
}
