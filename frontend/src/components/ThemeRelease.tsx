import { useEffect, useState, type CSSProperties } from "react";
import {
  aplicarTema, consultarTema, historicoTema, mensagemErroUsuario, previaTema, restaurarTema,
  type InstalledTheme, type ReleaseReport,
} from "../lib/api";
import { installTheme } from "../lib/themeUpdates";

export function ThemeRelease({ token, report }: { token: string; report?: ReleaseReport }) {
  const [preview, setPreview] = useState<ReleaseReport | null>(null);
  const [installed, setInstalled] = useState<InstalledTheme | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof historicoTema>>>([]);
  useEffect(() => {
    const controller = new AbortController();
    const update = (event: Event) => setInstalled((event as CustomEvent<InstalledTheme>).detail);
    if (!report) window.addEventListener("lsassist-theme-installed", update);
    if (!report) void consultarTema(controller.signal).then(setInstalled).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(mensagemErroUsuario(reason));
    });
    return () => { controller.abort(); window.removeEventListener("lsassist-theme-installed", update); };
  }, [report]);

  async function loadPreview() {
    setBusy(true); setError(""); setMessage(""); setConfirmation("");
    try {
      if (report) setPreview(await previaTema(token, report.id));
      else {
        const [state, events] = await Promise.all([consultarTema(), historicoTema(token)]);
        setInstalled(state); setHistory(events);
      }
    } catch (reason: unknown) { setError(mensagemErroUsuario(reason)); setPreview(null); }
    finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError(""); setMessage("");
    try {
      const state = preview ? await aplicarTema(token, preview, confirmation)
        : await restaurarTema(token, installed!.revision, confirmation);
      installTheme(state); setInstalled(state); setPreview(null); setConfirmation("");
      setMessage(`Operação concluída: tema ${state.version}, revisão ${state.revision}. Outras abas atualizam em até 30 segundos.`);
    } catch (reason: unknown) { setError(mensagemErroUsuario(reason)); }
    finally { setBusy(false); }
  }

  const required = preview ? `APLICAR ${preview.version}` : "RESTAURAR";
  return <div className="theme-release">
    {!report ? <>
      <h3>Tema instalado e recuperação</h3>
      <p>{installed ? `Versão ${installed.version} · revisão ${installed.revision}` : "Consultando tema..."}</p>
      <button type="button" disabled={busy} onClick={() => void loadPreview()}>Atualizar estado</button>
    </> : <button type="button" disabled={busy} onClick={() => void loadPreview()}>Ver prévia e compatibilidade</button>}
    {preview?.themes ? <div>
      <h4>Prévia isolada — {preview.version}</h4>
      <p>{preview.notes}</p><small>Base {preview.base_version} · Hash {preview.sha256}</small>
      {(["light", "dark"] as const).map((mode) => <section key={mode} className={`theme-preview ${mode}`}>
        <h4>{mode === "light" ? "Claro" : "Escuro"}</h4>
        <div className="theme-samples">{["success", "info", "edit", "warning", "danger", "special"].map((role, i) => {
          const colors = preview.themes![mode];
          const filled = role === "success" || role === "info";
          return <button key={role} type="button" style={{
            color: filled ? "#ffffff" : colors[`--ls-sem-${role}`],
            background: filled ? colors[`--ls-sem-${role}-bg`] : "transparent",
            borderColor: colors[`--ls-sem-${role}`],
          } as CSSProperties}>{["Salvar", "Visualizar", "Editar", "Analisar", "Cancelar OS", "Especial"][i]}</button>;
        })}</div>
      </section>)}
    </div> : null}
    {(preview || (!report && installed?.can_restore)) ? <div className="theme-confirm">
      <label>Digite <strong>{required}</strong> para confirmar na homologação
        <input value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
      </label>
      <button type="button" disabled={busy || confirmation !== required} onClick={() => void confirm()}>
        {busy ? "Processando…" : preview ? "Aplicar tema na homologação" : "Restaurar tema anterior"}
      </button>
      {preview ? <button type="button" disabled={busy} onClick={() => { setPreview(null); setConfirmation(""); }}>Fechar prévia</button> : null}
    </div> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {!report && history.length ? <details><summary>Histórico de aplicações e restaurações</summary>
      <ul>{history.map((event) => <li key={event.revision}>
        Revisão {event.revision}: {event.action} — {new Date(event.created).toLocaleString("pt-BR")}
        <small> · Usuário: {event.actor}</small>
      </li>)}</ul>
    </details> : null}
  </div>;
}
