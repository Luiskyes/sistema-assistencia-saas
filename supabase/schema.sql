-- Sistema de Assistência Técnica - esquema inicial para Supabase/PostgreSQL
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

begin;

create extension if not exists pgcrypto;

-- Tipos controlados
create type public.funcao_usuario as enum (
  'DONO',
  'TECNICO',
  'RECEPCIONISTA'
);

create type public.status_os as enum (
  'RECEBIDO',
  'EM_ANALISE',
  'AGUARDANDO_APROVACAO',
  'EM_MANUTENCAO',
  'CONCLUIDO',
  'ENTREGUE',
  'CANCELADO'
);

create type public.prioridade_os as enum (
  'BAIXA',
  'NORMAL',
  'ALTA',
  'URGENTE'
);

create type public.plano_assistencia as enum (
  'TESTE',
  'BASICO',
  'PROFISSIONAL'
);

-- Cada empresa assinante do sistema.
create table public.assistencias (
  id_assistencia uuid primary key default gen_random_uuid(),
  nome_assistencia varchar(100) not null,
  documento varchar(14),
  telefone varchar(20),
  email varchar(254),
  plano public.plano_assistencia not null default 'TESTE',
  ativo boolean not null default true,
  data_criacao timestamptz not null default now(),

  constraint assistencias_nome_nao_vazio
    check (btrim(nome_assistencia) <> ''),
  constraint assistencias_documento_formato
    check (documento is null or documento ~ '^[0-9]{11}([0-9]{3})?$'),
  constraint assistencias_email_formato
    check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create unique index assistencias_documento_unico
  on public.assistencias (documento)
  where documento is not null;

create unique index assistencias_email_unico
  on public.assistencias (lower(email))
  where email is not null;

-- Perfil de negócio ligado ao usuário gerenciado pelo Supabase Auth.
-- A senha de login nunca é armazenada nesta tabela.
create table public.usuarios (
  id_usuario uuid primary key default gen_random_uuid(),
  id_auth uuid not null unique references auth.users(id) on delete cascade,
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  cpf_usuario varchar(11),
  nome_usuario varchar(100) not null,
  funcao_usuario public.funcao_usuario not null,
  email_usuario varchar(254) not null,
  ativo boolean not null default true,
  data_criacao timestamptz not null default now(),

  constraint usuarios_nome_nao_vazio
    check (btrim(nome_usuario) <> ''),
  constraint usuarios_cpf_formato
    check (cpf_usuario is null or cpf_usuario ~ '^[0-9]{11}$'),
  constraint usuarios_email_formato
    check (email_usuario ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint usuarios_assistencia_identidade_unique
    unique (id_assistencia, id_usuario)
);

create unique index usuarios_cpf_por_assistencia
  on public.usuarios (id_assistencia, cpf_usuario)
  where cpf_usuario is not null;

create unique index usuarios_email_por_assistencia
  on public.usuarios (id_assistencia, lower(email_usuario));

create index usuarios_assistencia_idx
  on public.usuarios (id_assistencia);

create table public.clientes (
  id_cliente uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  cpf_cliente varchar(11),
  nome_cliente varchar(100) not null,
  telefone varchar(20),
  endereco_cliente varchar(255),
  data_criacao timestamptz not null default now(),

  constraint clientes_nome_nao_vazio
    check (btrim(nome_cliente) <> ''),
  constraint clientes_cpf_formato
    check (cpf_cliente is null or cpf_cliente ~ '^[0-9]{11}$'),
  constraint clientes_assistencia_identidade_unique
    unique (id_assistencia, id_cliente)
);

create unique index clientes_cpf_por_assistencia
  on public.clientes (id_assistencia, cpf_cliente)
  where cpf_cliente is not null;

create index clientes_assistencia_nome_idx
  on public.clientes (id_assistencia, nome_cliente);

create table public.equipamentos (
  id_equip uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  id_cliente uuid not null,
  marca_equip varchar(50),
  modelo_equip varchar(100),
  cor_equip varchar(30),
  num_serie varchar(100),
  descr_equip text,
  data_criacao timestamptz not null default now(),

  constraint equipamentos_cliente_fk
    foreign key (id_assistencia, id_cliente)
    references public.clientes (id_assistencia, id_cliente)
    on delete restrict,
  constraint equipamentos_assistencia_identidade_unique
    unique (id_assistencia, id_equip)
);

create index equipamentos_cliente_idx
  on public.equipamentos (id_assistencia, id_cliente);

create unique index equipamentos_serie_por_assistencia
  on public.equipamentos (id_assistencia, num_serie)
  where num_serie is not null and btrim(num_serie) <> '';

create table public.ordens_servico (
  id_os uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  num_os varchar(30) not null,
  id_cliente uuid not null,
  id_equip uuid not null,
  id_usuario_abertura uuid not null,
  id_tecnico_responsavel uuid,

  data_aber timestamptz not null default now(),
  data_atual timestamptz not null default now(),
  data_conc timestamptz,
  data_entre timestamptz,

  defeito_relatorio text not null,
  -- Conteúdo criptografado no FastAPI (ex.: Fernet/AES-GCM).
  -- Nunca armazene a chave de criptografia no banco.
  senha_equip_criptografada bytea,
  diag_os text,
  valor_total numeric(10,2) not null default 0,
  status_os public.status_os not null default 'RECEBIDO',
  obser_os text,
  prioridade_os public.prioridade_os not null default 'NORMAL',

  constraint ordens_numero_nao_vazio
    check (btrim(num_os) <> ''),
  constraint ordens_defeito_nao_vazio
    check (btrim(defeito_relatorio) <> ''),
  constraint ordens_valor_nao_negativo
    check (valor_total >= 0),
  constraint ordens_datas_validas
    check (
      (data_conc is null or data_conc >= data_aber)
      and (data_entre is null or data_entre >= data_aber)
    ),
  constraint ordens_cliente_fk
    foreign key (id_assistencia, id_cliente)
    references public.clientes (id_assistencia, id_cliente)
    on delete restrict,
  constraint ordens_equipamento_fk
    foreign key (id_assistencia, id_equip)
    references public.equipamentos (id_assistencia, id_equip)
    on delete restrict,
  constraint ordens_usuario_abertura_fk
    foreign key (id_assistencia, id_usuario_abertura)
    references public.usuarios (id_assistencia, id_usuario)
    on delete restrict,
  constraint ordens_tecnico_fk
    foreign key (id_assistencia, id_tecnico_responsavel)
    references public.usuarios (id_assistencia, id_usuario)
    on delete restrict,
  constraint ordens_assistencia_identidade_unique
    unique (id_assistencia, id_os),
  constraint ordens_numero_por_assistencia_unique
    unique (id_assistencia, num_os)
);

create index ordens_assistencia_status_idx
  on public.ordens_servico (id_assistencia, status_os);

create index ordens_assistencia_abertura_idx
  on public.ordens_servico (id_assistencia, data_aber desc);

create index ordens_cliente_idx
  on public.ordens_servico (id_assistencia, id_cliente);

create index ordens_tecnico_idx
  on public.ordens_servico (id_assistencia, id_tecnico_responsavel)
  where id_tecnico_responsavel is not null;

create table public.historicos_os (
  id_hist uuid primary key default gen_random_uuid(),
  id_assistencia uuid not null references public.assistencias(id_assistencia) on delete restrict,
  id_usuario uuid,
  id_os uuid not null,
  data_evento timestamptz not null default now(),
  status_anterior public.status_os,
  status_novo public.status_os not null,
  obs_hist text,

  constraint historicos_usuario_fk
    foreign key (id_assistencia, id_usuario)
    references public.usuarios (id_assistencia, id_usuario)
    on delete restrict,
  constraint historicos_ordem_fk
    foreign key (id_assistencia, id_os)
    references public.ordens_servico (id_assistencia, id_os)
    on delete restrict,
  constraint historicos_mudanca_valida
    check (status_anterior is null or status_anterior <> status_novo)
);

create index historicos_ordem_data_idx
  on public.historicos_os (id_assistencia, id_os, data_evento desc);

-- Funções auxiliares de autenticação em um schema não exposto pela API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.assistencia_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id_assistencia
  from public.usuarios u
  where u.id_auth = (select auth.uid())
    and u.ativo = true
  limit 1
$$;

create or replace function private.usuario_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id_usuario
  from public.usuarios u
  where u.id_auth = (select auth.uid())
    and u.ativo = true
  limit 1
$$;

create or replace function private.funcao_atual()
returns public.funcao_usuario
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.funcao_usuario
  from public.usuarios u
  where u.id_auth = (select auth.uid())
    and u.ativo = true
  limit 1
$$;

create or replace function private.eh_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'plataforma_admin')::boolean,
    false
  )
