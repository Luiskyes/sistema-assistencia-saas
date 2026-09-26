# Relatório — mini atualização 0.1.1

Data: 28/08/2026
Ambiente permitido: homologação
Produção alterada: não

## Artefato

- Arquivo: `releases/lsassist-0.1.1-homologacao.zip`
- Tamanho: 151.365 bytes
- SHA-256: `D4B754040BEE0E055057C6CE1801FC2F4163B988C175674DA02C0C7C4E77E381`
- Base declarada: 0.1.0
- Versão proposta: 0.1.1
- Mudança: nova paleta azul/teal no tema escuro, verde/azul no tema claro, contraste e
  indicação visual das quatro etapas no painel de versões.

## Caixa branca

Resultado: aprovado no escopo implementado.

- Leitura das regras internas do inspetor e do armazenamento de quarentena.
- ZIP válido, manifesto válido, arquivos obrigatórios presentes e nenhum erro estrutural.
- Rejeição automatizada de caminhos absolutos/relativos inseguros, links simbólicos,
  duplicatas, ZIP criptografado, `.env`, `.git`, `node_modules`, `.venv`, excesso de arquivos,
  tamanho descompactado excessivo, manifesto ausente/inválido e ambiente diferente.
- Hash recalculado antes da análise; adulteração resulta em bloqueio.
- Autorização exige homologação, project ref correto, e-mail exclusivo e claim administrativa.
- Estados de build, compatibilidade e testes permanecem `NAO_EXECUTADO` após inspeção estática.
- Contraste calculado nos pares principais: 7,17:1 a 14,75:1.

## Caixa preta

Resultado: aprovado no escopo local.

- API real em execução: listagem sem token = HTTP 401; upload sem token = HTTP 401.
- TestClient pela fronteira HTTP: upload autenticado = 201; análise e relatório = 200;
  aplicação = 409; produção/projeto incorreto/outros e-mails = 403; versão inexistente = 404.
- 24 testes do módulo de versões passaram.
- Não houve login automatizado real porque a senha do proprietário não deve ser acessada.

## Integração

Resultado: aprovado para quarentena local e simulação do conector.

- Pacote real: `RECEBIDO` → `AGUARDANDO_EXECUTOR`.
- SHA-256 foi preservado entre armazenamento e análise.
- 13 testes do conector GitHub passaram: token ausente/inválido, falhas HTTP, timeout sem
  repetição automática, commit alterado, execução concorrente e link de resultado confiável.
- TypeScript passou; Ruff passou; build Vite passou com 97 módulos.
- Suíte completa: 84 testes passaram; um aviso preexistente de depreciação TestClient/httpx.

## Limites que continuam bloqueados

- O GitHub Actions ainda não foi executado de verdade: workflow e branch não foram enviados.
- O ZIP não é transportado ao runner; os testes remotos atuais são do repositório.
- Compatibilidade com a versão instalada, testes RLS/banco real, navegador autenticado,
  migrations, aplicação, recuperação e rollback não foram executados.
- Portanto, a mini atualização não está aprovada para aplicação e o botão deve permanecer
  bloqueado. Um resultado estrutural não equivale a build ou teste funcional.

## Roteiro manual seguro

1. Na aba **Versões da plataforma**, escolher o ZIP entregue.
2. Clicar em **Enviar para quarentena**; confirmar versão recebida e hash acima.
3. Clicar em **Analisar estrutura**; esperar `Estrutura válida — aguardando testes isolados`.
4. Baixar o JSON e comparar versão, hash, checks e ausência de erros.
5. Confirmar que **Aplicar na homologação** continua desabilitado.
6. Não informar credenciais, não selecionar produção e não tentar contornar o bloqueio.
