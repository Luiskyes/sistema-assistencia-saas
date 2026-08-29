begin;

alter table public.itens_os
  add column if not exists status_compra varchar(20),
  add column if not exists data_compra timestamptz,
  add column if not exists data_recebimento timestamptz;

alter table public.itens_os drop constraint if exists itens_os_status_compra_check;
alter table public.itens_os add constraint itens_os_status_compra_check check (
  (tipo = 'PECA' and id_item_estoque is null
    and (status_compra is null
      or status_compra in ('SOLICITADA', 'COMPRADA', 'RECEBIDA', 'CANCELADA')))
  or (not (tipo = 'PECA' and id_item_estoque is null) and status_compra is null)
);

alter table public.ordens_servico
  add column if not exists destino_pecas_cancelamento varchar(20),
  add column if not exists data_cancelamento timestamptz;

alter table public.ordens_servico drop constraint if exists ordens_destino_cancelamento_check;
alter table public.ordens_servico add constraint ordens_destino_cancelamento_check check (
  destino_pecas_cancelamento is null
  or destino_pecas_cancelamento in ('DEVOLVER_ESTOQUE', 'CONSUMIDAS', 'PERDA')
);

create or replace function public.atualizar_compra_externa_os(
  p_id_os uuid,
  p_id_item_os uuid,
  p_status varchar
)
returns setof public.itens_os
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_assistencia uuid := private.assistencia_atual_id();
  v_funcao public.funcao_usuario := private.funcao_atual();
  v_item public.itens_os%rowtype;
begin
  if v_funcao not in ('DONO', 'RECEPCIONISTA') then
    raise exception 'Sua função não pode atualizar compras externas';
  end if;
  if p_status not in ('SOLICITADA', 'COMPRADA', 'RECEBIDA', 'CANCELADA') then
    raise exception 'Status de compra inválido';
  end if;

  select i.* into v_item
  from public.itens_os i
  join public.ordens_servico os
    on os.id_assistencia = i.id_assistencia and os.id_os = i.id_os
  where i.id_assistencia = v_assistencia
    and i.id_os = p_id_os
    and i.id_item_os = p_id_item_os
    and i.tipo = 'PECA'
    and i.id_item_estoque is null
    and os.status_os in ('AGUARDANDO_APROVACAO', 'EM_MANUTENCAO')
  for update of i;

  if not found then raise exception 'Peça externa não encontrada nesta OS'; end if;
  if v_item.status_compra = 'RECEBIDA' then
    raise exception 'A compra externa já foi encerrada';
  end if;
  if v_item.status_compra = 'CANCELADA' and p_status <> 'SOLICITADA' then
    raise exception 'Solicite novamente a peça antes de registrar a compra';
  end if;
  if p_status = 'RECEBIDA' and v_item.status_compra <> 'COMPRADA' then
    raise exception 'Marque a peça como comprada antes de registrar o recebimento';
  end if;

  update public.itens_os
  set status_compra = p_status,
      data_compra = case
        when p_status = 'SOLICITADA' then null
        when p_status = 'COMPRADA' then now()
        else data_compra end,
      data_recebimento = case
        when p_status = 'SOLICITADA' then null
        when p_status = 'RECEBIDA' then now()
        else data_recebimento end
  where id_assistencia = v_assistencia and id_item_os = p_id_item_os;

  return query select * from public.itens_os
  where id_assistencia = v_assistencia and id_item_os = p_id_item_os;
end;
$$;

create or replace function public.iniciar_manutencao_com_estoque(p_id_os uuid)
returns setof public.ordens_servico
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_assistencia uuid := private.assistencia_atual_id();
  v_usuario uuid := private.usuario_atual_id();
  v_funcao public.funcao_usuario := private.funcao_atual();
  v_ordem public.ordens_servico%rowtype;
  v_peca record;
  v_item public.estoque_itens%rowtype;
