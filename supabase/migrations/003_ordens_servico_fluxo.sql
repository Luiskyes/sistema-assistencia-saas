begin;

-- Numeração sequencial por assistência. O navegador nunca escolhe o número da OS.
alter table public.assistencias
  add column if not exists sequencia_os bigint not null default 0;

create or replace function public.proxima_numero_os()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_assistencia uuid;
  v_numero bigint;
begin
  v_assistencia := private.assistencia_atual_id();

  if v_assistencia is null then
    raise exception 'Usuário sem assistência ativa';
  end if;

  update public.assistencias
     set sequencia_os = sequencia_os + 1
   where id_assistencia = v_assistencia
     and ativo = true
  returning sequencia_os into v_numero;

  if v_numero is null then
    raise exception 'Assistência não encontrada ou inativa';
  end if;

  return 'OS-' || lpad(v_numero::text, 6, '0');
end;
$$;

revoke all on function public.proxima_numero_os() from public, anon;
grant execute on function public.proxima_numero_os() to authenticated;

-- A API controla permissões por função; o banco também impede saltos inválidos de status.
create or replace function private.validar_fluxo_ordem_servico()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status_os is distinct from old.status_os then
    if not (
      (old.status_os = 'RECEBIDO' and new.status_os in ('EM_ANALISE', 'CANCELADO'))
      or (old.status_os = 'EM_ANALISE' and new.status_os in ('AGUARDANDO_APROVACAO', 'EM_MANUTENCAO', 'CANCELADO'))
      or (old.status_os = 'AGUARDANDO_APROVACAO' and new.status_os in ('EM_MANUTENCAO', 'CANCELADO'))
      or (old.status_os = 'EM_MANUTENCAO' and new.status_os in ('CONCLUIDO', 'CANCELADO'))
      or (old.status_os = 'CONCLUIDO' and new.status_os = 'ENTREGUE')
    ) then
      raise exception 'Transição de status inválida: % -> %', old.status_os, new.status_os;
    end if;

    if new.status_os = 'CONCLUIDO' and new.data_conc is null then
      new.data_conc := now();
    end if;

    if new.status_os = 'ENTREGUE' and new.data_entre is null then
      new.data_entre := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ordens_validar_fluxo_trigger on public.ordens_servico;
create trigger ordens_validar_fluxo_trigger
before update of status_os on public.ordens_servico
for each row execute function private.validar_fluxo_ordem_servico();

commit;
