begin;

alter table public.itens_os
  add column if not exists fornecedor varchar(180),
  add column if not exists custo_unitario numeric(12,2)
    check (custo_unitario is null or custo_unitario >= 0);

alter table public.itens_os drop constraint if exists itens_os_check;
alter table public.itens_os add constraint itens_os_tipo_origem_check check (
  (tipo = 'PECA' and quantidade = trunc(quantidade))
  or (tipo = 'SERVICO' and id_item_estoque is null and fornecedor is null and custo_unitario is null)
);

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
  if v_assistencia is null or v_usuario is null then
    raise exception 'Sessão operacional inválida';
  end if;
  if v_funcao not in ('DONO', 'RECEPCIONISTA') then
    raise exception 'Função sem permissão para registrar aprovação';
  end if;

  select * into v_ordem from public.ordens_servico
  where id_assistencia = v_assistencia and id_os = p_id_os
  for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if v_ordem.status_os <> 'AGUARDANDO_APROVACAO' then
    raise exception 'A OS não está aguardando aprovação';
  end if;

  -- Somente peças que realmente pertencem ao estoque geram baixa.
  for v_peca in
    select id_item_estoque, sum(quantidade)::integer as quantidade
    from public.itens_os
    where id_assistencia = v_assistencia
      and id_os = p_id_os
      and tipo = 'PECA'
      and id_item_estoque is not null
    group by id_item_estoque
  loop
    select * into v_item from public.estoque_itens
    where id_assistencia = v_assistencia and id_item = v_peca.id_item_estoque
    for update;
    if not found or not v_item.ativo then
      raise exception 'Peça do orçamento não está disponível';
    end if;
    if v_item.quantidade_atual < v_peca.quantidade then
      raise exception 'Saldo insuficiente para a peça %', v_item.descricao;
    end if;

    update public.estoque_itens
       set quantidade_atual = quantidade_atual - v_peca.quantidade,
           data_atualizacao = now()
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

commit;
