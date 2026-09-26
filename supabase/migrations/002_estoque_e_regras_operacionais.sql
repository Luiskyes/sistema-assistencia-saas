-- LSAssist - Etapa 2
-- Estoque + ajuste das permissões operacionais solicitadas.

begin;

-- Técnico também pode cadastrar/atualizar cliente e equipamento dentro da própria assistência.
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists equipamentos_insert on public.equipamentos;
drop policy if exists equipamentos_update on public.equipamentos;

create policy clientes_insert
on public.clientes for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA', 'TECNICO'))
  or (select private.eh_admin_plataforma())
);

create policy clientes_update
on public.clientes for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA', 'TECNICO'))
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy equipamentos_insert
on public.equipamentos for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA', 'TECNICO'))
  or (select private.eh_admin_plataforma())
);

create policy equipamentos_update
on public.equipamentos for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA', 'TECNICO'))
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create table if not exists public.estoque_itens (
  id_item uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  codigo varchar(40) not null,
  descricao varchar(140) not null,
  categoria varchar(60),
  marca_compativel varchar(60),
  modelo_compativel varchar(120),
  quantidade_atual integer not null default 0 check (quantidade_atual >= 0),
  quantidade_minima integer not null default 0 check (quantidade_minima >= 0),
  custo_unitario numeric(12,2) check (custo_unitario is null or custo_unitario >= 0),
  preco_venda numeric(12,2) check (preco_venda is null or preco_venda >= 0),
  localizacao varchar(80),
  ativo boolean not null default true,
  data_criacao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),
  unique (id_assistencia, codigo),
  unique (id_assistencia, id_item),
  check (btrim(codigo) <> ''),
  check (btrim(descricao) <> '')
);

create index if not exists estoque_assistencia_descricao_idx
  on public.estoque_itens (id_assistencia, descricao);
create index if not exists estoque_assistencia_saldo_idx
  on public.estoque_itens (id_assistencia, quantidade_atual, quantidade_minima);

create table if not exists public.movimentos_estoque (
  id_movimento uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  id_item uuid not null,
  id_usuario uuid,
  id_os uuid,
  tipo varchar(20) not null,
  quantidade integer not null check (quantidade > 0),
  quantidade_anterior integer not null check (quantidade_anterior >= 0),
  quantidade_nova integer not null check (quantidade_nova >= 0),
  motivo varchar(255),
  data_movimento timestamptz not null default now(),
  foreign key (id_assistencia, id_item)
    references public.estoque_itens(id_assistencia, id_item) on delete restrict,
  foreign key (id_assistencia, id_usuario)
    references public.usuarios(id_assistencia, id_usuario) on delete restrict,
  foreign key (id_assistencia, id_os)
    references public.ordens_servico(id_assistencia, id_os) on delete restrict,
  check (tipo in ('ENTRADA', 'SAIDA', 'AJUSTE', 'RESERVA', 'LIBERACAO'))
);

create index if not exists movimentos_estoque_item_data_idx
  on public.movimentos_estoque (id_assistencia, id_item, data_movimento desc);

alter table public.estoque_itens enable row level security;
alter table public.movimentos_estoque enable row level security;

create policy estoque_select
on public.estoque_itens for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy estoque_insert
on public.estoque_itens for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
);

create policy estoque_update
on public.estoque_itens for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy movimentos_estoque_select
on public.movimentos_estoque for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create or replace function public.ajustar_estoque_item(
  p_id_item uuid,
  p_quantidade_nova integer,
  p_motivo text
)
returns setof public.estoque_itens
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_assistencia uuid;
  v_usuario uuid;
  v_funcao public.funcao_usuario;
  v_anterior integer;
  v_delta integer;
begin
  if p_quantidade_nova < 0 then
    raise exception 'Quantidade não pode ser negativa';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do ajuste';
  end if;

  v_assistencia := private.assistencia_atual_id();
  v_usuario := private.usuario_atual_id();
  v_funcao := private.funcao_atual();

  if v_assistencia is null or v_usuario is null then
    raise exception 'Usuário sem contexto de assistência';
  end if;
  if v_funcao not in ('DONO', 'RECEPCIONISTA') then
    raise exception 'Função sem permissão para ajustar estoque';
  end if;

  select quantidade_atual into v_anterior
  from public.estoque_itens
  where id_item = p_id_item and id_assistencia = v_assistencia
  for update;

  if not found then
    raise exception 'Item de estoque não encontrado';
  end if;

  v_delta := abs(p_quantidade_nova - v_anterior);
  if v_delta = 0 then
    return query select * from public.estoque_itens
      where id_item = p_id_item and id_assistencia = v_assistencia;
    return;
  end if;

  update public.estoque_itens
  set quantidade_atual = p_quantidade_nova,
      data_atualizacao = now()
  where id_item = p_id_item and id_assistencia = v_assistencia;

  insert into public.movimentos_estoque (
    id_assistencia, id_item, id_usuario, tipo, quantidade,
    quantidade_anterior, quantidade_nova, motivo
  ) values (
    v_assistencia, p_id_item, v_usuario, 'AJUSTE', v_delta,
    v_anterior, p_quantidade_nova, btrim(p_motivo)
  );

  return query select * from public.estoque_itens
    where id_item = p_id_item and id_assistencia = v_assistencia;
end;
$$;

revoke all on public.estoque_itens from authenticated;
revoke all on public.movimentos_estoque from authenticated;
grant select, insert, update on public.estoque_itens to authenticated;
grant select on public.movimentos_estoque to authenticated;
grant execute on function public.ajustar_estoque_item(uuid, integer, text) to authenticated;

commit;
