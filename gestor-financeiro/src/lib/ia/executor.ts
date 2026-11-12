// Executa as ferramentas da IA no navegador, com o login do usuário (RLS sempre ativo).
// Mesmas RPCs usadas pelas telas: uma única porta de escrita.
import { funcao, supabase } from '../supabase';
import { brl, dataBR } from '../fmt';
import { linkEmail, linkGoogleAgenda, linkWhatsApp, textoCobranca } from '../compartilhar';

export function emailCobranca(o: any, nomeNegocio: string, extra?: string) {
  const nome = o.cliente_nome ?? 'cliente';
  const assunto = `Lembrete de pagamento - ${brl(o.saldo)} - vence ${dataBR(o.vencimento)}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.5">
<p>Olá, ${nome}!</p>
<p>Passando para lembrar, com todo respeito, do pagamento abaixo:</p>
<table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:4px 12px 4px 0;color:#64748b">Referente a</td><td><b>${o.descricao}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Valor em aberto</td><td><b>${brl(o.saldo)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Vencimento</td><td><b>${dataBR(o.vencimento)}</b></td></tr></table>
${extra ? `<p>${extra.replace(/</g, '&lt;')}</p>` : ''}
<p>Se já pagou, por favor desconsidere esta mensagem. Qualquer dúvida, é só responder este e-mail.</p>
<p>Obrigado!<br>${nomeNegocio || ''}</p></div>`;
  return { assunto, html };
}

