import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  adicionarItemOrdem,
  alterarStatusOrdem,
  atualizarCompraExterna,
  atualizarOrdem,
  cancelarManutencaoOrdem,
  criarCliente,
  criarEquipamento,
  criarOrdem,
  emitirPreNotaPdf,
  listarClientes,
  listarEquipamentos,
  listarEstoque,
  listarHistoricoOrdem,
  listarItensOrdem,
  listarOrdens,
  listarUsuariosOperacionais,
  mensagemErroUsuario,
  removerItemOrdem,
  type Cliente,
  type DestinoPecasCancelamento,
  type Equipamento,
  type EstoqueItem,
  type FuncaoUsuario,
  type HistoricoOS,
  type OrdemServico,
  type OrdemItemOS,
  type PrioridadeOS,
  type StatusOS,
  type StatusCompraExterna,
  type UsuarioOperacional,
} from "../lib/api";
import { CORES_EQUIPAMENTO, MARCAS_EQUIPAMENTO, modelosParaMarca } from "../lib/equipmentPresets";
import { PresetSelect } from "./PresetSelect";

import "../pre-nota-preview.css";

type Props = {
  accessToken: string;
  funcao: FuncaoUsuario;
  nomeAssistencia: string;
  clienteInicialId?: string | null;
  abrirNovaNonce?: number;
};

type ClienteRapidoForm = {
  nome: string;
  cpf: string;
  telefone: string;
  endereco: string;
};

type EquipamentoRapidoForm = {
  marca: string;
  modelo: string;
  cor: string;
  serie: string;
  descricao: string;
};

type CampoBuscaOS =
  | "num_os"
  | "cliente"
  | "equipamento"
  | "status"
  | "tecnico"
  | "prioridade"
  | "defeito";

const CAMPOS_BUSCA_OS: Array<{
  value: CampoBuscaOS;
  label: string;
  help: string;
}> = [
  { value: "num_os", label: "Número da OS", help: "Ex.: OS-000123" },
  { value: "cliente", label: "Cliente", help: "Nome ou documento" },
  { value: "equipamento", label: "Equipamento", help: "Marca, modelo ou série" },
  { value: "status", label: "Status", help: "Em análise, concluído..." },
  { value: "tecnico", label: "Técnico", help: "Responsável pelo atendimento" },
  { value: "prioridade", label: "Prioridade", help: "Baixa, normal, alta, urgente" },
  { value: "defeito", label: "Relato", help: "Defeito informado pelo cliente" },
];

const CAMPOS_BUSCA_PADRAO: CampoBuscaOS[] = [
  "num_os",
  "cliente",
  "equipamento",
  "defeito",
  "status",
];

const CLIENTE_RAPIDO_VAZIO: ClienteRapidoForm = {
  nome: "",
  cpf: "",
  telefone: "",
  endereco: "",
};

const EQUIPAMENTO_RAPIDO_VAZIO: EquipamentoRapidoForm = {
  marca: "",
  modelo: "",
  cor: "",
  serie: "",
  descricao: "",
};

const DEFEITOS_COMUNS = [
  "Não liga",
  "Não carrega",
  "Bateria descarrega rápido",
  "Não reconhece carregador",
  "Tela sem imagem",
  "Tela quebrada",
  "Imagem piscando",
  "Touch não funciona",
  "Desliga sozinho",
  "Reiniciando sozinho",
  "Travando ou lento",
  "Superaquecendo",
  "Sem áudio",
  "Microfone não funciona",
  "Câmera não funciona",
  "Teclado não funciona",
  "Botões não funcionam",
  "Não conecta ao Wi-Fi",
  "Não reconhece USB",
  "Fazendo barulho",
  "Contato com líquido",
  "Conector danificado",
  "Carcaça quebrada",
] as const;

const DIAGNOSTICOS_COMUNS = [
  "Falha no circuito de alimentação",
  "Conector de carga danificado",
  "Bateria degradada",
  "Tela ou display danificado",
  "Sistema operacional corrompido",
  "Componente em curto",
  "Oxidação por contato com líquido",
  "Superaquecimento por acúmulo de sujeira",
  "Falha na memória ou armazenamento",
  "Necessita testes adicionais",
] as const;

const SERVICOS_SEM_PECA = [
  "Avaliação técnica e elaboração de orçamento",
  "Diagnóstico técnico e testes",
  "Limpeza interna preventiva",
  "Limpeza do sistema de refrigeração",
  "Desobstrução e limpeza do conector de carga",
  "Troca de pasta térmica",
  "Remoção de oxidação superficial",
  "Formatação e reinstalação do sistema",
  "Otimização de sistema lento ou travando",
  "Atualização de sistema, drivers e firmware",
  "Remoção de vírus e programas indesejados",
  "Backup e restauração de dados",
  "Configuração de Wi-Fi e rede",
  "Configuração de áudio, câmera ou microfone",
  "Configuração e testes de periféricos USB",
  "Instalação e configuração de aplicativos",
  "Criação e configuração de contas de usuário",
  "Recuperação de acesso e redefinição de senha",
  "Organização e transferência de arquivos",
  "Clonagem de sistema ou armazenamento",
  "Configuração de impressora e periféricos",
  "Configuração de e-mail e aplicativos de comunicação",
  "Teste de estabilidade e desempenho",
  "Higienização externa do equipamento",
  "Orientação e suporte técnico ao cliente",
] as const;

const OS_TABLE_GRID_TEMPLATE = [
  "minmax(96px, .8fr)",
  "minmax(160px, 1.35fr)",
  "minmax(155px, 1.3fr)",
  "minmax(105px, .85fr)",
  "minmax(90px, .7fr)",
  "minmax(155px, 1.08fr)",
  "minmax(120px, .9fr)",
  "minmax(175px, 1.12fr)",
].join(" ");

