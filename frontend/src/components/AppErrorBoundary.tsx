import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { falhou: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { falhou: false };

  static getDerivedStateFromError(): State {
    return { falhou: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha inesperada na interface", error, info.componentStack);
  }

  render() {
    if (!this.state.falhou) return this.props.children;

    return (
      <main className="unexpected-error-page" role="alert">
        <section className="unexpected-error-card">
          <span>Não foi possível exibir esta tela</span>
          <h1>O sistema encontrou um erro inesperado.</h1>
          <p>
            Seus dados não foram apagados. Atualize a página para carregar o sistema novamente.
            Se o problema continuar, informe em qual tela e ação ele aconteceu.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Atualizar página
          </button>
        </section>
      </main>
    );
  }
}
