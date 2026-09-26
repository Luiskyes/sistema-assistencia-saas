-- Execute somente no projeto lsassist-homologacao.
-- Antes, crie no Supabase Auth o usuário teste.homologacao@lsassist.dev.

do $$
declare
  v_auth_id uuid;
  v_assistencia_id uuid;
begin
  select id into v_auth_id
  from auth.users
  where lower(email) = 'teste.homologacao@lsassist.dev'
  limit 1;

  if v_auth_id is null then
    raise exception 'Crie primeiro o usuário de homologação no menu Authentication > Users';
  end if;

  select id_assistencia into v_assistencia_id
  from public.assistencias
  where lower(nome_assistencia) = lower('LSAssist Homologação')
  limit 1;

  if v_assistencia_id is null then
    insert into public.assistencias (
      nome_assistencia,
      email,
      plano,
      ativo
    ) values (
      'LSAssist Homologação',
      'teste.homologacao@lsassist.dev',
      'TESTE',
      true
    )
    returning id_assistencia into v_assistencia_id;
  end if;

  if not exists (select 1 from public.usuarios where id_auth = v_auth_id) then
    insert into public.usuarios (
      id_auth,
      id_assistencia,
      nome_usuario,
      funcao_usuario,
      email_usuario,
      ativo
    ) values (
      v_auth_id,
      v_assistencia_id,
      'Administrador de Testes',
      'DONO',
      'teste.homologacao@lsassist.dev',
      true
    );
  end if;
end;
$$;

select
  a.nome_assistencia,
  u.nome_usuario,
  u.funcao_usuario,
  u.email_usuario,
  u.ativo
from public.usuarios u
join public.assistencias a on a.id_assistencia = u.id_assistencia
where lower(u.email_usuario) = 'teste.homologacao@lsassist.dev';
