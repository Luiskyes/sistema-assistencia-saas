-- EXECUTAR SOMENTE NO PROJETO DE HOMOLOGAÇÃO ccoesxqurgafsslgstcu.
-- Não cria conta nem altera cargo operacional DONO/TECNICO/RECEPCIONISTA.
-- Remove administração de plataforma das demais contas desta base.
begin;
do $$
begin
  if (select count(*) from auth.users
      where lower(email) = 'luis.rogeriocdmelo@gmail.com'
        and email_confirmed_at is not null) <> 1 then
    raise exception 'Crie e confirme a conta individual de Luis na homologação antes de continuar.';
  end if;
end $$;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'plataforma_admin'
where lower(coalesce(email, '')) <> 'luis.rogeriocdmelo@gmail.com'
  and raw_app_meta_data ? 'plataforma_admin';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"plataforma_admin": true}'::jsonb
where lower(email) = 'luis.rogeriocdmelo@gmail.com';

-- Consulta o cadastro atual: a revogação não depende de JWT antigo expirar.
create or replace function private.eh_admin_plataforma()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and lower(u.email) = 'luis.rogeriocdmelo@gmail.com'
      and u.email_confirmed_at is not null
      and u.raw_app_meta_data -> 'plataforma_admin' = 'true'::jsonb
  )
$$;
revoke all on function private.eh_admin_plataforma() from public, anon;
grant execute on function private.eh_admin_plataforma() to authenticated;
commit;
-- Renovar login de Luis para receber app_metadata atualizada no JWT.
