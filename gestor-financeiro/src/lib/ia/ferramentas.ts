// Ferramentas da Central de Comando (formato canônico: name, description, parameters/JSON Schema).
const S = (description: string) => ({ type: 'string', description });
const N = (description: string) => ({ type: 'number', description });
const B = (description: string) => ({ type: 'boolean', description });
const DATA = (d: string) => ({ type: 'string', description: d + ' (AAAA-MM-DD)' });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });

export const FERRAMENTAS = [
  { name: 'buscar_cliente', description: 'Procura clientes por nome (aproximado) ou telefone. Use SEMPRE antes de criar um cliente.', parameters: obj({ texto: S('nome ou telefone') }, ['texto']) },
  { name: 'cadastrar_ou_atualizar_cliente', description: 'Cria o cliente se não existir (telefone tem prioridade; nunca duplica). Retorna status criado|existente|ambiguo. Se ambiguo, pergunte ao usuário.', parameters: obj({ nome: S('nome como o usuário disse'), telefone: S('telefone com DDD, se informado'), observacoes: S('observações') }, ['nome']) },
  { name: 'buscar_produto', description: 'Procura produtos por nome, nome comercial, princípio ativo ou código. Retorna estoque, custo, preço e classe regulatória.', parameters: obj({ texto: S('nome ou código') }, ['texto']) },
  {
    name: 'cadastrar_produto', description: 'Cadastra produto novo apenas com dados informados pelo usuário. Para medicamento, a classe regulatória e o registro ANVISA são obrigatórios: pergunte antes.',
    parameters: obj({
      nome: S('nome'), nome_comercial: S(''), principio_ativo: S(''), apresentacao: S(''), codigo: S('código/EAN'), unidade: S('un, cx, fr...'),
      preco_compra: N('custo unitário'), preco_venda: N('preço de venda'), estoque_minimo: N(''), registro_anvisa: S(''),
      classe_regulatoria: { type: 'string', enum: ['nao_medicamento', 'mip', 'tarja_vermelha', 'tarja_vermelha_retencao', 'controlado_344'] },
    }, ['nome']),
  },
  {
    name: 'registrar_venda', description: 'Grava uma venda (baixa o estoque, cria a conta a receber e o evento na agenda). Precisa de cliente_id e produto_id já obtidos.',
    parameters: obj({
      cliente_id: S('uuid'), itens: { type: 'array', items: obj({ produto_id: S('uuid'), quantidade: N(''), preco_unitario: N(''), desconto: N('desconto do item em R$') }, ['produto_id', 'quantidade', 'preco_unitario']) },
      vencimento: DATA('data prevista de recebimento'), pago_na_hora: B('true se já recebeu'), forma_pagamento: S('pix, dinheiro, cartão...'),
      desconto: N('desconto geral em R$'), data: DATA('data da venda; padrão hoje'), receita_medica_id: S('uuid da receita, se exigida'),
      confirmar_duplicada: B('true só se o usuário confirmou que é outra venda'), observacao: S(''),
    }, ['cliente_id', 'itens']),
  },
  {
    name: 'registrar_compra', description: 'Grava compra de estoque (entrada no estoque, custo, conta a pagar e evento). Para medicamento, informe lote e validade.',
    parameters: obj({
      fornecedor_nome: S('nome do fornecedor, se dito'), fornecedor_id: S('uuid'),
      itens: { type: 'array', items: obj({ produto_id: S('uuid'), quantidade: N(''), custo_unitario: N(''), lote: S(''), validade: DATA('') }, ['produto_id', 'quantidade', 'custo_unitario']) },
      vencimento: DATA('vencimento do pagamento'), parcelas: N('nº de parcelas mensais'), pago_na_hora: B(''), forma_pagamento: S(''), data: DATA(''), observacao: S(''),
    }, ['itens']),
  },
  {
    name: 'registrar_emprestimo', description: 'Grava empréstimo concedido. Calcula juros, parcelas e taxa equivalente. Pode retornar AVISO_LEGAL_PENDENTE.',
    parameters: obj({
      cliente_id: S('uuid'), principal: N('valor emprestado'), taxa_pct: N('taxa por período, em %'),
      periodicidade: { type: 'string', enum: ['diaria', 'semanal', 'mensal', 'anual', 'periodo_total'] },
      modalidade: { type: 'string', enum: ['simples', 'composto'] }, periodos: N('nº de períodos da taxa'),
      parcelas: N('nº de parcelas (padrão 1)'), vencimento: DATA('vencimento final'), data: DATA('data do empréstimo; padrão hoje'),
      ciente_aviso_legal: B('true só depois que o usuário confirmou ciência do aviso legal'),
    }, ['cliente_id', 'principal', 'taxa_pct', 'periodicidade', 'modalidade', 'periodos', 'vencimento']),
  },
  { name: 'registrar_pagamento', description: 'Registra pagamento total ou parcial de uma obrigação (a receber ou a pagar). Atualiza saldos, caixa e agenda.', parameters: obj({ obrigacao_id: S('uuid'), valor: N(''), data: DATA('padrão hoje'), forma: S(''), observacao: S('') }, ['obrigacao_id', 'valor']) },
  {
    name: 'registrar_conta', description: 'Despesa (tipo pagar) ou receita avulsa (tipo receber), pessoal ou comercial. Categorias pessoais: domestica, alimentacao, combustivel, energia, agua, internet, escola, saude, cartao, financiamento, emprestimo_pessoal, assinaturas, outras, salario_pm, outras_receitas. Comerciais: despesas_comerciais, vendas.',
    parameters: obj({
      tipo: { type: 'string', enum: ['pagar', 'receber'] }, descricao: S(''), valor: N('valor total'), escopo: { type: 'string', enum: ['pessoal', 'comercial'] },
      categoria_slug: S('slug da categoria'), pago: B('já foi pago/recebido'), vencimento: DATA(''), data: DATA('data do pagamento; padrão hoje'), parcelas: N(''), forma: S(''),
    }, ['tipo', 'descricao', 'valor', 'escopo']),
  },
  { name: 'criar_recorrencia', description: 'Conta ou receita que se repete todo mês (gera as obrigações e eventos automaticamente).', parameters: obj({ descricao: S(''), tipo: { type: 'string', enum: ['pagar', 'receber'] }, escopo: { type: 'string', enum: ['pessoal', 'comercial'] }, categoria_slug: S(''), valor: N(''), dia_vencimento: N('1 a 31'), inicio: DATA('') }, ['descricao', 'tipo', 'escopo', 'categoria_slug', 'valor', 'dia_vencimento']) },
  { name: 'alterar_vencimento', description: 'Prorroga/altera o vencimento de uma obrigação (atualiza o mesmo evento na agenda).', parameters: obj({ obrigacao_id: S('uuid'), nova_data: DATA(''), motivo: S('') }, ['obrigacao_id', 'nova_data']) },
  { name: 'renegociar_emprestimo', description: 'Renegocia o saldo devedor de um empréstimo com novas condições.', parameters: obj({ emprestimo_id: S('uuid'), taxa_pct: N(''), periodicidade: S(''), modalidade: S(''), periodos: N(''), parcelas: N(''), vencimento: DATA(''), ciente_aviso_legal: B(''), motivo: S('') }, ['emprestimo_id', 'periodos', 'vencimento']) },
  { name: 'estornar_pagamento', description: 'Desfaz um pagamento. Use só depois de o usuário confirmar explicitamente.', parameters: obj({ pagamento_id: S('uuid'), motivo: S('') }, ['pagamento_id', 'motivo']) },
  {
    name: 'registrar_contracheque', description: 'Contracheque da Polícia Militar (receita PESSOAL). Substitui os itens da competência.',
    parameters: obj({
      competencia: DATA('1º dia do mês de referência'), data_pagamento: DATA(''),
      itens: { type: 'array', items: obj({ tipo: { type: 'string', enum: ['provento', 'desconto'] }, rubrica: { type: 'string', enum: ['salario_base', 'gratificacao', 'adicional', 'hora_extra', 'servico_extraordinario', 'auxilio', 'outro_provento', 'previdencia', 'imposto_renda', 'consignado', 'plano_saude', 'associacao', 'pensao', 'outro_desconto'] }, descricao: S(''), valor: N('') }, ['tipo', 'rubrica', 'valor']) },
    }, ['competencia', 'itens']),
  },
  { name: 'registrar_receita_medica', description: 'Registra receita médica de um cliente (exigida para medicamentos sob prescrição).', parameters: obj({ cliente_id: S('uuid'), prescritor: S(''), registro_prescritor: S('CRM/UF'), data_emissao: DATA(''), tipo: { type: 'string', enum: ['simples', 'controle_especial', 'notificacao_A', 'notificacao_B'] }, retida: B('') }, ['cliente_id', 'prescritor', 'registro_prescritor', 'data_emissao', 'tipo']) },
  { name: 'listar_contas', description: 'Lista contas a pagar/receber com filtros. Use para localizar a obrigação de um pagamento e para "quem me deve".', parameters: obj({ tipo: { type: 'string', enum: ['pagar', 'receber'] }, cliente_id: S('uuid'), escopo: S(''), situacao: { type: 'array', items: { type: 'string', enum: ['pendente', 'parcial', 'atrasado', 'pago', 'cancelado', 'renegociado'] } }, de: DATA('vencimento a partir de'), ate: DATA('vencimento até'), texto: S('trecho da descrição') }) },
  { name: 'consultar_cliente', description: 'Histórico financeiro completo de um cliente.', parameters: obj({ cliente_id: S('uuid') }, ['cliente_id']) },
  { name: 'consultar_emprestimos', description: 'Empréstimos com condições e histórico.', parameters: obj({ cliente_id: S('uuid'), status: S('ativo|atrasado|quitado|renegociado') }) },
  { name: 'consultar_estoque', description: 'Inventário e alertas de estoque baixo/validade.', parameters: obj({ texto: S('filtro por nome') }) },
  { name: 'resumo_financeiro', description: 'Indicadores do período: faturamento, lucro, recebimentos, despesas, juros, a receber, a pagar, saldos.', parameters: obj({ de: DATA(''), ate: DATA('') }, ['de', 'ate']) },
  { name: 'enviar_email_cobranca', description: 'Envia pelo Gmail do usuário um lembrete educado de cobrança ao cliente de uma conta a receber. Use só quando o usuário pedir. Precisa do e-mail do cliente cadastrado.', parameters: obj({ obrigacao_id: S('uuid da conta a receber'), email: S('e-mail do cliente, se o usuário informar (será salvo no cadastro)'), mensagem_extra: S('frase opcional do usuário') }, ['obrigacao_id']) },
  { name: 'atualizar_cliente', description: 'Atualiza dados do cliente (e-mail, telefone, observações).', parameters: obj({ cliente_id: S('uuid'), email: S(''), telefone: S(''), observacoes: S('') }, ['cliente_id']) },
  { name: 'status_agenda', description: 'Sincroniza agora com o Google Agenda e devolve o status real dos eventos das obrigações informadas.', parameters: obj({ obrigacao_ids: { type: 'array', items: S('uuid') } }, ['obrigacao_ids']) },
];
