# LSAssist

Sistema SaaS multiempresa para gestão de assistências técnicas.

O **LSAssist** centraliza clientes, equipamentos, ordens de serviço, estoque e processos operacionais de uma assistência técnica em uma aplicação web, mantendo isolamento dos dados entre empresas.

> Projeto atualmente em desenvolvimento e homologação. O ambiente de produção ainda não está liberado.

## Tecnologias

### Frontend

- React 19
- TypeScript
- Vite
- Supabase Auth

### Backend

- Python 3.11+
- FastAPI
- Pydantic
- ReportLab
- Pytest

### Banco e autenticação

- PostgreSQL
- Supabase
- Row Level Security (RLS)
- Supabase Auth
- PostgREST / Data API

## Funcionalidades atuais

O LSAssist já possui:

- autenticação com Supabase Auth;
- definição de senha por convite;
- sessão autenticada integrada ao backend;
- arquitetura SaaS multiempresa;
- separação dos dados de cada assistência por RLS;
- cadastro e gerenciamento de clientes;
- cadastro e gerenciamento de equipamentos;
- controle de estoque;
- saldo mínimo e movimentações de estoque;
- criação e gerenciamento de ordens de serviço;
- diagnóstico técnico;
- orçamento da ordem de serviço;
- peças próprias e peças adquiridas externamente;
- fluxo de aprovação;
- controle de status da OS;
- histórico operacional;
- geração de pré-nota em PDF para impressão térmica;
- dashboard operacional;
- permissões conforme a função do usuário;
- tema claro e escuro;
- identidade visual LSAssist;
- área administrativa da plataforma protegida;
- homologação de atualizações declarativas de tema;
- inspeção de pacotes de atualização de código.

A instalação automática de pacotes de código e migrations pelo painel ainda **não está habilitada**.

## Fluxo da ordem de serviço

O fluxo operacional foi projetado aproximadamente como:

```text
Cliente
  ↓
Equipamento
  ↓
Ordem de Serviço
  ↓
Diagnóstico Técnico
  ↓
Orçamento
  ↓
Aprovação do Cliente
  ↓
Manutenção
  ↓
Validação Técnica
  ↓
Validação Administrativa
  ↓
Pré-nota / Documento
  ↓
Conclusão e Entrega
```

Os principais estados atualmente utilizados são:

```text
RECEBIDO
EM_ANALISE
AGUARDANDO_APROVACAO
EM_MANUTENCAO
CONCLUIDO
ENTREGUE
CANCELADO
```

## Arquitetura multiempresa

Cada assistência técnica possui seus próprios usuários e dados.

O frontend **não define livremente a assistência proprietária de um registro**. A associação com a empresa é obtida a partir do usuário autenticado.

Além das verificações realizadas pela API, o PostgreSQL utiliza políticas de **Row Level Security (RLS)** para reforçar o isolamento entre empresas.

Fluxo simplificado:

```text
React
  │
  │ JWT
  ▼
FastAPI
  │
  │ mesmo contexto autenticado
  ▼
Supabase / PostgREST
  │
  ▼
PostgreSQL + RLS
```

Essa abordagem reduz a dependência exclusiva das verificações do frontend ou da API para isolamento dos dados.

## Autenticação

O fluxo principal funciona da seguinte forma:

1. O frontend autentica o usuário pelo Supabase Auth.
2. O Supabase fornece um access token JWT.
3. O frontend envia o token ao FastAPI.
4. O backend valida a identidade e a sessão.
5. As operações no Supabase preservam o contexto autenticado.
6. As políticas RLS continuam sendo aplicadas no banco.

A chave `service_role` nunca deve ser utilizada no frontend.

## Estrutura do projeto

```text
Sistema de Assistência/
│
├── backend/
│   └── app/
│       ├── routers/
│       ├── services/
│       ├── config.py
│       ├── dependencies.py
│       ├── main.py
│       ├── schemas.py
│       ├── security.py
│       └── supabase.py
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       └── lib/
│
├── supabase/
│   ├── homologacao/
│   ├── manutencao/
│   └── migrations/
│
├── scripts/
├── tests/
├── branding/
├── main.py
├── pyproject.toml
└── README.md
```

