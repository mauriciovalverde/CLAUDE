// ia-comando: Central de Comando com IA (Claude + tool use).
// A IA só grava no banco por ferramentas que chamam as RPCs com o JWT do usuário (RLS sempre ativo).
// A resposta final é escrita a partir do retorno real das ferramentas.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { cors, json } from './comum.ts';
import { FERRAMENTAS } from './ferramentas.ts';

const SUPA = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

function hojeLocal(fuso: string) {
  const d = new Date();
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const ext = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return { iso, ext };
}

function systemPrompt(nome: string, fuso: string, google: string, extra: string) {
  const h = hojeLocal(fuso);
  return `Você é o assistente do GESTOR FINANCEIRO INTELIGENTE de ${nome}. Hoje é ${h.ext} (${h.iso}), fuso ${fuso}.
Google Agenda: ${google}.
Você registra e consulta movimentações financeiras SOMENTE por meio das ferramentas. Fale português do Brasil, curto e objetivo.

REGRAS
1. Nunca diga que algo foi salvo sem uma ferramenta ter retornado ok:true. Se uma ferramenta retornar erro, explique em linguagem simples e diga o que falta.
2. Nunca invente dados (telefone, CPF, preço, custo, data, taxa). Se faltar algo OBRIGATÓRIO, pergunte só isso, numa única pergunta.
   Obrigatórios: venda = cliente, produto, quantidade e preço (ou valor total), vencimento ou "pago agora".
   Empréstimo = cliente, valor, taxa, base da taxa (ao mês/dia/ano/período todo), prazo ou vencimento, e juros simples ou composto quando houver mais de um período.
   Compra = produto, quantidade, custo unitário ou total, vencimento ou "pago agora". Despesa = descrição, valor, se já foi paga ou o vencimento.
3. Clientes: SEMPRE chame buscar_cliente antes de criar. Telefone manda. Se houver candidatos ambíguos, pergunte qual é. Diga "novo cadastro" quando criar.
4. Produtos: chame buscar_produto. Se não existir, crie com cadastrar_produto só com os dados ditos.
   Se o nome sugerir medicamento (princípio ativo, mg, ampola, caneta, siglas de remédio), pergunte o que é, a classe regulatória e o registro ANVISA ANTES de cadastrar.
5. Datas relativas a hoje: "dia 20" = o próximo dia 20 que ainda não passou; "14 de dezembro" = o próximo 14/12; "em 30 dias" = hoje + 30. Data vaga: pergunte.
6. Venda, compra, empréstimo e estoque são COMERCIAIS. Casa, família e salário PM são PESSOAIS. Na dúvida, pergunte.
7. Faturamento, recebimento, lucro e saldo são diferentes: use exatamente o que as ferramentas de consulta retornarem.
8. AVISO_LEGAL_PENDENTE: mostre a taxa equivalente e a referência legal (Lei de Usura; cobrança acima do permitido pode ser crime, Lei 1.521/51), diga que o sistema não garante a legalidade e pergunte se quer registrar ciente. Só repita com ciente_aviso_legal=true depois do "sim".
9. Bloqueios de medicamento (LICENCA_OBRIGATORIA, RECEITA_OBRIGATORIA, RECEITA_RETENCAO, CONTROLADO_BLOQUEADO, REGISTRO_ANVISA_AUSENTE): explique o motivo e o que precisa ser regularizado. Nunca sugira contornar (por exemplo, recadastrar como não-medicamento).
10. POSSIVEL_DUPLICIDADE: mostre a operação parecida e pergunte se é outra. Só repita com confirmar_duplicada=true se confirmar.
11. Pagamento recebido/feito: localize a obrigação com listar_contas. Mais de uma candidata: pergunte. Valor menor que o saldo = PARCIAL: informe o saldo restante.
12. Depois de gravar algo com vencimento, chame status_agenda com os obrigacao_id retornados.
13. Toda resposta que gravou algo termina com o bloco de confirmação:
✅ <Operação> registrada (#<prefixo>-<número com 6 dígitos>)
Cliente/Fornecedor: <nome> (<novo cadastro | cadastro existente>, tel. <telefone, se houver>)
<linhas com produto, quantidade, valores, juros, lucro, estoque, conforme o caso>
<A receber | A pagar>: R$ <valor>, vencimento <dd/mm/aaaa>
Google Agenda: <✅ evento criado/atualizado "título" | ⏳ pendente: motivo | ❌ erro: motivo> (use SOMENTE o que status_agenda retornar)
Prefixos: V venda, C compra, E empréstimo, OB obrigação.
${extra}`;
}