$$;

grant usage on schema private to authenticated;
grant execute on function private.assistencia_atual_id() to authenticated;
grant execute on function private.usuario_atual_id() to authenticated;
grant execute on function private.funcao_atual() to authenticated;
grant execute on function private.eh_admin_plataforma() to authenticated;

-- Atualiza data_atual automaticamente em toda alteração da OS.
create or replace function private.atualizar_data_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.data_atual := now();

  if new.status_os = 'CONCLUIDO' and old.status_os <> 'CONCLUIDO'
     and new.data_conc is null then
    new.data_conc := now();
  end if;

  if new.status_os = 'ENTREGUE' and old.status_os <> 'ENTREGUE'
     and new.data_entre is null then
    new.data_entre := now();
  end if;

  return new;
end;
$$;

create trigger ordens_atualizar_data_trigger
before update on public.ordens_servico
for each row execute function private.atualizar_data_os();

-- Registra a criação e toda mudança de status automaticamente.
create or replace function private.registrar_historico_os()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  select u.id_usuario into v_usuario
  from public.usuarios u
  where u.id_auth = (select auth.uid())
    and u.id_assistencia = new.id_assistencia
  limit 1;

  if tg_op = 'INSERT' then
    insert into public.historicos_os (
      id_assistencia, id_usuario, id_os,
      status_anterior, status_novo, obs_hist
    ) values (
      new.id_assistencia, v_usuario, new.id_os,
      null, new.status_os, 'Ordem de serviço criada'
    );
  elsif new.status_os is distinct from old.status_os then
    insert into public.historicos_os (
      id_assistencia, id_usuario, id_os,
      status_anterior, status_novo
    ) values (
      new.id_assistencia, v_usuario, new.id_os,
      old.status_os, new.status_os
    );
  end if;

  return new;
