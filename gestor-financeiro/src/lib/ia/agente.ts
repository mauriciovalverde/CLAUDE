// Agente da Central de Comando: roda no navegador e funciona com
//   - Ollama no computador do usuário (grátis, privado; só no PC/Mac onde está instalado)
//   - Ollama Cloud (grátis com limites; funciona no celular) — via servidor, a chave fica cifrada
//   - Claude (pago pelo dono do app, se ativado no servidor)
import { funcao, supabase } from '../supabase';
import { FERRAMENTAS } from './ferramentas';
import { executarFerramenta } from './executor';

export type Provedor = 'ollama_local' | 'ollama_cloud' | 'claude';
export type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; tool_calls?: { id: string; name: string; arguments: any }[]; tool_call_id?: string; name?: string };
export const MODELO_PADRAO: Record<Provedor, string> = { ollama_local: 'qwen3:8b', ollama_cloud: 'gpt-oss:120b', claude: 'claude-sonnet-5-5' };
const FERR = (FERRAMENTAS as any[]).map((f) => ({ name: f.name, description: f.description, parameters: f.parameters }));
const GRAVACAO = /^(registrar|cadastrar|alterar|renegociar|estornar|criar|enviar|atualizar)/;

function hojeLocal(fuso: string) {
  const d = new Date();
  return {
    iso: new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    ext: new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d),
  };
}

export function promptSistema(cfg: any, google: string) {
  const h = hojeLocal(cfg?.fuso ?? 'America/Bahia');
  return `Você é o assistente financeiro do app GESTOR FINANCEIRO${cfg?.nome_negocio ? ` de "${cfg.nome_negocio}"` : ''}. Hoje é ${h.ext} (${h.iso}).
Google (Agenda e Gmail): ${google}.
Você registra e consulta movimentações SOMENTE chamando as ferramentas. Responda em português do Brasil, curto, simples e gentil: o usuário pode ser leigo.

REGRAS
1. Nunca diga que algo foi salvo sem uma ferramenta ter retornado ok:true. Se der erro, explique em palavras simples e diga o que falta.
2. Nunca invente dados (telefone, e-mail, preço, custo, data, taxa). Se faltar algo obrigatório, faça UMA pergunta curta.
   Venda: cliente, produto, quantidade e preço, vencimento ou "pago agora". Empréstimo: cliente, valor, taxa, se é ao mês ou no período, vencimento, juros simples ou composto (se mais de um período).
   Compra: produto, quantidade, custo, vencimento ou "pago agora". Despesa: descrição, valor, se já foi paga ou quando vence.
3. Antes de criar cliente, chame buscar_cliente. Antes de criar produto, chame buscar_produto. Se o produto parecer remédio, pergunte a classe regulatória e o registro ANVISA.
4. Datas: "dia 20" = próximo dia 20 que ainda não passou; "14 de dezembro" = próximo 14/12; "em 30 dias" = hoje + 30. Use o formato AAAA-MM-DD nas ferramentas.
5. Venda, compra, empréstimo e estoque são COMERCIAIS. Casa, família e salário são PESSOAIS.
6. Faturamento (vendido), recebimento (entrou), lucro (vendido − custo) e saldo (caixa) são diferentes.
7. AVISO_LEGAL_PENDENTE: explique que a taxa está acima da referência legal para empréstimo entre pessoas (Lei de Usura) e pergunte se quer registrar mesmo assim, ciente. Só repita com ciente_aviso_legal=true após o "sim".
8. Bloqueios de medicamento (licença, receita, ANVISA, controlado): explique o motivo. Nunca sugira contornar.
9. POSSIVEL_DUPLICIDADE: pergunte se é outra operação. Só repita com confirmar_duplicada=true se o usuário confirmar.
10. Pagamento: localize a conta com listar_contas. Valor menor que o saldo = pagamento parcial; informe o saldo restante.
11. E-mail de cobrança: só envie se o usuário pedir. Se o cliente não tiver e-mail, pergunte.
12. Depois de gravar algo com vencimento, chame status_agenda com os obrigacao_id retornados.
13. Ao terminar uma gravação, mostre um resumo:
✅ <O que foi feito> (#número)
Cliente/Fornecedor: <nome> (<novo cadastro | já cadastrado>)
<valores principais>
<A receber | A pagar>: R$ <valor>, vence em <dd/mm/aaaa>
Google Agenda: <✅ evento criado | ⏳ pendente: motivo | ❌ erro: motivo> (use SOMENTE o que status_agenda retornar)`;
}

async function chamarOllamaLocal(url: string, modelo: string, msgs: Msg[]): Promise<Msg> {
  let r: Response;
  try {
    r = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo, stream: false, options: { temperature: 0.1 }, tools: FERR.map((f) => ({ type: 'function', function: f })),
        messages: msgs.map((m) => m.role === 'tool' ? { role: 'tool', content: m.content ?? '', tool_name: m.name }
          : m.role === 'assistant' && m.tool_calls?.length ? { role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls.map((t) => ({ function: { name: t.name, arguments: t.arguments } })) }
          : { role: m.role, content: m.content ?? '' }),
      }),
    });
  } catch {
    throw new Error('Não encontrei o Ollama neste computador. Abra o programa Ollama e confira em Configurações → Inteligência artificial (botão "Testar").');
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 404 ? `O modelo "${modelo}" não está baixado. Vá em Configurações → Inteligência artificial e clique em "Baixar modelo".` : `Ollama ${r.status}: ${d?.error ?? ''}`);
  return {
    role: 'assistant', content: d.message?.content ?? '',
    tool_calls: (d.message?.tool_calls ?? []).map((t: any) => ({ id: crypto.randomUUID(), name: t.function?.name, arguments: typeof t.function?.arguments === 'string' ? JSON.parse(t.function.arguments || '{}') : t.function?.arguments ?? {} })),
  };
}

