# Atualizações pelo painel — etapa de preparação

## Implementado nesta etapa

- A análise de pacotes de código produz um plano ligado ao SHA-256 do ZIP.
- Inventário de todos os arquivos com tamanho e SHA-256 individual; leitura sem extração e sem execução.
- Inventário de arquivos SQL, inclusive fora da pasta convencional de migrations, sempre exigindo revisão.
- Lista explícita de pendências: versão instalada, testes do ZIP, instalador, saúde da aplicação e recuperação.
- Plano persistido no relatório da quarentena e incluído no download JSON.
- Painel com seção expansível explicando os arquivos, o banco e os bloqueios.
- Rejeição de tipos de pacote desconhecidos e versões não superiores à base declarada.
- Bloqueio de caminhos de credenciais e dependências também com letras maiúsculas.
- Gerador de pacote declara `kind=code` e inclui `frontend/index.html`.

## Verificação

110 testes Python passaram (8 novos); Ruff, TypeScript e build Vite passaram.
Os testes novos verificam inventário e hashes, SQL não aprovado, persistência, adulteração,
caminhos proibidos, versões, relatório pela API e bloqueio de produção.
Há um aviso preexistente de depreciação Starlette/httpx.
Testes usam SQLite temporário e autenticação simulada. Não validam transações reais no Supabase.
Não foi realizado teste visual autenticado nesta etapa.

## O que NÃO está finalizado

Este plano não instala código, não executa migrations e não libera produção.
O executor GitHub existente testa o repositório, não o ZIP enviado.
A recuperação existente é de temas, não do aplicativo completo nem do banco.
Nenhuma mudança foi publicada remotamente nesta etapa.

## Continuação necessária, sem obrigação de comprar domínio

1. Definir transporte privado do pacote para executor isolado e identidade verificável dos resultados.
2. Executar build e testes do mesmo hash sem credenciais de produção; guardar evidências e artefatos.
3. Registrar versão instalada do aplicativo e migrações aplicadas, com checksums e controle de concorrência.
4. Validar migrations em banco descartável; exigir revisão e plano de recuperação para mudanças de dados.
5. Integrar instalador/supervisor ao destino de homologação, com saúde pós-instalação e troca atômica.
6. Ensaiar restauração do código. Recuperação de banco é separada: voltar um backup pode perder dados novos.
7. Somente depois integrar o destino de produção, com aprovação explícita e credenciais segregadas.

Não é seguro substituir esses passos por um botão que execute scripts do ZIP dentro da API.
O plano é inventário, não uma análise semântica que certifique SQL ou código como seguros.
