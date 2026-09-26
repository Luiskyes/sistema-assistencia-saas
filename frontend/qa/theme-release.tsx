// Fixture isolada do Vite: não integra o build de produção nem acessa banco/autenticação.
import { createRoot } from "react-dom/client";
import { ThemeRelease } from "../src/components/ThemeRelease";
import type { InstalledTheme, ReleaseReport } from "../src/lib/api";
import "../src/styles.css";
import "../src/dashboard.css";
import "../src/components/atualizacoes.css";

const themes = Object.fromEntries((["light", "dark"] as const).map((mode) => [mode,
  Object.fromEntries(["success", "success-bg", "success-hover", "info", "info-bg", "edit", "warning", "danger", "special"]
    .map((key) => ["--ls-sem-" + key, key.endsWith("bg") || key.endsWith("hover") || mode === "light" ? "#006414" : "#ffffff"]))
])) as ReleaseReport["themes"];
const report: ReleaseReport = { id: "fixture", created: new Date().toISOString(), sha256: "a".repeat(64),
  status: "TEMA_VALIDADO", version: "0.1.1", base_version: "0.1.0", errors: [], themes, expected_revision: 0, notes: "Simulação sem alterações no servidor." };
let state: InstalledTheme = { version: "0.1.0", revision: 0, themes: {}, release_id: null, can_restore: false };
window.fetch = async (input, init) => {
  const path = String(input);
  let result: unknown = state;
  let status = 200;
  if (path.endsWith("/previa")) result = report;
  else if (path.endsWith("/historico")) result = [];
  else if (path.endsWith("/aplicar") || path.endsWith("/restaurar")) {
    const body = JSON.parse(String(init?.body));
    if (body.revision !== state.revision) { status = 409; result = { detail: "O tema mudou. Atualize a prévia." }; }
    else {
      const applying = path.endsWith("/aplicar");
      state = { version: applying ? "0.1.1" : "0.1.0", revision: state.revision + 1,
        themes: applying ? themes! : {}, release_id: applying ? "fixture" : null, can_restore: applying };
      result = state;
    }
  } else if (!path.endsWith("/publico")) throw new Error("Acesso externo proibido nesta fixture.");
  return new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(<main className="release-panel" style={{ padding: 24, margin: "auto" }}>
  <h1>SIMULAÇÃO — nenhum dado real é alterado</h1>
  <article className="release-card"><ThemeRelease token="fixture" /></article>
  <article className="release-card"><ThemeRelease token="fixture" report={report} /></article>
</main>);
