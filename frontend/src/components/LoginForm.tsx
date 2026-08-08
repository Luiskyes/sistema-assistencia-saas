import { type FormEvent, useState } from "react";

import { apiUrl, getSupabaseClient } from "../lib/supabase";
import { PasswordInput } from "./PasswordInput";
import { StatusMessage } from "./StatusMessage";

type ProfileResponse = {
  usuario: {
    nome_usuario: string;
    funcao_usuario: string;
  };
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setSuccess(undefined);
    setSubmitting(true);

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("E-mail ou senha incorretos. Confira os dados e tente novamente.");
        return;
      }

      const response = await fetch(apiUrl + "/api/v1/sessao/atual", {
        headers: { Authorization: "Bearer " + data.session.access_token },
      });
      if (!response.ok) {
        await supabase.auth.signOut();
        setMessage("Seu login existe, mas ainda não foi vinculado a uma assistência ativa.");
        return;
      }

      const profile = (await response.json()) as ProfileResponse;
      setSuccess("Acesso confirmado. Bem-vindo, " + profile.usuario.nome_usuario + "!");
    } catch {
      setMessage("Não foi possível conectar ao sistema. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="mobile-brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <path d="M24.8 7.3a8.6 8.6 0 0 0-9.7 11.9L6.6 27.7a3.8 3.8 0 0 0 5.4 5.4l8.5-8.5a8.6 8.6 0 0 0 11.8-9.8l-5 5-5.7-1.5-1.5-5.7 4.7-5.3Z" />
          </svg>
        </span>
        LuAssists
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
        {success ? <StatusMessage type="success">{success}</StatusMessage> : null}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? <span className="button-loader" aria-hidden="true" /> : null}
          {submitting ? "Entrando..." : "Entrar no sistema"}
        </button>
      </form>

      <p className="auth-help">
        Precisa de acesso? Fale com o administrador da sua assistência.
      </p>
    </div>
  );
}
