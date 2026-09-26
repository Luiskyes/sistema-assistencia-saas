import { type FormEvent, useState } from "react";

import { getSupabaseClient } from "../lib/supabase";
import { LSAssistLogo } from "./LSAssistLogo";
import { PasswordInput } from "./PasswordInput";
import { StatusMessage } from "./StatusMessage";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setSubmitting(true);

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("E-mail ou senha incorretos. Confira os dados e tente novamente.");
      }
    } catch {
      setMessage("Não foi possível conectar ao sistema. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="mobile-brand">
        <LSAssistLogo />
      </div>

      <header className="auth-header">
        <p className="eyebrow">Área segura</p>
        <h2>Bem-vindo de volta</h2>
        <p>Entre para acessar a rotina da sua assistência.</p>
      </header>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="voce@assistencia.com"
            required
          />
        </div>

        <PasswordInput
          label="Senha"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {message ? <StatusMessage type="error">{message}</StatusMessage> : null}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? <span className="button-loader" aria-hidden="true" /> : null}
          {submitting ? "Entrando..." : "Entrar no sistema"}
        </button>
      </form>

      <p className="auth-help">Precisa de acesso? Fale com o administrador da sua assistência.</p>
    </div>
  );
}
