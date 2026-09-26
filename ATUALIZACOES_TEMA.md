# Atualização parcial de botões — Luis / homologação

## Escopo

Atualiza nove tokens semânticos nos temas claro e escuro. Não instala código, CSS livre,
migrations ou dependências. A versão do **tema** começa em 0.1.0 e é independente da
versão do aplicativo. Pacotes antigos de código continuam sem permissão de aplicação.

## Como testar pelo painel

1. Entre com a conta administrativa de Luis na homologação.
2. Abra Administração da plataforma e consulte o tema instalado.
3. Envie `releases/luis-tema-0.1.1.zip` e clique em Analisar estrutura.
4. Abra Ver prévia e compatibilidade; confira os botões claros/escuros, versão e hash.
5. Digite `APLICAR 0.1.1` e confirme. A tela atual muda imediatamente; as outras abas
   atualizam ao receber foco ou em até 30 segundos enquanto visíveis.
6. Para desfazer, consulte o estado, digite `RESTAURAR` e confirme.
7. Atualizar estado também carrega o histórico com revisão, data, ação e usuário.

Enviar, analisar e visualizar não mudam o tema instalado. Confirmar sem a versão correta,
com hash diferente ou revisão desatualizada falha sem alteração parcial. Um duplo clique
ou requisições concorrentes não criam duas aplicações. A restauração incrementa a revisão
e não permite alternar indefinidamente entre versões por cliques repetidos.

## Pacote

Somente dois arquivos na raiz: `release.json` e `theme.json`.

```json
{
  "kind": "theme",
  "schema_version": 1,
  "environment": "homologacao",
  "version": "0.1.1",
  "base_version": "0.1.0",
  "notes": "Luis — nova paleta dos botões"
}
```

theme.json contém light e dark, cada um com todos estes campos hexadecimais #RRGGBB:
--ls-sem-success, --ls-sem-success-bg, --ls-sem-success-hover, --ls-sem-info,
--ls-sem-info-bg, --ls-sem-edit, --ls-sem-warning, --ls-sem-danger, --ls-sem-special.

O validador rejeita campos/arquivos extras, JSON duplicado, links/caminhos inseguros,
cores não hexadecimais e contraste abaixo de 4,5:1. O cálculo considera texto branco nos
botões preenchidos e mistura de 9% da cor no fundo dos botões de contorno. Isso não
substitui uma auditoria de acessibilidade de todas as telas/estados da plataforma.

Geração de um novo exemplo, na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe scripts/criar-tema.py --base 0.1.0 --version 0.1.1
```

## Persistência e segurança

Mesma SQLite local de quarentena, definida por UPDATES_STORE_PATH. A alteração e o evento
de auditoria são gravados na mesma transação BEGIN IMMEDIATE, junto com o snapshot
anterior. Esse snapshot é o mecanismo de restauração, não um backup fora da máquina.
Preservar o arquivo .local-updates/homologacao.sqlite3 entre reinícios. Esta implementação
é para uma instância de homologação; não é uma solução distribuída/múltiplos servidores.

Aplicar, restaurar e consultar auditoria exigem conta ativa, claim administrativa e e-mail
exato de Luis. O ambiente e o projeto Supabase precisam coincidir com a homologação
autorizada. A consulta pública retorna apenas versão, revisão e cores, com no-store;
fora da homologação retorna o tema padrão, sem acessar o armazenamento de temas.

## Testes

tests/test_theme_updates.py cobre validação, ataques, base incompatível, hash alterado,
confirmação, repetição, concorrência real SQLite, persistência, recuperação, permissões e
bloqueio de produção. Não altera o banco Supabase nem a quarentena real.

frontend/qa/theme-release.html é uma fixture visual apenas do servidor de desenvolvimento:
componentes reais com HTTP simulado em memória e banner SIMULAÇÃO. Não integra o build
Vite de produção, não fornece autenticação real e não testa permissões do Supabase.

Testes GitHub Actions continuam separados: verificam o commit do repositório, não aprovam
um ZIP. Para temas, a validação determinística e a confirmação no backend são os controles
de aplicação. Para atualizações de código ainda são necessários runner isolado do pacote,
validação de migrations/compatibilidade, deploy e recuperação. Produção segue bloqueada.
