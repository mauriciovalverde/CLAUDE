// Executa as ferramentas da IA com a sessão de quem está logado: grava de verdade no banco e consulta os dados reais.
import { rpc, supabase } from '../supabase';
import { agrupar, carregarPeriodo, indicadores, porCategoria, todas, variacao, variacaoPrecos } from '../analise';
// @ts-ignore módulo JS testado
import { categorizar, chaveFornecedor, chaveProduto, nomeCategoria, nomePadrao, semAcento } from '../catalogo.js';
import { addMeses, fimMes, hoje, inicioMes } from '../fmt';

const r2 = (n: number) => Math.round(n * 100) / 100;
const parecido = (a: string, b: string) => { const x = semAcento(a).toLowerCase(), y = semAcento(b).toLowerCase(); return x.includes(y) || y.includes(x); };

async function acharProduto(nome: string) {
  const { data } = await supabase.from('rest_produtos').select('id,nome,chave,unidade,categoria,estoque_atual,estoque_minimo').neq('status', 'inativo');
  const ch = chaveProduto(nome);
  const exato = (data ?? []).find((p) => p.chave === ch);
  if (exato) return [exato];
  const palavras = semAcento(nome).toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
  return (data ?? []).filter((p) => palavras.every((w: string) => semAcento(p.nome).toLowerCase().includes(w)) || parecido(p.nome, nome)).slice(0, 8);
}
async function acharFornecedor(nome: string) {
  const { data } = await supabase.from('rest_fornecedores').select('id,nome,chave,telefone,condicoes_pagamento');
  const ch = chaveFornecedor(nome);
  const exato = (data ?? []).find((f) => f.chave === ch);
  return exato ? [exato] : (data ?? []).filter((f) => parecido(f.nome, nome)).slice(0, 8);
}

