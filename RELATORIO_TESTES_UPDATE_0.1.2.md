# Relatório — atualização cumulativa 0.1.2

Data: 28/08/2026
Ambiente: homologação
Base declarada: 0.1.0
Produção alterada: não

## Artefato

- `releases/lsassist-0.1.2-homologacao.zip`
- 151.712 bytes
- SHA-256: `3D82749500D14DBF0380D6805BB8E1F08E2C4DD9BE5FE6348395DF771E44A728`
- Atualização cumulativa: inclui a paleta 0.1.1 e acrescenta botões administrativos
  semânticos. A base continua 0.1.0 porque a versão 0.1.1 foi apenas analisada, não aplicada.

## Cores dos botões

- Magenta: enviar pacote.
- Ciano: consultar conexão e baixar relatório.
- Roxo: executar testes.
- Laranja: analisar estrutura.
- Verde: aplicar, somente quando todos os bloqueios forem resolvidos.
- Vermelho e amarelo ficam reservados a erro/perigo e atenção.
- Tema claro usa tons escuros; tema escuro usa tons luminosos.
- Menor contraste medido entre os pares verificados: superior a 4,5:1 após o ajuste final.

## Resultado automatizado

- Inspeção do ZIP: `AGUARDANDO_EXECUTOR`, sem erros.
- Integração real com quarentena temporária: `RECEBIDO` → `AGUARDANDO_EXECUTOR`.
- Hash preservado entre recebimento e análise.
- 84 testes passaram.
- Ruff aprovado.
- Build Vite aprovado, 97 módulos.
- Um aviso preexistente de depreciação TestClient/httpx.

## Próximo bloqueio esperado

O pacote pode ser enviado e analisado, mas não aplicado. Para avançar, o workflow precisa
ser publicado numa branch revisada do GitHub e o backend de homologação precisa receber um
token fine-grained. Isso habilita inicialmente apenas os testes do **repositório**, não os
testes do ZIP. Transporte seguro do artefato, compatibilidade, banco/RLS, deploy e rollback
continuam pendentes. Não contornar o botão bloqueado.
