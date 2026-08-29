# Relatório de atualização — fluxo de OS e estoque

Data: 18/08/2026

## Implementado

- Orçamento detalhado por itens de serviço e peças do estoque.
- Subtotal por item e total da OS recalculado pelo banco.
- Peças validadas contra o saldo atual antes de entrar no orçamento.
- Orçamento bloqueado para edição após ser enviado para aprovação.
- Aprovação do cliente inicia a manutenção e baixa as peças em uma única transação.
- Movimento de saída registra usuário, OS, saldo anterior, saldo novo e motivo.
- Permissões: dono e técnico compõem o orçamento; recepção registra aprovação/recusa.
- Interface da análise técnica com composição do orçamento e peças compatíveis.

## Atualização obrigatória do Supabase

Executar, nesta ordem, no SQL Editor do projeto:

1. `supabase/migrations/005_fluxo_os_aprovacao_obrigatoria.sql`
2. `supabase/migrations/006_autoatribuicao_responsavel_os.sql`
3. `supabase/migrations/007_itens_orcamento_e_consumo_estoque.sql`

A migração 007 cria `itens_os`, políticas RLS, cálculo automático do total e a função
transacional `iniciar_manutencao_com_estoque`. Sem ela, o novo orçamento detalhado
permanece indisponível e a aprovação falha de forma segura, sem baixar estoque.

## Validações executadas

- Backend: 32 testes automatizados aprovados.
- Qualidade Python: Ruff sem erros.
- Frontend: TypeScript sem erros.
- Build de produção: concluído com 94 módulos.
- Smoke test: frontend e endpoint `/health` responderam HTTP 200.
- Navegador: login carregou sem erros de console.

## Próximas evoluções recomendadas

- Incluir os itens detalhados na pré-nota/PDF.
- Registrar aprovação com data, canal e observação do cliente.
- Permitir estorno controlado da peça ao cancelar uma OS já iniciada.
- Implementar checklist, fotos, histórico expandido e garantia, já definidos como fase futura.
