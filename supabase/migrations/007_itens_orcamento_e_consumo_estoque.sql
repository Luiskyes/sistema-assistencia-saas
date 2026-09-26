begin;

do $$ begin
  create type public.tipo_item_os as enum ('PECA', 'SERVICO');
exception when duplicate_object then null;
end $$;

create table if not exists public.itens_os (
  id_item_os uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  id_os uuid not null,
  tipo public.tipo_item_os not null,
  id_item_estoque uuid,
  descricao varchar(180) not null,
  quantidade numeric(10,2) not null check (quantidade > 0),
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  subtotal numeric(14,2) generated always as (quantidade * valor_unitario) stored,
  data_criacao timestamptz not null default now(),
  foreign key (id_assistencia, id_os)
    references public.ordens_servico(id_assistencia, id_os) on delete restrict,
  foreign key (id_assistencia, id_item_estoque)
    references public.estoque_itens(id_assistencia, id_item) on delete restrict,
  check (btrim(descricao) <> ''),
  check (
    (tipo = 'PECA' and id_item_estoque is not null and quantidade = trunc(quantidade))
    or (tipo = 'SERVICO' and id_item_estoque is null)
  )
);

create index if not exists itens_os_ordem_idx
  on public.itens_os(id_assistencia, id_os, data_criacao);
create index if not exists itens_os_estoque_idx
  on public.itens_os(id_assistencia, id_item_estoque)
  where id_item_estoque is not null;

alter table public.itens_os enable row level security;

drop policy if exists itens_os_select on public.itens_os;
create policy itens_os_select on public.itens_os
for select to authenticated
using (id_assistencia = (select private.assistencia_atual_id()));

drop policy if exists itens_os_insert on public.itens_os;
create policy itens_os_insert on public.itens_os
for insert to authenticated
with check (
  id_assistencia = (select private.assistencia_atual_id())
  and (select private.funcao_atual()) in ('DONO', 'TECNICO')
  and exists (
    select 1 from public.ordens_servico os
    where os.id_assistencia = itens_os.id_assistencia
      and os.id_os = itens_os.id_os
      and os.status_os in ('RECEBIDO', 'EM_ANALISE')
  )
);

drop policy if exists itens_os_delete on public.itens_os;
create policy itens_os_delete on public.itens_os
for delete to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  and (select private.funcao_atual()) in ('DONO', 'TECNICO')
  and exists (
    select 1 from public.ordens_servico os
    where os.id_assistencia = itens_os.id_assistencia
      and os.id_os = itens_os.id_os
      and os.status_os in ('RECEBIDO', 'EM_ANALISE')
  )
);

grant select, insert, delete on public.itens_os to authenticated;
revoke all on public.itens_os from anon;

create or replace function private.recalcular_total_os()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assistencia uuid := coalesce(new.id_assistencia, old.id_assistencia);
  v_os uuid := coalesce(new.id_os, old.id_os);
begin
  update public.ordens_servico
     set valor_total = coalesce((
       select sum(i.subtotal) from public.itens_os i
       where i.id_assistencia = v_assistencia and i.id_os = v_os
     ), 0)
   where id_assistencia = v_assistencia and id_os = v_os;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists itens_os_recalcular_total_trigger on public.itens_os;
create trigger itens_os_recalcular_total_trigger
after insert or update or delete on public.itens_os
for each row execute function private.recalcular_total_os();

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

  for v_peca in
    select id_item_estoque, sum(quantidade)::integer as quantidade
    from public.itens_os
    where id_assistencia = v_assistencia and id_os = p_id_os and tipo = 'PECA'
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

revoke all on function public.iniciar_manutencao_com_estoque(uuid) from public, anon;
grant execute on function public.iniciar_manutencao_com_estoque(uuid) to authenticated;

commit;
