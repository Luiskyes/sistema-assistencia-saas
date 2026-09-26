begin;

-- Toda manutenção deve partir de um orçamento previamente aprovado.
-- A API valida também diagnóstico, valor e técnico; o banco impede o salto
-- de EM_ANALISE diretamente para EM_MANUTENCAO como defesa adicional.
create or replace function private.validar_fluxo_ordem_servico()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status_os is distinct from old.status_os then
    if not (
      (old.status_os = 'RECEBIDO' and new.status_os in ('EM_ANALISE', 'CANCELADO'))
      or (old.status_os = 'EM_ANALISE' and new.status_os in ('AGUARDANDO_APROVACAO', 'CANCELADO'))
      or (old.status_os = 'AGUARDANDO_APROVACAO' and new.status_os in ('EM_MANUTENCAO', 'CANCELADO'))
      or (old.status_os = 'EM_MANUTENCAO' and new.status_os in ('CONCLUIDO', 'CANCELADO'))
      or (old.status_os = 'CONCLUIDO' and new.status_os = 'ENTREGUE')
    ) then
      raise exception 'Transição de status inválida: % -> %', old.status_os, new.status_os;
    end if;

    if new.status_os = 'AGUARDANDO_APROVACAO' then
      if nullif(btrim(coalesce(new.diag_os, '')), '') is null then
        raise exception 'Diagnóstico obrigatório antes da aprovação';
      end if;
      if new.valor_total <= 0 then
        raise exception 'Orçamento deve ser maior que zero antes da aprovação';
      end if;
    end if;

    if new.status_os = 'CONCLUIDO' then
      if nullif(btrim(coalesce(new.diag_os, '')), '') is null then
        raise exception 'Diagnóstico obrigatório para concluir a OS';
      end if;
      if new.id_tecnico_responsavel is null then
        raise exception 'Técnico responsável obrigatório para concluir a OS';
      end if;
      if new.data_conc is null then
        new.data_conc := now();
      end if;
    end if;

    if new.status_os = 'ENTREGUE' and new.data_entre is null then
      new.data_entre := now();
    end if;
  end if;

  return new;
end;
$$;

commit;
