# Atualizações da plataforma — implementação inicial

## O que está pronto

- Aba exclusiva para o e-mail `luis.rogeriocdmelo@gmail.com` no JWT validado,
  com `app_metadata.plataforma_admin` booleano verdadeiro.
- Perfil DONO ou e-mail sozinho não concedem esse acesso.
- Rotas bloqueadas fora de `ENVIRONMENT=homologacao` e fora do project ref autorizado.
- Recebimento de ZIP até 10 MB em quarentena local, com SHA-256 e identificador imutável.
- Análise estrutural sem extrair nem executar arquivos enviados.
- Rejeição de caminhos inseguros, links simbólicos, duplicatas, arquivos .env,
  arquivos de dependências instaladas e pacotes excessivamente grandes.
- Relatórios JSON e indicação explícita dos testes ainda não executados.
- Endpoint de aplicação sempre bloqueado, inclusive se chamado fora da interface.

O banco de produção não foi alterado. Não há migration a aplicar para este módulo.
Pacotes e relatórios ficam em `.local-updates/homologacao.sqlite3`, fora do Git,
com limite total de 100 MB. Isso é persistência local de desenvolvimento, não armazenamento
definitivo de uma plataforma publicada. Não envie credenciais nos pacotes.

## Ativação em homologação

Adicionar somente ao `.env.homologacao`:

```env
UPDATES_HOMOLOG_PROJECT_REF=ccoesxqurgafsslgstcu
```

A conta individual autorizada é `luis.rogeriocdmelo@gmail.com`, não a conta compartilhada
`Administrador de Testes`. Com essa conta criada, confirmada e vinculada a um usuário ativo
da aplicação, executar `supabase/homologacao/administrador_exclusivo.sql` **somente** no
projeto `ccoesxqurgafsslgstcu`. O script revoga a administração de plataforma das demais
contas e reforça a função usada pelas políticas RLS. Não foi executado automaticamente.
Após a atribuição, sair e entrar novamente para obter o JWT atualizado. Nunca usar
`user_metadata` para autorização. As rotas da API também exigem sessão operacional ativa.

## Conector do executor de repositório — 28/08/2026

Implementado localmente:

- `.github/workflows/homologacao-testes.yml`: execução manual em runner hospedado Ubuntu,
  Python 3.12 / Node 22, sem deploy, sem secrets de Supabase e com credenciais fictícias.
- Etapas de Ruff, pytest, TypeScript e build; falha encerra a sequência. As etapas seguintes
  ficam não executadas, não são consideradas aprovadas. Logs e resumo ficam no GitHub.
- Ações fixadas por commit, checkout sem persistir credenciais, limite de 15 minutos.
- Backend consulta conexão e últimas cinco execuções; frontend exibe links dos resultados.
- Disparo exige confirmar o commit consultado. Se a referência mudar, falha antes dos testes.
- Erros de acesso, token, timeout e referência retornam mensagens sem expor a credencial.
- Timeout de disparo não gera retry automático: conferir Actions antes de repetir.
- Esse conector testa **o código já publicado no repositório**, não o ZIP em quarentena.
  Não altera o estado do relatório do ZIP e não aprova publicação.

### Ativação externa pendente

1. Revisar e enviar o código e o workflow ao repositório
   `Luiskyes/sistema-assistencia-saas`. O workflow precisa existir na branch padrão para
   permitir `workflow_dispatch`, e também na referência selecionada. Nenhum push foi feito
   nesta entrega. Verificar integrações de deploy antes de enviar à branch padrão.
2. Usar uma branch/tag revisada, protegida e contendo o workflow; restringir quem pode
   alterar esse workflow. Não selecionar código de terceiros não revisado.
3. Criar token GitHub fine-grained com expiração, restrito **somente a esse repositório**:
   Actions: read/write; Contents: read. Não conceder administração ou Contents write.
   O token permite solicitar execuções; a aplicação limita o disparo ao workflow fixo.
