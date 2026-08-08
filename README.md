# Sistema de Assistência

Backend SaaS multiempresa para assistências técnicas, construído com FastAPI e
PostgreSQL/Supabase.

## O que já existe

- Esquema PostgreSQL multiempresa em supabase/schema.sql.
- RLS para separar os dados de cada assistência.
- API FastAPI com CORS configurável.
- Validação de tokens do Supabase Auth.
- Consulta do perfil atual usando a Data API e preservando a RLS.
- Cadastro, listagem, busca, consulta e edição de clientes.
- Cadastro, listagem, filtro, consulta e edição de equipamentos vinculados aos clientes.
- Normalização de CPF e bloqueio do id da assistência enviado pelo navegador.
- Endpoint público de saúde e documentação Swagger.
- Frontend React com login e definição de senha por convite.

## Configuração local sem Docker

Requer Python 3.11 ou mais recente.

    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install -e ".[dev]"
    Copy-Item .env.example .env

Preencha no arquivo .env:

- SUPABASE_URL: Dashboard do Supabase, Project Settings, API.
- SUPABASE_PUBLISHABLE_KEY: chave pública/publishable do mesmo painel.
- FRONTEND_ORIGINS: endereços autorizados a chamar a API.

Não coloque a chave service_role no frontend nem a versione no repositório.

Gere a chave que será usada futuramente para proteger senhas de equipamentos:

    python -m app.scripts.generate_encryption_key

Copie o resultado para EQUIPMENT_ENCRYPTION_KEY no arquivo .env.

## Executar

    uvicorn main:app --reload

Abra:

- API: http://127.0.0.1:8000/health
- Swagger: http://127.0.0.1:8000/docs

## Testar

    pytest
    ruff check .

## Como a autenticação funciona

1. O frontend realiza o login pelo Supabase Auth.
2. O Supabase devolve um access token JWT.
3. O frontend envia Authorization: Bearer TOKEN para o FastAPI.
4. A API verifica a assinatura e validade do token.
5. A API consulta o Supabase usando o mesmo token; assim, as policies RLS continuam ativas.
6. O endpoint /api/v1/sessao/atual devolve o perfil e a assistência do usuário.

## Rotas atuais

- GET /health
- GET /api/v1/sessao/atual
- GET /api/v1/clientes
- GET /api/v1/clientes/{id_cliente}
- POST /api/v1/clientes
- PATCH /api/v1/clientes/{id_cliente}
- GET /api/v1/equipamentos
- GET /api/v1/equipamentos/{id_equip}
- POST /api/v1/equipamentos
- PATCH /api/v1/equipamentos/{id_equip}

## Frontend

Com a API ativa na porta 8000:

    cd frontend
    npm.cmd install
    npm.cmd run dev

Acesse http://127.0.0.1:5173.

O fluxo de convite usa http://127.0.0.1:5173/auth/convite durante o
desenvolvimento. Essa URL deve ser adicionada no Supabase em Authentication,
URL Configuration, Redirect URLs antes de enviar um convite.
