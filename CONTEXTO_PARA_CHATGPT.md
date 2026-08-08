# Contexto completo — Sistema de Assistência Técnica

Use este documento como contexto principal para continuar o desenvolvimento deste projeto no ChatGPT.

## Objetivo do produto

Construir um sistema SaaS multiempresa para ser alugado a várias assistências técnicas. Cada assistência deve acessar somente seus próprios usuários, clientes, equipamentos e ordens de serviço.

O usuário prefere uma solução simples de desenvolver e hospedar, sem Docker local e sem precisar comprar domínio durante o desenvolvimento.

## Perfis de usuário

- DONO
- TECNICO
- RECEPCIONISTA

## Arquitetura escolhida

- Frontend: React 19 + TypeScript + Vite
- Backend: Python + FastAPI
- Banco: PostgreSQL do Supabase
- Autenticação: Supabase Auth
- Acesso ao banco: Supabase Data API/PostgREST usando o JWT do usuário
- Segurança multiempresa: Row Level Security (RLS) no Supabase
- Ambiente local:
  - Frontend: http://127.0.0.1:5173
  - Backend: http://127.0.0.1:8000
  - Swagger: http://127.0.0.1:8000/docs

Não usar MongoDB. O modelo é relacional e PostgreSQL/Supabase foi escolhido.

## Regras importantes de segurança

- Nunca colocar `service_role` no frontend.
- Nunca versionar ou exibir o conteúdo real do `.env`.
- O frontend usa apenas a chave pública/publishable do Supabase.
- O backend valida o JWT emitido pelo Supabase.
- O mesmo JWT é enviado para o PostgREST, mantendo as policies RLS ativas.
- `id_assistencia` nunca deve ser aceito do navegador em operações de criação.
- A API obtém `id_assistencia` a partir do perfil autenticado.
- Consultas e alterações devem ser protegidas por RLS e, quando possível, também filtrar explicitamente pela assistência da sessão.
- Senhas de equipamentos não devem ser armazenadas em texto puro. Existe `EQUIPMENT_ENCRYPTION_KEY` para futura criptografia reversível desse campo.

## Entidades e banco de dados

O script completo está em `supabase/schema.sql`.

Entidades já modeladas:

- `assistencias`
- `usuarios`
- `clientes`
- `equipamentos`
- `ordens_servico`
- `historicos_os`

As chaves usam UUID. O esquema possui FKs compostas com `id_assistencia`, índices, enums, triggers de status/histórico, grants restritos e policies RLS.

### Status de ordem de serviço

- RECEBIDO
- EM_ANALISE
- AGUARDANDO_APROVACAO
- EM_MANUTENCAO
- CONCLUIDO
- ENTREGUE
- CANCELADO

## Supabase já configurado

- Projeto Supabase já criado e com o schema executado.
- Assistência criada: `LuAssists`.
- ID da assistência: `f91900ae-2aef-4907-9ab7-0db73e0b887c`.
- Usuário de negócio criado com função `DONO` e ativo.
- Nome: Luis.
- E-mail atual: `luis.rogeriocdmelo@gmail.com`.
- Auth UID: `dc2ac05b-0f83-4f0c-a6f0-52b69ef8eb17`.
- ID do usuário de negócio: `5ddd2bd3-22cb-4292-a745-f8e5e1b513d6`.
- Site URL e Redirect URL do Supabase configurados para:
  `http://127.0.0.1:5173/auth/convite`

Não incluir chaves do Supabase neste documento. Elas já estão no `.env` local.

## Backend implementado

Arquivos principais:

- `app/main.py`
- `app/config.py`
- `app/security.py`
- `app/supabase.py`
- `app/dependencies.py`
- `app/schemas.py`
- `app/schemas_clientes.py`
- `app/schemas_equipamentos.py`
- `app/routers/health.py`
- `app/routers/public_config.py`
- `app/routers/session.py`
- `app/routers/clientes.py`
- `app/routers/equipamentos.py`

### Rotas atuais

- `GET /health`
- `GET /api/v1/config/public`
- `GET /api/v1/sessao/atual`
- `GET /api/v1/clientes`
- `GET /api/v1/clientes/{id_cliente}`
- `POST /api/v1/clientes`
- `PATCH /api/v1/clientes/{id_cliente}`
- `GET /api/v1/equipamentos`
- `GET /api/v1/equipamentos/{id_equip}`
- `POST /api/v1/equipamentos`
- `PATCH /api/v1/equipamentos/{id_equip}`

### Clientes

- Cadastro, listagem, busca por nome, paginação, consulta e edição.
- CPF é armazenado como texto e normalizado para 11 dígitos.
- Textos são limpos antes da gravação.
- Payloads extras são rejeitados.
- `id_assistencia` é injetado pela API usando a sessão.

### Equipamentos

