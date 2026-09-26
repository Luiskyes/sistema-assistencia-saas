import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  ajustarEstoque,
  criarItemEstoque,
  listarEstoque,
  mensagemErroUsuario,
  type EstoqueItem,
  type EstoqueItemPayload,
  type FuncaoUsuario,
} from "../lib/api";
import { MARCAS_EQUIPAMENTO, modelosParaMarca } from "../lib/equipmentPresets";
import { CATEGORIAS_ESTOQUE, LOCALIZACOES_ESTOQUE } from "../lib/stockPresets";
import { PresetSelect } from "./PresetSelect";

type Props = { accessToken: string; funcao: FuncaoUsuario };
const EMPTY: EstoqueItemPayload = { codigo: "", descricao: "", quantidade_atual: 0, quantidade_minima: 0, ativo: true };

export function EstoquePanel({ accessToken, funcao }: Props) {
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<EstoqueItemPayload>(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [ajuste, setAjuste] = useState<EstoqueItem | null>(null);
  const [quantidadeNova, setQuantidadeNova] = useState(0);
  const [motivo, setMotivo] = useState("");
  const podeGerenciar = funcao === "DONO" || funcao === "RECEPCIONISTA";

  function abrirCadastro() {
    setForm(EMPTY);
    setErro(null);
    setModal(true);
  }

  async function carregar() {
    setCarregando(true); setErro(null);
    try { setItens(await listarEstoque(accessToken)); }
    catch (error: unknown) { setErro(mensagemErroUsuario(error, "Não foi possível carregar o estoque.")); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, [accessToken]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter((i) => [i.codigo, i.descricao, i.categoria, i.marca_compativel, i.modelo_compativel].filter(Boolean).some((v) => String(v).toLowerCase().includes(t)));
  }, [busca, itens]);

  const baixo = itens.filter((i) => i.quantidade_atual <= i.quantidade_minima).length;

  async function cadastrar(event: FormEvent) {
    event.preventDefault(); setSalvando(true); setErro(null);
    try { const criado = await criarItemEstoque(accessToken, form); setItens((atuais) => [criado, ...atuais]); setModal(false); setForm(EMPTY); }
    catch (error: unknown) { setErro(mensagemErroUsuario(error, "Não foi possível cadastrar a peça.")); }
    finally { setSalvando(false); }
  }

  function abrirAjuste(item: EstoqueItem) { setAjuste(item); setQuantidadeNova(item.quantidade_atual); setMotivo(""); }
  async function salvarAjuste(event: FormEvent) {
    event.preventDefault(); if (!ajuste) return; setSalvando(true); setErro(null);
    try { const atualizado = await ajustarEstoque(accessToken, ajuste.id_item, quantidadeNova, motivo); setItens((atuais) => atuais.map((item) => item.id_item === atualizado.id_item ? atualizado : item)); setAjuste(null); }
    catch (error: unknown) { setErro(mensagemErroUsuario(error, "Não foi possível ajustar o estoque.")); }
    finally { setSalvando(false); }
  }

  return <section className="resource-page">
    <div className="page-heading-row"><div><span className="page-kicker">Peças e insumos</span><h2>Estoque</h2><p>Consulte a disponibilidade antes de prosseguir com o atendimento.</p></div>{podeGerenciar ? <button className="action-primary" onClick={abrirCadastro}>＋ Nova peça</button> : null}</div>
    <div className="stock-summary"><div><span>Itens cadastrados</span><strong>{itens.length}</strong></div><div className={baixo ? "stock-alert" : ""}><span>Estoque baixo / zerado</span><strong>{baixo}</strong></div><div><span>Seu acesso</span><strong>{podeGerenciar ? "Consulta e gestão" : "Somente consulta"}</strong></div></div>
    <div className="clients-toolbar"><label className="search-box"><span>⌕</span><input placeholder="Buscar peça, código, marca ou modelo..." value={busca} onChange={(e) => setBusca(e.target.value)} /></label><span className="clients-count">{filtrados.length} item(ns)</span></div>
    {erro ? <div className="form-error stock-error" role="alert">{erro}</div> : null}
    <div className="clients-card">{carregando ? <div className="inline-state"><span className="table-loader" />Carregando estoque...</div> : filtrados.length === 0 ? <div className="empty-state"><div className="empty-state-icon">ST</div><h3>Estoque vazio</h3><p>Cadastre as peças para a equipe consultar a disponibilidade durante o atendimento.</p></div> : <div className="table-scroll"><table className="clients-table"><thead><tr><th>Código / peça</th><th>Compatibilidade</th><th>Disponível</th><th>Mínimo</th><th>Preço</th><th>Local</th><th /></tr></thead><tbody>{filtrados.map((i) => {
      const baixoItem = i.quantidade_atual <= i.quantidade_minima;
      return <tr key={i.id_item}><td><strong>{i.codigo}</strong><small className="table-subtext">{i.descricao}</small></td><td>{[i.marca_compativel, i.modelo_compativel].filter(Boolean).join(" · ") || "—"}</td><td><span className={baixoItem ? "qty-badge qty-low" : "qty-badge"}>{i.quantidade_atual}</span></td><td>{i.quantidade_minima}</td><td>{i.preco_venda == null ? "—" : Number(i.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>{i.localizacao || "—"}</td><td className="client-actions">{podeGerenciar ? <button className="semantic-warning-action" onClick={() => abrirAjuste(i)}>Ajustar</button> : null}</td></tr>;
    })}</tbody></table></div>}</div>

    {modal ? <div className="modal-backdrop" onMouseDown={() => !salvando && setModal(false)}><section className="client-modal stock-create-modal" role="dialog" aria-modal="true" aria-labelledby="stock-create-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><span className="page-kicker">Estoque</span><h3 id="stock-create-title">Cadastrar peça</h3><p>Cadastre a identificação, compatibilidade e o controle inicial.</p></div><button className="modal-close" aria-label="Fechar" onClick={() => setModal(false)}>×</button></div><form className="client-form stock-guided-form" onSubmit={cadastrar}>
      <div className="stock-form-section"><div className="stock-form-section-title"><b>1</b><div><strong>Identificação</strong><small>Como este item será localizado no estoque.</small></div></div><div className="client-form-grid"><label><span>Código *</span><input required placeholder="Ex.: BAT-SAM-A55" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></label><PresetSelect label="Categoria" value={form.categoria ?? ""} options={CATEGORIAS_ESTOQUE} customLabel="Outra categoria" customPlaceholder="Digite a categoria..." onChange={(categoria) => setForm((current) => ({ ...current, categoria: categoria || null }))} /></div><label><span>Descrição *</span><input required placeholder="Ex.: Bateria compatível com Galaxy A55" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label></div>
      <div className="stock-form-section"><div className="stock-form-section-title"><b>2</b><div><strong>Compatibilidade</strong><small>Opcional; ajuda a equipe a encontrar a peça correta.</small></div></div><div className="client-form-grid"><PresetSelect label="Marca compatível" value={form.marca_compativel ?? ""} options={MARCAS_EQUIPAMENTO} customLabel="Outra marca" customPlaceholder="Digite a marca..." onChange={(marca) => setForm((current) => ({ ...current, marca_compativel: marca || null, modelo_compativel: marca === current.marca_compativel ? current.modelo_compativel : null }))} /><PresetSelect label="Modelo compatível" value={form.modelo_compativel ?? ""} options={modelosParaMarca(form.marca_compativel ?? "")} customLabel="Outro modelo" customPlaceholder="Digite o modelo..." onChange={(modelo) => setForm((current) => ({ ...current, modelo_compativel: modelo || null }))} /></div></div>
      <div className="stock-form-section"><div className="stock-form-section-title"><b>3</b><div><strong>Controle</strong><small>Saldo, limite de alerta, valores e posição física.</small></div></div><div className="client-form-grid"><label><span>Quantidade inicial</span><input type="number" min="0" value={form.quantidade_atual} onChange={(e) => setForm({ ...form, quantidade_atual: Number(e.target.value) })} /></label><label><span>Estoque mínimo</span><input type="number" min="0" value={form.quantidade_minima} onChange={(e) => setForm({ ...form, quantidade_minima: Number(e.target.value) })} /></label></div><div className="client-form-grid">{funcao === "DONO" ? <label><span>Custo unitário</span><input type="number" min="0" step="0.01" value={form.custo_unitario ?? ""} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value ? Number(e.target.value) : null })} /></label> : <div />}<label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={form.preco_venda ?? ""} onChange={(e) => setForm({ ...form, preco_venda: e.target.value ? Number(e.target.value) : null })} /></label></div><PresetSelect label="Localização" value={form.localizacao ?? ""} options={LOCALIZACOES_ESTOQUE} customLabel="Outra localização" customPlaceholder="Ex.: Prateleira A3" onChange={(localizacao) => setForm((current) => ({ ...current, localizacao: localizacao || null }))} /></div>
      <div className="modal-actions"><button type="button" className="action-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="action-primary" disabled={salvando}>{salvando ? "Salvando..." : "Cadastrar peça"}</button></div>
    </form></section></div> : null}

    {ajuste ? <div className="modal-backdrop" onMouseDown={() => !salvando && setAjuste(null)}><section className="client-modal stock-adjust-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><span className="page-kicker">Ajuste auditável</span><h3>{ajuste.codigo} · {ajuste.descricao}</h3></div><button className="modal-close" onClick={() => setAjuste(null)}>×</button></div><form className="client-form" onSubmit={salvarAjuste}><p className="stock-current">Saldo atual: <strong>{ajuste.quantidade_atual}</strong></p><label><span>Novo saldo *</span><input type="number" min="0" required value={quantidadeNova} onChange={(e) => setQuantidadeNova(Number(e.target.value))} /></label><label><span>Motivo do ajuste *</span><input required minLength={3} placeholder="Ex.: Entrada de 5 peças da compra 123" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><div className="modal-actions"><button type="button" className="action-secondary" onClick={() => setAjuste(null)}>Cancelar</button><button className="action-primary" disabled={salvando}>Confirmar ajuste</button></div></form></section></div> : null}
  </section>;
}
