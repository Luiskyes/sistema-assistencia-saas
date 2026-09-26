# Entrega — atualizações parciais de tema de Luis

## Implementado

- ZIP declarativo com release.json e theme.json; sem execução de código ou CSS livre.
- Validação estrita de campos, versões, hash, ambiente, caminhos, arquivos e contraste.
- Prévia separada para os modos claro/escuro, sem alterar o tema instalado.
- Confirmação digitada e aplicação transacional com controle de revisão.
- Restauração do snapshot anterior e auditoria com usuário, data, ação e revisão.
- Atualização global dos tokens semânticos usados nos botões dos módulos.
- Propagação na aba atual, ao receber foco e a cada 30 segundos nas abas visíveis.
- Preservação dos dados entre reinícios via SQLite local da homologação.
- Pacote de exemplo de Luis e documentação de uso em ATUALIZACOES_TEMA.md.

## Pacote para teste

`releases/luis-tema-0.1.1.zip`

SHA-256: `43B887422AD724663E223E29D3518E3BE4CC28458F75E9751DCAD428A639F5A6`

Versão base do tema: 0.1.0. Nova versão: 0.1.1. Menor contraste calculado: 5,22:1.
Os nove tokens de cada tema são validados com contraste mínimo 4,5:1.
Essa verificação não representa auditoria completa de acessibilidade de todo o site.

## Testes locais confirmados

| Verificação | Resultado |
|---|---|
| Ruff — backend, testes e gerador do pacote | Passou |
| Pytest — regressão e novos cenários | 102 passaram |
| TypeScript | Passou |
| Build Vite | Passou; 99 módulos |
| Confirmação incompleta no navegador | Botão bloqueado |
| Aplicar tema e atualizar estado no navegador | Passou com API simulada |
| Restaurar tema anterior no navegador | Passou com API simulada |
| Console da fixture visual | Sem erros observados |

18 cenários novos incluem: cores e contraste, CSS/URL proibidos, arquivos extras,
caminhos inseguros, duplicação de JSON, JSON muito aninhado, progressão de versão,
persistência entre instâncias, restauração, hash adulterado, confirmação incorreta,
base incompatível, repetição de requisição, duas confirmações concorrentes (SQLite real
temporária), rotas de API e bloqueio administrativo/produção.

O aviso de depreciação Starlette/httpx preexistente permanece; não impediu os testes.

## CI

Execução anterior 33226718413 confirmada como sucesso (commit 1e55643).
Execução do código desta entrega: 33291351766, commit 1d93e2b.
Resultado confirmado: **SUCESSO**. Ruff, testes backend, TypeScript e build concluídos.
Link: https://github.com/Luiskyes/sistema-assistencia-saas/actions/runs/33291351766

## Limites e validações pendentes

- A sessão de navegador disponível estava deslogada. O teste visual foi feito em fixture
  isolada com componentes reais e respostas simuladas, não na conta administrativa real.
- Os testes de permissões das rotas usam autenticação substituída por fixtures; não são
  testes end-to-end de Supabase Auth/RLS.
- Nenhum teste desta entrega alterou OS, estoque ou banco Supabase.
- O pacote NÃO foi aplicado ao tema real; a aplicação está reservada ao teste do usuário.
- Apenas a branch luis/homologacao-executor foi atualizada. Sem merge do sistema na main,
  sem publicação em produção e sem scripts SQL executados.
- Pacotes de código continuam bloqueados. Atualizações arbitrárias de frontend/backend
  e banco exigem outro fluxo de isolamento, build, compatibilidade, deploy e recuperação.
- SQLite local suporta esta instância de homologação, não publicação distribuída. Snapshot
  anterior permite desfazer o tema, mas não substitui backup do arquivo fora da máquina.