async function chamarModelo(cfg: any, msgs: Msg[]): Promise<Msg> {
  const prov: Provedor = cfg?.ia_provedor ?? 'ollama_cloud';
  const modelo = cfg?.ia_ollama_modelo || MODELO_PADRAO[prov];
  if (prov === 'ollama_local') return chamarOllamaLocal(cfg?.ia_ollama_url ?? 'http://localhost:11434', modelo, msgs);
  const r = await funcao('ia-modelo', { acao: 'chat', provedor: prov, modelo: prov === 'claude' ? 'claude-sonnet-5-5' : modelo, mensagens: msgs, ferramentas: FERR });
  if (!r.ok) throw new Error(r.mensagem ?? r.erro ?? 'Falha ao falar com a IA.');
  return r.mensagem;
}

/** Processa uma mensagem do usuário. Retorna a resposta e as ferramentas usadas. */
export async function conversar(conversaId: string, mensagemId: string, texto: string, historico: { papel: string; texto: string }[]) {
  const { data: cfg } = await supabase.from('configuracoes').select('*').maybeSingle();
  const { data: integ } = await supabase.from('v_integracoes').select('status,conta_email').maybeSingle();
  const google = integ?.status === 'conectado' ? `conectado (${integ.conta_email})` : 'DESCONECTADO (eventos ficam pendentes e e-mails não podem ser enviados)';
  const { data: op } = await supabase.from('ia_operacoes').insert({ conversa_id: conversaId, mensagem: texto }).select('id').single();
  await supabase.from('chat_mensagens').insert({ conversa_id: conversaId, papel: 'user', conteudo: { texto, mensagem_id: mensagemId } });

  const msgs: Msg[] = [{ role: 'system', content: promptSistema(cfg, google) },
    ...historico.slice(-12).map((m) => ({ role: (m.papel === 'user' ? 'user' : 'assistant') as Msg['role'], content: m.texto })),
    { role: 'user', content: texto }];
  const log: any[] = [];
  try {
    for (let volta = 0; volta < 10; volta++) {
      const resp = await chamarModelo(cfg, msgs);
      msgs.push(resp);
      if (!resp.tool_calls?.length) {
        const resposta = (resp.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '(sem resposta)';
        await supabase.from('chat_mensagens').insert({ conversa_id: conversaId, papel: 'assistant', conteudo: { texto: resposta, ferramentas: log.map((l) => l.nome) } });
        await supabase.from('ia_operacoes').update({ ferramentas: log, resposta, status: 'concluida' }).eq('id', op?.id);
        return { ok: true, resposta, ferramentas: log.map((l) => ({ nome: l.nome, ok: l.saida?.ok })) };
      }
      for (const [i, t] of resp.tool_calls.entries()) {
        const t0 = Date.now();
        const saida = await executarFerramenta(t.name, t.arguments ?? {}, `ia:${conversaId}:${mensagemId}:${volta}:${i}`).catch((e) => ({ ok: false, mensagem: String(e?.message ?? e) }));
        log.push({ nome: t.name, entrada: t.arguments, saida, ms: Date.now() - t0 });
        msgs.push({ role: 'tool', tool_call_id: t.id, name: t.name, content: JSON.stringify(saida) });
      }
    }
    throw new Error('a conversa ficou longa demais; tente dividir o pedido');
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    await supabase.from('ia_operacoes').update({ ferramentas: log, status: 'erro', erro: msg }).eq('id', op?.id);
    const gravadas = log.filter((l) => l.saida?.ok && GRAVACAO.test(l.nome)).map((l) => l.nome);
    return { ok: false, resposta: `❌ ${msg}${gravadas.length ? `\nJá gravado antes do erro: ${gravadas.join(', ')}.` : '\nNada foi gravado.'}`, ferramentas: log.map((l) => ({ nome: l.nome, ok: l.saida?.ok })) };
  }
}

// ---------- utilitários de configuração ----------
export async function ollamaLocalStatus(url: string) {
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, modelos: [] as string[], erro: `respondeu ${r.status}` };
    const d = await r.json();
    return { ok: true, modelos: (d.models ?? []).map((m: any) => m.name as string) };
  } catch { return { ok: false, modelos: [] as string[], erro: 'nao_encontrado' }; }
}

/** Baixa um modelo no Ollama local com progresso (0–100). */
export async function ollamaBaixar(url: string, modelo: string, progresso: (p: number, status: string) => void) {
  const r = await fetch(`${url.replace(/\/$/, '')}/api/pull`, { method: 'POST', body: JSON.stringify({ model: modelo, stream: true }) });
  if (!r.ok || !r.body) throw new Error('Não consegui pedir o download ao Ollama.');
  const leitor = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { done, value } = await leitor.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split('\n'); buf = linhas.pop() ?? '';
    for (const l of linhas) {
      if (!l.trim()) continue;
      const j = JSON.parse(l);
      if (j.error) throw new Error(j.error);
      progresso(j.total ? Math.round((j.completed ?? 0) / j.total * 100) : (j.status === 'success' ? 100 : 0), j.status);
    }
  }
}
