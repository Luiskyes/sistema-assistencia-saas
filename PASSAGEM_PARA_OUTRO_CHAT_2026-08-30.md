# LSAssist — relatório de passagem e plano de continuidade

Data: 30/08/2026. Destinatário: outro chat/agente que continuará o projeto.

Este documento reúne decisões do usuário, estado do código e próximos passos. Não contém
senhas, tokens nem chaves privadas. Não representa certificação de segurança ou prontidão
para produção. Os resultados de testes abaixo são da última execução, não foram repetidos
apenas para gerar este arquivo.

## 1. Objetivo e decisões que devem ser preservadas

LSAssist é um SaaS para várias assistências técnicas. Cada assistência deve acessar somente
seus próprios dados. Perfis operacionais: DONO, TECNICO e RECEPCIONISTA.

O usuário quer terminar o produto antes de publicar. Não quer comprar domínio nem escolher
hospedagem agora. Sua máquina é limitada; não exigir Docker local. Implementar inicialmente
na homologação, sem modificar produção. Usar o nome de Luis nos pacotes e na identificação
das entregas, não o nome do assistente.

O foco atual é atualizar o sistema pelo painel administrativo: enviar pacote, analisar,
testar, conferir compatibilidade, confirmar aplicação e recuperar uma versão anterior.
Não confundir isso com a aplicação de temas, que já existe.

O sistema apoia o atendimento: não exige pagamento integrado. Estoque próprio é opcional;
a assistência pode comprar peças de fornecedor para uma OS. Custo e fornecedor são internos;
o cliente deve conhecer o serviço contratado e o total, sem exposição de margem ou custo.

## 2. Arquitetura e localização

- Projeto local: `C:\Users\kwkay\Documents\Sistema de Assistência`.
- Frontend: React 19, TypeScript, Vite; pasta `frontend`.
- Backend: Python, FastAPI; pacote `backend/app`, entrada `main.py` na raiz.
- Banco operacional e autenticação: Supabase PostgreSQL/Auth.
- Acesso operacional ao banco: JWT do usuário via Data API/PostgREST, preservando RLS.
- Quarentena e estado de temas: SQLite local `.local-updates/homologacao.sqlite3`.
- Repositório: https://github.com/Luiskyes/sistema-assistencia-saas
- Branch de trabalho: `luis/homologacao-executor`.
- Último commit remoto registrado nesta continuidade: `1d93e2b735072b9aec4b07d653b7c5b178da1e03`.
- URLs locais habituais: frontend http://127.0.0.1:5173; API http://127.0.0.1:8000;
  documentação http://127.0.0.1:8000/docs. Conferir processos antes de iniciar: não são URLs públicas.

O repositório estava público. Não publicar arquivos locais, bancos, ZIPs com dados ou segredos.
Não fazer merge automático na main nem presumir que push equivale a implantação.

### Configuração e autorização

`.env.homologacao` contém configuração local de testes; `.env` é tratado como configuração
sensível de produção. Não copiar valores entre ambientes nem mostrar os arquivos no chat.
Usar `LSASSIST_ENV_FILE` explicitamente para selecionar homologação.

Projeto de homologação autorizado: `ccoesxqurgafsslgstcu`.
Administrador exclusivo: `luis.rogeriocdmelo@gmail.com`.
O acesso exige JWT válido, `app_metadata.plataforma_admin` booleano verdadeiro, conta com
perfil operacional ativo, ambiente homologação e project ref autorizado. E-mail sozinho,
perfil DONO ou `user_metadata` não concedem administração total.

Configurações relevantes: `UPDATES_HOMOLOG_PROJECT_REF`, `UPDATES_STORE_PATH`,
`UPDATES_GITHUB_TOKEN`, `UPDATES_GITHUB_REF`. Conferir os nomes/defaults em
`backend/app/config.py` antes de editar. Nenhum segredo deve ir para `VITE_*`.

## 3. Estado do produto operacional

Há módulos de login/convite, sessão, clientes, equipamentos, OS, estoque e plataforma.
Há seletores com opções comuns para equipamentos, defeitos, diagnóstico e serviços;
campos livres complementam opções como “Outro”. Os temas claro/escuro receberam ajustes.

Fluxo principal da OS:

`RECEBIDO → EM_ANALISE → AGUARDANDO_APROVACAO → EM_MANUTENCAO → CONCLUIDO → ENTREGUE`

Também existe CANCELADO. O código inclui orçamento com serviços e peças, atribuição de
responsável, pré-nota PDF, aprovação e consumo de estoque. Peças externas não devem baixar
estoque. A migration 009 trata cancelamento com destino das peças e compras externas.

