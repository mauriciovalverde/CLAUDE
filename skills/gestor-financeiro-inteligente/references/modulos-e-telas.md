# Módulos e telas

## Layout geral (AppShell)

- **Menu lateral** (no celular, vira uma barra inferior com 5 atalhos e um botão "Mais"): Central IA · Dashboard · Contas · Clientes · Vendas · Compras · Estoque · Empréstimos · Pessoal · Salário PM · Comparativo · Relatórios · Configurações.
- **Barra superior:** seletor de período (Mês | Trimestre | Semestre | Ano | Personalizado, guardado na URL), indicador da agenda, alternância Pessoal / Comercial / Tudo e avatar.
- **Chat flutuante** em todas as telas (botão no canto inferior direito, atalho `Ctrl+K`).
- **Visual de software financeiro premium:** fundo neutro (slate-50 no claro e slate-950 no escuro), cartões brancos com borda sutil, uma cor de destaque discreta (azul-petróleo `#0F766E`), verde para entradas, vermelho para atrasos, números tabulares (`font-variant-numeric: tabular-nums`) e fonte Inter. Inclua tema escuro.
- **Tabelas:** busca, filtros em "chips", ordenação, paginação, exportação CSV e, no celular, linhas que viram cartões.
- **Estados vazios** com um exemplo de comando para a IA ("Experimente: *Vendi 2 TZ para Maria por 300, paga dia 10*").
- O formulário de cada módulo grava pela **mesma RPC** que a IA usa.

## Dashboard (`/`)

Cartões: Patrimônio registrado · Saldo disponível (pessoal | comercial) · A receber (atrasado em vermelho) · A pagar · Total emprestado / saldo devedor · Lucro com juros · Faturamento · Lucro das vendas · Despesas pessoais.
Gráficos (Recharts): receitas × despesas (barras por mês) · evolução do faturamento e do lucro (linhas) · emprestado × recebido · a pagar × a receber nos próximos 90 dias (fluxo de caixa futuro, em barras empilhadas por semana) · despesas por categoria (rosca) · evolução do valor do estoque · top 10 produtos · top 10 clientes.
Listas: vencimentos dos próximos 7 dias · atrasados · alertas de estoque e validade.

## Clientes (`/clientes`, `/clientes/$id`)

Lista com busca por nome ou telefone, mostrando total comprado, pendente e atrasado (`v_clientes_resumo`).
Ficha: dados (o CPF aparece mascarado, com o botão "mostrar" registrado na auditoria), observações, data do cadastro, e as abas Resumo · Compras · Empréstimos · Pagamentos · Pendências · Linha do tempo. Botões: "Nova venda", "Novo empréstimo", "Registrar recebimento", "Relatório PDF do cliente" e "Mesclar com…" (junta cadastros duplicados, migrando todas as relações e registrando na auditoria).

## Estoque e produtos (`/estoque`)

Campos: nome, nome comercial, princípio ativo, apresentação, código ou EAN, unidade, fornecedor, preço de compra (último custo), preço de venda, margem (calculada), estoque atual (só leitura, vem das movimentações), estoque mínimo, classe regulatória, registro ANVISA e controle de lote.
Abas: Inventário (em tempo real, via Realtime) · Lotes e validades · Movimentações · Alertas · Mais vendidos · Mais lucrativos. Ajuste de inventário só com motivo (`movimentacoes_estoque.origem='inventario'`).

## Compras (`/compras`)

Produto(s), quantidade, custo unitário, total, fornecedor, data, forma de pagamento, vencimento, número de parcelas, lote e validade (obrigatórios para medicamento) e situação do pagamento.

## Vendas (`/vendas`)

Cliente, itens (produto, quantidade, preço unitário, desconto), desconto geral, total, custo da mercadoria, lucro bruto, margem %, data, forma de pagamento, data prevista de recebimento, situação (pago, pendente, parcial ou atrasado) e receita médica quando exigida.

## Empréstimos (`/emprestimos`)

Lista por situação (ativo, atrasado, quitado, renegociado) e agrupada por cliente.
Formulário: cliente, valor, data, taxa, periodicidade, modalidade, prazo (n), número de parcelas e vencimento. O **simulador ao vivo** mostra juros, total, parcelas e a taxa mensal equivalente, com o aviso legal quando aplicável.
Detalhe: condições contratuais, parcelas com saldo, pagamentos (juros × principal), linha do tempo (`emprestimo_eventos`: criação, pagamentos, atrasos, prorrogações, renegociações) e os botões Registrar pagamento · Prorrogar · Renegociar · PDF das condições.
Relatórios: lucro obtido com juros e valores a receber.

## Contas a pagar e a receber (`/contas`)

Abas: A receber de vendas · A receber de empréstimos · A pagar a fornecedores · Despesas pessoais · Parcelamentos.
Filtros: vencimento (período), cliente ou fornecedor, categoria, situação e escopo. Ações por linha: pagamento parcial, quitação, alterar vencimento e estornar. Mostra o status da agenda e o link do evento.
**Fluxo de caixa futuro:** saldo atual + a receber − a pagar, dia a dia, nos próximos 30, 60 e 90 dias, com a linha do saldo projetado.

## Finanças pessoais (`/pessoal`)

Categorias: despesas domésticas, alimentação, combustível, energia, água, internet, escola, saúde, cartões de crédito, financiamentos, empréstimos pessoais, assinaturas e outras.
Receitas e despesas **recorrentes** (`recorrencias`, geradas pela rotina diária com 35 dias de antecedência e sincronizadas com a agenda).
Indicadores: total de receitas, total de despesas, saldo mensal, contas pagas, pendentes e atrasadas, evolução mês a mês e gastos por categoria. Nunca mostra valores comerciais.

## Salário PM (`/salario`)

Lançamento do contracheque por competência: rubricas de provento (salário-base, gratificações, adicionais, horas extras, serviço extraordinário, auxílios, outros) e de desconto (previdência, IR, consignados, plano de saúde, associação, pensão, outros).
Gráficos: bruto × líquido × descontos por mês, variação mensal % e evolução anual. Tabela comparativa por rubrica, ano contra ano.
A IA entende: "Recebi o salário de novembro: base 5.200, gratificação 1.300, desconto previdência 650, consignado 400".

## Comparativo (`/comparativo`)

Mês atual × mês anterior (ou × mesmo mês do ano anterior): cartões de variação de faturamento, número de vendas, itens vendidos, lucro bruto, margem média, ticket médio, clientes novos e recorrentes. Gráfico de 12 meses, ranking de produtos e clientes, e o texto "Crescimento de 30% no faturamento; lucro cresceu 22%". Faturamento e lucro aparecem sempre separados.

## Configurações (`/configuracoes`)

Perfil e 2FA · Contas financeiras · Categorias · Agenda (conectar, lembretes, horário, ação ao pagar, sincronizar ou reconstruir) · Licenças sanitárias · Limite legal de juros · Membros e permissões · Backup e exportação · Privacidade (LGPD) · Lixeira (restaurar).
