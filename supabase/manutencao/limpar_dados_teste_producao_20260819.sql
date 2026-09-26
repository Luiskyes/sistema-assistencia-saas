-- ATENÇÃO: execute somente no projeto de PRODUÇÃO depois de confirmar que todos
-- os dados operacionais existentes são de teste.
-- Preserva assistências, usuários, autenticação, estrutura, funções e policies.

begin;

-- Cópia recuperável. Se este schema já existir, o script para sem excluir nada.
create schema cleanup_backup_20260819;

create table cleanup_backup_20260819.clientes as table public.clientes;
create table cleanup_backup_20260819.equipamentos as table public.equipamentos;
create table cleanup_backup_20260819.ordens_servico as table public.ordens_servico;
create table cleanup_backup_20260819.historicos_os as table public.historicos_os;
create table cleanup_backup_20260819.estoque_itens as table public.estoque_itens;
create table cleanup_backup_20260819.movimentos_estoque as table public.movimentos_estoque;
create table cleanup_backup_20260819.itens_os as table public.itens_os;

-- Evita que a exclusão administrativa dos itens tente recalcular uma OS.
alter table public.itens_os disable trigger itens_os_recalcular_total_trigger;

-- Ordem respeita todas as chaves estrangeiras.
delete from public.historicos_os;
delete from public.movimentos_estoque;
delete from public.itens_os;
delete from public.ordens_servico;
delete from public.equipamentos;
delete from public.clientes;
delete from public.estoque_itens;

alter table public.itens_os enable trigger itens_os_recalcular_total_trigger;

-- A próxima ordem criada voltará a ser OS-000001.
update public.assistencias set sequencia_os = 0;

commit;

-- Conferência: todos os resultados abaixo devem ser zero.
select 'clientes' as tabela, count(*) as registros from public.clientes
union all select 'equipamentos', count(*) from public.equipamentos
union all select 'ordens_servico', count(*) from public.ordens_servico
union all select 'historicos_os', count(*) from public.historicos_os
union all select 'estoque_itens', count(*) from public.estoque_itens
union all select 'movimentos_estoque', count(*) from public.movimentos_estoque
union all select 'itens_os', count(*) from public.itens_os;
