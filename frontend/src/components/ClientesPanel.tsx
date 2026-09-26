import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  atualizarCliente,
  criarCliente,
  listarClientes,
  mensagemErroUsuario,
  type Cliente,
  type ClientePayload,
} from "../lib/api";

type ClientesPanelProps = {
  accessToken: string;
  onNovaOS?: (clienteId: string) => void;
};

type ClienteFormState = {
  nome_cliente: string;
  cpf_cliente: string;
  telefone: string;
  endereco_cliente: string;
};

const EMPTY_FORM: ClienteFormState = {
  nome_cliente: "",
  cpf_cliente: "",
  telefone: "",
  endereco_cliente: "",
};

function formatCpf(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function toPayload(form: ClienteFormState): ClientePayload {
  return {
    nome_cliente: form.nome_cliente.trim(),
    cpf_cliente: form.cpf_cliente.trim() || null,
    telefone: form.telefone.trim() || null,
    endereco_cliente: form.endereco_cliente.trim() || null,
  };
}

export function ClientesPanel({ accessToken, onNovaOS }: ClientesPanelProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteFormState>(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setClientes(await listarClientes(accessToken));
    } catch (error: unknown) {
      setErro(mensagemErroUsuario(error, "Não foi possível carregar os clientes."));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [accessToken]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((cliente) =>
      [cliente.nome_cliente, cliente.cpf_cliente, cliente.telefone, cliente.endereco_cliente]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo)),
    );
  }, [busca, clientes]);

  const totalLabel = useMemo(
    () => `${clientesFiltrados.length} ${clientesFiltrados.length === 1 ? "cliente" : "clientes"}`,
    [clientesFiltrados.length],
  );

  function novoCliente() {
    setClienteEditando(null);
    setForm(EMPTY_FORM);
    setErroForm(null);
    setModalAberto(true);
  }

  function editarCliente(cliente: Cliente) {
    setClienteEditando(cliente);
    setForm({
      nome_cliente: cliente.nome_cliente,
      cpf_cliente: cliente.cpf_cliente ?? "",
      telefone: cliente.telefone ?? "",
      endereco_cliente: cliente.endereco_cliente ?? "",
    });
    setErroForm(null);
    setModalAberto(true);
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroForm(null);

    if (form.nome_cliente.trim().length < 2) {
      setErroForm("Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    setSalvando(true);
    try {
      if (clienteEditando) {
        const atualizado = await atualizarCliente(accessToken, clienteEditando.id_cliente, toPayload(form));
        setClientes((atuais) => atuais.map((cliente) => cliente.id_cliente === atualizado.id_cliente ? atualizado : cliente));
      } else {
        const criado = await criarCliente(accessToken, toPayload(form));
        setClientes((atuais) => [criado, ...atuais]);
      }
      setModalAberto(false);
    } catch (error: unknown) {
      setErroForm(mensagemErroUsuario(error, "Não foi possível salvar o cliente."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="clients-page">
      <div className="page-heading-row">
        <div>
          <span className="page-kicker">Relacionamento</span>
          <h2>Clientes</h2>
          <p>Cadastre e encontre rapidamente quem deixou equipamentos na assistência.</p>
        </div>
        <button className="action-primary" type="button" onClick={novoCliente}>
          <span aria-hidden="true">＋</span> Novo cliente
        </button>
      </div>

      <div className="clients-toolbar">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Buscar cliente pelo nome..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </label>
        <span className="clients-count">{totalLabel}</span>
      </div>

      <div className="clients-card">
        {erro ? (
          <div className="inline-state inline-state-error">
            <strong>Não foi possível carregar os clientes.</strong>
            <span>{erro}</span>
            <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
          </div>
        ) : carregando ? (
          <div className="inline-state"><span className="table-loader" />Carregando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">LS</div>
            <h3>{busca ? "Nenhum cliente encontrado" : "Comece pelo primeiro cliente"}</h3>
            <p>{busca ? "Tente buscar por outro nome." : "Cadastre o cliente para depois vincular equipamentos e ordens de serviço."}</p>
            {!busca ? <button className="action-primary" type="button" onClick={novoCliente}>Cadastrar cliente</button> : null}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Endereço</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id_cliente}>
                    <td>
                      <div className="client-name-cell">
                        <span className="client-avatar">{initials(cliente.nome_cliente)}</span>
                        <div><strong>{cliente.nome_cliente}</strong><small>Cliente</small></div>
                      </div>
                    </td>
                    <td>{formatCpf(cliente.cpf_cliente)}</td>
                    <td>{cliente.telefone || "—"}</td>
                    <td className="client-address">{cliente.endereco_cliente || "—"}</td>
                    <td className="client-actions">
                      <div className="client-row-actions">
                        {onNovaOS ? (
                          <button
                            type="button"
                            className="client-os-action"
                            onClick={() => onNovaOS(cliente.id_cliente)}
                          >
                            Nova OS
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="semantic-edit-action"
                          onClick={() => editarCliente(cliente)}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !salvando && setModalAberto(false)}>
          <section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="page-kicker">{clienteEditando ? "Atualizar cadastro" : "Novo cadastro"}</span>
                <h3 id="client-modal-title">{clienteEditando ? "Editar cliente" : "Cadastrar cliente"}</h3>
              </div>
              <button className="modal-close" type="button" aria-label="Fechar" disabled={salvando} onClick={() => setModalAberto(false)}>×</button>
            </div>

            <form className="client-form" onSubmit={salvar}>
              <label>
                <span>Nome completo *</span>
                <input required minLength={2} maxLength={100} value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })} />
              </label>
              <div className="client-form-grid">
                <label>
                  <span>CPF</span>
                  <input inputMode="numeric" placeholder="000.000.000-00" value={form.cpf_cliente} onChange={(e) => setForm({ ...form, cpf_cliente: e.target.value })} />
                </label>
                <label>
                  <span>Telefone</span>
                  <input maxLength={20} placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </label>
              </div>
              <label>
                <span>Endereço</span>
                <input maxLength={255} placeholder="Rua, número, bairro..." value={form.endereco_cliente} onChange={(e) => setForm({ ...form, endereco_cliente: e.target.value })} />
              </label>

              {erroForm ? <div className="form-error" role="alert">{erroForm}</div> : null}

              <div className="modal-actions">
                <button className="action-secondary" type="button" disabled={salvando} onClick={() => setModalAberto(false)}>Cancelar</button>
                <button className="action-primary" type="submit" disabled={salvando}>{salvando ? "Salvando..." : clienteEditando ? "Salvar alterações" : "Cadastrar cliente"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
