# LSAssist — relatório completo para continuidade

**Data de consolidação:** 25/09/2026  
**Objetivo:** permitir que outro chat continue o projeto sem refazer decisões, confundir homologação com produção ou considerar prontas funções ainda planejadas.

> Este documento não contém senhas, tokens ou chaves. Antes de qualquer alteração, o próximo responsável deve ler este arquivo, conferir `git status` e preservar todas as mudanças locais existentes.

## 1. Visão geral

O LSAssist é um sistema SaaS multiempresa para gestão de assistências técnicas. O sistema organiza clientes, equipamentos, estoque e ordens de serviço, com isolamento de dados por assistência e perfis operacionais.

Tecnologias atuais:

- Frontend: React 19, TypeScript e Vite.
- Backend: Python, FastAPI e Pydantic.
- Banco e autenticação: PostgreSQL/Supabase Auth.
- Segurança de dados: JWT do usuário, RLS e validações adicionais no backend e no banco.
- Atualizações de tema: pacotes ZIP declarativos analisados sem executar código.
- Testes: Pytest no backend e TypeScript/build no frontend.

Diretório local:

`C:\Users\kwkay\Documents\Sistema de Assistência`

Endereços de desenvolvimento:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`
- Documentação da API: `http://127.0.0.1:8000/docs`

## 2. Decisões do produto que devem ser preservadas

- O trabalho atual ocorre somente na homologação. Produção não deve ser alterada até o produto estar concluído e aprovado.
- O usuário não deseja contratar domínio ou infraestrutura de produção neste momento.
- Cada assistência acessa somente seus próprios dados.
- Perfis operacionais existentes: `DONO`, `TECNICO` e `RECEPCIONISTA`.
- O e-mail autorizado como administrador total da plataforma é `luis.rogeriocdmelo@gmail.com`.
- Ser dono de uma assistência não concede automaticamente administração da plataforma.
- Uma assistência pode trabalhar sem estoque próprio e comprar peças de fornecedores por OS.
- O cliente vê a descrição dos itens e o total cobrado. Fornecedor, custo interno e margem não devem aparecer na pré-nota do cliente.
- Uma OS pode conter somente serviços, somente peças ou ambos.
- Estoque próprio só é baixado depois da aprovação, ao iniciar a manutenção.
- Peça externa necessária precisa estar recebida antes do início da manutenção.
- Cancelar uma OS em manutenção exige decidir o destino das peças: devolver ao estoque, registrar como consumidas ou registrar como perda.
- O nome de Luis deve ser usado na identificação das atualizações; não usar “Codex” como autor visível do produto.

## 3. Ambientes e execução local

Há configuração separada para homologação. O arquivo `.env.homologacao` é o ambiente que deve ser usado nos testes atuais. O arquivo `.env` já apontou para um projeto antigo/inválido e não deve ser presumido como homologação.

