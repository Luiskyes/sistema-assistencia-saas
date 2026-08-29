import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  atualizarEquipamento,
  criarEquipamento,
  listarClientes,
  listarEquipamentos,
  mensagemErroUsuario,
  type Cliente,
  type Equipamento,
  type EquipamentoPayload,
} from "../lib/api";
import { CORES_EQUIPAMENTO, MARCAS_EQUIPAMENTO, modelosParaMarca } from "../lib/equipmentPresets";
import { PresetSelect } from "./PresetSelect";

type Props = { accessToken: string };

type FormState = {
  id_cliente: string;
  marca_equip: string;
  modelo_equip: string;
  cor_equip: string;
  num_serie: string;
  descr_equip: string;
};

const EMPTY: FormState = {
  id_cliente: "",
  marca_equip: "",
  modelo_equip: "",
  cor_equip: "",
  num_serie: "",
  descr_equip: "",
};

function payload(form: FormState): EquipamentoPayload {
  return {
    id_cliente: form.id_cliente,
    marca_equip: form.marca_equip || null,
    modelo_equip: form.modelo_equip || null,
    cor_equip: form.cor_equip || null,
    num_serie: form.num_serie || null,
    descr_equip: form.descr_equip || null,
  };
}

export function EquipamentosPanel({ accessToken }: Props) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Equipamento | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [eqs, cls] = await Promise.all([
        listarEquipamentos(accessToken),
        listarClientes(accessToken),
      ]);
      setEquipamentos(eqs);
      setClientes(cls);
    } catch (error: unknown) {
      setErro(mensagemErroUsuario(error, "Não foi possível carregar os equipamentos."));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, [accessToken]);

  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id_cliente, c])), [clientes]);
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return equipamentos;
    return equipamentos.filter((e) => {
      const cliente = clientePorId.get(e.id_cliente)?.nome_cliente ?? "";
      return [e.marca_equip, e.modelo_equip, e.num_serie, cliente]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [busca, equipamentos, clientePorId]);

  function novo() {
    setEditando(null);
    setForm(EMPTY);
    setErroForm(null);
    setModal(true);
  }

  function editar(item: Equipamento) {
    setEditando(item);
    setForm({
      id_cliente: item.id_cliente,
      marca_equip: item.marca_equip ?? "",
      modelo_equip: item.modelo_equip ?? "",
      cor_equip: item.cor_equip ?? "",
      num_serie: item.num_serie ?? "",
      descr_equip: item.descr_equip ?? "",
    });
    setErroForm(null);
    setModal(true);
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (!form.id_cliente) { setErroForm("Selecione o cliente responsável pelo equipamento."); return; }
    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        const atualizado = await atualizarEquipamento(accessToken, editando.id_equip, payload(form));
        setEquipamentos((atuais) => atuais.map((item) => item.id_equip === atualizado.id_equip ? atualizado : item));
      } else {
        const criado = await criarEquipamento(accessToken, payload(form));
        setEquipamentos((atuais) => [criado, ...atuais]);
      }
      setModal(false);
    } catch (error: unknown) {
      setErroForm(mensagemErroUsuario(error, "Não foi possível salvar o equipamento."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="resource-page">
      <div className="page-heading-row">
        <div><span className="page-kicker">Atendimento</span><h2>Equipamentos</h2><p>Vincule os aparelhos aos clientes antes de abrir uma ordem de serviço.</p></div>
        <button className="action-primary" type="button" onClick={novo}>＋ Novo equipamento</button>
      </div>

      <div className="clients-toolbar">
        <label className="search-box"><span>⌕</span><input type="search" placeholder="Buscar por cliente, marca, modelo ou série..." value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <span className="clients-count">{filtrados.length} equipamento(s)</span>
      </div>

      <div className="clients-card">
        {erro ? <div className="inline-state inline-state-error"><strong>Não foi possível carregar.</strong><span>{erro}</span><button onClick={() => void carregar()}>Tentar novamente</button></div>
        : carregando ? <div className="inline-state"><span className="table-loader" />Carregando equipamentos...</div>
        : filtrados.length === 0 ? <div className="empty-state"><div className="empty-state-icon">EQ</div><h3>Nenhum equipamento encontrado</h3><p>Cadastre o equipamento para relacioná-lo à futura ordem de serviço.</p></div>
        : <div className="table-scroll"><table className="clients-table"><thead><tr><th>Equipamento</th><th>Cliente</th><th>Série</th><th>Descrição</th><th /></tr></thead><tbody>
          {filtrados.map((e) => <tr key={e.id_equip}><td><strong>{[e.marca_equip, e.modelo_equip].filter(Boolean).join(" ") || "Equipamento sem identificação"}</strong><small className="table-subtext">{e.cor_equip || "Cor não informada"}</small></td><td>{clientePorId.get(e.id_cliente)?.nome_cliente ?? "Cliente"}</td><td>{e.num_serie || "—"}</td><td className="client-address">{e.descr_equip || "—"}</td><td className="client-actions"><button className="semantic-edit-action" onClick={() => editar(e)}>Editar</button></td></tr>)}
        </tbody></table></div>}
      </div>

      {modal ? <div className="modal-backdrop" onMouseDown={() => !salvando && setModal(false)}><section className="client-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header"><div><span className="page-kicker">{editando ? "Atualizar cadastro" : "Novo cadastro"}</span><h3>{editando ? "Editar equipamento" : "Cadastrar equipamento"}</h3></div><button className="modal-close" disabled={salvando} onClick={() => setModal(false)}>×</button></div>
        <form className="client-form" onSubmit={salvar}>
          <label><span>Cliente *</span><select required value={form.id_cliente} onChange={(e) => setForm({ ...form, id_cliente: e.target.value })}><option value="">Selecione...</option>{clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nome_cliente}</option>)}</select></label>
          <div className="client-form-grid">
            <PresetSelect label="Marca" value={form.marca_equip} options={MARCAS_EQUIPAMENTO} customLabel="Outra marca" customPlaceholder="Digite a marca..." onChange={(marca_equip) => setForm((current) => ({ ...current, marca_equip, modelo_equip: marca_equip === current.marca_equip ? current.modelo_equip : "" }))} />
            <PresetSelect label="Modelo" value={form.modelo_equip} options={modelosParaMarca(form.marca_equip)} customLabel="Outro modelo" customPlaceholder="Digite o modelo..." onChange={(modelo_equip) => setForm((current) => ({ ...current, modelo_equip }))} />
          </div>
          <div className="client-form-grid">
            <PresetSelect label="Cor" value={form.cor_equip} options={CORES_EQUIPAMENTO} customLabel="Outra cor" customPlaceholder="Digite a cor..." onChange={(cor_equip) => setForm((current) => ({ ...current, cor_equip }))} />
            <label><span>Número de série</span><input value={form.num_serie} onChange={(e) => setForm({ ...form, num_serie: e.target.value })} /></label>
          </div>
          <label><span>Descrição / observação</span><input value={form.descr_equip} onChange={(e) => setForm({ ...form, descr_equip: e.target.value })} /></label>
          {erroForm ? <div className="form-error" role="alert">{erroForm}</div> : null}
          <div className="modal-actions"><button className="action-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="action-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button></div>
        </form>
      </section></div> : null}
    </section>
  );
}
