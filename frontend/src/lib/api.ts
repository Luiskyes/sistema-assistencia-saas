Adicionar:

export interface AssistenciaAtual {
  id_assistencia: string;
  nome_assistencia: string;
  ativo: boolean;
}

Alterar:

export interface SessaoAtual {
  usuario: UsuarioAutenticado;
  assistencia: AssistenciaAtual;
}
