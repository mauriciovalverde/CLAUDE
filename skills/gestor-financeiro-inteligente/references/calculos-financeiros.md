# Cálculos e definições financeiras

A implementação de referência está em `scripts/calculos.mjs`, coberta por testes. O banco repete as mesmas fórmulas em `calcular_emprestimo` e `taxa_mensal_equivalente`.

## Os quatro conceitos que nunca se confundem

| Conceito | Definição | De onde vem |
|---|---|---|
| **Faturamento** | Soma do valor das vendas no período, pela data da venda, recebidas ou não | `sum(vendas.total)` |
| **Recebimento** | Dinheiro que de fato entrou no período | `sum(lancamentos.valor)` com `tipo='entrada'`, pela data do pagamento |
| **Lucro bruto de vendas** | Faturamento − custo da mercadoria vendida (CMV, pelo custo do lote ou o último custo) | `vendas.lucro_bruto` |
| **Lucro com juros** | Só a parte de juros dos pagamentos de empréstimos já recebidos | `sum(pagamentos.juros_valor)` |
| **Saldo disponível** | Saldo inicial das contas + entradas − saídas | `v_saldo_contas` |

- Venda sem custo cadastrado entra no faturamento, mas **não** no lucro. A tela mostra "N vendas sem custo: lucro incompleto".
- Dinheiro emprestado **não é despesa**, e o principal devolvido **não é receita**: os dois são lançamentos `natureza='patrimonial'`. Só os juros são receita.
- Compra de estoque é saída de caixa quando é paga; vira custo (CMV) quando a mercadoria é vendida.

## Indicadores do dashboard (período filtrado)

- **Patrimônio financeiro registrado** = saldo das contas + total a receber em aberto (vendas + empréstimos) + estoque ao custo − total a pagar em aberto.
- **Saldo disponível** = `v_saldo_contas`, separado em pessoal e comercial, mais o total.
- **Total a receber / a pagar** = `sum(saldo)` em `v_obrigacoes` com situação pendente, parcial ou atrasado (mostre o atrasado à parte).
- **Total emprestado** = principal dos empréstimos ativos, atrasados e renegociados; **saldo devedor** = soma dos saldos das obrigações deles.
- **Faturamento comercial, lucro das vendas, margem média e ticket médio**: ver `v_vendas_mensal`.
- **Despesas pessoais** = lançamentos `escopo='pessoal'`, `tipo='saida'`, `natureza='operacional'`.

## Empréstimos

- **Simples:** `M = P × (1 + i × n)`. **Composto:** `M = P × (1 + i)^n`, com `i` = taxa por período e `n` = número de períodos.
- **Periodicidade** (`diaria`, `semanal`, `mensal`, `anual` ou `periodo_total`) define a unidade de `n`. "10% em 30 dias" = mensal, n = 1 → R$ 1.100.
- **Parcelas:** valores iguais, com os juros distribuídos de forma proporcional entre elas e a última absorvendo o arredondamento. Se o usuário pedir tabela Price, implemente `PMT = P·i/(1−(1+i)^−n)` à parte, sem trocar o padrão.
- **Pagamento parcial:** abate primeiro os juros da parcela e depois o principal (Código Civil, art. 354). O saldo restante continua com o mesmo vencimento, e o evento da agenda é atualizado com o novo valor.
- **Atraso:** a rotina diária marca o empréstimo como `atrasado` e registra o evento `atraso`. **Não** aplique multa ou juros de mora automaticamente. Encargos de mora só entram se tiverem sido contratados e registrados nas condições, e respeitando os limites legais.
- **Prorrogação:** `alterar_vencimento` (mesmo evento na agenda, histórico em `emprestimo_eventos`).
- **Renegociação:** `renegociar_emprestimo` encerra as parcelas em aberto com status `renegociado` (os eventos são cancelados) e cria novas parcelas sobre o saldo devedor, com novas condições.
- **Situação:** `ativo` → (`atrasado`) → `quitado`; `renegociado` quando houve nova negociação.
- **Relatório de lucro com juros:** `sum(pagamentos.juros_valor)` por mês e por cliente, comparado com os juros previstos.
- **Taxa mensal equivalente:** é calculada sempre e comparada com `configuracoes.limite_juros_mensal_pct` (ver conformidade-legal.md).

## Comparativo mensal de vendas

Para o mês M e o mês anterior M−1 (ou o mesmo mês do ano anterior, como opção):

- Crescimento % = `(M − (M−1)) / (M−1) × 100`; quando M−1 = 0, mostre "—" e não "∞". Exemplo: outubro R$ 5.000 e novembro R$ 6.500 = **+30%**.
- Compare: faturamento, quantidade de vendas, quantidade de itens, lucro bruto, margem média, ticket médio, clientes novos (primeira compra no mês) e clientes recorrentes.
- Top produtos por quantidade e por lucro, e top clientes por faturamento.
- Os cartões mostram o valor, a seta e a variação %, sempre com o rótulo "Faturamento" ou "Lucro" explícito.

## Estoque

- Entrada pela compra, com o custo do lote e a atualização de `produtos.preco_compra`.
- Saída pela venda, em ordem FEFO (vence primeiro, sai primeiro). Lotes vencidos nunca são vendidos.
- Margem do produto = `(preço de venda − custo) / preço de venda`. Na tela, mostre também o markup = `(venda − custo) / custo`.
- Valor do estoque = `Σ quantidade do lote × custo do lote`.
- Alertas: `estoque_atual <= estoque_minimo`; validade em até 60 dias (o prazo é configurável); lote vencido com saldo (sugira descarte com registro).
