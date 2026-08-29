import { useEffect, useState } from "react";
import {
  analisarVersao, enviarVersao, listarVersoes, mensagemErroUsuario, type ReleaseReport,
  consultarExecutor, testarRepositorio, type ExecutorState,
} from "../lib/api";
import "./atualizacoes.css";

const labels = {
  RECEBIDO: "Recebido — ainda não analisado",
  BLOQUEADO: "Bloqueado pela análise",
  AGUARDANDO_EXECUTOR: "Estrutura válida — aguardando testes isolados",
};

export function AtualizacoesPanel({ accessToken }: { accessToken: string }) {
  const [releases, setReleases] = useState<ReleaseReport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executor, setExecutor] = useState<ExecutorState | null>(null);
  const [executorNotice, setExecutorNotice] = useState<string | null>(null);

  async function checkExecutor() {
    setBusy(true);
    setError(null);
    setExecutor(null);
    try { setExecutor(await consultarExecutor(accessToken)); }
    catch (reason: unknown) { setError(mensagemErroUsuario(reason)); }
    finally { setBusy(false); }
  }

  async function runTests() {
    if (!executor?.commit) return;
    if (!window.confirm(`Executar testes do commit ${executor.commit.slice(0, 12)} no GitHub? Não publica nem valida o ZIP.`)) return;
    setBusy(true);
    setError(null);
    setExecutorNotice(null);
    try {
      const result = await testarRepositorio(accessToken, executor.commit);
      setExecutorNotice(result.notice);
    } catch (reason: unknown) { setError(mensagemErroUsuario(reason)); }
    finally { setBusy(false); setExecutor(null); }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listarVersoes(accessToken)
      .then((data) => { if (active) setReleases(data); })
      .catch((reason: unknown) => { if (active) setError(mensagemErroUsuario(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  async function upload() {
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith(".zip") || file.size > 10 * 1024 * 1024) {
      setError("Selecione um ZIP de até 10 MB, sem .env, node_modules ou .venv.");
      return;
    }
    setBusy(true);
    try {
      const report = await enviarVersao(accessToken, file);
      setReleases((current) => [report, ...current]);
    } catch (reason: unknown) {
      setError(mensagemErroUsuario(reason));
    } finally { setBusy(false); }
  }

  async function analyze(id: string) {
    setBusy(true);
    setError(null);
    try {
      const report = await analisarVersao(accessToken, id);
      setReleases((current) => current.map((item) => item.id === id ? report : item));
    } catch (reason: unknown) {
      setError(mensagemErroUsuario(reason));
    } finally { setBusy(false); }
  }

  function download(report: ReleaseReport) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${report.id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="release-panel">
    <header><span>EXCLUSIVO DA PLATAFORMA · HOMOLOGAÇÃO</span>
      <h2>Validação de versões</h2>
      <p>Enviar um arquivo não altera o sistema. Nenhum código enviado é executado nesta etapa.</p>
      <div className="release-flow" aria-label="Etapas de uma atualização segura">
        <span><b>1</b> Enviar</span><i>→</i><span><b>2</b> Analisar</span><i>→</i>
        <span><b>3</b> Testar</span><i>→</i><span><b>4</b> Aplicar</span>
      </div>
    </header>
    <div className="release-warning" role="status">
      Os testes do repositório são separados da análise do ZIP. Compatibilidade, testes do
      pacote e aplicação permanecem bloqueados. Nenhum resultado abaixo libera publicação.
    </div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <article className="release-card">
      <h3>Executor GitHub Actions — código do repositório</h3>
      <p>Roda Ruff, testes backend, TypeScript e build fora do seu computador, sem banco real.</p>
      <div className="release-actions">
        <button type="button" className="release-connect-action" disabled={busy} onClick={() => void checkExecutor()}>
          Consultar conexão e resultados
        </button>
        <button type="button" className="release-test-action" disabled={busy || !executor?.conectado || !executor.commit}
          onClick={() => void runTests()}>Executar testes do repositório</button>
      </div>
      {executorNotice ? <p role="status">{executorNotice}</p> : null}
      {executor && !executor.conectado ? <p role="status">
        Conexão pendente: configure token e referência no backend de homologação.
      </p> : null}
      {executor?.conectado ? <>
        <p>Referência: {executor.referencia}</p>
        <small className="release-hash">Commit: {executor.commit}</small>
        {executor.runs.length === 0 ? <p>Nenhuma execução encontrada.</p> : null}
        <ul>{executor.runs.map((run) => <li key={run.id}>
          <a href={run.url} target="_blank" rel="noreferrer">Execução #{run.id}</a>
          {` — ${run.status} / ${run.conclusion ?? "aguardando resultado"} — ${run.commit.slice(0, 12)}`}
        </li>)}</ul>
      </> : null}
    </article>
    <div className="release-upload">
      <label htmlFor="release-file">Pacote ZIP com release.json na raiz (máximo 10 MB)</label>
      <input id="release-file" type="file" accept=".zip" disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <button type="button" className="primary-action release-upload-action" disabled={!file || busy}
        onClick={() => void upload()}>{busy ? "Processando..." : "Enviar para quarentena"}</button>
    </div>
    {loading ? <p role="status">Carregando versões...</p> : null}
    {!loading && !error && !releases.length ? <p>Nenhuma versão enviada.</p> : null}
    {releases.map((report) => <article key={report.id} className="release-card">
      <h3>{report.version || "Versão não analisada"}</h3>
      <strong>{labels[report.status]}</strong>
      <p>Enviado em {new Date(report.created).toLocaleString("pt-BR")}</p>
      <small className="release-hash">SHA-256: {report.sha256}</small>
      {report.errors.length ? <ul>{report.errors.map((message, i) => <li key={i}>{message}</li>)}</ul> : null}
      <dl>{Object.entries(report.checks ?? {}).map(([check, state]) =>
        <div key={check}><dt>{check}</dt><dd>{state.replaceAll("_", " ")}</dd></div>)}</dl>
      {report.notice ? <p>{report.notice}</p> : null}
      <div className="release-actions">
        <button type="button" className="release-analyze-action" disabled={busy} onClick={() => void analyze(report.id)}>Analisar estrutura</button>
        <button type="button" className="release-report-action" onClick={() => download(report)}>Baixar relatório</button>
        <button type="button" className="release-apply-action" disabled title="Aguardando executor isolado e testes">Aplicar na homologação</button>
      </div>
    </article>)}
  </section>;
}