Consultar as rotas `backend/app/routers/ordens.py`, `estoque.py`, o serviço
`pre_nota_pdf.py`, `tests/test_processos.py` e migrations 002 a 009 antes de mudar o fluxo.
O relatório operacional de 19/08 é histórico: suas pendências não devem ser tratadas como
atuais sem conferir o código posterior. Não há evidência nesta última etapa de teste real
completo de concorrência/RLS no Supabase.

Itens explicitamente deixados para depois pelo usuário: checklist e fotos de entrada/saída,
acessórios e avarias; histórico ampliado de todas as alterações; garantia e retorno vinculado
à OS original. Relatórios de margem e administração comercial das assistências também
precisam de escopo próprio; não considerar esses módulos prontos.

## 4. Atualizações: o que realmente funciona

### 4.1 Quarentena e relatórios

- Upload de ZIP de até 10 MB, com limite acumulado de quarentena de 100 MB.
- Armazenamento local, UUID, SHA-256 e relatório persistido.
- Inspeção sem extrair nem executar código enviado.
- Rejeição de caminhos inseguros, links simbólicos, duplicatas, ZIP criptografado,
  excesso de arquivos/tamanho e alguns caminhos de segredos/dependências.
- Download do relatório JSON.

Essas verificações não são antivírus, análise completa de segredos ou certificação de código seguro.
SQLite local atende esta instância de desenvolvimento; não é solução distribuída de produção.

### 4.2 Temas declarativos — implementado

- ZIP contendo `release.json` e `theme.json`, sem código ou CSS arbitrário.
- Tokens semânticos restritos, validação de cor e contraste, prévia claro/escuro.
- Conferência de base do tema e revisão, confirmação digitada, aplicação transacional.
- Auditoria e snapshot anterior para restauração; proteção contra confirmação desatualizada.
- Propagação dos tokens nos botões, na aba atual e em outras abas visíveis por atualização periódica/foco.

Pacote conhecido: `releases/luis-tema-0.1.1.zip`.
SHA-256: `43b887422ad724663e223e29d3518e3be4cc28458f75e9751dcad428a639f5a6`.
O usuário posteriormente aplicou o tema: último estado observado 0.1.1, revisão 1.
Conferir o estado atual antes de preparar outro pacote; reenviar a mesma base pode ser incompatível.
Versão do tema não é versão do aplicativo.

A pedido do usuário, dois uploads antigos foram arquivados manualmente no SQLite e removidos
da listagem, preservando o ativo e a recuperação. Não existe limpeza automática/deduplicação
completa implementada. Não apagar o banco para “limpar a tela”.

### 4.3 GitHub Actions — implementado para o repositório

Workflow `.github/workflows/homologacao-testes.yml`: execução manual, commit esperado,
checkout com actions fixadas, Python 3.12, Node 22, Ruff, pytest, TypeScript e build.
Sem credenciais de banco real e sem deploy. O painel consulta resultados e solicita testes.

Execução remota anteriormente confirmada como sucesso:
https://github.com/Luiskyes/sistema-assistencia-saas/actions/runs/33291351766
Essa execução corresponde ao commit 1d93e2b, não às últimas alterações locais.

Importante: este workflow testa o REPOSITÓRIO, não o ZIP em quarentena. Resultado verde
não libera o ZIP, não prova compatibilidade com banco instalado e não autoriza produção.
O token foi pensado para Actions read/write e Contents read no repositório específico;
não presumir permissão de escrita de código ou transporte privado de artefatos.

### 4.4 Plano de código — última etapa local implementada

O novo `backend/app/services/code_updates.py` gera inventário ligado ao hash do pacote:

- Caminho, tamanho e SHA-256 individual de todos os arquivos.
- Identificação de arquivos SQL, sempre com revisão obrigatória, inclusive fora de migrations.
- Versão e base declaradas; lista de arquivos de build faltantes.
- Pendências explícitas de executor, versão instalada, instalador, saúde e recuperação.
- `can_apply=false` e `production_enabled=false`.

O plano integra o relatório persistido, o download e uma seção expansível no painel.
Tipos desconhecidos de pacote e versões não superiores à base são rejeitados. Caminhos
`.env`, `.git`, `.venv` e `node_modules` passaram a considerar também maiúsculas/minúsculas.
O gerador de código agora declara `kind=code` e inclui `frontend/index.html`.

Limite importante: é inventário, não comparação real com banco ou aplicativo instalados.
O gerador ainda precisa de auditoria de completude/reprodutibilidade antes de servir para deploy.

## 5. O que NÃO está pronto