export async function executarFerramenta(nome: string, a: any): Promise<any> {
  switch (nome) {
    case 'buscar_produto': {
      const l = await acharProduto(a.nome);
      const ids = l.map((p) => p.id);
      const { data: precos } = ids.length ? await supabase.from('rest_v_itens').select('produto_id,valor_unitario,data,fornecedor').in('produto_id', ids).not('valor_unitario', 'is', null).order('data', { ascending: false }).limit(50) : { data: [] as any[] };
      return { ok: true, encontrados: l.map((p) => ({ nome: p.nome, unidade: p.unidade, categoria: nomeCategoria(p.categoria), estoque: p.estoque_atual, ultimo_preco: precos?.find((x) => x.produto_id === p.id) ?? null })), dica: l.length ? undefined : 'Produto novo: será cadastrado ao registrar a compra.' };
    }
    case 'buscar_fornecedor': { const l = await acharFornecedor(a.nome); return { ok: true, encontrados: l.map((f) => ({ nome: f.nome, telefone: f.telefone, condicoes: f.condicoes_pagamento })), dica: l.length ? undefined : 'Fornecedor novo: será cadastrado ao registrar a compra.' }; }

    case 'registrar_compra': {
      if (!a.itens?.length) return { ok: false, erro: 'FALTA_ITEM', mensagem: 'Informe pelo menos um produto com valor.' };
      const itens = [];
      for (const i of a.itens) {
        const total = i.valor_total ?? (i.valor_unitario && i.quantidade ? r2(i.valor_unitario * i.quantidade) : null);
        if (!total || total <= 0) return { ok: false, erro: 'FALTA_VALOR', mensagem: `Falta o valor de "${i.produto}".` };
        if (i.valor_unitario && i.quantidade && i.valor_total && Math.abs(i.valor_unitario * i.quantidade - i.valor_total) > Math.max(0.05, i.valor_total * 0.02)) return { ok: false, erro: 'INCONSISTENTE', mensagem: `Para "${i.produto}": ${i.quantidade} × ${i.valor_unitario} não dá ${i.valor_total}. Confirme os valores.` };
        const [p] = await acharProduto(i.produto);
        const exato = p && p.chave === chaveProduto(i.produto) ? p : null;
        itens.push({ produto_id: exato?.id ?? null, nome: exato?.nome ?? nomePadrao(i.produto), chave: chaveProduto(i.produto), categoria: exato?.categoria ?? categorizar(i.produto), unidade: i.unidade ?? exato?.unidade ?? 'un', descricao_original: i.produto, quantidade: i.quantidade ?? null, peso_kg: (i.unidade ?? '') === 'kg' ? i.quantidade : null, valor_unitario: i.valor_unitario ?? (i.quantidade ? r2(total / i.quantidade) : null), valor_total: total });
      }
      const totalCompra = r2(itens.reduce((t, i) => t + i.valor_total, 0) - (a.desconto ?? 0));
      const [forn] = await acharFornecedor(a.fornecedor);
      const fornecedor = forn && forn.chave === chaveFornecedor(a.fornecedor) ? forn : null;
      if (!a.confirmar_duplicada && fornecedor) {
        const { data: dup } = await supabase.from('rest_compras').select('numero,total').eq('fornecedor_id', fornecedor.id).eq('data', a.data).neq('status', 'cancelada');
        const igual = (dup ?? []).find((c) => Math.abs(+c.total - totalCompra) < 0.01);
        if (igual) return { ok: false, erro: 'POSSIVEL_DUPLICIDADE', mensagem: `Já existe a compra #${igual.numero} de ${fornecedor.nome} em ${a.data} com o mesmo total. É outra compra?` };
      }
      const r = await rpc('rest_registrar_compra', { p: { data: a.data, fornecedor_id: fornecedor?.id ?? null, fornecedor_nome: fornecedor?.nome ?? a.fornecedor, fornecedor_chave: chaveFornecedor(a.fornecedor), itens, pago: !!a.pago, forma_pagamento: a.forma_pagamento ?? null, vencimento: a.pago ? null : a.vencimento ?? null, parcelas: a.parcelas ?? 1, desconto: a.desconto ?? 0, recebida: !!a.mercadoria_chegou, origem: 'ia' } });
      return { ok: true, compra_numero: r.numero, total: r.total, fornecedor: r.fornecedor, fornecedor_novo: !fornecedor, itens: itens.map((i) => `${i.nome}${i.produto_id ? '' : ' (novo cadastro)'}: ${i.quantidade ?? ''} ${i.unidade} = R$ ${i.valor_total}`), conta: a.pago ? 'já paga' : `a pagar, vence ${a.vencimento ?? a.data}`, estoque: a.mercadoria_chegou ? 'entrada feita' : 'aguardando chegada (use marcar_compra_recebida)', agenda: a.pago ? null : 'o vencimento aparece no Google Agenda assinado (Financeiro → Google Agenda)' };
    }

    case 'registrar_despesa': {
      if (!a.confirmar_duplicada) {
        const { data: dup } = await supabase.from('rest_contas').select('numero').eq('tipo', 'pagar').eq('valor', a.valor).eq('vencimento', a.vencimento).ilike('descricao', a.descricao).neq('status', 'cancelado');
        if (dup?.length) return { ok: false, erro: 'POSSIVEL_DUPLICIDADE', mensagem: `Já existe a conta #${dup[0].numero} igual (mesma descrição, valor e vencimento). É outra?` };
      }
      const [forn] = a.fornecedor ? await acharFornecedor(a.fornecedor) : [];
      const { data: c, error } = await supabase.from('rest_contas').insert({ tipo: 'pagar', descricao: a.descricao, categoria: a.categoria, valor: a.valor, vencimento: a.vencimento, emissao: hoje(), fornecedor_id: forn?.id ?? null, status: a.pago ? 'pago' : 'pendente', pago_em: a.pago ? hoje() : null, origem: 'ia' }).select('numero').single();
      if (error) return { ok: false, mensagem: error.message };
      return { ok: true, conta_numero: c.numero, situacao: a.pago ? 'paga' : 'a pagar' };
    }

    case 'marcar_compra_recebida': {
      const [forn] = await acharFornecedor(a.fornecedor);
      if (!forn) return { ok: false, mensagem: `Não encontrei o fornecedor "${a.fornecedor}".` };
      let x = supabase.from('rest_compras').select('id,numero,data,total').eq('fornecedor_id', forn.id).eq('status', 'comprada').order('data', { ascending: false });
      if (a.data) x = x.eq('data', a.data);
      const { data: cs } = await x;
      if (!cs?.length) return { ok: false, mensagem: `Não há compra em aberto de ${forn.nome}${a.data ? ` em ${a.data}` : ''}.` };
      if (cs.length > 1 && !a.data) return { ok: false, erro: 'VARIAS', mensagem: `Há ${cs.length} compras em aberto de ${forn.nome}: ${cs.map((c) => `#${c.numero} (${c.data}, R$ ${c.total})`).join('; ')}. Qual chegou?` };
      const r = await rpc('rest_receber_compra', { p_compra: cs[0].id, p_itens: null });
      return { ok: true, compra_numero: cs[0].numero, entradas_no_estoque: r.entradas };
    }

    case 'consultar_gastos': {
      let itens = await todas('rest_v_itens', 'data,fornecedor,produto,categoria,quantidade,unidade,valor_total,valor_unitario', (x) => x.gte('data', a.de).lte('data', a.ate));
      if (a.categoria) itens = itens.filter((i) => i.categoria === a.categoria);
      if (a.fornecedor) itens = itens.filter((i) => parecido(i.fornecedor ?? '', a.fornecedor));
      if (a.produto) itens = itens.filter((i) => parecido(i.produto, a.produto));
      const total = r2(itens.reduce((t, i) => t + +i.valor_total, 0));
      const qtd = r2(itens.reduce((t, i) => t + +(i.quantidade ?? 0), 0));
      const g = a.agrupar_por && a.agrupar_por !== 'nenhum' ? agrupar(itens, (i) => a.agrupar_por === 'categoria' ? nomeCategoria(i.categoria) : a.agrupar_por === 'mes' ? i.data.slice(0, 7) : a.agrupar_por === 'fornecedor' ? (i.fornecedor ?? '—') : i.produto, (i) => +i.valor_total).slice(0, 15) : undefined;
      return { ok: true, periodo: `${a.de} a ${a.ate}`, total, itens_encontrados: itens.length, quantidade_somada: a.produto ? `${qtd} ${itens[0]?.unidade ?? ''}` : undefined, agrupado: g, aviso: itens.length ? undefined : 'Nenhuma compra encontrada com esses filtros.' };
    }

    case 'faturamento': {
      const p = await carregarPeriodo(a.de, a.ate); const i = indicadores(p);
      const formas = Object.fromEntries(['dinheiro', 'debito', 'credito', 'pix', 'vale_alimentacao', 'vale_refeicao', 'outros'].map((k) => [k, r2(p.vendas.reduce((t, v) => t + +v[k], 0))]));
      return { ok: true, periodo: `${a.de} a ${a.ate}`, dias_com_venda: new Set(p.vendas.map((v) => v.data)).size, faturamento_bruto: i.bruto, faturamento_liquido: i.liquido, vendas: i.qtdVendas, ticket_medio: i.ticket, formas, custo_mercadorias: i.cmv, margem_bruta: i.margemBruta, despesas_lancadas: i.despesasLancadas, resultado_operacional_estimado: i.resultado, aviso: p.vendas.length ? undefined : 'Não há vendas registradas nesse período (fechamento de caixa ou importação).' };
    }

    case 'comparar_periodos': {
      const [pa, pb] = await Promise.all([carregarPeriodo(a.a_de, a.a_ate), carregarPeriodo(a.b_de, a.b_ate)]);
      const ia = indicadores(pa), ib = indicadores(pb);
      const comp = (k: keyof typeof ia) => ({ a: ia[k], b: ib[k], variacao_pct: variacao(Number(ia[k] ?? 0), Number(ib[k] ?? 0)) });
      const ca = Object.fromEntries(porCategoria(pa).map((x) => [x.nome, x.total])), cb = Object.fromEntries(porCategoria(pb).map((x) => [x.nome, x.total]));
      return { ok: true, a: `${a.a_de} a ${a.a_ate}`, b: `${a.b_de} a ${a.b_ate}`, faturamento: comp('liquido'), despesas: comp('despesasLancadas'), compras: comp('compras'), custo_mercadorias: comp('cmv'), resultado: comp('resultado'), ticket: comp('ticket'), vendas: comp('qtdVendas'),
        compras_por_categoria: [...new Set([...Object.keys(ca), ...Object.keys(cb)])].map((n) => ({ categoria: n, a: ca[n] ?? 0, b: cb[n] ?? 0, variacao_pct: variacao(ca[n] ?? 0, cb[n] ?? 0) })) };
    }

    case 'preco_produto': {
      const l = await acharProduto(a.produto);
      if (!l.length) return { ok: false, mensagem: `Não encontrei o produto "${a.produto}".` };
      const ids = l.map((p) => p.id);
      const it = await todas('rest_v_itens', 'data,fornecedor,produto,valor_unitario,unidade,quantidade,valor_total', (x) => { let y = x.in('produto_id', ids).not('valor_unitario', 'is', null).order('data'); if (a.de) y = y.gte('data', a.de); if (a.ate) y = y.lte('data', a.ate); return y; });
      if (!it.length) return { ok: false, mensagem: 'Sem preços registrados nesse período.' };
      const porForn = agrupar(it, (i) => i.fornecedor ?? '—', () => 1).map((f) => { const d = it.filter((i) => (i.fornecedor ?? '—') === f.nome); return { fornecedor: f.nome, compras: d.length, ultimo: +d.at(-1)!.valor_unitario, menor: Math.min(...d.map((i) => +i.valor_unitario)), maior: Math.max(...d.map((i) => +i.valor_unitario)) }; });
      const meses = agrupar(it, (i) => i.data.slice(0, 7), (i) => +i.valor_total).map((m) => { const d = it.filter((i) => i.data.startsWith(m.nome)); const q = d.reduce((t, i) => t + +(i.quantidade ?? 0), 0); return { mes: m.nome, gasto: m.total, preco_medio: q ? r2(m.total / q) : null }; }).sort((x, y) => x.mes.localeCompare(y.mes));
      return { ok: true, produtos: l.map((p) => p.nome), unidade: it[0].unidade, primeiro: { data: it[0].data, preco: +it[0].valor_unitario }, ultimo: { data: it.at(-1)!.data, preco: +it.at(-1)!.valor_unitario }, variacao_pct: variacao(+it[0].valor_unitario, +it.at(-1)!.valor_unitario), por_fornecedor: porForn, por_mes: meses, total_gasto: r2(it.reduce((t, i) => t + +i.valor_total, 0)) };
    }

    case 'maiores_aumentos': {
      const ad = a.a_de ?? addMeses(inicioMes(), -1), aa = a.a_ate ?? fimMes(addMeses(inicioMes(), -1)), bd = a.b_de ?? inicioMes(), ba = a.b_ate ?? hoje();
      const [ia, ib] = await Promise.all([todas('rest_v_itens', '*', (x) => x.gte('data', ad).lte('data', aa)), todas('rest_v_itens', '*', (x) => x.gte('data', bd).lte('data', ba))]);
      const v = variacaoPrecos(ia, ib);
      return { ok: true, a: `${ad} a ${aa}`, b: `${bd} a ${ba}`, maiores_aumentos: v.slice(0, 10), maiores_quedas: v.slice(-5).reverse(), produtos_comparados: v.length };
    }

    case 'contas': {
      let x = supabase.from('rest_contas').select('numero,descricao,valor,vencimento,status,pago_em, rest_fornecedores(nome)').eq('tipo', a.tipo).neq('status', 'cancelado').order('vencimento').limit(200);
      if (a.situacao === 'abertas' || !a.situacao) x = x.eq('status', 'pendente'); if (a.situacao === 'vencidas') x = x.eq('status', 'pendente').lt('vencimento', hoje()); if (a.situacao === 'pagas') x = x.eq('status', 'pago');
      if (a.de) x = x.gte(a.situacao === 'pagas' ? 'pago_em' : 'vencimento', a.de); if (a.ate) x = x.lte(a.situacao === 'pagas' ? 'pago_em' : 'vencimento', a.ate);
      const { data: l, error } = await x; if (error) return { ok: false, mensagem: error.message };
      return { ok: true, quantidade: l.length, total: r2(l.reduce((t, c) => t + +c.valor, 0)), contas: l.slice(0, 25).map((c: any) => ({ n: c.numero, descricao: c.descricao, fornecedor: c.rest_fornecedores?.nome, valor: +c.valor, vencimento: c.vencimento, pago_em: c.pago_em })) };
    }

    case 'pagamentos_por_fornecedor': {
      if (a.por === 'compras') { const it = await todas('rest_v_itens', 'fornecedor,valor_total', (x) => x.gte('data', a.de).lte('data', a.ate)); return { ok: true, criterio: 'total comprado', ranking: agrupar(it, (i) => i.fornecedor ?? '—', (i) => +i.valor_total).slice(0, 10) }; }
      const c = await todas('rest_contas', 'valor, rest_fornecedores(nome)', (x) => x.eq('tipo', 'pagar').eq('status', 'pago').gte('pago_em', a.de).lte('pago_em', a.ate).not('fornecedor_id', 'is', null));
      return { ok: true, criterio: 'pagamentos feitos', ranking: agrupar(c, (x: any) => x.rest_fornecedores?.nome ?? '—', (x) => +x.valor).slice(0, 10) };
    }

    case 'estoque': {
      if (a.produto) { const l = await acharProduto(a.produto); return { ok: true, produtos: l.map((p) => ({ nome: p.nome, saldo: +p.estoque_atual, unidade: p.unidade, minimo: +p.estoque_minimo })) }; }
      const { data: l } = await supabase.from('rest_produtos').select('nome,estoque_atual,estoque_minimo,unidade').eq('status', 'ativo').gt('estoque_minimo', 0);
      const baixo = (l ?? []).filter((p) => +p.estoque_atual <= +p.estoque_minimo);
      return { ok: true, abaixo_do_minimo: baixo.map((p) => ({ nome: p.nome, saldo: +p.estoque_atual, minimo: +p.estoque_minimo, unidade: p.unidade })) };
    }
  }
  return { ok: false, mensagem: `ferramenta desconhecida: ${nome}` };
}
