-- EXECUTAR SOMENTE NO PROJETO DE HOMOLOGAÇÃO ccoesxqurgafsslgstcu.
-- Vincula a conta Auth confirmada de Luis ao perfil operacional exigido pelo sistema.
-- É idempotente: não duplica assistência nem usuário.
begin;

do $$
declare
  v_auth_id uuid;
  v_assistencia_id uuid;
begin
  select id into v_auth_id
  from auth.users
  where lower(email) = 'luis.rogeriocdmelo@gmail.com'
    and email_confirmed_at is not null;

  if v_auth_id is null then
    raise exception 'A conta Auth confirmada de Luis não foi encontrada na homologação.';
  end if;

  -- Se o perfil já existe, apenas garante que permaneça ativo e com o papel de DONO.
  update public.usuarios
  set nome_usuario = 'Luis',
      funcao_usuario = 'DONO',
      email_usuario = 'luis.rogeriocdmelo@gmail.com',
      ativo = true
  where id_auth = v_auth_id;

  if found then
    return;
  end if;

  -- Reaproveita a assistência técnica de homologação criada para os testes.
  select id_assistencia into v_assistencia_id
  from public.assistencias
  where lower(nome_assistencia) = lower('LSAssist Homologação')
  order by data_criacao
  limit 1;

  if v_assistencia_id is null then
    insert into public.assistencias (nome_assistencia, email, plano, ativo)
    values ('LSAssist Homologação', 'luis.rogeriocdmelo@gmail.com', 'TESTE', true)
    returning id_assistencia into v_assistencia_id;
  else
    update public.assistencias set ativo = true where id_assistencia = v_assistencia_id;
  end if;

  insert into public.usuarios (
    id_auth, id_assistencia, nome_usuario, funcao_usuario, email_usuario, ativo
  ) values (
    v_auth_id, v_assistencia_id, 'Luis', 'DONO', 'luis.rogeriocdmelo@gmail.com', true
  );
end;
$$;

commit;

select
  a.nome_assistencia,
  a.ativo as assistencia_ativa,
  u.nome_usuario,
  u.funcao_usuario,
  u.email_usuario,
  u.ativo as usuario_ativo
from public.usuarios u
join public.assistencias a on a.id_assistencia = u.id_assistencia
where lower(u.email_usuario) = 'luis.rogeriocdmelo@gmail.com';