const statusLabels: Record<StatusOS, string> = {
  RECEBIDO: "Recebido",
  EM_ANALISE: "Em análise",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  EM_MANUTENCAO: "Em manutenção",
  CONCLUIDO: "Concluído",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const statusCompraLabels: Record<StatusCompraExterna, string> = {
  SOLICITADA: "Solicitada",
  COMPRADA: "Comprada",
  RECEBIDA: "Recebida",
  CANCELADA: "Cancelada",
};

const proximosStatus: Record<FuncaoUsuario, Partial<Record<StatusOS, StatusOS[]>>> = {
  DONO: {
    RECEBIDO: ["EM_ANALISE", "CANCELADO"],
    EM_ANALISE: ["AGUARDANDO_APROVACAO", "CANCELADO"],
    AGUARDANDO_APROVACAO: ["EM_MANUTENCAO", "CANCELADO"],
    EM_MANUTENCAO: ["CONCLUIDO", "CANCELADO"],
    CONCLUIDO: ["ENTREGUE"],
  },
  TECNICO: {
    RECEBIDO: ["EM_ANALISE"],
    EM_ANALISE: ["AGUARDANDO_APROVACAO"],
    EM_MANUTENCAO: ["CONCLUIDO"],
  },
  RECEPCIONISTA: {
    RECEBIDO: ["CANCELADO"],
    AGUARDANDO_APROVACAO: ["EM_MANUTENCAO", "CANCELADO"],
    CONCLUIDO: ["ENTREGUE"],
  },
};

type AcaoFluxo = {
  label: string;
  tituloConfirmacao: string;
  descricaoConfirmacao: string;
  confirmar: string;
};

const proximosPassos: Record<StatusOS, { titulo: string; descricao: string }> = {
  RECEBIDO: { titulo: "Iniciar a análise do equipamento", descricao: "O cliente já deixou o equipamento. Agora a equipe deve iniciar os testes e registrar o diagnóstico." },
  EM_ANALISE: { titulo: "Preparar o orçamento para o cliente", descricao: "Registre o diagnóstico e o valor. Depois, gere a pré-nota para solicitar a aprovação do cliente." },
  AGUARDANDO_APROVACAO: { titulo: "Registrar a resposta do cliente", descricao: "Confirme se o cliente aprovou o orçamento ou se decidiu não realizar o serviço." },
  EM_MANUTENCAO: { titulo: "Executar e finalizar o serviço", descricao: "Realize o reparo aprovado e, após os testes finais, marque a OS como concluída." },
  CONCLUIDO: { titulo: "Avisar o cliente e registrar a entrega", descricao: "O equipamento está pronto. Após a retirada, registre a entrega para encerrar o atendimento." },
  ENTREGUE: { titulo: "Atendimento encerrado", descricao: "O equipamento foi entregue e a jornada desta OS está concluída." },
  CANCELADO: { titulo: "Atendimento cancelado", descricao: "Esta OS não seguirá para manutenção. O histórico permanece disponível para consulta." },
};

function acaoFluxo(statusAtual: StatusOS, statusNovo: StatusOS): AcaoFluxo {
  if (statusNovo === "CANCELADO") {
    const recusado = statusAtual === "AGUARDANDO_APROVACAO";
    return {
      label: recusado ? "Cliente não aprovou" : "Cancelar OS",
      tituloConfirmacao: recusado ? "Registrar recusa do orçamento?" : "Cancelar esta OS?",
      descricaoConfirmacao: recusado
        ? "A decisão do cliente será registrada e o atendimento será encerrado."
        : "O cancelamento será registrado no histórico e encerrará o fluxo desta OS.",
      confirmar: recusado ? "Sim, registrar recusa" : "Sim, cancelar OS",
    };
  }

  const acoes: Partial<Record<StatusOS, AcaoFluxo>> = {
    EM_ANALISE: { label: "Iniciar análise", tituloConfirmacao: "Iniciar a análise técnica?", descricaoConfirmacao: "A OS será encaminhada para diagnóstico e orçamento.", confirmar: "Sim, iniciar análise" },
    AGUARDANDO_APROVACAO: { label: "Enviar orçamento ao cliente", tituloConfirmacao: "Enviar para aprovação?", descricaoConfirmacao: "A OS ficará aguardando a resposta do cliente sobre o orçamento.", confirmar: "Sim, aguardar aprovação" },
    EM_MANUTENCAO: {
      label: statusAtual === "AGUARDANDO_APROVACAO" ? "Cliente aprovou" : "Iniciar manutenção",
      tituloConfirmacao: statusAtual === "AGUARDANDO_APROVACAO" ? "Confirmar aprovação do cliente?" : "Iniciar a manutenção?",
      descricaoConfirmacao: statusAtual === "AGUARDANDO_APROVACAO" ? "A aprovação ficará registrada e o equipamento seguirá para manutenção." : "A OS seguirá para execução do serviço.",
      confirmar: statusAtual === "AGUARDANDO_APROVACAO" ? "Sim, cliente aprovou" : "Sim, iniciar manutenção",
    },
    CONCLUIDO: { label: "Finalizar serviço", tituloConfirmacao: "Marcar o serviço como concluído?", descricaoConfirmacao: "Confirme apenas após finalizar o reparo e os testes do equipamento.", confirmar: "Sim, finalizar serviço" },
    ENTREGUE: { label: "Registrar entrega", tituloConfirmacao: "Confirmar entrega ao cliente?", descricaoConfirmacao: "Esta ação registra que o cliente recebeu o equipamento e encerra a OS.", confirmar: "Sim, registrar entrega" },
  };

  return acoes[statusNovo] ?? { label: `Avançar para ${statusLabels[statusNovo]}`, tituloConfirmacao: "Confirmar próxima etapa?", descricaoConfirmacao: "A mudança será registrada no histórico da OS.", confirmar: "Sim, confirmar" };
}

function erroTexto(error: unknown) {
  return mensagemErroUsuario(error);
}

function dataHora(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function somenteDigitos(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function descricaoEquipamento(equipamento: Equipamento) {
  return (
    [equipamento.marca_equip, equipamento.modelo_equip, equipamento.num_serie]
      .filter(Boolean)
      .join(" • ") || "Equipamento sem identificação"
  );
}


function moedaBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function numeroOrcamento(value: string) {
  const normalizado = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
}

function formatarPrioridade(prioridade: PrioridadeOS) {
  const texto = prioridade.toLocaleLowerCase("pt-BR").replace("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function OrdensPanel({
  accessToken,
  funcao,
  nomeAssistencia,
  clienteInicialId = null,
  abrirNovaNonce = 0,
}: Props) {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOperacional[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [selecionada, setSelecionada] = useState<OrdemServico | null>(null);
  const [historico, setHistorico] = useState<HistoricoOS[]>([]);
  const [itensOrcamento, setItensOrcamento] = useState<OrdemItemOS[]>([]);
  const [busca, setBusca] = useState("");
  const [filtrosBuscaAbertos, setFiltrosBuscaAbertos] = useState(false);
  const [camposBusca, setCamposBusca] = useState<CampoBuscaOS[]>(CAMPOS_BUSCA_PADRAO);
  const [camposBuscaRascunho, setCamposBuscaRascunho] = useState<CampoBuscaOS[]>(CAMPOS_BUSCA_PADRAO);
  const [statusFiltro, setStatusFiltro] = useState<StatusOS | "TODOS">("TODOS");
  const [ordenacao, setOrdenacao] = useState<"recentes" | "antigas" | "prioridade">("recentes");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [modoDetalhe, setModoDetalhe] = useState<"visualizar" | "alterar" | null>(null);
  const [statusParaConfirmar, setStatusParaConfirmar] = useState<StatusOS | null>(null);
  const [destinoCancelamento, setDestinoCancelamento] =
    useState<DestinoPecasCancelamento>("DEVOLVER_ESTOQUE");

  const [clienteId, setClienteId] = useState("");
  const [equipId, setEquipId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [cadastroClienteAberto, setCadastroClienteAberto] = useState(false);
  const [clienteRapido, setClienteRapido] =
    useState<ClienteRapidoForm>(CLIENTE_RAPIDO_VAZIO);
  const [mensagemCliente, setMensagemCliente] = useState<string | null>(null);

  const [cadastroEquipAberto, setCadastroEquipAberto] = useState(false);
  const [equipamentoRapido, setEquipamentoRapido] =
    useState<EquipamentoRapidoForm>(EQUIPAMENTO_RAPIDO_VAZIO);
  const [mensagemEquipamento, setMensagemEquipamento] = useState<string | null>(null);

  const [tecnicoId, setTecnicoId] = useState("");
  const [defeito, setDefeito] = useState("");
  const [observacao, setObservacao] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeOS>("NORMAL");
  const [diagnostico, setDiagnostico] = useState("");
  const [orcamento, setOrcamento] = useState("0,00");
  const [tecnicoEdicaoId, setTecnicoEdicaoId] = useState("");
  const [gerandoPreNota, setGerandoPreNota] = useState(false);
  const [preNotaVisualAberta, setPreNotaVisualAberta] = useState(false);
  const [tipoNovoItem, setTipoNovoItem] = useState<
    "SERVICO" | "PECA_ESTOQUE" | "PECA_FORNECEDOR"
  >("SERVICO");
  const [pecaId, setPecaId] = useState("");
  const [descricaoServico, setDescricaoServico] = useState("");
  const [quantidadeItem, setQuantidadeItem] = useState("1");
  const [valorItem, setValorItem] = useState("0,00");
  const [pecaFornecedor, setPecaFornecedor] = useState("");
  const [fornecedorItem, setFornecedorItem] = useState("");
  const [custoItem, setCustoItem] = useState("0,00");

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    void Promise.all([
      listarOrdens(accessToken),
      listarClientes(accessToken),
      listarEquipamentos(accessToken),
      listarUsuariosOperacionais(accessToken),
      listarEstoque(accessToken),
    ])
      .then(([ordensData, clientesData, equipamentosData, usuariosData, estoqueData]) => {
        if (!ativo) return;
        setOrdens(ordensData);
        setClientes(clientesData);
        setEquipamentos(equipamentosData);
        setUsuarios(usuariosData);
        setEstoque(estoqueData);
      })
      .catch((error: unknown) => {
        if (ativo) setErro(erroTexto(error));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (abrirNovaNonce <= 0) return;

    setNovoAberto(true);
    setClienteId(clienteInicialId ?? "");
    setEquipId("");
    setBuscaCliente("");
    setCadastroClienteAberto(false);
    setCadastroEquipAberto(false);
    setMensagemCliente(null);
    setMensagemEquipamento(null);
  }, [abrirNovaNonce, clienteInicialId]);

  useEffect(() => {
    if (!selecionada) {
      setHistorico([]);
      setItensOrcamento([]);
      setDiagnostico("");
      setTecnicoEdicaoId("");
      return;
    }

    setDiagnostico(selecionada.diag_os ?? "");
    setTecnicoEdicaoId(selecionada.id_tecnico_responsavel ?? "");
    setOrcamento(
      Number(selecionada.valor_total ?? 0)
        .toFixed(2)
        .replace(".", ","),
    );
    void listarHistoricoOrdem(accessToken, selecionada.id_os)
      .then(setHistorico)
      .catch(() => setHistorico([]));
    void listarItensOrdem(accessToken, selecionada.id_os).then((itensData) => {
      setItensOrcamento(itensData);
      if (itensData.length > 0) {
        const total = itensData.reduce((soma, item) => soma + Number(item.subtotal), 0);
        setOrcamento(total.toFixed(2).replace(".", ","));
      }
    }).catch(() => setItensOrcamento([]));
  }, [accessToken, selecionada]);

  const clientesPorId = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id_cliente, cliente])),
    [clientes],
  );

  const equipamentosPorId = useMemo(
    () =>
      new Map(
        equipamentos.map((equipamento) => [equipamento.id_equip, equipamento]),
      ),
    [equipamentos],
  );

  const estoqueCompativel = useMemo(() => {
    if (!selecionada) return [];
    const equipamento = equipamentosPorId.get(selecionada.id_equip);
    if (!equipamento) return [];
    const marca = (equipamento.marca_equip ?? "").toLocaleLowerCase("pt-BR");
    const modelo = (equipamento.modelo_equip ?? "").toLocaleLowerCase("pt-BR");

    return estoque
      .filter((item) => {
        if (!item.ativo) return false;
        const marcaItem = (item.marca_compativel ?? "").toLocaleLowerCase("pt-BR");
        const modeloItem = (item.modelo_compativel ?? "").toLocaleLowerCase("pt-BR");
        if (!marcaItem && !modeloItem) return true;
        const marcaCombina =
          !marcaItem || Boolean(marca && (marca.includes(marcaItem) || marcaItem.includes(marca)));
        const modeloCombina =
          !modeloItem || Boolean(modelo && (modelo.includes(modeloItem) || modeloItem.includes(modelo)));
        return marcaCombina && modeloCombina;
      })
      .slice(0, 8);
  }, [equipamentosPorId, estoque, selecionada]);

  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((usuario) => [usuario.id_usuario, usuario])),
    [usuarios],
  );

  const equipamentosCliente = useMemo(
    () =>
      equipamentos.filter(
        (equipamento) => equipamento.id_cliente === clienteId,
      ),
    [equipamentos, clienteId],
  );

  const tecnicos = useMemo(
    () =>
      usuarios.filter(
        (usuario) =>
          usuario.funcao_usuario === "TECNICO" ||
          usuario.funcao_usuario === "DONO",
      ),
    [usuarios],
  );


  const resumoOS = useMemo(() => {
    const total = ordens.length;
    return {
      total,
      emAnalise: ordens.filter((ordem) => ordem.status_os === "EM_ANALISE").length,
      aguardandoAprovacao: ordens.filter(
        (ordem) => ordem.status_os === "AGUARDANDO_APROVACAO",
      ).length,
      finalizadas: ordens.filter(
        (ordem) => ordem.status_os === "CONCLUIDO" || ordem.status_os === "ENTREGUE",
      ).length,
    };
  }, [ordens]);

  const camposBuscaAtivos = useMemo(
    () =>
      CAMPOS_BUSCA_OS.filter((campo) => camposBusca.includes(campo.value)),
    [camposBusca],
  );

  const placeholderBusca = useMemo(() => {
    if (camposBuscaAtivos.length === 0) {
      return "Escolha ao menos um filtro de pesquisa.";
    }

    return `Pesquisar em: ${camposBuscaAtivos
      .map((campo) => campo.label)
      .join(", ")}...`;
  }, [camposBuscaAtivos]);

  const clientesEncontrados = useMemo(() => {
    const termo = buscaCliente.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return clientes.slice(0, 8);

    const digits = somenteDigitos(termo);
    return clientes
      .filter((cliente) => {
        const alvo = [
          cliente.nome_cliente,
          cliente.cpf_cliente,
          cliente.telefone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR");

        if (alvo.includes(termo)) return true;
        if (!digits) return false;

        return (
          somenteDigitos(cliente.cpf_cliente).includes(digits) ||
          somenteDigitos(cliente.telefone).includes(digits)
        );
      })
      .slice(0, 8);
  }, [buscaCliente, clientes]);

  const ordensFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    const filtradas = ordens.filter((ordem) => {
      if (statusFiltro !== "TODOS" && ordem.status_os !== statusFiltro) {
        return false;
      }

      if (!termo) return true;
      if (camposBusca.length === 0) return false;

      const cliente = clientesPorId.get(ordem.id_cliente);
      const equipamento = equipamentosPorId.get(ordem.id_equip);
      const tecnico = ordem.id_tecnico_responsavel
        ? usuariosPorId.get(ordem.id_tecnico_responsavel)
        : null;

      const mapa: Record<CampoBuscaOS, string> = {
        num_os: ordem.num_os ?? "",
        cliente: [
          cliente?.nome_cliente,
          cliente?.cpf_cliente,
          cliente?.telefone,
        ]
          .filter(Boolean)
          .join(" "),
        equipamento: [
          equipamento?.marca_equip,
          equipamento?.modelo_equip,
          equipamento?.num_serie,
          equipamento?.descr_equip,
        ]
          .filter(Boolean)
          .join(" "),
        status: statusLabels[ordem.status_os],
        tecnico: tecnico?.nome_usuario ?? "Não atribuído",
        prioridade: formatarPrioridade(ordem.prioridade_os),
        defeito: ordem.defeito_relatorio ?? "",
      };

      return camposBusca.some((campo) =>
        mapa[campo].toLocaleLowerCase("pt-BR").includes(termo),
      );
    });

    const pesoPrioridade: Record<PrioridadeOS, number> = {
      URGENTE: 4,
      ALTA: 3,
      NORMAL: 2,
      BAIXA: 1,
    };

    return [...filtradas].sort((a, b) => {
      if (ordenacao === "prioridade") {
        return pesoPrioridade[b.prioridade_os] - pesoPrioridade[a.prioridade_os];
      }

      const dataA = new Date(a.data_aber).getTime();
      const dataB = new Date(b.data_aber).getTime();

      return ordenacao === "antigas" ? dataA - dataB : dataB - dataA;
    });
  }, [
    busca,
    camposBusca,
    clientesPorId,
    equipamentosPorId,
    ordens,
    ordenacao,
    statusFiltro,
    usuariosPorId,
  ]);

  function resetarNovaOS() {
    setClienteId("");
    setEquipId("");
    setBuscaCliente("");
    setCadastroClienteAberto(false);
    setClienteRapido(CLIENTE_RAPIDO_VAZIO);
    setMensagemCliente(null);
    setCadastroEquipAberto(false);
    setEquipamentoRapido(EQUIPAMENTO_RAPIDO_VAZIO);
    setMensagemEquipamento(null);
    setTecnicoId("");
    setDefeito("");
    setObservacao("");
    setPrioridade("NORMAL");
  }

  function abrirModalNovaOS(clienteInicial?: string | null) {
    resetarNovaOS();
    setClienteId(clienteInicial ?? "");
    setNovoAberto(true);
  }

  function fecharModalNovaOS() {
    if (salvando) return;
    setNovoAberto(false);
    resetarNovaOS();
  }

  function abrirVisualizacao(ordem: OrdemServico) {
    setSelecionada(ordem);
    setModoDetalhe("visualizar");
  }

  function abrirAlteracao(ordem: OrdemServico) {
    setSelecionada(ordem);
    setModoDetalhe("alterar");
  }

  function fecharDetalhe() {
    setSelecionada(null);
    setModoDetalhe(null);
    setStatusParaConfirmar(null);
  }

  function solicitarMudancaStatus(status: StatusOS) {
    if (status === "CANCELADO") setDestinoCancelamento("DEVOLVER_ESTOQUE");
    setStatusParaConfirmar(status);
  }


  function abrirFiltrosBusca() {
    setCamposBuscaRascunho(camposBusca);
    setFiltrosBuscaAbertos(true);
  }

  function fecharFiltrosBusca() {
    setCamposBuscaRascunho(camposBusca);
    setFiltrosBuscaAbertos(false);
  }

  function alternarCampoBuscaRascunho(campo: CampoBuscaOS) {
    setCamposBuscaRascunho((atual) => {
      if (atual.includes(campo)) {
        if (atual.length === 1) return atual;
        return atual.filter((item) => item !== campo);
      }
      return [...atual, campo];
    });
  }

  function aplicarFiltrosBusca() {
    setCamposBusca(camposBuscaRascunho);
    setFiltrosBuscaAbertos(false);
  }

  function restaurarFiltrosPadrao() {
    setCamposBuscaRascunho(CAMPOS_BUSCA_PADRAO);
  }

  function atualizarNaLista(ordem: OrdemServico) {
    setOrdens((atual) => {
      const existe = atual.some((item) => item.id_os === ordem.id_os);
      return existe
        ? atual.map((item) => (item.id_os === ordem.id_os ? ordem : item))
        : [ordem, ...atual];
    });
    setSelecionada((atual) =>
      atual?.id_os === ordem.id_os ? ordem : atual,
    );
  }

  async function cadastrarClienteRapido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nome = clienteRapido.nome.trim();
    if (nome.length < 2) {
      setMensagemCliente("Informe o nome do cliente.");
      return;
    }

    const cpfDigitado = somenteDigitos(clienteRapido.cpf);
    if (cpfDigitado) {
      const existente = clientes.find(
        (cliente) => somenteDigitos(cliente.cpf_cliente) === cpfDigitado,
      );

      if (existente) {
        setClienteId(existente.id_cliente);
        setEquipId("");
        setCadastroClienteAberto(false);
        setMensagemCliente(
          `Cliente já cadastrado. ${existente.nome_cliente} foi selecionado automaticamente.`,
        );
        return;
      }
    }

    setSalvando(true);
    setMensagemCliente(null);

    try {
      const criado = await criarCliente(accessToken, {
        nome_cliente: nome,
        cpf_cliente: clienteRapido.cpf.trim() || null,
        telefone: clienteRapido.telefone.trim() || null,
        endereco_cliente: clienteRapido.endereco.trim() || null,
      });

      setClientes((atuais) => [criado, ...atuais]);
      setClienteId(criado.id_cliente);
      setEquipId("");
      setCadastroClienteAberto(false);
      setClienteRapido(CLIENTE_RAPIDO_VAZIO);
      setMensagemCliente("Cliente cadastrado e selecionado. Continue com o equipamento.");
    } catch (error: unknown) {
      setMensagemCliente(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarEquipamentoRapido(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!clienteId) {
      setMensagemEquipamento("Selecione um cliente antes de cadastrar o equipamento.");
      return;
    }

    const serie = equipamentoRapido.serie.trim();
    if (serie) {
      const existente = equipamentosCliente.find(
        (equipamento) =>
          (equipamento.num_serie ?? "").trim().toLocaleLowerCase("pt-BR") ===
          serie.toLocaleLowerCase("pt-BR"),
      );

      if (existente) {
        setEquipId(existente.id_equip);
        setCadastroEquipAberto(false);
        setMensagemEquipamento(
          "Este número de série já está cadastrado para o cliente. O equipamento existente foi selecionado.",
        );
        return;
      }
    }

    if (
      !equipamentoRapido.marca.trim() &&
      !equipamentoRapido.modelo.trim() &&
      !equipamentoRapido.descricao.trim()
    ) {
      setMensagemEquipamento(
        "Informe pelo menos marca, modelo ou uma descrição do equipamento.",
      );
      return;
    }

    setSalvando(true);
    setMensagemEquipamento(null);

    try {
      const criado = await criarEquipamento(accessToken, {
        id_cliente: clienteId,
        marca_equip: equipamentoRapido.marca.trim() || null,
        modelo_equip: equipamentoRapido.modelo.trim() || null,
        cor_equip: equipamentoRapido.cor.trim() || null,
        num_serie: serie || null,
        descr_equip: equipamentoRapido.descricao.trim() || null,
      });

      setEquipamentos((atuais) => [criado, ...atuais]);
      setEquipId(criado.id_equip);
      setCadastroEquipAberto(false);
      setEquipamentoRapido(EQUIPAMENTO_RAPIDO_VAZIO);
      setMensagemEquipamento(
        "Equipamento cadastrado e selecionado. Finalize os dados do atendimento.",
      );
    } catch (error: unknown) {
      setMensagemEquipamento(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function abrirOrdem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clienteId || !equipId) {
      setErro("Selecione cliente e equipamento antes de abrir a OS.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const ordem = await criarOrdem(accessToken, {
        id_cliente: clienteId,
        id_equip: equipId,
        id_tecnico_responsavel: tecnicoId || null,
        defeito_relatorio: defeito,
        obser_os: observacao || null,
        prioridade_os: prioridade,
      });

      atualizarNaLista(ordem);
      setNovoAberto(false);
      resetarNovaOS();
      setSelecionada(ordem);
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarDiagnosticoEOrcamento() {
    if (!selecionada) return;

    setSalvando(true);
    setErro(null);

    try {
      const ordem = await atualizarOrdem(accessToken, selecionada.id_os, {
        diag_os: diagnostico || null,
        valor_total: numeroOrcamento(orcamento),
        ...(funcao === "DONO"
          ? { id_tecnico_responsavel: tecnicoEdicaoId || null }
          : {}),
      });
      atualizarNaLista(ordem);
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarItemAoOrcamento() {
    if (!selecionada) return;
    const quantidade = Number(quantidadeItem.replace(",", "."));
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setErro("Informe uma quantidade válida.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const item = await adicionarItemOrdem(accessToken, selecionada.id_os, {
        tipo: tipoNovoItem === "SERVICO" ? "SERVICO" : "PECA",
        quantidade,
        ...(tipoNovoItem === "PECA_ESTOQUE"
          ? { id_item_estoque: pecaId, valor_unitario: numeroOrcamento(valorItem) }
          : tipoNovoItem === "PECA_FORNECEDOR"
            ? {
                descricao: pecaFornecedor,
                fornecedor: fornecedorItem || null,
                ...(funcao === "DONO" ? { custo_unitario: numeroOrcamento(custoItem) } : {}),
                valor_unitario: numeroOrcamento(valorItem),
              }
            : { descricao: descricaoServico, valor_unitario: numeroOrcamento(valorItem) }),
      });
      const novosItens = [...itensOrcamento, item];
      setItensOrcamento(novosItens);
      const total = novosItens.reduce((soma, atual) => soma + Number(atual.subtotal), 0);
      setOrcamento(total.toFixed(2).replace(".", ","));
      setDescricaoServico("");
      setQuantidadeItem("1");
      setValorItem("0,00");
      setPecaId("");
      setPecaFornecedor("");
      setFornecedorItem("");
      setCustoItem("0,00");
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function removerItemDoOrcamento(item: OrdemItemOS) {
    if (!selecionada) return;
    setSalvando(true);
    try {
      await removerItemOrdem(accessToken, selecionada.id_os, item.id_item_os);
      const novosItens = itensOrcamento.filter((atual) => atual.id_item_os !== item.id_item_os);
      setItensOrcamento(novosItens);
      const total = novosItens.reduce((soma, atual) => soma + Number(atual.subtotal), 0);
      setOrcamento(total.toFixed(2).replace(".", ","));
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  function preNotaDisponivel(ordem: OrdemServico | null) {
    return Boolean(
      ordem?.diag_os?.trim() && Number(ordem?.valor_total ?? 0) > 0,
    );
  }

  async function salvarEVisualizarPreNota() {
    if (!selecionada) return;
    if (!diagnostico.trim()) {
      setErro("Selecione ou informe o diagnóstico técnico.");
      return;
    }
    if (numeroOrcamento(orcamento) <= 0) {
      setErro("Adicione ao menos um serviço ou informe um valor maior que zero.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const ordem = await atualizarOrdem(accessToken, selecionada.id_os, {
        diag_os: diagnostico,
        valor_total: numeroOrcamento(orcamento),
        ...(funcao === "DONO"
          ? { id_tecnico_responsavel: tecnicoEdicaoId || null }
          : {}),
      });
      atualizarNaLista(ordem);
      setSelecionada(ordem);
      setPreNotaVisualAberta(true);
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  function visualizarPreNota() {
    if (!selecionada || !preNotaDisponivel(selecionada)) return;
    setPreNotaVisualAberta(true);
  }

  async function imprimirPreNota() {
    if (!selecionada) return;

    const pdfWindow = window.open("", "_blank");

    if (!pdfWindow) {
      setErro(
        "O navegador bloqueou a abertura do PDF. Permita pop-ups para o LSAssist e tente novamente.",
      );
      return;
    }

    pdfWindow.opener = null;
    pdfWindow.document.title = `Pré-nota ${selecionada.num_os}`;
    pdfWindow.document.body.innerHTML =
      '<p style="font-family:Arial,sans-serif;padding:20px">Gerando pré-nota...</p>';

    setGerandoPreNota(true);
    setErro(null);

    const statusAnterior = selecionada.status_os;

    try {
      const pdf = await emitirPreNotaPdf(accessToken, selecionada.id_os);
      const url = URL.createObjectURL(pdf);

      pdfWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);

      if (
        statusAnterior === "RECEBIDO" ||
        statusAnterior === "EM_ANALISE"
      ) {
        const ordemAtualizada: OrdemServico = {
          ...selecionada,
          status_os: "AGUARDANDO_APROVACAO",
        };

        atualizarNaLista(ordemAtualizada);
        setSelecionada(ordemAtualizada);
      }

      const hist = await listarHistoricoOrdem(
        accessToken,
        selecionada.id_os,
      );
      setHistorico(hist);
    } catch (error: unknown) {
      if (!pdfWindow.closed) {
        pdfWindow.close();
      }
      setErro(erroTexto(error));
    } finally {
      setGerandoPreNota(false);
    }
  }

  async function mudarStatus(novo: StatusOS) {
    if (!selecionada) return;

    setSalvando(true);
    setErro(null);

    try {
      const ordem = selecionada.status_os === "EM_MANUTENCAO" && novo === "CANCELADO"
        ? await cancelarManutencaoOrdem(accessToken, selecionada.id_os, destinoCancelamento)
        : await alterarStatusOrdem(accessToken, selecionada.id_os, novo);
      atualizarNaLista(ordem);
      setSelecionada(ordem);
      if (novo === "EM_MANUTENCAO") {
        setEstoque(await listarEstoque(accessToken));
      }
      const hist = await listarHistoricoOrdem(accessToken, selecionada.id_os);
      setHistorico(hist);
      setStatusParaConfirmar(null);
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatusCompra(item: OrdemItemOS, statusCompra: StatusCompraExterna) {
    if (!selecionada) return;
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await atualizarCompraExterna(
        accessToken,
        selecionada.id_os,
        item.id_item_os,
        statusCompra,
      );
      setItensOrcamento((atuais) =>
        atuais.map((atual) => atual.id_item_os === atualizado.id_item_os ? atualizado : atual),
      );
    } catch (error: unknown) {
      setErro(erroTexto(error));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="module-page os-page">
      <div className="module-toolbar">
        <div>
          <span className="page-kicker">Fluxo operacional</span>
          <h2>Ordens de Serviço</h2>
          <p>
            Abra o atendimento sem sair da tela: localize ou cadastre cliente e
            equipamento no mesmo fluxo.
          </p>
        </div>

        <button
          className="primary-action"
          type="button"
          onClick={() => abrirModalNovaOS()}
        >
          + Nova OS
        </button>
      </div>

      {erro ? <div className="module-alert module-alert-error">{erro}</div> : null}

      <section className="os-corporate-summary" aria-label="Resumo das ordens">
        <div>
          <span>Total</span>
          <strong>{resumoOS.total}</strong>
        </div>
        <div>
          <span>Em análise</span>
          <strong>{resumoOS.emAnalise}</strong>
        </div>
        <div>
          <span>Aguardando aprovação</span>
          <strong>{resumoOS.aguardandoAprovacao}</strong>
        </div>
        <div>
          <span>Finalizadas</span>
          <strong>{resumoOS.finalizadas}</strong>
        </div>
      </section>

      <section className="os-command-bar">
        <div className="os-command-primary">
          <div className="os-search-input-wrap">
            <input
              className="module-search"
              aria-label="Pesquisar ordens de serviço"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder={placeholderBusca}
            />
            <button
              type="button"
              className="os-filter-toggle"
              onClick={() => (filtrosBuscaAbertos ? fecharFiltrosBusca() : abrirFiltrosBusca())}
              aria-expanded={filtrosBuscaAbertos}
            >
              Filtros
            </button>
          </div>

          <div className="os-command-selects">
            <label>
              Status
              <select
                value={statusFiltro}
                onChange={(event) =>
                  setStatusFiltro(event.target.value as StatusOS | "TODOS")
                }
              >
                <option value="TODOS">Todos</option>
                <option value="RECEBIDO">Recebido</option>
                <option value="EM_ANALISE">Em análise</option>
                <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
                <option value="EM_MANUTENCAO">Em manutenção</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="ENTREGUE">Entregue</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </label>

            <label>
              Ordenar
              <select
                value={ordenacao}
                onChange={(event) =>
                  setOrdenacao(
                    event.target.value as "recentes" | "antigas" | "prioridade",
                  )
                }
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigas">Mais antigas</option>
                <option value="prioridade">Maior prioridade</option>
              </select>
            </label>
          </div>
        </div>

        <div className="os-active-search-fields">
          {camposBuscaAtivos.map((campo) => (
            <span key={campo.value}>{campo.label}</span>
          ))}
        </div>

        {filtrosBuscaAbertos ? (
          <aside className="os-search-filter-card">
            <div className="os-search-filter-header">
              <strong>Escolha onde pesquisar</strong>
              <small>Selecione os campos e confirme para aplicar.</small>
            </div>

            <div
              className="os-search-filter-options"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
              }}
            >
              {CAMPOS_BUSCA_OS.map((campo) => {
                const ativo = camposBuscaRascunho.includes(campo.value);

                return (
                  <button
                    key={campo.value}
                    type="button"
                    className={ativo ? "active" : ""}
                    onClick={() => alternarCampoBuscaRascunho(campo.value)}
                    style={{
                      minHeight: "74px",
                      padding: "14px 16px",
                      justifyContent: "flex-start",
                    }}
                  >
                    <span className="os-check-indicator" aria-hidden="true">
                      {ativo ? "✓" : ""}
                    </span>
                    <div>
                      <strong>{campo.label}</strong>
                      <small>{campo.help}</small>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginTop: "16px",
                flexWrap: "wrap",
              }}
            >
              <small style={{ color: "var(--muted-text)" }}>
                {camposBuscaRascunho.length} campo(s) selecionado(s).
              </small>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={restaurarFiltrosPadrao}
                >
                  Restaurar padrão
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={fecharFiltrosBusca}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={aplicarFiltrosBusca}
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </section>

      {carregando ? (
        <div className="module-empty">Carregando ordens...</div>
      ) : (
        <div className="os-data-panel">
          <div
            className="os-data-header"
            style={{
              gridTemplateColumns: OS_TABLE_GRID_TEMPLATE,
              columnGap: "14px",
              minWidth: "1180px",
              paddingInline: "16px",
            }}
          >
            <span>OS</span>
            <span>Cliente</span>
            <span>Equipamento</span>
            <span>Técnico</span>
            <span>Prioridade</span>
            <span>Status</span>
            <span>Abertura</span>
            <span>Ações</span>
          </div>

          <div className="os-data-body">
            {ordensFiltradas.length === 0 ? (
              <div className="module-empty os-data-empty">
                <strong>Nenhuma ordem encontrada.</strong>
                <span>Revise a pesquisa ou os filtros selecionados.</span>
              </div>
            ) : (
              ordensFiltradas.map((ordem) => {
                const cliente = clientesPorId.get(ordem.id_cliente);
                const equipamento = equipamentosPorId.get(ordem.id_equip);
                const tecnico = ordem.id_tecnico_responsavel
                  ? usuariosPorId.get(ordem.id_tecnico_responsavel)
                  : null;
                const podeAlterar = funcao === "TECNICO" || funcao === "DONO";

                return (
                  <article
                    className="os-data-row"
                    key={ordem.id_os}
                    style={{
                      gridTemplateColumns: OS_TABLE_GRID_TEMPLATE,
                      columnGap: "14px",
                      minWidth: "1180px",
                      alignItems: "center",
                      paddingInline: "16px",
                      paddingBlock: "14px",
                    }}
                  >
                    <div className="os-data-os">
                      <strong>{ordem.num_os}</strong>
                      <small>{ordem.defeito_relatorio}</small>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <strong>{cliente?.nome_cliente ?? "Cliente"}</strong>
                      <small>{cliente?.telefone || cliente?.cpf_cliente || "Sem contato"}</small>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <strong>
                        {equipamento
                          ? [equipamento.marca_equip, equipamento.modelo_equip]
                              .filter(Boolean)
                              .join(" ") || "Equipamento"
                          : "Equipamento"}
                      </strong>
                      <small>{equipamento?.num_serie || "Sem número de série"}</small>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <strong>{tecnico?.nome_usuario ?? "Não atribuído"}</strong>
                      <small>
                        {tecnico?.funcao_usuario === "DONO"
                          ? "Dono"
                          : tecnico?.funcao_usuario === "TECNICO"
                            ? "Técnico"
                            : "—"}
                      </small>
                    </div>

                    <div>
                      <span
                        className={`os-priority os-priority-${ordem.prioridade_os.toLowerCase()}`}
                      >
                        {formatarPrioridade(ordem.prioridade_os)}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`os-status os-status-${ordem.status_os.toLowerCase()}`}
                      >
                        {statusLabels[ordem.status_os]}
                      </span>
                    </div>

                    <div>
                      <strong>{dataHora(ordem.data_aber)}</strong>
                    </div>

                    <div
                      className="os-data-actions"
                      style={{ justifyContent: "flex-end", flexWrap: "nowrap", gap: "8px" }}
                    >
                      <button
                        type="button"
                        className="secondary-action os-view-action"
                        onClick={() => abrirVisualizacao(ordem)}
                      >
                        Ver detalhes
                      </button>
                      {podeAlterar ? (
                        <button
                          type="button"
                          className="primary-action os-edit-action"
                          onClick={() => abrirAlteracao(ordem)}
                        >
                          Atualizar
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <footer className="os-data-footer" style={{ minWidth: "1180px", paddingInline: "16px" }}>
            <span>
              Exibindo <strong>{ordensFiltradas.length}</strong> de{" "}
              <strong>{ordens.length}</strong> ordens
            </span>
            <small>
              Busca local nesta etapa. Paginação do backend entra quando o volume crescer.
            </small>
          </footer>
        </div>
      )}

      {selecionada && modoDetalhe ? (
        <div
          className="module-modal-backdrop"
          role="presentation"
          onMouseDown={fecharDetalhe}
        >
          <section
            className="module-modal os-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modoDetalhe === "visualizar"
                ? `Visualizar ${selecionada.num_os}`
                : `Alterar ${selecionada.num_os}`
            }
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="module-modal-header os-detail-modal-header">
              <div>
                <span className="page-kicker">
                  {modoDetalhe === "visualizar"
                    ? "Consulta rápida do atendimento"
                    : "Alteração técnica do atendimento"}
                </span>
                <h3>{selecionada.num_os}</h3>
                <p>
                  {clientesPorId.get(selecionada.id_cliente)?.nome_cliente ??
                    "Cliente"}{" "}
                  •{" "}
                  {equipamentosPorId.get(selecionada.id_equip)
                    ? descricaoEquipamento(
                        equipamentosPorId.get(
                          selecionada.id_equip,
                        ) as Equipamento,
                      )
                    : "Equipamento"}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={fecharDetalhe}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="os-detail-modal-body">
              {erro ? (
                <div className="module-alert module-alert-error os-modal-error" role="alert">
                  {erro}
                </div>
              ) : null}
              <div className="os-status-summary">
                <div>
                  <span>Situação atual</span>
                  <strong>{statusLabels[selecionada.status_os]}</strong>
                </div>
                <div>
                  <span>Abertura</span>
                  <strong>{dataHora(selecionada.data_aber)}</strong>
                </div>
                <div>
                  <span>Técnico</span>
                  <strong>
                    {selecionada.id_tecnico_responsavel
                      ? usuariosPorId.get(
                          selecionada.id_tecnico_responsavel,
                        )?.nome_usuario ?? "Técnico"
                      : "Não atribuído"}
                  </strong>
                </div>
                <div>
                  <span>Prioridade</span>
                  <strong>{selecionada.prioridade_os}</strong>
                </div>
              </div>

              <article className="os-next-step-card">
                <div className="os-next-step-marker" aria-hidden="true">→</div>
                <div>
                  <span>Próximo passo do atendimento</span>
                  <strong>{proximosPassos[selecionada.status_os].titulo}</strong>
                  <p>{proximosPassos[selecionada.status_os].descricao}</p>
                </div>
              </article>

              {modoDetalhe === "visualizar" ? (
                <div className="os-customer-view">
                  <article className="os-section-card">
                    <span>Defeito relatado</span>
                    <p>{selecionada.defeito_relatorio}</p>
                  </article>

                  <article className="os-section-card">
                    <div className="os-section-heading-row">
                      <div>
                        <span>Diagnóstico / retorno técnico</span>
                        <p>
                          {selecionada.diag_os ||
                            "O técnico ainda não registrou um diagnóstico para esta OS."}
                        </p>
                      </div>
                      <div className="os-budget-total">
                        <span>Orçamento</span>
                        <strong>{moedaBRL(Number(selecionada.valor_total ?? 0))}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="os-section-card os-customer-answer">
                    <span>Resumo para atendimento ao cliente</span>
                    <div className="os-customer-summary-grid">
                      <div>
                        <small>Situação</small>
                        <strong>{statusLabels[selecionada.status_os]}</strong>
                      </div>
                      <div>
                        <small>Orçamento</small>
                        <strong>{moedaBRL(Number(selecionada.valor_total ?? 0))}</strong>
                      </div>
                    </div>
                    <p>
                      Use o diagnóstico e o histórico abaixo para responder rapidamente
                      como está o atendimento.
                    </p>
                  </article>

                  {(["EM_ANALISE", "AGUARDANDO_APROVACAO"] as StatusOS[]).includes(selecionada.status_os) ? <article className="os-section-card pre-note-actions-card">
                    <div className="pre-note-actions-copy">
                      <span className="page-kicker">Documento para aprovação</span>
                      <strong>Pré-nota / Orçamento - bobina 80 mm</strong>
                      <small>
                        Formato térmico 80 mm, disponível após diagnóstico e orçamento. Não é documento fiscal.
                      </small>
                    </div>
                    <div className="pre-note-actions">
                      <button
                        type="button"
                        className="secondary-action semantic-info-action"
                        disabled={gerandoPreNota || !preNotaDisponivel(selecionada)}
                        onClick={() => void visualizarPreNota()}
                      >
                        Visualizar pré-nota
                      </button>
                      <button
                        type="button"
                        className="primary-action semantic-info-filled-action"
                        disabled={gerandoPreNota || !preNotaDisponivel(selecionada)}
                        onClick={() => void imprimirPreNota()}
                      >
                        {gerandoPreNota ? "Gerando PDF..." : selecionada?.status_os === "EM_ANALISE" ? "Gerar PDF e enviar para aprovação" : "Abrir PDF para imprimir"}
                      </button>
                    </div>
                  </article> : null}

                  <article className="os-section-card">
                    <span>Histórico do atendimento</span>
                    <div className="os-history">
                      {historico.length === 0 ? (
                        <small>Sem eventos adicionais.</small>
                      ) : (
                        historico.map((item) => (
                          <div className="os-history-item" key={item.id_hist}>
                            <i />
                            <div>
                              <strong>{statusLabels[item.status_novo]}</strong>
                              <span>{dataHora(item.data_evento)}</span>
                              {item.obs_hist ? <p>{item.obs_hist}</p> : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              ) : (
                <div className="os-technician-edit">
                  <article className="os-section-card">
                    <span>Defeito relatado</span>
                    <p>{selecionada.defeito_relatorio}</p>
                  </article>

                  {selecionada.status_os === "EM_ANALISE" ? <article className="os-section-card os-diagnosis-budget-card">
                    <div className="os-section-heading-row">
                      <div>
                        <span className="page-kicker">Análise técnica</span>
                        <h4>Diagnóstico e orçamento</h4>
                      </div>
                      <div className="os-budget-total">
                        <span>Orçamento atual</span>
                        <strong>{moedaBRL(numeroOrcamento(orcamento))}</strong>
                      </div>
                    </div>

                    <PresetSelect
                      label="Diagnóstico técnico"
                      value={diagnostico}
                      options={DIAGNOSTICOS_COMUNS}
                      onChange={setDiagnostico}
                      placeholder="Selecione o diagnóstico identificado"
                      customLabel="Outro diagnóstico"
                      customPlaceholder="Registre testes, causa encontrada e solução indicada..."
                      customMultiline
                    />

                    {funcao === "DONO" ? (
                      <label className="os-technician-assignment">
                        <span>Técnico responsável</span>
                        <select
                          value={tecnicoEdicaoId}
                          onChange={(event) => setTecnicoEdicaoId(event.target.value)}
                        >
                          <option value="">Atribuir automaticamente ao salvar</option>
                          {tecnicos.map((tecnico) => (
                            <option key={tecnico.id_usuario} value={tecnico.id_usuario}>
                              {tecnico.nome_usuario}
                            </option>
                          ))}
                        </select>
                        <small>
                          Se permanecer vazio, o dono que salvar o diagnóstico assume a OS.
                        </small>
                      </label>
                    ) : null}

                    <section className="os-budget-items">
                      <div className="os-stock-availability-heading">
                        <div><span>Composição do orçamento</span><strong>O que será cobrado do cliente</strong></div>
                        <small>{itensOrcamento.length} item(ns)</small>
                      </div>
                      {itensOrcamento.length > 0 ? (
                        <div className="os-budget-items-list">
                          {itensOrcamento.map((item) => (
                            <div key={item.id_item_os}>
                              <span>
                                <b>{item.tipo === "PECA" ? (item.id_item_estoque ? "Peça do estoque" : "Peça de fornecedor") : "Serviço"}</b> {item.descricao}
                                {item.fornecedor ? <small>Fornecedor: {item.fornecedor}</small> : null}
                              </span>
                              <span>{item.quantidade} × {moedaBRL(item.valor_unitario)}</span>
                              <strong>{moedaBRL(item.subtotal)}</strong>
                              <button type="button" className="semantic-danger-action" disabled={salvando} onClick={() => void removerItemDoOrcamento(item)}>Remover</button>
                            </div>
                          ))}
                        </div>
                      ) : <p>Escolha um serviço ou uma peça e clique em “Adicionar item”. Apenas preencher os campos não inclui o item.</p>}
                      <div className="os-stock-flow-help">
                        <span><b>Estoque</b> baixa somente após aprovação</span><i>•</i>
                        <span><b>Fornecedor</b> entra apenas no custo da OS</span>
                      </div>
                      <div className="os-budget-item-form">
                        <label>Tipo<select value={tipoNovoItem} onChange={(event) => setTipoNovoItem(event.target.value as "SERVICO" | "PECA_ESTOQUE" | "PECA_FORNECEDOR")}><option value="SERVICO">Serviço</option><option value="PECA_ESTOQUE">Peça do estoque</option><option value="PECA_FORNECEDOR">Peça comprada para esta OS</option></select></label>
                        {tipoNovoItem === "PECA_ESTOQUE" ? (
                          <label className="wide">Peça<select value={pecaId} onChange={(event) => { const id = event.target.value; setPecaId(id); const peca = estoqueCompativel.find((item) => item.id_item === id); if (peca?.preco_venda != null) setValorItem(Number(peca.preco_venda).toFixed(2).replace(".", ",")); }}><option value="">Selecione no estoque</option>{estoqueCompativel.map((item) => <option key={item.id_item} value={item.id_item}>{item.descricao} · {item.quantidade_atual} un.</option>)}</select></label>
                        ) : tipoNovoItem === "PECA_FORNECEDOR" ? (
                          <>
                            <label className="wide">Peça comprada<input value={pecaFornecedor} onChange={(event) => setPecaFornecedor(event.target.value)} placeholder="Ex.: Tela Samsung A57" /></label>
                            <label>Fornecedor<input value={fornecedorItem} onChange={(event) => setFornecedorItem(event.target.value)} placeholder="Opcional" /></label>
                            {funcao === "DONO" ? <label>Custo de compra<input inputMode="decimal" value={custoItem} onChange={(event) => setCustoItem(event.target.value)} /></label> : null}
                          </>
                        ) : (
                          <div className="wide os-service-preset">
                            <PresetSelect
                              label="Serviço sem troca de peça"
                              value={descricaoServico}
                              options={SERVICOS_SEM_PECA}
                              onChange={setDescricaoServico}
                              placeholder="Selecione o serviço realizado"
                              customLabel="Outro serviço"
                              customPlaceholder="Descreva o serviço..."
                            />
                          </div>
                        )}
                        <label>Quantidade<input inputMode="decimal" value={quantidadeItem} onChange={(event) => setQuantidadeItem(event.target.value)} /></label>
                        <label>Valor deste item<input inputMode="decimal" value={valorItem} onChange={(event) => setValorItem(event.target.value)} /><small>Uso interno; o cliente verá apenas o total.</small></label>
                        <button type="button" className="primary-action os-add-budget-item" disabled={salvando || numeroOrcamento(valorItem) <= 0 || (tipoNovoItem === "PECA_ESTOQUE" ? !pecaId : tipoNovoItem === "PECA_FORNECEDOR" ? !pecaFornecedor.trim() : !descricaoServico.trim())} onClick={() => void adicionarItemAoOrcamento()}>+ Adicionar ao orçamento</button>
                      </div>
                    </section>

                    <div className="os-budget-input-row">
                      <label htmlFor="orcamento-os">
                        Valor proposto ao cliente
                        <div className="currency-input">
                          <span>R$</span>
                          <input
                            id="orcamento-os"
                            inputMode="decimal"
                            value={orcamento}
                            disabled={itensOrcamento.length > 0}
                            onChange={(event) => setOrcamento(event.target.value)}
                            onBlur={() =>
                              setOrcamento(
                                numeroOrcamento(orcamento)
                                  .toFixed(2)
                                  .replace(".", ","),
                              )
                            }
                            placeholder="0,00"
                          />
                        </div>
                      </label>

                      <div className="os-budget-hint">
                        <span>Próximo passo</span>
                        <strong>
                          Salve diagnóstico + valor antes de enviar para aprovação.
                        </strong>
                        <small>
                          Peças e serviços detalhados serão ligados ao orçamento na
                          etapa de estoque.
                        </small>
                      </div>
                    </div>

                    <div className="os-stock-availability">
                      <div className="os-stock-availability-heading">
                        <div>
                          <span>Consulta ao estoque</span>
                          <strong>Peças compatíveis com este equipamento</strong>
                        </div>
                        <small>{estoqueCompativel.length} item(ns) encontrado(s)</small>
                      </div>
                      {estoqueCompativel.length === 0 ? (
                        <p>
                          Nenhuma peça compatível foi localizada. Revise a marca e o modelo
                          no cadastro do equipamento ou consulte o módulo Estoque.
                        </p>
                      ) : (
                        <div className="os-stock-availability-list">
                          {estoqueCompativel.map((item) => (
                            <div key={item.id_item}>
                              <span>
                                <strong>{item.descricao}</strong>
                                <small>{item.codigo} · {item.localizacao || "Local não informado"}</small>
                              </span>
                              <span className={item.quantidade_atual <= item.quantidade_minima ? "low" : ""}>
                                <b>{item.quantidade_atual} un.</b>
                                <small>{item.preco_venda == null ? "Sem preço" : moedaBRL(Number(item.preco_venda))}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <small className="os-stock-availability-note">
                        Adicionar ao orçamento não altera o saldo. A baixa acontece quando
                        “Cliente aprovou” muda a OS para Em manutenção.
                      </small>
                    </div>

                    <div className="os-diagnosis-actions">
                      <button
                        type="button"
                        className="primary-action"
                        disabled={salvando}
                        onClick={() => void salvarDiagnosticoEOrcamento()}
                      >
                        {salvando ? "Salvando..." : "Salvar diagnóstico e orçamento"}
                      </button>
                    </div>
                  </article> : (
                    <article className="os-section-card os-analysis-readonly">
                      <span className="page-kicker">Análise técnica</span>
                      <strong>
                        {selecionada.status_os === "RECEBIDO"
                          ? "Inicie a análise para registrar diagnóstico e orçamento."
                          : "Diagnóstico e orçamento encerrados para edição."}
                      </strong>
                      <p>{selecionada.diag_os || "Nenhum diagnóstico registrado."}</p>
                      <div className="os-budget-total">
                        <span>Valor total para o cliente</span>
                        <strong>{moedaBRL(Number(selecionada.valor_total ?? 0))}</strong>
                      </div>
                    </article>
                  )}

                  {itensOrcamento.some((item) => item.tipo === "PECA" && !item.id_item_estoque) ? (
                    <article className="os-section-card os-external-purchases-card">
                      <span className="page-kicker">Compras para esta OS</span>
                      <strong>Acompanhe as peças adquiridas com fornecedores</strong>
                      <p>
                        A manutenção só poderá começar depois que todas as peças estiverem recebidas.
                      </p>
                      <div className="os-external-purchases-list">
                        {itensOrcamento
                          .filter((item) => item.tipo === "PECA" && !item.id_item_estoque)
                          .map((item) => (
                            <div key={item.id_item_os} className="os-external-purchase-item">
                              <div>
                                <strong>{item.descricao}</strong>
                                <small>{item.fornecedor || "Fornecedor não informado"}</small>
                              </div>
                              <span className={`purchase-status purchase-status-${(item.status_compra || "SOLICITADA").toLowerCase()}`}>
                                {statusCompraLabels[item.status_compra || "SOLICITADA"]}
                              </span>
                              {funcao !== "TECNICO" ? (
                                <div className="purchase-actions">
                                  {item.status_compra === "SOLICITADA" || !item.status_compra ? (
                                    <>
                                      <button type="button" disabled={salvando} onClick={() => void mudarStatusCompra(item, "COMPRADA")}>Marcar comprada</button>
                                      <button type="button" className="os-danger-action" disabled={salvando} onClick={() => void mudarStatusCompra(item, "CANCELADA")}>Cancelar compra</button>
                                    </>
                                  ) : null}
                                  {item.status_compra === "COMPRADA" ? (
                                    <>
                                      <button type="button" className="primary-action" disabled={salvando} onClick={() => void mudarStatusCompra(item, "RECEBIDA")}>Confirmar recebimento</button>
                                      <button type="button" className="os-danger-action" disabled={salvando} onClick={() => void mudarStatusCompra(item, "CANCELADA")}>Cancelar compra</button>
                                    </>
                                  ) : null}
                                  {item.status_compra === "CANCELADA" ? (
                                    <button type="button" disabled={salvando} onClick={() => void mudarStatusCompra(item, "SOLICITADA")}>Solicitar novamente</button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    </article>
                  ) : null}

                  {selecionada.status_os === "EM_ANALISE" ? <article className="os-section-card pre-note-actions-card">
                    <div className="pre-note-actions-copy">
                      <span className="page-kicker">Etapa de análise</span>
                      <strong>Preparar orçamento para o cliente</strong>
                      <small>
                        O cliente verá diagnóstico e valor total, sem custos internos ou fornecedor.
                      </small>
                    </div>
                    <div className="pre-note-actions">
                      <button
                        type="button"
                        className="secondary-action semantic-info-action"
                        disabled={gerandoPreNota || salvando}
                        onClick={() => void salvarEVisualizarPreNota()}
                      >
                        {salvando ? "Salvando análise..." : "Salvar e visualizar pré-nota"}
                      </button>
                      <button
                        type="button"
                        className="primary-action semantic-info-filled-action"
                        disabled={gerandoPreNota || !preNotaDisponivel(selecionada)}
                        onClick={() => void imprimirPreNota()}
                      >
                        {gerandoPreNota ? "Gerando PDF..." : selecionada?.status_os === "EM_ANALISE" ? "Gerar PDF e enviar para aprovação" : "Abrir PDF para imprimir"}
                      </button>
                    </div>
                  </article> : null}

                  {(proximosStatus[funcao][selecionada.status_os] ?? []).filter(
                    (status) => !(
                      selecionada.status_os === "EM_ANALISE" &&
                      status === "AGUARDANDO_APROVACAO"
                    ),
                  ).length > 0 ? (
                    <article className="os-section-card os-flow-actions-card">
                      <span>Ações da etapa atual</span>
                      <p className="os-process-warning">
                        {selecionada.status_os === "AGUARDANDO_APROVACAO"
                          ? "Registre a decisão informada pelo cliente."
                          : "Escolha a ação realizada. A mudança ficará registrada no histórico."}
                      </p>
                      <div className="os-status-actions">
                        {(
                          proximosStatus[funcao][selecionada.status_os] ?? []
                        ).filter((status) => !(
                          selecionada.status_os === "EM_ANALISE" &&
                          status === "AGUARDANDO_APROVACAO"
                        )).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={status === "CANCELADO" ? "os-danger-action" : "os-flow-action"}
                            disabled={salvando}
                            onClick={() => solicitarMudancaStatus(status)}
                          >
                            {acaoFluxo(selecionada.status_os, status).label}
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : (
                    <article className="os-section-card">
                      <span>Seguimento do processo</span>
                      <p>
                        Não há próxima etapa permitida para este status e perfil.
                      </p>
                    </article>
                  )}

                  <article className="os-section-card">
                    <span>Histórico</span>
                    <div className="os-history">
                      {historico.length === 0 ? (
                        <small>Sem eventos adicionais.</small>
                      ) : (
                        historico.map((item) => (
                          <div className="os-history-item" key={item.id_hist}>
                            <i />
                            <div>
                              <strong>{statusLabels[item.status_novo]}</strong>
                              <span>{dataHora(item.data_evento)}</span>
                              {item.obs_hist ? <p>{item.obs_hist}</p> : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {selecionada && preNotaVisualAberta
        ? createPortal(
            <div
              className="pre-note-preview-backdrop"
          role="presentation"
          onMouseDown={() => setPreNotaVisualAberta(false)}
        >
          <section
            className="pre-note-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Pré-nota ${selecionada.num_os}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="pre-note-preview-toolbar">
              <div>
                <span className="page-kicker">Prévia no sistema</span>
                <h3>Pré-nota / Orçamento</h3>
                <p>Visualização em formato térmico de 80 mm.</p>
              </div>

              <div className="pre-note-preview-toolbar-actions">
                <button
                  type="button"
                  className="primary-action semantic-info-filled-action"
                  disabled={gerandoPreNota}
                  onClick={() => void imprimirPreNota()}
                >
                  {gerandoPreNota ? "Gerando PDF..." : selecionada?.status_os === "EM_ANALISE" ? "Gerar PDF e enviar para aprovação" : "Abrir PDF para imprimir"}
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setPreNotaVisualAberta(false)}
                  aria-label="Fechar visualização"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="pre-note-preview-stage">
              <article className="thermal-receipt-preview">
                <header className="thermal-receipt-header">
                  <strong className="thermal-brand">LSAssist</strong>
                  <span>{nomeAssistencia}</span>
                  <h4>PRÉ-NOTA / ORÇAMENTO</h4>
                  <b>NÃO É DOCUMENTO FISCAL</b>
                </header>

                <div className="thermal-rule" />

                <section className="thermal-info-block">
                  <p><strong>OS:</strong> {selecionada.num_os}</p>
                  <p><strong>Data:</strong> {dataHora(selecionada.data_aber)}</p>
                  <p><strong>Status:</strong> {statusLabels[selecionada.status_os]}</p>
                </section>

                <div className="thermal-rule" />

                <section className="thermal-info-block">
                  <h5>CLIENTE</h5>
                  <p>
                    <strong>
                      {clientesPorId.get(selecionada.id_cliente)?.nome_cliente ??
                        "Cliente"}
                    </strong>
                  </p>
                  {clientesPorId.get(selecionada.id_cliente)?.cpf_cliente ? (
                    <p>
                      CPF:{" "}
                      {clientesPorId.get(selecionada.id_cliente)?.cpf_cliente}
                    </p>
                  ) : null}
                  {clientesPorId.get(selecionada.id_cliente)?.telefone ? (
                    <p>
                      Tel:{" "}
                      {clientesPorId.get(selecionada.id_cliente)?.telefone}
                    </p>
                  ) : null}
                  {clientesPorId.get(selecionada.id_cliente)?.endereco_cliente ? (
                    <p>
                      End:{" "}
                      {clientesPorId.get(selecionada.id_cliente)?.endereco_cliente}
                    </p>
                  ) : null}
                </section>

                <section className="thermal-info-block">
                  <h5>EQUIPAMENTO</h5>
                  {(() => {
                    const equipamento = equipamentosPorId.get(selecionada.id_equip);
                    return equipamento ? (
                      <>
                        <p>
                          <strong>
                            {[equipamento.marca_equip, equipamento.modelo_equip]
                              .filter(Boolean)
                              .join(" ") || "Equipamento"}
                          </strong>
                        </p>
                        {equipamento.cor_equip ? <p>Cor: {equipamento.cor_equip}</p> : null}
                        {equipamento.num_serie ? <p>Série: {equipamento.num_serie}</p> : null}
                        {equipamento.descr_equip ? <p>{equipamento.descr_equip}</p> : null}
                      </>
                    ) : (
                      <p>Equipamento</p>
                    );
                  })()}
                </section>

                <section className="thermal-info-block">
                  <h5>DEFEITO RELATADO</h5>
                  <p>{selecionada.defeito_relatorio}</p>
                </section>

                <section className="thermal-info-block">
                  <h5>DIAGNÓSTICO</h5>
                  <p>{selecionada.diag_os}</p>
                </section>

                <section className="thermal-info-block">
                  <h5>TÉCNICO</h5>
                  <p>
                    {selecionada.id_tecnico_responsavel
                      ? usuariosPorId.get(selecionada.id_tecnico_responsavel)
                          ?.nome_usuario ?? "Não informado"
                      : "Não informado"}
                  </p>
                </section>

                <div className="thermal-rule" />

                <section className="thermal-total">
                  <span>ORÇAMENTO</span>
                  <strong>{moedaBRL(Number(selecionada.valor_total ?? 0))}</strong>
                </section>

                <div className="thermal-rule" />

                <footer className="thermal-receipt-footer">
                  <p>
                    Pré-nota para conferência e aprovação do cliente. Não substitui
                    nota fiscal, NF-e ou NFS-e.
                  </p>
                  <strong>Gerado pelo LSAssist</strong>
                </footer>
              </article>
            </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      {selecionada && statusParaConfirmar ? (
        <div
          className="process-confirm-backdrop"
          role="presentation"
          onMouseDown={() => setStatusParaConfirmar(null)}
        >
          <section
            className="process-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-process-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="process-confirm-icon" aria-hidden="true">
              ✓
            </span>

            <div>
              <span className="page-kicker">Confirmação obrigatória</span>
              <h3 id="confirm-process-title">
                {acaoFluxo(selecionada.status_os, statusParaConfirmar).tituloConfirmacao}
              </h3>
              <p>
                {acaoFluxo(selecionada.status_os, statusParaConfirmar).descricaoConfirmacao}
              </p>
            </div>

            <div className="process-transition-preview">
              <div>
                <span>De</span>
                <strong>{statusLabels[selecionada.status_os]}</strong>
              </div>
              <b aria-hidden="true">→</b>
              <div>
                <span>Para</span>
                <strong>{statusLabels[statusParaConfirmar]}</strong>
              </div>
            </div>

            {selecionada.status_os === "EM_MANUTENCAO" && statusParaConfirmar === "CANCELADO" ? (
              <label className="process-cancel-destination">
                <span>O que aconteceu com as peças retiradas do estoque?</span>
                <select
                  value={destinoCancelamento}
                  onChange={(event) => setDestinoCancelamento(event.target.value as DestinoPecasCancelamento)}
                >
                  <option value="DEVOLVER_ESTOQUE">Devolver ao estoque</option>
                  <option value="CONSUMIDAS">Foram utilizadas/consumidas</option>
                  <option value="PERDA">Registrar como perda</option>
                </select>
                <small>Essa escolha ficará vinculada ao cancelamento e não poderá ser desfeita.</small>
              </label>
            ) : null}

            <div className="process-confirm-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={salvando}
                onClick={() => setStatusParaConfirmar(null)}
              >
                Não, voltar
              </button>
              <button
                type="button"
                className={statusParaConfirmar === "CANCELADO" ? "danger-action" : "primary-action"}
                disabled={salvando}
                onClick={() => void mudarStatus(statusParaConfirmar)}
              >
                {salvando ? "Confirmando..." : acaoFluxo(selecionada.status_os, statusParaConfirmar).confirmar}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {novoAberto ? (
        <div
          className="module-modal-backdrop"
          role="presentation"
          onMouseDown={fecharModalNovaOS}
        >
          <section
            className="module-modal os-intake-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Abrir nova Ordem de Serviço"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="module-modal-header">
              <div>
                <span className="page-kicker">Novo atendimento</span>
                <h3>Abrir Ordem de Serviço</h3>
                <p>
                  Se o cliente ou equipamento ainda não existir, cadastre aqui
                  mesmo e continue.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={fecharModalNovaOS}
                disabled={salvando}
              >
                ×
              </button>
            </div>

            <div className="intake-progress" aria-label="Etapas do atendimento">
              <span className={clienteId ? "done" : "active"}>
                <b>1</b> Cliente
              </span>
              <span className={equipId ? "done" : clienteId ? "active" : ""}>
                <b>2</b> Equipamento
              </span>
              <span className={equipId ? "active" : ""}>
                <b>3</b> Atendimento
              </span>
            </div>

            <section className="intake-section">
              <div className="intake-section-heading">
                <div>
                  <span className="page-kicker">Etapa 1</span>
                  <h4>Quem está sendo atendido?</h4>
                </div>
                <button
                  type="button"
                  className="inline-link-button"
                  onClick={() =>
                    setCadastroClienteAberto((value) => !value)
                  }
                >
                  {cadastroClienteAberto
                    ? "Usar cliente existente"
                    : "+ Cadastrar cliente"}
                </button>
              </div>

              {!cadastroClienteAberto ? (
                <>
                  <input
                    className="module-search"
                    value={buscaCliente}
                    onChange={(event) => setBuscaCliente(event.target.value)}
                    placeholder="Digite nome, CPF ou telefone..."
                    autoFocus
                  />

                  <div className="intake-choice-list">
                    {clientesEncontrados.length === 0 ? (
                      <button
                        type="button"
                        className="intake-empty-action"
                        onClick={() => setCadastroClienteAberto(true)}
                      >
                        <strong>Nenhum cliente encontrado</strong>
                        <span>Cadastre sem sair da Ordem de Serviço →</span>
                      </button>
                    ) : (
                      clientesEncontrados.map((cliente) => (
                        <button
                          type="button"
                          key={cliente.id_cliente}
                          className={`intake-choice ${
                            clienteId === cliente.id_cliente
                              ? "intake-choice-selected"
                              : ""
                          }`}
                          onClick={() => {
                            setClienteId(cliente.id_cliente);
                            setEquipId("");
                            setMensagemCliente(null);
                            setCadastroEquipAberto(false);
                          }}
                        >
                          <span className="intake-choice-avatar">
                            {cliente.nome_cliente
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("")}
                          </span>
                          <span>
                            <strong>{cliente.nome_cliente}</strong>
                            <small>
                              {[cliente.cpf_cliente, cliente.telefone]
                                .filter(Boolean)
                                .join(" • ") || "Sem CPF/telefone informado"}
                            </small>
                          </span>
                          <b>{clienteId === cliente.id_cliente ? "✓" : "→"}</b>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <form
                  className="inline-create-card"
                  onSubmit={cadastrarClienteRapido}
                >
                  <div className="module-form-grid">
                    <label>
                      Nome completo *
                      <input
                        required
                        minLength={2}
                        value={clienteRapido.nome}
                        onChange={(event) =>
                          setClienteRapido({
                            ...clienteRapido,
                            nome: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      CPF
                      <input
                        value={clienteRapido.cpf}
                        onChange={(event) =>
                          setClienteRapido({
                            ...clienteRapido,
                            cpf: event.target.value,
                          })
                        }
                        placeholder="000.000.000-00"
                      />
                    </label>
                    <label>
                      Telefone
                      <input
                        value={clienteRapido.telefone}
                        onChange={(event) =>
                          setClienteRapido({
                            ...clienteRapido,
                            telefone: event.target.value,
                          })
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </label>
                    <label>
                      Endereço
                      <input
                        value={clienteRapido.endereco}
                        onChange={(event) =>
                          setClienteRapido({
                            ...clienteRapido,
                            endereco: event.target.value,
                          })
                        }
                        placeholder="Rua, número, bairro..."
                      />
                    </label>
                  </div>

                  <div className="inline-create-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setCadastroClienteAberto(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="primary-action"
                      disabled={salvando}
                    >
                      {salvando ? "Salvando..." : "Salvar e usar cliente"}
                    </button>
                  </div>
                </form>
              )}

              {mensagemCliente ? (
                <div className="inline-feedback">{mensagemCliente}</div>
              ) : null}
            </section>

            <section
              className={`intake-section ${!clienteId ? "intake-section-disabled" : ""}`}
            >
              <div className="intake-section-heading">
                <div>
                  <span className="page-kicker">Etapa 2</span>
                  <h4>Qual equipamento entrou?</h4>
                </div>
                {clienteId ? (
                  <button
                    type="button"
                    className="inline-link-button"
                    onClick={() =>
                      setCadastroEquipAberto((value) => !value)
                    }
                  >
                    {cadastroEquipAberto
                      ? "Usar equipamento existente"
                      : "+ Novo equipamento"}
                  </button>
                ) : null}
              </div>

              {!clienteId ? (
                <div className="intake-placeholder">
                  Selecione o cliente para visualizar os equipamentos dele.
                </div>
              ) : cadastroEquipAberto ? (
                <form
                  className="inline-create-card"
                  onSubmit={cadastrarEquipamentoRapido}
                >
                  <div className="module-form-grid">
                    <PresetSelect label="Marca" value={equipamentoRapido.marca} options={MARCAS_EQUIPAMENTO} customLabel="Outra marca" customPlaceholder="Digite a marca..." onChange={(marca) => setEquipamentoRapido((current) => ({ ...current, marca, modelo: marca === current.marca ? current.modelo : "" }))} />
                    <PresetSelect label="Modelo" value={equipamentoRapido.modelo} options={modelosParaMarca(equipamentoRapido.marca)} customLabel="Outro modelo" customPlaceholder="Digite o modelo..." onChange={(modelo) => setEquipamentoRapido((current) => ({ ...current, modelo }))} />
                    <PresetSelect label="Cor" value={equipamentoRapido.cor} options={CORES_EQUIPAMENTO} customLabel="Outra cor" customPlaceholder="Digite a cor..." onChange={(cor) => setEquipamentoRapido((current) => ({ ...current, cor }))} />
                    <label>
                      Número de série
                      <input
                        value={equipamentoRapido.serie}
                        onChange={(event) =>
                          setEquipamentoRapido({
                            ...equipamentoRapido,
                            serie: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Descrição / observação
                    <input
                      value={equipamentoRapido.descricao}
                      onChange={(event) =>
                        setEquipamentoRapido({
                          ...equipamentoRapido,
                          descricao: event.target.value,
                        })
                      }
                      placeholder="Ex.: notebook 15'', aparelho com capa azul..."
                    />
                  </label>

                  <div className="inline-create-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setCadastroEquipAberto(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="primary-action"
                      disabled={salvando}
                    >
                      {salvando ? "Salvando..." : "Salvar e usar equipamento"}
                    </button>
                  </div>
                </form>
              ) : equipamentosCliente.length === 0 ? (
                <button
                  type="button"
                  className="intake-empty-action"
                  onClick={() => setCadastroEquipAberto(true)}
                >
                  <strong>Este cliente ainda não possui equipamentos</strong>
                  <span>Cadastrar equipamento e continuar →</span>
                </button>
              ) : (
                <div className="equipment-choice-grid">
                  {equipamentosCliente.map((equipamento) => (
                    <button
                      type="button"
                      key={equipamento.id_equip}
                      className={`equipment-choice ${
                        equipId === equipamento.id_equip
                          ? "equipment-choice-selected"
                          : ""
                      }`}
                      onClick={() => setEquipId(equipamento.id_equip)}
                    >
                      <strong>{descricaoEquipamento(equipamento)}</strong>
                      <span>{equipamento.descr_equip || "Sem observação"}</span>
                      <b>{equipId === equipamento.id_equip ? "Selecionado ✓" : "Selecionar"}</b>
                    </button>
                  ))}
                </div>
              )}

              {mensagemEquipamento ? (
                <div className="inline-feedback">{mensagemEquipamento}</div>
              ) : null}
            </section>

            <form className="intake-section intake-service-section" onSubmit={abrirOrdem}>
              <div className="intake-section-heading">
                <div>
                  <span className="page-kicker">Etapa 3</span>
                  <h4>Dados do atendimento</h4>
                </div>
              </div>

              <div className="module-form-grid">
                <label>
                  Prioridade
                  <select
                    value={prioridade}
                    onChange={(event) =>
                      setPrioridade(event.target.value as PrioridadeOS)
                    }
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </label>

                <label>
                  Técnico responsável
                  <select
                    value={tecnicoId}
                    onChange={(event) => setTecnicoId(event.target.value)}
                  >
                    <option value="">Definir depois</option>
                    {tecnicos.map((tecnico) => (
                      <option
                        key={tecnico.id_usuario}
                        value={tecnico.id_usuario}
                      >
                        {tecnico.nome_usuario}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <PresetSelect
                label="Motivo do atendimento"
                value={defeito}
                options={DEFEITOS_COMUNS}
                onChange={setDefeito}
                placeholder="Selecione o problema informado pelo cliente"
                customLabel="Outro problema"
                customPlaceholder="Descreva o problema informado pelo cliente..."
                required
              />

              <label className="intake-textarea-field">
                <span className="intake-field-title">Observações da entrada</span>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={(event) => setObservacao(event.target.value)}
                  placeholder="Acessórios entregues, avarias, senha informada futuramente em campo seguro..."
                />
              </label>

              <div className="intake-summary">
                <div>
                  <span>Cliente</span>
                  <strong>
                    {clienteId
                      ? clientesPorId.get(clienteId)?.nome_cliente ??
                        "Selecionado"
                      : "Pendente"}
                  </strong>
                </div>
                <div>
                  <span>Equipamento</span>
                  <strong>
                    {equipId
                      ? descricaoEquipamento(
                          equipamentosPorId.get(equipId) as Equipamento,
                        )
                      : "Pendente"}
                  </strong>
                </div>
              </div>

              <div className="module-modal-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={fecharModalNovaOS}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={
                    salvando ||
                    !clienteId ||
                    !equipId ||
                    defeito.trim().length < 3
                  }
                >
                  {salvando ? "Abrindo..." : "Abrir Ordem de Serviço"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