Comando recomendado para a API de homologação:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\iniciar-homologacao.ps1
```

Frontend:

```powershell
cd frontend
npm.cmd run dev -- --host 127.0.0.1
```

Nunca mostrar, copiar para o chat ou versionar `.env`, `.env.homologacao`, tokens do GitHub, chaves do Supabase ou senhas.

## 4. Autenticação e controle de acesso implementados

- Login pelo Supabase Auth.
- Definição de senha por convite.
- Recuperação da sessão atual por `/api/v1/sessao/atual`.
- Token JWT enviado do frontend para a API.
- Consultas ao Supabase usam o token do próprio usuário, preservando RLS.
- Perfil operacional ativo obrigatório; uma conta Auth sem perfil ativo recebe mensagem clara.
- Ambiente de homologação identificado na interface.
- Administração da plataforma exige, além do perfil operacional, autorização explícita em `app_metadata`, projeto de homologação permitido e administrador configurado.
- Erros de autenticação, sessão e perfil são convertidos em mensagens para o usuário.

Arquivos de referência:

- `frontend/src/App.tsx`
- `frontend/src/components/LoginForm.tsx`
- `frontend/src/components/InvitePasswordForm.tsx`
- `backend/app/dependencies.py`
- `backend/app/security.py`
- `backend/app/routers/session.py`
- `supabase/homologacao/administrador_exclusivo.sql`

## 5. Frontend e identidade visual

### Implementado

- Identidade visual oficial do LSAssist aplicada com logos claro, escuro e ícone.
- Tema claro em branco/cinza de gelo, com contraste reduzido e superfícies separadas.
- Tema escuro em azul-marinho profundo, com azul, verde e cores semânticas.
- Alternância claro/escuro.
- Layout responsivo em React.
- Sidebar, cabeçalho, cartões, tabelas, modais, formulários e botões refinados.
- Tela inicial chamada **Início**, com hero, ações principais e atalhos para os módulos.
- Tela de versões reorganizada, com textos e tabelas menos comprimidos.
- Componente compartilhado `PresetSelect` corrigido para sobrepor o conteúdo no desktop, usar fluxo estático no celular e fechar com clique externo ou `Escape`.
- Correção propagada para seletores de estoque, equipamentos e OS.
- Mensagens de status/erro reutilizáveis na interface.

### Última alteração desta etapa: login minimalista

- Retirados os três blocos promocionais que deixavam a tela carregada.
- Texto resumido para “Seu atendimento, mais simples”.
- Mantida somente uma mensagem discreta sobre operação conectada e dados protegidos.
- Painel visual mais estreito e formulário com largura de leitura controlada.
- No celular, o painel promocional é removido e ficam somente marca, formulário e rodapé.
- Contraste, espaçamento, botão e responsividade foram conferidos visualmente no navegador local.

Arquivos alterados nesta etapa:

- `frontend/src/components/BrandPanel.tsx`
- `frontend/src/styles.css`

## 6. Clientes

- Listagem e pesquisa.
- Cadastro, consulta e edição.
- Normalização de CPF.
- Mensagens claras de validação e erros da API.
- Abertura de nova OS a partir do cliente.
- Isolamento por assistência.

Arquivos principais:

- `frontend/src/components/ClientesPanel.tsx`
- `backend/app/routers/clientes.py`
- `backend/app/schemas_clientes.py`

## 7. Equipamentos

- Listagem, filtro, cadastro, consulta e edição.
- Vínculo obrigatório com cliente.
- Marca, modelo, cor, número de série e observações.
- Opções preparadas de marcas, modelos e cores, com alternativa livre.
- Seletores responsivos corrigidos.

Arquivos principais:

- `frontend/src/components/EquipamentosPanel.tsx`
- `frontend/src/lib/equipmentPresets.ts`
- `backend/app/routers/equipamentos.py`

## 8. Estoque

- Cadastro e edição de itens.
- Categorias preparadas e opção de outra categoria.
- Código, descrição, compatibilidade, localização, quantidade, estoque mínimo, custo e preço de venda.
- Ajuste de saldo com histórico de movimentações.
- Consulta de saldo mínimo.
- Permissões: técnico somente consulta; alterações de custo são restritas ao dono.
- Interface de cadastro organizada em etapas e seletores reutilizáveis.
- Baixa automática e atômica de peças do estoque ao iniciar manutenção depois da aprovação.
- Retorno ao estoque em cancelamento quando o destino escolhido for devolução.

Arquivos principais:

- `frontend/src/components/EstoquePanel.tsx`
- `frontend/src/lib/stockPresets.ts`
- `backend/app/routers/estoque.py`
- `supabase/migrations/002_estoque_e_regras_operacionais.sql`

## 9. Ordens de serviço

Fluxo principal:

`RECEBIDO → EM_ANALISE → AGUARDANDO_APROVACAO → EM_MANUTENCAO → CONCLUIDO → ENTREGUE`

Também existe `CANCELADO`, respeitando as regras de cada etapa.

### Criação

- Localização ou cadastro do cliente dentro do fluxo.
- Seleção de equipamento existente ou cadastro de equipamento.
- Prioridade e técnico responsável.
- Motivo principal com problemas predefinidos e opção livre.
- Validações com mensagens visíveis.

### Diagnóstico e orçamento

- Diagnósticos predefinidos e opção livre.
- Autoatribuição ao usuário responsável ao iniciar a análise, conforme regra de permissão.
- Serviços predefinidos que não exigem peça e serviço livre.
- Valor unitário, quantidade e subtotal por item.
- Peça do estoque ou peça externa de fornecedor.
- Fornecedor e custo unitário são internos e só o dono recebe o custo pela API.
- Total do orçamento recalculado no banco.
- Orçamento não pode ser alterado depois da etapa permitida.

### Pré-nota

- Visualização e geração em PDF.
- Disponível somente durante análise/aprovação.
- Emissão encaminha a OS para aprovação quando aplicável.
- Mostra serviços, peças, quantidades, valores cobrados e total.
- Não expõe custo da peça, fornecedor ou margem interna.

### Aprovação, estoque e fornecedor

- Aprovação do cliente inicia a manutenção.
- Peças de estoque têm baixa atômica e movimento vinculado à OS.
- Saldo insuficiente impede a operação com mensagem.
- Peças externas possuem estados `SOLICITADA`, `COMPRADA`, `RECEBIDA` e `CANCELADA`.
- Manutenção fica bloqueada enquanto uma peça externa necessária não estiver recebida.

### Cancelamento

- Cancelamento durante manutenção exige destino explícito das peças.
- `DEVOLVER_ESTOQUE` estorna o saldo e cria movimento de entrada.
- `CONSUMIDAS` e `PERDA` registram a decisão sem devolver saldo.
- Compras externas ainda abertas são canceladas junto com a OS.

### Permissões e histórico

- Regras por função para editar orçamento, mudar status, aprovar e cancelar.
- Técnico não altera OS atribuída a outro técnico.
- Histórico atual registra principalmente transições de status.

Arquivos principais:

- `frontend/src/components/OrdensPanel.tsx`
- `backend/app/routers/ordens.py`
- `backend/app/services/pre_nota_pdf.py`
- `supabase/migrations/003_ordens_servico_fluxo.sql` até `009_cancelamento_e_compras_externas.sql`

## 10. Banco de dados e segurança

- Esquema multiempresa em `supabase/schema.sql`.
- RLS para separar assistências.
- Regras operacionais duplicadas no banco para impedir contorno direto via Data API.
- RPCs para operações transacionais de estoque, aprovação, compra externa e cancelamento.
- Migrations incrementais numeradas de `002` a `009`.
- Scripts específicos para criar a assistência/administrador na homologação.
- Script de limpeza de dados de teste de produção existe, mas é destrutivo e nunca deve ser executado sem conferir o alvo e obter autorização específica.

Limite conhecido: testes automatizados locais usam substituições/mocks e não equivalem a um ensaio completo de RLS, concorrência e transações em um Supabase descartável.

## 11. Administração e atualizações da plataforma

### Temas declarativos: implementado em homologação

- Upload de ZIP com limite de tamanho.
- Quarentena local.
- `release.json` e `theme.json` obrigatórios.
- Validação estrutural, de tokens permitidos e contraste mínimo.
- SHA-256 do pacote.
- Prévia claro/escuro antes da aplicação.
- Confirmação digitada para aplicar.
- Versão-base e revisão evitam atualização sobre estado desatualizado.
- Histórico/auditoria e restauração do tema anterior.
- Nenhum CSS ou código arbitrário do ZIP é executado.

### Executor GitHub Actions: implementado para o repositório

- Consulta da conexão e dos resultados.
- Disparo manual de workflow.
- Workflow executa Ruff, Pytest, TypeScript e build.
- Não usa banco real e não publica o sistema.
- O resultado testa o código do repositório/commit, não o ZIP enviado à quarentena.

### Pacote de código: inventário seguro implementado, aplicação real bloqueada

O backend hoje:

- lista arquivos do ZIP;
- calcula SHA-256 de cada arquivo e do pacote;
- identifica SQL e exige revisão;
- confere arquivos mínimos de build;
- registra bloqueios e plano de recuperação;
- mantém `can_apply=false` e `production_enabled=false`.

Isto é intencional. Ainda **não** existe execução isolada do ZIP, instalador do aplicativo, troca atômica da versão ativa, health check pós-instalação, ledger real de migrations ou rollback de código/banco. Portanto, atualização de código e banco pelo painel não deve ser apresentada como finalizada.

Arquivos principais:

- `frontend/src/components/AtualizacoesPanel.tsx`
- `frontend/src/components/atualizacoes.css`
- `backend/app/routers/plataforma.py`
- `backend/app/services/release_validation.py`
- `backend/app/services/theme_updates.py`
- `backend/app/services/code_updates.py`
- `backend/app/services/github_executor.py`
- `.github/workflows/homologacao-testes.yml`

## 12. Testes e verificações desta consolidação

Executados em 25/09/2026 depois da simplificação do login:

| Verificação | Resultado |
|---|---|
| TypeScript (`npm.cmd run typecheck`) | Passou |
| Backend (`.venv\\Scripts\\python.exe -m pytest -q`) | **110 testes passaram** |
| Build Vite (`npm.cmd run build`) | Passou, 99 módulos transformados |
| `git diff --check` | Passou; apenas avisos de conversão LF/CRLF do Git no Windows |
| Inspeção visual no navegador local | Passou no layout responsivo do login |

Aviso não bloqueante existente: `StarletteDeprecationWarning` sobre `httpx`/`TestClient`.

O Python global desta máquina não contém Pytest; usar o interpretador da `.venv`.

Checklist manual já existente:

`outputs/testes-manuais/LSAssist_Checklist_Testes_Manuais.xlsx`

## 13. Funcionalidades planejadas, mas não concluídas

Não tratar como prontas:

- Checklist de entrada e saída do equipamento.
- Acessórios entregues.
- Fotos de avarias.
- Testes antes e depois do reparo.
- Histórico completo de diagnóstico, orçamento, técnico, prioridade, peças e datas.
- Garantia do serviço com início, fim, prazo e retorno vinculado à OS original.
- Relatório financeiro de custo, preço cobrado e margem.
- Administração comercial completa das assistências.
- Atualização executável de código/banco pelo painel.
- Publicação segura em produção e rollback completo da aplicação/banco.
- Teste real de concorrência e RLS em banco descartável.
- Domínio e hospedagem de produção.

## 14. Próximos passos recomendados

### Prioridade 1 — regressão funcional manual

Executar o checklist Excel usando somente homologação, cobrindo:

1. login e convite;
2. cliente novo e existente;
3. equipamento novo e existente;
4. OS somente com serviço;
5. OS com peça de estoque;
6. OS com peça externa;
7. OS mista;
8. pré-nota e aprovação;
9. baixa de estoque;
10. bloqueio por compra externa não recebida;
11. cancelamento com os três destinos;
12. conclusão e entrega;
13. mensagens de erro;
14. claro/escuro e responsividade.

### Prioridade 2 — pendências operacionais do produto

Implementar, nesta ordem sugerida:

1. checklist/fotos/acessórios;
2. histórico completo de auditoria;
3. garantia e retorno vinculado;
4. relatórios de margem apenas para o dono;
5. administração das assistências.

### Prioridade 3 — atualização de código real

Antes de habilitar “Aplicar” para código ou banco:

1. definir manifesto versionado do aplicativo;
2. criar executor efêmero que teste o ZIP exato e vincule o resultado ao SHA-256;
3. registrar versão instalada e migrations aplicadas com checksum;
4. preparar backup e testar restauração;
5. instalar em diretório separado;
6. executar health checks;
7. promover por troca atômica;
8. restaurar automaticamente a versão saudável em falha;
9. exigir reautenticação/confirmação;
10. manter produção desabilitada até autorização futura específica.

## 15. Cuidados para o próximo chat

- Começar com `git status --short`; a árvore contém mudanças locais legítimas do usuário e do trabalho anterior.
- Não usar `git reset --hard`, `git checkout --` nem apagar arquivos não rastreados.
- Não mudar produção.
- Não executar scripts destrutivos de limpeza.
- Não expor segredos.
- Não confundir atualização de tema com atualização do aplicativo.
- Não dizer que o painel já instala código ou migrations: hoje ele apenas inspeciona e bloqueia com segurança.
- Antes de qualquer nova alteração, repetir TypeScript, Pytest e build.
- Depois de iniciar o servidor, fazer verificação visual no navegador e procurar erros no console.

## 16. Estado final desta etapa

A tela de login foi simplificada e está responsiva. O núcleo operacional de clientes, equipamentos, estoque e fluxo de OS está implementado, incluindo pré-nota, serviços, peças próprias/externas, baixa, compra externa e cancelamento com destino. A gestão segura de temas em homologação está funcional. A análise de pacotes de código existe, porém a instalação real de código/banco e a publicação em produção continuam corretamente bloqueadas até existir infraestrutura segura e verificável.
