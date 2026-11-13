// Ferramentas que a IA pode chamar. Tudo roda no aparelho com a permissão de quem está logado (RLS).
const data = { type: 'string', description: 'data AAAA-MM-DD' };
export const FERRAMENTAS = [
  { name: 'buscar_produto', description: 'Procura produtos cadastrados pelo nome (aceita grafias diferentes). Use antes de registrar compra para usar o nome do cadastro.', parameters: { type: 'object', properties: { nome: { type: 'string' } }, required: ['nome'] } },
  { name: 'buscar_fornecedor', description: 'Procura fornecedores cadastrados pelo nome.', parameters: { type: 'object', properties: { nome: { type: 'string' } }, required: ['nome'] } },
  { name: 'registrar_compra', description: 'Registra uma compra REALIZADA (com valores). Gera a conta a pagar automaticamente. Não use para pedidos/solicitações.', parameters: { type: 'object', properties: {
    data, fornecedor: { type: 'string', description: 'nome do fornecedor; "Não informado" se o usuário disser que não importa' },
    itens: { type: 'array', items: { type: 'object', properties: { produto: { type: 'string' }, quantidade: { type: 'number' }, unidade: { type: 'string', description: 'kg, un, pct, cx, L, fardo...' }, valor_unitario: { type: 'number' }, valor_total: { type: 'number' } }, required: ['produto'] } },
    pago: { type: 'boolean', description: 'true se já foi pago' }, forma_pagamento: { type: 'string' }, vencimento: { ...data, description: 'se vai pagar depois' }, parcelas: { type: 'number' },
    desconto: { type: 'number' }, mercadoria_chegou: { type: 'boolean', description: 'true para dar entrada no estoque agora' }, confirmar_duplicada: { type: 'boolean' },
  }, required: ['data', 'fornecedor', 'itens', 'pago'] } },
  { name: 'registrar_despesa', description: 'Lança uma despesa que não é compra de mercadoria (energia, gás, aluguel, salários, manutenção, impostos...).', parameters: { type: 'object', properties: {
    descricao: { type: 'string' }, categoria: { type: 'string', enum: ['Funcionários', 'Energia', 'Água', 'Gás', 'Internet/Telefone', 'Aluguel', 'Manutenção', 'Equipamentos', 'Impostos', 'Taxas de cartões', 'Despesas administrativas', 'Outras despesas'] },
    valor: { type: 'number' }, vencimento: data, pago: { type: 'boolean' }, fornecedor: { type: 'string' }, confirmar_duplicada: { type: 'boolean' },
  }, required: ['descricao', 'categoria', 'valor', 'vencimento', 'pago'] } },
  { name: 'marcar_compra_recebida', description: 'Marca como recebida (dá entrada no estoque) a compra em aberto de um fornecedor.', parameters: { type: 'object', properties: { fornecedor: { type: 'string' }, data } , required: ['fornecedor'] } },
  { name: 'consultar_gastos', description: 'Soma das compras de um período, com filtros opcionais e agrupamento. Use para "quanto gastamos com X", "quanto compramos no fornecedor Y".', parameters: { type: 'object', properties: {
    de: data, ate: data, categoria: { type: 'string', enum: ['hortalicas', 'frutas', 'acougue', 'aves', 'peixes', 'cereais', 'mercearia', 'laticinios', 'bebidas', 'padaria', 'embalagens', 'limpeza', 'outros'], description: 'carnes = acougue; frango = aves' },
    fornecedor: { type: 'string' }, produto: { type: 'string' }, agrupar_por: { type: 'string', enum: ['categoria', 'fornecedor', 'produto', 'mes', 'nenhum'] },
  }, required: ['de', 'ate'] } },
  { name: 'faturamento', description: 'Faturamento (vendas) de um período: bruto, líquido, nº de vendas, ticket médio, formas de pagamento, margem e resultado estimados.', parameters: { type: 'object', properties: { de: data, ate: data }, required: ['de', 'ate'] } },
  { name: 'comparar_periodos', description: 'Compara dois períodos (ex.: outubro × novembro): faturamento, despesas, compras, custo de mercadorias, resultado, por categoria.', parameters: { type: 'object', properties: { a_de: data, a_ate: data, b_de: data, b_ate: data }, required: ['a_de', 'a_ate', 'b_de', 'b_ate'] } },
  { name: 'preco_produto', description: 'Histórico de preço de um produto: por fornecedor, menor, maior, último, variação no período.', parameters: { type: 'object', properties: { produto: { type: 'string' }, de: data, ate: data }, required: ['produto'] } },
  { name: 'maiores_aumentos', description: 'Produtos que mais subiram de preço entre dois períodos (padrão: mês passado × este mês).', parameters: { type: 'object', properties: { a_de: data, a_ate: data, b_de: data, b_ate: data } } },
  { name: 'contas', description: 'Contas a pagar ou a receber: abertas, vencidas ou pagas, com total.', parameters: { type: 'object', properties: { tipo: { type: 'string', enum: ['pagar', 'receber'] }, situacao: { type: 'string', enum: ['abertas', 'vencidas', 'pagas', 'todas'] }, de: data, ate: data }, required: ['tipo'] } },
  { name: 'pagamentos_por_fornecedor', description: 'Ranking de fornecedores por pagamentos feitos (ou por compras) no período.', parameters: { type: 'object', properties: { de: data, ate: data, por: { type: 'string', enum: ['pagamentos', 'compras'] } }, required: ['de', 'ate'] } },
  { name: 'estoque', description: 'Saldo de estoque de um produto, ou a lista do que está abaixo do mínimo.', parameters: { type: 'object', properties: { produto: { type: 'string' }, so_baixo: { type: 'boolean' } } } },
];
