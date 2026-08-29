begin;

-- Permite ao técnico assumir somente uma OS ainda sem responsável.
-- Trocar uma atribuição existente continua proibido para o perfil técnico.
create or replace function private.validar_permissoes_ordem_servico()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_funcao public.funcao_usuario;
begin
  if private.eh_admin_plataforma() then
    return new;
  end if;

  v_funcao := private.funcao_atual();
  if v_funcao is null then
    raise exception 'Usuário sem função operacional ativa';
  end if;

  if tg_op = 'INSERT' then
    if new.status_os <> 'RECEBIDO'
       or new.id_usuario_abertura <> private.usuario_atual_id()
       or new.id_assistencia <> private.assistencia_atual_id()
       or new.diag_os is not null
       or new.valor_total <> 0
       or new.data_conc is not null
       or new.data_entre is not null
       or new.num_os !~ '^OS-[0-9]{6,}$' then
      raise exception 'Dados iniciais da ordem de serviço são inválidos';
    end if;
    return new;
  end if;

  if new.id_os is distinct from old.id_os
     or new.id_assistencia is distinct from old.id_assistencia
     or new.num_os is distinct from old.num_os
     or new.id_cliente is distinct from old.id_cliente
     or new.id_equip is distinct from old.id_equip
     or new.id_usuario_abertura is distinct from old.id_usuario_abertura
     or new.data_aber is distinct from old.data_aber then
    raise exception 'Campos estruturais da ordem de serviço são imutáveis';
  end if;

  if v_funcao = 'RECEPCIONISTA' then
    if new.diag_os is distinct from old.diag_os
       or new.valor_total is distinct from old.valor_total then
      raise exception 'Recepção não pode alterar diagnóstico ou orçamento';
    end if;

    if new.status_os is distinct from old.status_os and not (
      (old.status_os = 'RECEBIDO' and new.status_os = 'CANCELADO')
      or (old.status_os = 'AGUARDANDO_APROVACAO'
          and new.status_os in ('EM_MANUTENCAO', 'CANCELADO'))
      or (old.status_os = 'CONCLUIDO' and new.status_os = 'ENTREGUE')
    ) then
      raise exception 'Recepção não pode realizar esta transição de status';
    end if;
  elsif v_funcao = 'TECNICO' then
    if new.defeito_relatorio is distinct from old.defeito_relatorio
       or new.prioridade_os is distinct from old.prioridade_os
       or (
         new.id_tecnico_responsavel is distinct from old.id_tecnico_responsavel
         and not (
           old.id_tecnico_responsavel is null
           and new.id_tecnico_responsavel = private.usuario_atual_id()
           and old.status_os in ('RECEBIDO', 'EM_ANALISE')
         )
       ) then
      raise exception 'Técnico não pode alterar dados de recepção ou responsável';
    end if;

    if new.status_os is distinct from old.status_os and not (
      (old.status_os = 'RECEBIDO' and new.status_os = 'EM_ANALISE')
      or (old.status_os = 'EM_ANALISE' and new.status_os = 'AGUARDANDO_APROVACAO')
      or (old.status_os = 'EM_MANUTENCAO' and new.status_os = 'CONCLUIDO')
    ) then
      raise exception 'Técnico não pode realizar esta transição de status';
    end if;
  end if;

  return new;
end;
$$;

commit;