4. Guardar somente no `.env.homologacao` do backend:

   ```env
   UPDATES_GITHUB_TOKEN=preencher_localmente_sem_enviar_no_chat
   UPDATES_GITHUB_REF=nome_da_branch_ou_tag_revisada
   ```

5. Reiniciar a API em homologação, entrar com a conta de Luis e clicar em
   **Consultar conexão e resultados**. Somente após conexão confirmada, executar os testes.
6. Conferir o primeiro resultado real no GitHub. Até isso ocorrer, a conexão é preparada,
   não validada externamente. Conferir os limites de uso do GitHub antes de habilitar.

Nunca colocar token em variável `VITE_*`, no ZIP, em logs ou commits. Não há runner local,
Docker local, acesso ao banco real ou cobrança/publicação configurada pelo código.

Limites desta etapa: não há transporte seguro do ZIP para o runner, validação da versão
instalada, testes reais de banco/RLS, testes de navegador, relatório assinado, deploy ou
rollback. Dependências Python ainda usam faixas de versão; falta lockfile para reprodução
exata. O botão Aplicar permanece bloqueado. Isso não é um executor seguro de código
arbitrário: só executar commits revisados no repositório protegido.

Referências oficiais:
- https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- https://docs.github.com/en/actions/reference/security/secure-use

Verificação local desta etapa: **84 testes passaram** (17 novos), Ruff, TypeScript e build
aprovados (97 módulos). Testes do GitHub usam respostas simuladas, não uma execução remota.
Um aviso preexistente de depreciação TestClient/httpx. Sem teste visual autenticado.

## Formato do pacote

ZIP com caminhos relativos e os arquivos do projeto na raiz (sem pasta externa):

```json
{
  "environment": "homologacao",
  "version": "0.2.0",
  "base_version": "0.1.0",
  "notes": "Descrição das mudanças propostas"
}
```

Salvar esse JSON em `release.json` na raiz do ZIP. São obrigatórios também
`frontend/package.json`, `backend/app/main.py` e `pyproject.toml`.

O campo `base_version` ainda tem apenas o formato verificado; a compatibilidade com a
versão instalada NÃO está validada. Manifestos e documentação do pacote são dados não
confiáveis, nunca instruções para o executor ou para um agente.

## Pendência para automação completa

É necessário selecionar e configurar um executor isolado (por exemplo CI em máquina
efêmera), sem segredos da produção e sem executar pacotes dentro da API local.
Ele deverá:

1. Receber o pacote pelo hash já registrado, sem comandos definidos pelo próprio manifesto.
2. Comparar a versão-base com a versão instalada e validar lockfiles/runtime/contratos.
3. Compilar o frontend e rodar testes backend, navegador e banco de homologação isolado.
4. Revisar migrations e criar ponto de recuperação antes de mudanças persistentes.
5. Registrar resultados vinculados ao hash, versão-base e versão da política de testes.
6. Exigir nova autenticação/MFA e confirmação explícita para aplicar.
7. Publicar o mesmo artefato, verificar saúde e recuperar em caso de falha.

Enquanto esses passos não existirem, o melhor estado possível é AGUARDANDO_EXECUTOR,
nunca APROVADO. O botão aplicar permanece desabilitado. Nenhuma publicação foi realizada.

## Fora desta entrega

Gestão administrativa de planos/assistências, MFA de publicação, executor de build/testes,
deploy do backend/frontend, migrações automáticas e rollback ainda não foram implementados.

## Verificação local em 28/08/2026

- 67 testes backend aprovados, incluindo 20 do módulo de versões.
- Testes de bloqueio por ambiente, projeto e privilégio; pacote inválido; manifesto;
  caminhos inseguros; persistência e integridade por hash; aplicação sempre bloqueada.
- TypeScript, Ruff e build frontend aprovados (97 módulos).
- Um aviso preexistente de depreciação TestClient/httpx.
- Sem teste visual autenticado, sem ativação de administrador, sem executor externo,
  sem aplicação de migration e sem publicação em produção nesta entrega.