begin
  if v_assistencia is null or v_usuario is null then raise exception 'Sessão operacional inválida'; end if;
  if v_funcao not in ('DONO', 'RECEPCIONISTA') then
    raise exception 'Função sem permissão para registrar aprovação';
  end if;

  select * into v_ordem from public.ordens_servico
  where id_assistencia = v_assistencia and id_os = p_id_os for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if v_ordem.status_os <> 'AGUARDANDO_APROVACAO' then
    raise exception 'A OS não está aguardando aprovação';
  end if;
  if exists (
    select 1 from public.itens_os
    where id_assistencia = v_assistencia and id_os = p_id_os
      and tipo = 'PECA' and id_item_estoque is null
      and status_compra <> 'RECEBIDA'
  ) then
    raise exception 'Confirme o recebimento de todas as peças compradas antes de iniciar a manutenção';
  end if;

  for v_peca in
    select id_item_estoque, sum(quantidade)::integer as quantidade
    from public.itens_os
    where id_assistencia = v_assistencia and id_os = p_id_os
      and tipo = 'PECA' and id_item_estoque is not null
    group by id_item_estoque
  loop
    select * into v_item from public.estoque_itens
    where id_assistencia = v_assistencia and id_item = v_peca.id_item_estoque for update;
    if not found or not v_item.ativo then raise exception 'Peça do orçamento não está disponível'; end if;
    if v_item.quantidade_atual < v_peca.quantidade then
      raise exception 'Saldo insuficiente para a peça %', v_item.descricao;
    end if;
    update public.estoque_itens
    set quantidade_atual = quantidade_atual - v_peca.quantidade, data_atualizacao = now()
    where id_assistencia = v_assistencia and id_item = v_item.id_item;
    insert into public.movimentos_estoque (
      id_assistencia, id_item, id_usuario, id_os, tipo, quantidade,
      quantidade_anterior, quantidade_nova, motivo
    ) values (
      v_assistencia, v_item.id_item, v_usuario, p_id_os, 'SAIDA', v_peca.quantidade,
      v_item.quantidade_atual, v_item.quantidade_atual - v_peca.quantidade,
      'Consumo autorizado na OS ' || v_ordem.num_os
    );
  end loop;

  update public.ordens_servico set status_os = 'EM_MANUTENCAO'
  where id_assistencia = v_assistencia and id_os = p_id_os;
  return query select * from public.ordens_servico
  where id_assistencia = v_assistencia and id_os = p_id_os;
end;
$$;

create or replace function public.cancelar_manutencao_com_destino(
  p_id_os uuid,
  p_destino varchar
)
returns setof public.ordens_servico
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_assistencia uuid := private.assistencia_atual_id();
  v_usuario uuid := private.usuario_atual_id();
  v_funcao public.funcao_usuario := private.funcao_atual();
  v_ordem public.ordens_servico%rowtype;
  v_mov record;
  v_saldo integer;
begin
  if v_funcao not in ('DONO', 'RECEPCIONISTA') then
    raise exception 'Sua função não pode cancelar uma manutenção';
  end if;
  if p_destino not in ('DEVOLVER_ESTOQUE', 'CONSUMIDAS', 'PERDA') then
    raise exception 'Informe o destino das peças utilizadas';
  end if;

  select * into v_ordem from public.ordens_servico
  where id_assistencia = v_assistencia and id_os = p_id_os for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if v_ordem.status_os <> 'EM_MANUTENCAO' then
    raise exception 'Somente uma OS em manutenção exige destino das peças';
  end if;

  if p_destino = 'DEVOLVER_ESTOQUE' then
    for v_mov in
      select id_item, sum(quantidade)::integer as quantidade
      from public.movimentos_estoque
      where id_assistencia = v_assistencia and id_os = p_id_os and tipo = 'SAIDA'
      group by id_item
    loop
      select quantidade_atual into v_saldo from public.estoque_itens
      where id_assistencia = v_assistencia and id_item = v_mov.id_item for update;
      update public.estoque_itens
      set quantidade_atual = quantidade_atual + v_mov.quantidade, data_atualizacao = now()
      where id_assistencia = v_assistencia and id_item = v_mov.id_item;
      insert into public.movimentos_estoque (
        id_assistencia, id_item, id_usuario, id_os, tipo, quantidade,
        quantidade_anterior, quantidade_nova, motivo
      ) values (
        v_assistencia, v_mov.id_item, v_usuario, p_id_os, 'ENTRADA', v_mov.quantidade,
        v_saldo, v_saldo + v_mov.quantidade,
        'Devolução por cancelamento da OS ' || v_ordem.num_os
      );
    end loop;
  end if;

  update public.itens_os set status_compra = 'CANCELADA'
  where id_assistencia = v_assistencia and id_os = p_id_os
    and tipo = 'PECA' and id_item_estoque is null
    and status_compra in ('SOLICITADA', 'COMPRADA');

  update public.ordens_servico
  set status_os = 'CANCELADO', destino_pecas_cancelamento = p_destino,
      data_cancelamento = now()
  where id_assistencia = v_assistencia and id_os = p_id_os;

  return query select * from public.ordens_servico
  where id_assistencia = v_assistencia and id_os = p_id_os;
end;
$$;

revoke all on function public.atualizar_compra_externa_os(uuid, uuid, varchar) from public, anon;
revoke all on function public.cancelar_manutencao_com_destino(uuid, varchar) from public, anon;
grant execute on function public.atualizar_compra_externa_os(uuid, uuid, varchar) to authenticated;
grant execute on function public.cancelar_manutencao_com_destino(uuid, varchar) to authenticated;

commit;