export async function executarFerramenta(nome: string, e: any, chave: string): Promise<any> {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, codigo: error.message.split(':')[0].trim(), mensagem: error.message };
    return data && typeof data === 'object' && !Array.isArray(data) ? { ok: true, ...data } : { ok: true, resultado: data };
  };
  const sel = async (p: PromiseLike<{ data: any; error: any }>) => { const { data, error } = await p; return error ? { ok: false, mensagem: error.message } : { ok: true, dados: data }; };
  switch (nome) {
    case 'buscar_cliente': return rpc('buscar_clientes', { p_texto: e.texto });
    case 'cadastrar_ou_atualizar_cliente': return rpc('upsert_cliente', { p_nome: e.nome, p_telefone: e.telefone ?? null, p_obs: e.observacoes ?? null });
    case 'atualizar_cliente': {
      const p: any = {}; for (const k of ['email', 'telefone', 'observacoes']) if (e[k]) p[k] = e[k];
      return sel(supabase.from('clientes').update(p).eq('id', e.cliente_id).select('id,nome,telefone,email').single());
    }
    case 'buscar_produto': {
      const t = String(e.texto ?? '').trim().replace(/[,()]/g, ' ');
      return sel(supabase.from('produtos').select('id,nome,nome_comercial,principio_ativo,apresentacao,codigo,unidade,preco_compra,preco_venda,margem_pct,estoque_atual,estoque_minimo,classe_regulatoria,registro_anvisa')
        .is('excluido_em', null).or(`nome.ilike.%${t}%,codigo.eq.${t},nome_comercial.ilike.%${t}%,principio_ativo.ilike.%${t}%`).limit(10));
    }
    case 'cadastrar_produto': return sel(supabase.from('produtos').insert({ ...e }).select().single());
    case 'registrar_venda': return rpc('registrar_venda', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_compra': return rpc('registrar_compra', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_emprestimo': return rpc('registrar_emprestimo', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_pagamento': return rpc('registrar_pagamento', { p_obrigacao: e.obrigacao_id, p_valor: e.valor, p_data: e.data ?? null, p_forma: e.forma ?? null, p_conta: null, p_obs: e.observacao ?? null, p_chave: chave });
    case 'registrar_conta': return rpc('registrar_conta', { p: { ...e, chave_idempotencia: chave } });
    case 'alterar_vencimento': return rpc('alterar_vencimento', { p_obrigacao: e.obrigacao_id, p_nova: e.nova_data, p_motivo: e.motivo ?? null });
    case 'renegociar_emprestimo': return rpc('renegociar_emprestimo', { p: e });
    case 'estornar_pagamento': return rpc('estornar_pagamento', { p_pagamento: e.pagamento_id, p_motivo: e.motivo });
    case 'registrar_contracheque': return rpc('registrar_contracheque', { p: e });
    case 'registrar_receita_medica': return sel(supabase.from('receitas_medicas').insert(e).select().single());
    case 'criar_recorrencia': {
      const { data: cat } = await supabase.from('categorias').select('id').eq('escopo', e.escopo).eq('slug', e.categoria_slug).maybeSingle();
      return sel(supabase.from('recorrencias').insert({ descricao: e.descricao, tipo: e.tipo, escopo: e.escopo, categoria_id: cat?.id, valor: e.valor, dia_vencimento: e.dia_vencimento, inicio: e.inicio ?? undefined }).select().single());
    }
    case 'listar_contas': {
      let q = supabase.from('v_obrigacoes').select('id,numero,tipo,escopo,origem,descricao,cliente_id,cliente_nome,cliente_telefone,fornecedor_nome,categoria_nome,parcela_num,parcela_total,valor,valor_pago,saldo,vencimento,situacao,dias_atraso,agenda_status').order('vencimento').limit(50);
      if (e.tipo) q = q.eq('tipo', e.tipo);
      if (e.cliente_id) q = q.eq('cliente_id', e.cliente_id);
      if (e.escopo) q = q.eq('escopo', e.escopo);
      if (e.situacao?.length) q = q.in('situacao', e.situacao);
      if (e.de) q = q.gte('vencimento', e.de);
      if (e.ate) q = q.lte('vencimento', e.ate);
      if (e.texto) q = q.ilike('descricao', `%${e.texto}%`);
      return sel(q);
    }
    case 'consultar_cliente': {
      const [res, vendas, emps, contas] = await Promise.all([
        supabase.from('v_clientes_resumo').select('*').eq('id', e.cliente_id).maybeSingle(),
        supabase.from('vendas').select('numero,data,total,lucro_bruto,status,venda_itens(quantidade,preco_unitario,produtos(nome))').eq('cliente_id', e.cliente_id).is('excluido_em', null).order('data', { ascending: false }).limit(20),
        supabase.from('emprestimos').select('numero,data,principal,taxa_pct,periodicidade,modalidade,total_previsto,vencimento,status').eq('cliente_id', e.cliente_id).is('excluido_em', null),
        supabase.from('v_obrigacoes').select('id,numero,descricao,saldo,vencimento,situacao').eq('cliente_id', e.cliente_id).in('situacao', ['pendente', 'parcial', 'atrasado']),
      ]);
      return { ok: true, resumo: res.data, vendas: vendas.data, emprestimos: emps.data, pendencias: contas.data };
    }
    case 'consultar_emprestimos': {
      let q = supabase.from('emprestimos').select('id,numero,data,principal,taxa_pct,periodicidade,modalidade,periodos,parcelas,vencimento,juros_previstos,total_previsto,taxa_mensal_equivalente_pct,acima_limite_legal,status,clientes(nome,telefone)').is('excluido_em', null).order('data', { ascending: false }).limit(30);
      if (e.cliente_id) q = q.eq('cliente_id', e.cliente_id);
      if (e.status) q = q.eq('status', e.status);
      return sel(q);
    }
    case 'consultar_estoque': {
      const [p, a] = await Promise.all([
        supabase.from('produtos').select('nome,estoque_atual,estoque_minimo,unidade,preco_compra,preco_venda,margem_pct,classe_regulatoria').is('excluido_em', null).ilike('nome', `%${e.texto ?? ''}%`).order('nome').limit(50),
        supabase.from('v_estoque_alertas').select('*'),
      ]);
      return { ok: true, produtos: p.data, alertas: a.data };
    }
    case 'resumo_financeiro': {
      const { de, ate } = e;
      const [vendas, lanc, abertas, saldos, juros] = await Promise.all([
        supabase.from('vendas').select('total,lucro_bruto,custo_total').is('excluido_em', null).neq('status', 'cancelado').gte('data', de).lte('data', ate),
        supabase.from('lancamentos').select('tipo,escopo,natureza,valor').is('excluido_em', null).gte('data', de).lte('data', ate),
        supabase.from('v_obrigacoes').select('tipo,saldo,situacao').in('situacao', ['pendente', 'parcial', 'atrasado']),
        supabase.from('v_saldo_contas').select('nome,escopo,saldo'),
        supabase.from('pagamentos').select('juros_valor').is('estornado_em', null).gte('data', de).lte('data', ate),
      ]);
      const s = (a: any[] | null, f: (x: any) => boolean, k = 'valor') => (a ?? []).filter(f).reduce((t, x) => t + Number(x[k] ?? 0), 0);
      const v = vendas.data ?? [];
      return {
        ok: true, periodo: { de, ate }, faturamento: s(v, () => true, 'total'), qtd_vendas: v.length,
        lucro_bruto_vendas: s(v, (x) => x.lucro_bruto != null, 'lucro_bruto'), vendas_sem_custo: v.filter((x) => x.custo_total == null).length,
        recebimentos_comerciais: s(lanc.data, (x) => x.tipo === 'entrada' && x.escopo === 'comercial'),
        receitas_pessoais: s(lanc.data, (x) => x.tipo === 'entrada' && x.escopo === 'pessoal' && x.natureza === 'operacional'),
        despesas_pessoais: s(lanc.data, (x) => x.tipo === 'saida' && x.escopo === 'pessoal' && x.natureza === 'operacional'),
        lucro_com_juros: s(juros.data, () => true, 'juros_valor'),
        a_receber_total: s(abertas.data, (x) => x.tipo === 'receber', 'saldo'), a_receber_atrasado: s(abertas.data, (x) => x.tipo === 'receber' && x.situacao === 'atrasado', 'saldo'),
        a_pagar_total: s(abertas.data, (x) => x.tipo === 'pagar', 'saldo'), saldos_contas: saldos.data,
      };
    }
    case 'enviar_email_cobranca': {
      const { data: o } = await supabase.from('v_obrigacoes').select('*').eq('id', e.obrigacao_id).maybeSingle();
      if (!o) return { ok: false, mensagem: 'Conta não encontrada.' };
      if (o.tipo !== 'receber') return { ok: false, mensagem: 'Só é possível cobrar contas a receber.' };
      let email = e.email;
      if (email && o.cliente_id) await supabase.from('clientes').update({ email }).eq('id', o.cliente_id);
      if (!email && o.cliente_id) email = (await supabase.from('clientes').select('email').eq('id', o.cliente_id).single()).data?.email;
      if (!email) return { ok: false, codigo: 'SEM_EMAIL', mensagem: 'O cliente não tem e-mail cadastrado. Pergunte o e-mail ao usuário ou ofereça o WhatsApp.', link_whatsapp: o.cliente_telefone ? linkWhatsApp(o.cliente_telefone, textoCobranca(o)) : null };
      const { data: cfg } = await supabase.from('configuracoes').select('nome_negocio').maybeSingle();
      const { data: integ } = await supabase.from('v_integracoes').select('status').maybeSingle();
      if (integ?.status !== 'conectado') {
        const t = textoCobranca(o, cfg?.nome_negocio ?? '');
        return { ok: false, codigo: 'GMAIL_NAO_CONECTADO', mensagem: 'O Gmail não está conectado. Ofereça os links abaixo para o usuário cobrar com um toque.', link_whatsapp: o.cliente_telefone ? linkWhatsApp(o.cliente_telefone, t) : null, link_email: linkEmail(email, `Lembrete de pagamento - ${o.descricao}`, t) };
      }
      const m = emailCobranca(o, cfg?.nome_negocio ?? '', e.mensagem_extra);
      const r = await funcao('gmail-enviar', { para: email, assunto: m.assunto, html: m.html, tipo: 'cobranca', cliente_id: o.cliente_id, obrigacao_id: o.id });
      return r.ok ? { ok: true, enviado_para: email, de: r.de } : { ok: false, mensagem: r.mensagem ?? r.erro };
    }
    case 'status_agenda': {
      const r = await funcao('agenda-sync', { obrigacao_ids: e.obrigacao_ids, forcar: true }).catch((err) => ({ ok: false, erro: String(err) }));
      const { data: evs } = await supabase.from('agenda_eventos').select('obrigacao_id,status,google_event_id,html_link,ultimo_erro').in('obrigacao_id', e.obrigacao_ids ?? []);
      const { data: integ } = await supabase.from('v_integracoes').select('status,conta_email').maybeSingle();
      let links: any[] = [];
      if (integ?.status !== 'conectado') {
        const { data: obs } = await supabase.from('v_obrigacoes').select('*').in('id', e.obrigacao_ids ?? []);
        links = (obs ?? []).filter((o: any) => o.saldo > 0).map((o: any) => ({ obrigacao_id: o.id, adicionar_ao_google_agenda: linkGoogleAgenda(o) }));
      }
      return { ok: true, google: integ?.status ?? 'desconectado', conta: integ?.conta_email ?? null, eventos: evs, sync: r?.detalhes ?? r, links_agenda_manual: links };
    }
    default: return { ok: false, mensagem: 'ferramenta desconhecida: ' + nome };
  }
}
