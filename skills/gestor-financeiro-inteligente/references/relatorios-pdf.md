# Central de relatórios em PDF

Tela `/relatorios`: escolha o **período** (os mesmos atalhos do dashboard ou datas livres), os **módulos** (caixas de seleção; dá para juntar vários num só PDF) e, quando fizer sentido, o cliente. O botão "Gerar PDF" baixa o arquivo, e "Pré-visualizar" mostra o PDF numa janela.

## Relatórios

1. Financeiro geral (todos os indicadores do dashboard + DRE simplificada pessoal e comercial)
2. Empréstimos (carteira, situação, condições, selos ⚠️ de taxa acima da referência)
3. Juros recebidos (por mês e por cliente; previsto × realizado)
4. Vendas (lista, totais, faturamento × lucro, margem)
5. Compras (por fornecedor e produto, pagas e pendentes)
6. Estoque (inventário valorizado, lotes, validades, alertas)
7. Lucro (vendas + juros, por mês)
8. Contas a pagar
9. Contas a receber (com aging: em dia, 1–30, 31–60 e mais de 60 dias de atraso)
10. Despesas pessoais (por categoria e mês)
11. Salarial (contracheques, bruto, líquido, descontos e variação)
12. Comparativo mensal e anual
13. Individual por cliente (ficha + histórico completo + pendências)

## Layout (pdfmake)

- A4 retrato (paisagem para tabelas largas), margens de 40 pt e fonte Roboto (embutida no pdfmake).
- **Cabeçalho** em todas as páginas: "GESTOR FINANCEIRO INTELIGENTE", o nome do relatório, o período e a linha fina na cor de destaque.
- **Rodapé:** "Emitido em dd/mm/aaaa hh:mm por <usuário>" e "Página X de Y".
- **Capa resumida** (para relatórios com vários módulos): cartões de indicadores, desenhados como tabelas de 2×4.
- **Tabelas:** cabeçalho com fundo cinza-claro, linhas zebradas, números alinhados à direita no formato `R$ 1.234,56`, **subtotal** por grupo e **total geral** em negrito, com a linha do cabeçalho repetida em cada página (`headerRows: 1`).
- **Gráficos:** renderize o mesmo componente Recharts escondido na tela, converta o SVG em PNG (canvas, 2× para ficar nítido) e insira com `image`. Pelo menos um gráfico por módulo que tenha série temporal.
- **Notas:** as definições (faturamento ≠ lucro), a ressalva legal no relatório de empréstimos e um aviso de "dados confidenciais (LGPD)".
- Nome do arquivo: `gfi-<relatorio>-<de>_<ate>.pdf`.

## Fonte dos dados

Cada relatório chama uma consulta das views (`v_obrigacoes`, `v_vendas_mensal`, `v_clientes_resumo`, `v_saldo_contas`, `v_estoque_alertas`) ou das tabelas, filtrando pelo período e respeitando o escopo. Os totais são **recalculados** a partir das linhas listadas e conferidos contra o resumo: se não baterem, o relatório mostra um aviso em vez de esconder a diferença.

A IA também gera relatórios: "me manda o relatório de vendas de outubro em PDF" → a ferramenta `gerar_relatorio` devolve um link assinado (Storage privado, válido por 24 h) para o PDF gerado por uma Edge Function com a mesma definição.