- Cadastro, listagem, filtro por cliente, paginação, consulta e edição.
- O equipamento é vinculado a um cliente.
- Textos são normalizados.
- Payloads extras são rejeitados.
- `id_assistencia` é injetado pela API usando a sessão.
- Listagens, consultas e alterações também filtram pela assistência da sessão.

## Frontend implementado

Arquivos principais:

- `frontend/src/App.tsx`
- `frontend/src/lib/supabase.ts`
- `frontend/src/components/BrandPanel.tsx`
- `frontend/src/components/LoginForm.tsx`
- `frontend/src/components/InvitePasswordForm.tsx`
- `frontend/src/components/PasswordInput.tsx`
- `frontend/src/components/StatusMessage.tsx`
- `frontend/src/styles.css`

Funcionalidades:

- Tela de login responsiva.
- Mostrar/ocultar senha.
- Mensagens acessíveis de erro e status.
- Login real usando Supabase Auth.
- Tela de criação/redefinição de senha por convite.
- Tratamento de links com `code` e troca por sessão.
- Espera pelo evento de autenticação antes de considerar o convite inválido.
- Configuração pública do Supabase carregada pelo FastAPI.

## Correções já realizadas

### Convite aparecia como inválido

O Supabase aceitava o link, mas o frontend chamava `getSession()` cedo demais. A tela foi ajustada para:

- observar `onAuthStateChange`;
- aceitar `?code=` com `exchangeCodeForSession`;
- consultar a sessão atual;
- aguardar brevemente antes de mostrar convite inválido;
- cancelar listener e timer ao desmontar o componente.

Ainda falta testar novamente com um link real novo porque o provedor de e-mail gratuito do Supabase atingiu a cota temporária.

### CORS

O frontend usa `127.0.0.1`, mas a API aceitava apenas `localhost`. O `.env` foi corrigido para aceitar ambos:

`FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

O `.env.example` também foi criado com essa configuração, sem segredos.

## Testes e verificações já executados

- `pytest`: 11 testes passando.
- `ruff check app tests`: sem erros.
- `python -m compileall`: sem erros.
- `npm run typecheck`: sem erros.
- `npm run build`: build de produção concluído.
- `/health`: HTTP 200.
- `/api/v1/config/public`: HTTP 200 e somente campos públicos.
- Sessão, clientes e equipamentos sem token: HTTP 401.
- Token inválido: HTTP 401.
- CORS para `localhost:5173`: HTTP 200.
- CORS para `127.0.0.1:5173`: HTTP 200.
- Acesso anônimo direto a `clientes` no Supabase: HTTP 401.
- Login real com credenciais inexistentes: mensagem amigável correta.
- Link de convite sem token: estado de inválido/expirado correto.
- Swagger: todas as rotas aparecem corretamente.
- Interface verificada sem overlay de erro e sem rolagem horizontal no viewport testado.

Existe somente um aviso não bloqueante da integração `TestClient`/Starlette sobre futura migração de `httpx` para `httpx2`.

## Arquivos de configuração

- `.env`: contém valores reais e não deve ser mostrado nem enviado.
- `.env.example`: modelo seguro para configuração.
- `pyproject.toml`: dependências e ferramentas Python.
- `frontend/package.json`: dependências e scripts do React.
- `README.md`: instruções locais atualizadas.

## Como executar localmente

Backend:

```powershell
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm.cmd run dev
```

Testes:

```powershell
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\ruff.exe check app tests
cd frontend
npm.cmd run typecheck
npm.cmd run build
```

## Próximos passos recomendados

1. Após a cota de e-mail liberar, enviar um novo convite/recovery para Luis e validar a criação de senha ponta a ponta.
2. Criar o painel autenticado.
3. Criar telas de listagem/cadastro/edição de clientes.
4. Criar telas de listagem/cadastro/edição de equipamentos.
5. Implementar backend de ordens de serviço.
6. Implementar histórico automático e interface de mudança de status.
7. Aplicar controle de permissões por função.
8. Criar testes reais autenticados e testes de isolamento entre duas assistências.
9. Preparar deploy sem Docker, mantendo frontend, FastAPI e Supabase separados.

## Orientação para o novo ChatGPT

Continue trabalhando em português, com explicações simples e diretas. Antes de sugerir alterações, considere o que já está implementado. Não recrie o banco nem troque a arquitetura sem necessidade. Preserve o isolamento multiempresa, as policies RLS e as alterações existentes. Nunca solicite que o usuário publique chaves ou copie o conteúdo real do `.env` para o chat.

Ao fornecer código, prefira arquivos completos ou patches claros e sempre inclua como testar. O próximo trabalho mais útil é o painel autenticado e as interfaces de clientes/equipamentos, mas primeiro confirme o novo convite de Luis quando a cota do Supabase estiver disponível.
