# Relatório de testes do fluxo de Ordem de Serviço

Data: 19/08/2026

## Escopo

Foi verificado o fluxo operacional da OS desde o recebimento até a entrega, incluindo
orçamento somente com serviço, peça retirada do estoque, peça comprada de fornecedor,
orçamento misto, recusa do cliente, saldo insuficiente e restrições por função.

Os testes são automatizados e isolados: não alteram clientes, ordens ou saldos reais.
A integração com o banco foi confrontada com as funções SQL das migrations 007 e 008.

## Resultado geral

- 41 testes do backend aprovados.
- 30 testes específicos dos processos, estoque, orçamento e PDF aprovados.
- TypeScript aprovado.
- Ruff aprovado.
- Nenhuma regressão encontrada nos módulos já testados.
- Existe um aviso técnico de depreciação do TestClient/httpx, sem impacto funcional atual.

## Cenários executados

| Cenário | Resultado | Comportamento confirmado |
|---|---|---|
| Somente serviço | Aprovado | Avança até Entregue sem movimentar estoque. |
| Peça do fornecedor | Aprovado | Registra custo interno e preço cobrado; não baixa estoque. |
| Peça do estoque | Aprovado | Baixa somente após aprovação e registra movimento de saída vinculado à OS. |
| Orçamento misto | Aprovado | Serviço e fornecedor não alteram saldo; somente a peça vinculada ao estoque é baixada. |
| Saldo insuficiente | Aprovado | Bloqueia a aprovação, mantém a OS aguardando e não realiza alteração parcial. |
| Cliente recusou | Aprovado | Cancela a OS sem baixar estoque. |
| Fluxo completo | Aprovado | Recebido → Em análise → Aguardando aprovação → Em manutenção → Concluído → Entregue. |
| Pré-nota | Aprovado | Gera PDF válido somente após diagnóstico e orçamento; encaminha para aprovação. |
| Técnico responsável | Aprovado | Autoatribuição e bloqueio de OS pertencente a outro técnico. |
| Permissões | Aprovado | Recepção não altera orçamento; técnico não entrega nem ajusta estoque. |
| Orçamento bloqueado | Aprovado | Itens não podem ser alterados após envio para aprovação. |

## Garantias confirmadas

1. A baixa de estoque e a mudança para Em manutenção acontecem na mesma função SQL.
   Se uma peça não tiver saldo, toda a operação falha sem baixa parcial.
2. Peças compradas para uma OS possuem `id_item_estoque` vazio e são ignoradas pela baixa.
3. O custo e o fornecedor são dados internos. A pré-nota atual recebe diagnóstico e valor
   total, sem expor custo de aquisição ou nome do fornecedor.
4. A OS não pode pular a aprovação nem ser concluída sem diagnóstico e técnico responsável.

## Melhorias recomendadas

### Prioridade alta

1. **Devolução de estoque em cancelamento posterior à aprovação.** Hoje é permitido cancelar
   uma OS em manutenção, mas não existe estorno automático das peças já baixadas. Deve haver
   uma ação explícita: devolver ao estoque, registrar como consumida/perdida ou impedir o
   cancelamento até decidir o destino das peças.
2. **Acompanhamento da compra externa.** Criar estados para a peça de fornecedor: solicitada,
   comprada, recebida e cancelada. A manutenção não deveria começar antes de confirmar o
   recebimento quando a peça externa for necessária.
3. **Teste real em banco de homologação.** A atomicidade foi validada pelo desenho SQL e por
   simulação automatizada. Convém manter um projeto Supabase separado para testar RLS,
   concorrência e transações reais sem afetar produção.

### Prioridade média

4. **Reserva de estoque.** Entre o orçamento e a resposta do cliente outra OS pode consumir a
   última peça. Uma reserva com validade reduziria aprovações bloqueadas por falta de saldo.
5. **Registro formal da aprovação.** Guardar data, usuário, canal (balcão, telefone, WhatsApp),
   observação e, futuramente, aceite digital do cliente.
6. **Margem e rentabilidade.** Relatório interno com custo de peças de estoque/fornecedor,
   preço cobrado, margem bruta por item, por OS e por período.
7. **Pré-nota detalhada para o cliente.** Oferecer linhas resumidas de serviço e peça com preço
   de venda e subtotal, sem fornecedor nem custo interno, mantendo o total final.

### Prioridade futura

8. Checklist e fotos de entrada/saída, acessórios e avarias.
9. Histórico de alterações de diagnóstico, orçamento, técnico, prioridade, itens e datas.
10. Garantia com vigência, retorno vinculado à OS original e identificação de retrabalho.
11. Identificação de quem recebeu o equipamento na entrega e comprovante de retirada.
12. Atualizar a dependência de testes indicada pelo aviso de depreciação do TestClient/httpx.

## Conclusão

O fluxo essencial está consistente para assistências que trabalham somente com serviços,
com estoque próprio, com compras sob demanda ou com os três modelos combinados. O principal
risco operacional restante é o destino do estoque quando uma OS já aprovada é cancelada; o
principal ganho de produto será controlar o ciclo das compras externas e registrar formalmente
a aprovação do cliente.