## Configuração local

O projeto foi preparado para desenvolvimento local sem Docker.

### Requisitos

- Python 3.11 ou superior
- Node.js / npm
- Git
- projeto Supabase configurado

### Backend

Na raiz do projeto:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Crie sua configuração a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Configure somente suas próprias credenciais locais.

Nunca versione arquivos `.env`, tokens, senhas ou chaves privadas.

### Executar o backend

Para desenvolvimento convencional:

```powershell
uvicorn main:app --reload
```

API:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Frontend

Com o backend ativo:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

A aplicação ficará disponível em:

```text
http://127.0.0.1:5173
```

Durante o desenvolvimento, o fluxo de convite utiliza:

```text
http://127.0.0.1:5173/auth/convite
```

Essa URL deve estar cadastrada nas Redirect URLs do Supabase Auth.

## Ambiente de homologação

As evoluções do sistema devem ser validadas em homologação antes de qualquer utilização em produção.

Existe uma configuração separada baseada em:

```text
.env.homologacao
```

O repositório fornece apenas o arquivo de exemplo:

```text
.env.homologacao.example
```

As credenciais reais não devem ser versionadas.

No Windows, o ambiente pode ser iniciado pelo script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\iniciar-homologacao.ps1
```

> Homologação e produção devem permanecer isoladas. Não utilize credenciais de produção para testes.

## Banco de dados e migrations

Para uma instalação nova, o schema inicial está em:

```text
supabase/schema.sql
```

As evoluções posteriores ficam em:

```text
supabase/migrations/
```

As migrations devem ser aplicadas em ordem.

O projeto utiliza constraints, funções, políticas RLS e regras adicionais no banco para complementar as validações realizadas pela API.

## Testes

### Backend

```powershell
python -m pytest -q
```

Validação estática:

```powershell
ruff check backend/app tests main.py
```

### Frontend

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run build
```

O projeto também possui testes automatizados para fluxos operacionais e para partes da infraestrutura de homologação.

## Atualizações

O LSAssist possui infraestrutura inicial para homologação de atualizações.

Atualmente existem mecanismos para:

- upload controlado de pacotes;
- identificação por hash SHA-256;
- inspeção de conteúdo;
- validação de pacotes;
- atualização declarativa de temas;
- restauração de temas;
- integração com testes executados pelo GitHub Actions;
- inventário de pacotes de código.

A presença dessas funções **não significa que pacotes de código possam ser instalados automaticamente**.

A instalação automática de código, migrations, promoção para produção e rollback completo ainda fazem parte da evolução da plataforma.

## Segurança

Algumas das medidas adotadas no projeto:

- autenticação baseada em JWT;
- Row Level Security;
- isolamento multiempresa;
- permissões por função;
- validações também no backend;
- restrições adicionais no banco;
- ausência de `service_role` no frontend;
- CORS configurável;
- proteção das rotas administrativas;
- separação entre homologação e produção;
- credenciais fora do repositório;
- identificação de pacotes de atualização por SHA-256.

Segurança é tratada em múltiplas camadas e não apenas na interface.

## Status do projeto

O LSAssist está em **desenvolvimento ativo**.

Os módulos centrais de clientes, equipamentos, estoque e ordens de serviço já estão implementados, enquanto funcionalidades adicionais e a infraestrutura completa de atualização/publicação continuam em evolução.

Entre as próximas evoluções planejadas estão:

- checklist de entrada e saída dos equipamentos;
- registro de acessórios e condições de entrada;
- fotos associadas ao atendimento;
- histórico/auditoria mais detalhado;
- garantia e retorno vinculados à OS original;
- relatórios de margem;
- administração comercial das assistências;
- evolução segura do mecanismo de atualização;
- preparação futura para implantação em produção.

## Autor

Desenvolvido por **Luis Rogerio**.

## Licença

Projeto proprietário em desenvolvimento.

O código não deve ser redistribuído, publicado ou utilizado comercialmente sem autorização do autor.