async function executar(db: SupabaseClient, nome: string, e: any, chave: string, auth: string): Promise<any> {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) {
      const m = error.message ?? String(error);
      return { ok: false, codigo: m.split(':')[0].trim(), mensagem: m };
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? { ok: true, ...data } : { ok: true, resultado: data };
  };
  const sel = async (p: PromiseLike<{ data: any; error: any }>) => {
    const { data, error } = await p;
    return error ? { ok: false, mensagem: error.message } : { ok: true, dados: data };
  };
  switch (nome) {
    case 'buscar_cliente': return rpc('buscar_clientes', { p_texto: e.texto });
    case 'cadastrar_ou_atualizar_cliente': {
      const r = await rpc('upsert_cliente', { p_nome: e.nome, p_telefone: e.telefone ?? null, p_obs: e.observacoes ?? null });
      if (r.ok && r.status === 'existente' && (e.endereco || e.observacoes)) {
        await db.from('clientes').update({ observacoes: e.observacoes ?? undefined }).eq('id', r.cliente_id);
      }
      return r;
    }
    case 'buscar_produto': {
      const t = String(e.texto ?? '').trim();
      return sel(db.from('produtos').select('id,nome,nome_comercial,principio_ativo,apresentacao,codigo,unidade,preco_compra,preco_venda,margem_pct,estoque_atual,estoque_minimo,classe_regulatoria,registro_anvisa')
        .is('excluido_em', null).or(`nome.ilike.%${t}%,codigo.eq.${t},nome_comercial.ilike.%${t}%,principio_ativo.ilike.%${t}%`).limit(10));
    }
    case 'cadastrar_produto': return sel(db.from('produtos').insert({ ...e }).select().single());
    case 'registrar_venda': return rpc('registrar_venda', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_compra': return rpc('registrar_compra', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_emprestimo': return rpc('registrar_emprestimo', { p: { ...e, chave_idempotencia: chave } });
    case 'registrar_pagamento': return rpc('registrar_pagamento', { p_obrigacao: e.obrigacao_id, p_valor: e.valor, p_data: e.data ?? null, p_forma: e.forma ?? null, p_conta: null, p_obs: e.observacao ?? null, p_chave: chave });
    case 'registrar_conta': return rpc('registrar_conta', { p: { ...e, chave_idempotencia: chave } });
    case 'alterar_vencimento': return rpc('alterar_vencimento', { p_obrigacao: e.obrigacao_id, p_nova: e.nova_data, p_motivo: e.motivo ?? null });
    case 'renegociar_emprestimo': return rpc('renegociar_emprestimo', { p: e });
    case 'estornar_pagamento': return rpc('estornar_pagamento', { p_pagamento: e.pagamento_id, p_motivo: e.motivo });
    case 'registrar_contracheque': return rpc('registrar_contracheque', { p: e });
    case 'registrar_receita_medica': return sel(db.from('receitas_medicas').insert(e).select().single());
    case 'criar_recorrencia': {
      const { data: cat } = await db.from('categorias').select('id').eq('escopo', e.escopo).eq('slug', e.categoria_slug).maybeSingle();
      return sel(db.from('recorrencias').insert({ descricao: e.descricao, tipo: e.tipo, escopo: e.escopo, categoria_id: cat?.id, valor: e.valor, dia_vencimento: e.dia_vencimento, inicio: e.inicio ?? undefined }).select().single());
    }
    case 'listar_contas': {
      let q = db.from('v_obrigacoes').select('id,numero,tipo,escopo,origem,descricao,cliente_nome,cliente_telefone,fornecedor_nome,categoria_nome,parcela_num,parcela_total,valor,valor_pago,saldo,vencimento,situacao,dias_atraso,agenda_status').order('vencimento').limit(50);
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
      const [res, vendas, emps, contas, pags] = await Promise.all([
        db.from('v_clientes_resumo').select('*').eq('id', e.cliente_id).maybeSingle(),
        db.from('vendas').select('numero,data,total,lucro_bruto,status,venda_itens(quantidade,preco_unitario,produtos(nome))').eq('cliente_id', e.cliente_id).is('excluido_em', null).order('data', { ascending: false }).limit(20),
        db.from('emprestimos').select('numero,data,principal,taxa_pct,periodicidade,modalidade,total_previsto,vencimento,status').eq('cliente_id', e.cliente_id).is('excluido_em', null),
        db.from('v_obrigacoes').select('numero,descricao,saldo,vencimento,situacao').eq('cliente_id', e.cliente_id).in('situacao', ['pendente', 'parcial', 'atrasado']),
        db.from('pagamentos').select('data,valor,juros_valor,obrigacoes!inner(cliente_id,descricao)').eq('obrigacoes.cliente_id', e.cliente_id).is('estornado_em', null).order('data', { ascending: false }).limit(20),
      ]);
      return { ok: true, resumo: res.data, vendas: vendas.data, emprestimos: emps.data, pendencias: contas.data, pagamentos: pags.data };
    }
    case 'consultar_emprestimos': {
      let q = db.from('emprestimos').select('id,numero,data,principal,taxa_pct,periodicidade,modalidade,periodos,parcelas,vencimento,juros_previstos,total_previsto,taxa_mensal_equivalente_pct,acima_limite_legal,status,clientes(nome,telefone),emprestimo_eventos(tipo,dados,criado_em)').is('excluido_em', null).order('data', { ascending: false }).limit(30);
      if (e.cliente_id) q = q.eq('cliente_id', e.cliente_id);
      if (e.status) q = q.eq('status', e.status);
      return sel(q);
    }
    case 'consultar_estoque': {
      const t = String(e.texto ?? '');
      const [p, a] = await Promise.all([
        db.from('produtos').select('nome,estoque_atual,estoque_minimo,unidade,preco_compra,preco_venda,margem_pct,classe_regulatoria').is('excluido_em', null).ilike('nome', `%${t}%`).order('nome').limit(50),
        db.from('v_estoque_alertas').select('*'),
      ]);
      return { ok: true, produtos: p.data, alertas: a.data };
    }
    case 'resumo_financeiro': {
      const de = e.de, ate = e.ate;
      const [vendas, lanc, abertas, saldos, juros] = await Promise.all([
        db.from('vendas').select('total,lucro_bruto,custo_total').is('excluido_em', null).neq('status', 'cancelado').gte('data', de).lte('data', ate),
        db.from('lancamentos').select('tipo,escopo,natureza,valor').is('excluido_em', null).gte('data', de).lte('data', ate),
        db.from('v_obrigacoes').select('tipo,escopo,origem,saldo,situacao').in('situacao', ['pendente', 'parcial', 'atrasado']),
        db.from('v_saldo_contas').select('*'),
        db.from('pagamentos').select('juros_valor').is('estornado_em', null).gte('data', de).lte('data', ate),
      ]);
      const s = (a: any[] | null, f: (x: any) => boolean, k = 'valor') => (a ?? []).filter(f).reduce((t, x) => t + Number(x[k] ?? 0), 0);
      const v = vendas.data ?? [];
      return {
        ok: true, periodo: { de, ate },
        faturamento: s(v, () => true, 'total'), qtd_vendas: v.length,
        lucro_bruto_vendas: s(v, (x) => x.lucro_bruto != null, 'lucro_bruto'), vendas_sem_custo: v.filter((x) => x.custo_total == null).length,
        recebimentos_comerciais: s(lanc.data, (x) => x.tipo === 'entrada' && x.escopo === 'comercial'),
        receitas_pessoais: s(lanc.data, (x) => x.tipo === 'entrada' && x.escopo === 'pessoal' && x.natureza === 'operacional'),
        despesas_pessoais: s(lanc.data, (x) => x.tipo === 'saida' && x.escopo === 'pessoal' && x.natureza === 'operacional'),
        despesas_comerciais_pagas: s(lanc.data, (x) => x.tipo === 'saida' && x.escopo === 'comercial' && x.natureza === 'operacional'),
        lucro_com_juros: s(juros.data, () => true, 'juros_valor'),
        a_receber_total: s(abertas.data, (x) => x.tipo === 'receber', 'saldo'),
        a_receber_atrasado: s(abertas.data, (x) => x.tipo === 'receber' && x.situacao === 'atrasado', 'saldo'),
        a_pagar_total: s(abertas.data, (x) => x.tipo === 'pagar', 'saldo'),
        saldos_contas: saldos.data,
      };
    }
    case 'status_agenda': {
      const r = await fetch(`${SUPA}/functions/v1/agenda-sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: ANON },
        body: JSON.stringify({ obrigacao_ids: e.obrigacao_ids, forcar: true }),
      }).then((x) => x.json()).catch((err) => ({ ok: false, erro: String(err) }));
      const { data: evs } = await db.from('agenda_eventos').select('obrigacao_id,status,google_event_id,html_link,ultimo_erro').in('obrigacao_id', e.obrigacao_ids ?? []);
      const { data: integ } = await db.from('v_integracoes').select('status,conta_email').maybeSingle();
      return { ok: true, google: integ?.status ?? 'desconectado', conta: integ?.conta_email ?? null, eventos: evs, sync: r?.detalhes ?? r };
    }
    default: return { ok: false, mensagem: 'ferramenta desconhecida: ' + nome };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(SUPA, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
  const KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!KEY) return json({ ok: false, erro: 'ia_nao_configurada', resposta: '⚠️ A IA ainda não está ativada: falta a chave ANTHROPIC_API_KEY nos secrets das Edge Functions do Supabase. Nada foi gravado.' });

  const { conversa_id, mensagem_id, texto } = await req.json();
  if (!conversa_id || !texto) return json({ ok: false, erro: 'parametros' }, 400);
  await db.rpc('inicializar_usuario');
  const { data: cfg } = await db.from('configuracoes').select('*').maybeSingle();
  const { data: integ } = await db.from('v_integracoes').select('status,conta_email').maybeSingle();
  const { data: hist } = await db.from('chat_mensagens').select('papel,conteudo').eq('conversa_id', conversa_id).order('criado_em', { ascending: false }).limit(20);
  const { data: op } = await db.from('ia_operacoes').insert({ conversa_id, mensagem: texto }).select('id').single();
  await db.from('chat_mensagens').insert({ conversa_id, papel: 'user', conteudo: { texto, mensagem_id } });

  const messages: any[] = (hist ?? []).reverse().map((m: any) => ({ role: m.papel, content: String(m.conteudo?.texto ?? '') }))
    .filter((m: any) => m.content);
  // garante alternância começando por 'user'
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: texto });
  const merged: any[] = [];
  for (const m of messages) {
    if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n' + m.content;
    else merged.push({ ...m });
  }

  const fuso = cfg?.fuso ?? 'America/Bahia';
  const system = systemPrompt(user.email ?? 'usuário', fuso,
    integ?.status === 'conectado' ? `conectado (${integ.conta_email})` : 'DESCONECTADO (eventos ficam pendentes até conectar)', '');
  const log: any[] = [];
  try {
    for (let volta = 0; volta < 10; volta++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg?.ia_modelo ?? 'claude-sonnet-5-5', max_tokens: 2048, system, tools: FERRAMENTAS, messages: merged }),
      });
      const resp = await r.json();
      if (!r.ok) throw new Error(`Claude API ${r.status}: ${resp?.error?.message ?? JSON.stringify(resp)}`);
      merged.push({ role: 'assistant', content: resp.content });
      if (resp.stop_reason !== 'tool_use') {
        const resposta = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
        await db.from('chat_mensagens').insert({ conversa_id, papel: 'assistant', conteudo: { texto: resposta, ferramentas: log.map((l) => l.nome) } });
        await db.from('ia_operacoes').update({ ferramentas: log, resposta, status: 'concluida' }).eq('id', op?.id);
        return json({ ok: true, resposta, ferramentas: log.map((l) => ({ nome: l.nome, ok: l.saida?.ok })) });
      }
      const resultados: any[] = [];
      let i = 0;
      for (const b of resp.content.filter((x: any) => x.type === 'tool_use')) {
        const t0 = Date.now();
        const saida = await executar(db, b.name, b.input ?? {}, `ia:${conversa_id}:${mensagem_id}:${volta}:${i++}`, auth);
        log.push({ nome: b.name, entrada: b.input, saida, ms: Date.now() - t0 });
        resultados.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(saida), is_error: saida?.ok === false });
      }
      merged.push({ role: 'user', content: resultados });
    }
    throw new Error('limite de etapas atingido');
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    await db.from('ia_operacoes').update({ ferramentas: log, status: 'erro', erro: msg }).eq('id', op?.id);
    const gravadas = log.filter((l) => l.saida?.ok && /^registrar|cadastrar|alterar|renegociar|estornar|criar/.test(l.nome)).map((l) => l.nome);
    return json({ ok: false, erro: msg, resposta: `❌ Não consegui concluir (${msg}).${gravadas.length ? ' Já gravado: ' + gravadas.join(', ') + '.' : ' Nada foi gravado.'}` }, 200);
  }
});