- Transporte privado e seguro do ZIP até um executor efêmero.
- Build/testes do ZIP exato, com evidência verificável vinculada ao hash.
- Registro confiável da versão instalada do aplicativo (separado do tema).
- Ledger de migrations aplicadas com checksums e comparação com o pacote.
- Execução de migrations com ensaio, backup validado e revisão.
- Instalador/supervisor para código, health checks, troca de versão e rollback do aplicativo.
- Publicação em produção, recuperação de banco, MFA/reauth de publicação.
- Testes reais end-to-end de todo esse fluxo.

O sistema completo de atualização NÃO está finalizado. Não substituir bloqueios por flags
manuais de “passou” nem executar scripts do ZIP dentro da API para aparentar conclusão.
Domínio não é pré-requisito; um destino de execução é necessário para testar instalação real.

## 6. Próximos passos, em ordem de dependência

### Etapa A — contrato e estado confiável de uma atualização

Definir manifesto versionado para código, runtimes, lockfiles e migrations. Separar versão
do aplicativo, versão do tema e revisão do esquema. Registrar operações, autor, hash,
versão-base, destino e eventos imutáveis. Prever idempotência, bloqueio de concorrência e
expiração da aprovação se pacote, base ou política de testes mudar.

Critério de aceite: mesma requisição não aplica duas vezes; uma base alterada invalida a
confirmação; apenas uma aplicação por ambiente; restart não perde estado da operação.

### Etapa B — executor do pacote, não apenas do repositório

Escolher transporte privado e executor isolado compatível com o orçamento. Pode aproveitar
CI remoto, mas o conector atual não resolve sozinho a entrega do ZIP. Evitar exigir Docker
no computador do usuário. Executor deve ser efêmero, limitado em tempo/recursos e sem
segredos de produção; comandos/política vêm da plataforma revisada, não do manifesto enviado.
Considerar também scripts de instalação e build como execução de código não confiável.

Fixar dependências e testar frontend/backend. Guardar artefatos e evidências com hash do
pacote, commit da política, runtime e resultado de cada etapa. Verificar a identidade e
integridade do resultado antes de aceitar callbacks; rejeitar replay e resultados de outro pacote.

Critério de aceite: um teste do repositório não aprova ZIP; pacote adulterado ou resultado
forjado falha; teste não executado nunca aparece como aprovado.

### Etapa C — banco e migrações

Criar ledger confiável e comparar checksums; não reaplicar todo o histórico em banco existente.
Ensaiar em banco descartável com a mesma base, com dados sintéticos, RLS e concorrência.
Inventário ou regex de SQL não prova segurança. Alterações destrutivas exigem revisão e devem
ficar bloqueadas no fluxo inicial. Preferir mudanças compatíveis com código anterior e posterior.

Separar executor de testes do aplicador privilegiado de migrations. Configurar backup e testar
restauração. Não presumir disponibilidade de PITR/backup gerenciado no plano gratuito.
Voltar código não desfaz SQL; restaurar backup pode apagar operações posteriores ao backup.

Critério de aceite: migration antiga alterada é bloqueada; falha não deixa estado reportado como
sucesso; plano de recuperação é ensaiado; isolamento entre duas assistências é testado realmente.

### Etapa D — instalação real na homologação

Implementar um adaptador de destino e um supervisor confiável separado da API. Instalar em
diretório/versão separado, validar saúde e só então trocar a versão ativa. Não sobrescrever
arquivos do processo em execução ou iniciar shells construídos a partir de entradas do ZIP.
Proteger caminhos, permissões e snapshots; manter versão anterior compatível.

É possível preparar interfaces sem escolher hospedagem. Se usar destino local para ensaio,
pedir confirmação do diretório/serviço e preservar o workspace. Teste com adaptador simulado
deve ser rotulado como simulado, não como implantação real.

Critério de aceite: falha de inicialização mantém/restaura versão saudável; confirmação é
obrigatória; interrupção/restart é recuperável; banco incompatível impede troca de código.

### Etapa E — produção somente depois

Quando o produto e os ensaios estiverem prontos, escolher hospedagem/endereço. Separar
credenciais, armazenamento e permissões por ambiente. Exigir nova autenticação/MFA,
confirmação explícita, artefato já validado, backup, health checks e auditoria. Não reconstruir
um artefato diferente depois da aprovação. A promoção deve usar a mesma versão verificada.

Critério de aceite: ensaio de falha e recuperação documentado; sem publicação acidental;
usuário concede autorização específica de produção. Esta passagem não concede essa autorização.

## 7. Matriz mínima de testes a ampliar