end;
$$;

create trigger ordens_historico_trigger
after insert or update of status_os on public.ordens_servico
for each row execute function private.registrar_historico_os();

-- Row-Level Security: isolamento entre assistências.
alter table public.assistencias enable row level security;
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.equipamentos enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.historicos_os enable row level security;

-- Assistências: usuário vê a própria; dono edita; admin da plataforma gerencia todas.
create policy assistencias_select
on public.assistencias for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy assistencias_insert_admin
on public.assistencias for insert to authenticated
with check ((select private.eh_admin_plataforma()));

create policy assistencias_update
on public.assistencias for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) = 'DONO')
  or (select private.eh_admin_plataforma())
)
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) = 'DONO')
  or (select private.eh_admin_plataforma())
);

-- Usuários: membros ativos veem a equipe; somente dono/admin gerencia perfis.
create policy usuarios_select
on public.usuarios for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy usuarios_insert
on public.usuarios for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) = 'DONO')
  or (select private.eh_admin_plataforma())
);

create policy usuarios_update
on public.usuarios for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) = 'DONO')
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

-- Clientes e equipamentos: todos consultam; dono e recepção cadastram/alteram.
create policy clientes_select
on public.clientes for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy clientes_insert
on public.clientes for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
);

create policy clientes_update
on public.clientes for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy equipamentos_select
on public.equipamentos for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy equipamentos_insert
on public.equipamentos for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
);

create policy equipamentos_update
on public.equipamentos for update to authenticated
using (
  (id_assistencia = (select private.assistencia_atual_id())
   and (select private.funcao_atual()) in ('DONO', 'RECEPCIONISTA'))
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

-- OS: toda a equipe pode consultar, cadastrar e atualizar dentro da própria assistência.
create policy ordens_select
on public.ordens_servico for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

create policy ordens_insert
on public.ordens_servico for insert to authenticated
with check (
  (id_assistencia = (select private.assistencia_atual_id())
   and id_usuario_abertura = (select private.usuario_atual_id()))
  or (select private.eh_admin_plataforma())
);

create policy ordens_update
on public.ordens_servico for update to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
)
with check (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

-- O histórico é imutável: leitura pela equipe e inserção pelo trigger acima.
create policy historicos_select
on public.historicos_os for select to authenticated
using (
  id_assistencia = (select private.assistencia_atual_id())
  or (select private.eh_admin_plataforma())
);

-- Privilégios para a API autenticada. As policies continuam sendo aplicadas.
-- Revoga primeiro eventuais privilégios padrão herdados pelo projeto Supabase.
revoke all on public.assistencias from authenticated;
revoke all on public.usuarios from authenticated;
revoke all on public.clientes from authenticated;
revoke all on public.equipamentos from authenticated;
revoke all on public.ordens_servico from authenticated;
revoke all on public.historicos_os from authenticated;

grant select, insert on public.assistencias to authenticated;
grant update (nome_assistencia, documento, telefone, email)
  on public.assistencias to authenticated;
grant select, insert, update on public.usuarios to authenticated;
grant select, insert, update on public.clientes to authenticated;
grant select, insert, update on public.equipamentos to authenticated;
grant select, insert, update on public.ordens_servico to authenticated;
grant select on public.historicos_os to authenticated;

-- Nenhuma tabela de negócio fica disponível para visitantes sem login.
revoke all on public.assistencias from anon;
revoke all on public.usuarios from anon;
revoke all on public.clientes from anon;
revoke all on public.equipamentos from anon;
revoke all on public.ordens_servico from anon;
revoke all on public.historicos_os from anon;

commit;