| Camada | Cobertura necessária |
|---|---|
| Caixa branca | Parser, limites, hashes, versões, máquina de estados, idempotência, concorrência |
| API/caixa preta | Não autenticado, usuário comum, admin, ambiente errado, mensagens claras, uploads inválidos |
| Integração executor | Pacote exato, timeout, cancelamento, resultado forjado, replay, falta de artefato |
| Banco real | RLS multiempresa, permissões, migration falha, checksum divergente, rollback/recuperação |
| Navegador | Upload, análise, progresso, confirmação, falha, download, reinício, claro/escuro, teclado |
| Instalação | Serviço não sobe, health check falha, falta de espaço, duas aplicações, recovery após restart |
| Regressão OS | Serviço sem peça, estoque, fornecedor, misto, aprovação, cancelamento, PDF e entrega |

Usar dados sintéticos; não testar destruição em produção. Relatório final deve diferenciar
simulado, real, não executado, aprovado e falhou, com logs sanitizados e versão testada.

## 8. Últimos resultados confirmados

- Pytest: **110 passaram**, incluindo 8 novos casos de plano/integridade/API.
- Ruff: passou após correção de ordenação de import.
- TypeScript: passou.
- Build Vite: passou, 99 módulos; primeira tentativa falhou por restrição de leitura do
  sandbox Windows, repetição com permissão adequada passou.
- Aviso preexistente de depreciação Starlette/TestClient/httpx permanece.
- Testes recentes usam SQLite temporário e autenticação substituída nas fixtures.
- Não houve teste visual autenticado, SQL real, instalação de código ou publicação nesta etapa.
- Teste visual anterior de temas usou componente real com API simulada; não prova RLS real.

## 9. Alterações locais ainda não publicadas

Estado verificado ao criar este documento:

Modificados:
- `backend/app/services/release_validation.py`
- `frontend/src/components/AtualizacoesPanel.tsx`
- `frontend/src/lib/api.ts`
- `scripts/criar-pacote-homologacao.ps1`

Novos/não rastreados:
- `backend/app/services/code_updates.py`
- `tests/test_code_updates.py`
- `RELATORIO_PLANO_ATUALIZACOES.md`
- `RELATORIO_TEMAS_HOMOLOGACAO.md`
- Este arquivo de passagem.

Preservar esses arquivos e mudanças. Não usar reset/checkout destrutivo. O próximo chat
precisa receber também o código atualizado; somente este relatório não entrega os patches.
Se não tiver acesso ao workspace, pedir snapshot sanitizado, nunca `.env` ou o SQLite real.

## 10. Arquivos que o próximo chat deve ler primeiro

1. Este documento e `RELATORIO_PLANO_ATUALIZACOES.md`.
2. `backend/app/routers/plataforma.py` e `backend/app/config.py`.
3. `backend/app/services/release_validation.py`, `code_updates.py`, `theme_updates.py`.
4. `backend/app/services/github_executor.py` e `.github/workflows/homologacao-testes.yml`.
5. `frontend/src/components/AtualizacoesPanel.tsx`, `ThemeRelease.tsx`,
   `frontend/src/lib/api.ts` e `themeUpdates.ts`.
6. `tests/test_releases.py`, `test_code_updates.py`, `test_theme_updates.py`, `test_github_executor.py`.
7. `scripts/criar-pacote-homologacao.ps1`, `criar-tema.py` e documentação de temas.

`CONTEXTO_PARA_CHATGPT.md` e partes de `ATUALIZACOES_HOMOLOGACAO.md` são antigos: contêm
contagens menores de testes e pendências posteriormente implementadas. Não usá-los para
concluir que não existe painel/OS ou que todos os pacotes, inclusive temas, estão bloqueados.

## 11. Comandos locais

Na raiz, iniciar API explicitamente em homologação:

```powershell
.\scripts\iniciar-homologacao.ps1
```

Em outro terminal:

```powershell
Set-Location frontend
npm.cmd run dev -- --host 127.0.0.1 --strictPort
```

Verificações, na raiz:

```powershell
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\ruff.exe check backend tests main.py
Set-Location frontend
npm.cmd run typecheck
npm.cmd run build
```

O script da API não usa reload: mudanças no backend exigem reinício controlado. Não iniciar
duplicatas em portas alternativas sem avisar. Não matar processos desconhecidos.

## 12. Mensagem pronta para iniciar o outro chat

> Continue o LSAssist a partir deste relatório e do código atual. Quero concluir o fluxo de
> atualização de código, funcionalidades e banco pelo painel, primeiro na homologação,
> sem comprar domínio ou publicar em produção agora. Já existem temas aplicáveis, testes
> do repositório no GitHub e inventário do ZIP; ainda falta executor do pacote, migrations
> controladas e instalador/recuperação do aplicativo. Inspecione os arquivos e mudanças
> locais antes de agir. Implemente por etapas verificáveis, preserve segurança multiempresa
> e não execute código enviado dentro da API. Não apresente testes simulados ou planos como
> deploy real concluído. Informe o que foi alterado, testes, limitações e dependências externas.
