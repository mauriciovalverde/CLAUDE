// ia-modelo: uma "volta" do modelo de IA, para os provedores que rodam na nuvem.
//   acao 'chat'          { provedor: 'ollama_cloud'|'gemini'|'claude', modelo, mensagens, ferramentas } -> { ok, mensagem }
//   acao 'salvar_chave'  { provedor: 'ollama_cloud', chave }  (cifrada; nunca volta para o navegador)
//   acao 'remover_chave' { provedor }
//   acao 'testar'        { provedor } -> { ok, modelos[] }
// Formato canônico das mensagens (igual ao do navegador):
//   { role: 'system'|'user'|'assistant'|'tool', content, tool_calls?: [{id,name,arguments}], tool_call_id?, name? }
// O agente (loop e ferramentas) roda no navegador com o login do usuário: as gravações seguem o RLS.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { admin, cifrar, cors, decifrar, json } from './comum.ts';

const OLLAMA_CLOUD = 'https://ollama.com';
type Msg = { role: string; content?: string; tool_calls?: { id: string; name: string; arguments: any }[]; tool_call_id?: string; name?: string };
type Ferr = { name: string; description: string; parameters: unknown };

// /api/tags é público (responde até com chave falsa); quem valida a chave de verdade é POST /api/me.
async function validarChave(chave: string) {
  const r = await fetch(`${OLLAMA_CLOUD}/api/me`, { method: 'POST', headers: { Authorization: `Bearer ${chave}` } });
  return { ok: r.ok, status: r.status };
}
async function listarModelos() {
  const t = await fetch(`${OLLAMA_CLOUD}/api/tags`);
  const d = await t.json().catch(() => ({}));
  return (d.models ?? []).map((m: any) => m.name ?? m.model) as string[];
}

// Modelos da nuvem tentados em ordem. Alguns exigem créditos pagos (HTTP 402); o app usa o primeiro que responde no plano do usuário.
const CANDIDATOS = ['gpt-oss:20b', 'gemma4:31b', 'glm-5.3-flash', 'deepseek-v4.1-flash', 'minimax-m3.1-flash', 'mimo-v2.6-flash', 'gpt-oss:120b', 'glm-5.3', 'kimi-k2.6', 'mistral-large-4'];
async function testarModelo(chave: string, modelo: string) {
  const r = await fetch(`${OLLAMA_CLOUD}/api/chat`, {
    method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, stream: false, messages: [{ role: 'user', content: 'Responda apenas: ok' }], options: { num_predict: 2 } }),
  });
  return r.status;
}
/** Procura um modelo que funcione de verdade (resposta 200) no plano desta chave. */
async function acharModeloGratis(chave: string, evitar: string[] = []) {
  const disponiveis = new Set(await listarModelos().catch(() => [] as string[]));
  const lista = CANDIDATOS.filter((m) => !evitar.includes(m) && (!disponiveis.size || disponiveis.has(m)));
  let limite = false;
  for (const m of lista) {
    const st = await testarModelo(chave, m);
    if (st === 200) return { modelo: m };
    if (st === 429) { limite = true; break; }
  }
  return { modelo: null as string | null, limite };
}

async function chaveOllama(userId: string) {
  const { data } = await admin().from('chaves_ia').select('chave_cifrada').eq('user_id', userId).eq('provedor', 'ollama_cloud').maybeSingle();
  return data ? decifrar(data.chave_cifrada) : null;
}

async function chatOllama(chave: string, modelo: string, msgs: Msg[], ferr: Ferr[]) {
  const r = await fetch(`${OLLAMA_CLOUD}/api/chat`, {
    method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo, stream: false, options: { temperature: 0.1 },
      tools: ferr.map((f) => ({ type: 'function', function: f })),
      messages: msgs.map((m) => m.role === 'tool' ? { role: 'tool', content: m.content ?? '', tool_name: m.name }
        : m.role === 'assistant' && m.tool_calls?.length ? { role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls.map((t) => ({ function: { name: t.name, arguments: t.arguments } })) }
        : { role: m.role, content: m.content ?? '' }),
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'Chave do Ollama inválida ou expirada. Cole uma nova em Configurações → Inteligência artificial.' : r.status === 429 ? 'Limite gratuito do Ollama de hoje acabou. Tente mais tarde ou use “Ollama no meu computador”.' : `Ollama ${r.status}: ${d?.error ?? ''}`);
  return {
    role: 'assistant', content: d.message?.content ?? '',
    tool_calls: (d.message?.tool_calls ?? []).map((t: any) => ({ id: crypto.randomUUID(), name: t.function?.name, arguments: typeof t.function?.arguments === 'string' ? JSON.parse(t.function.arguments || '{}') : t.function?.arguments ?? {} })),
  };
}


// ---------- Google Gemini (chave gratuita do Google AI Studio), pela API compatível com OpenAI ----------
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
async function chaveDe(userId: string, provedor: string) {
  const { data } = await admin().from('chaves_ia').select('chave_cifrada').eq('user_id', userId).eq('provedor', provedor).maybeSingle();
  return data ? decifrar(data.chave_cifrada) : null;
}
/** Modelos "flash" disponíveis para a chave, do mais novo para o mais antigo. */
async function modelosGemini(chave: string) {
  const r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': chave } });
  if (!r.ok) return { ok: false, status: r.status, modelos: [] as string[] };
  const d = await r.json().catch(() => ({}));
  const nomes = (d.models ?? []).filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m: any) => String(m.name).replace(/^models\//, ''))
    .filter((n: string) => /^gemini-[\d.]+-flash(-lite)?$/.test(n));
  const ver = (n: string) => Number((n.match(/gemini-([\d.]+)/) ?? [])[1] ?? 0);
  nomes.sort((a: string, b: string) => ver(b) - ver(a) || (a.includes('lite') ? 1 : 0) - (b.includes('lite') ? 1 : 0));
  return { ok: true, status: 200, modelos: nomes };
}
function paraOpenAI(msgs: Msg[]) {
  return msgs.map((m) => m.role === 'tool' ? { role: 'tool', tool_call_id: m.tool_call_id, content: m.content ?? '' }
    : m.role === 'assistant' && m.tool_calls?.length ? { role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.arguments ?? {}) } })) }
    : { role: m.role, content: m.content ?? '' });
}
async function chatGemini(chave: string, modelo: string, msgs: Msg[], ferr: Ferr[]) {
  const r = await fetch(`${GEMINI}/openai/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, temperature: 0.1, messages: paraOpenAI(msgs), ...(ferr.length ? { tools: ferr.map((f) => ({ type: 'function', function: f })) } : {}) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const det = Array.isArray(d) ? d[0]?.error?.message : d?.error?.message;
    throw new Error(r.status === 429 ? 'Limite gratuito do Gemini atingido por agora. Espere um pouco e tente de novo.' : r.status === 400 && /API key/i.test(det ?? '') ? 'Chave do Gemini inválida. Gere outra em aistudio.google.com.' : `Gemini ${r.status}: ${det ?? ''}`);
  }
  const msg = d.choices?.[0]?.message ?? {};
  return {
    role: 'assistant', content: msg.content ?? '',
    tool_calls: (msg.tool_calls ?? []).map((t: any) => ({ id: t.id ?? crypto.randomUUID(), name: t.function?.name, arguments: typeof t.function?.arguments === 'string' ? JSON.parse(t.function.arguments || '{}') : t.function?.arguments ?? {} })),
  };
}
/** Testa de verdade (uma resposta curta) e devolve o primeiro modelo gratuito que responder. */
async function acharGemini(chave: string, evitar: string[] = []) {
  const l = await modelosGemini(chave);
  if (!l.ok) return { modelo: null as string | null, invalida: l.status === 400 || l.status === 401 || l.status === 403, limite: false };
  let limite = false;
  for (const m of l.modelos.filter((x) => !evitar.includes(x)).slice(0, 5)) {
    try { await chatGemini(chave, m, [{ role: 'user', content: 'Responda apenas: ok' }], []); return { modelo: m, invalida: false, limite: false }; }
    catch (e) { if (/Limite/.test(String((e as Error).message))) { limite = true; } }
  }
  return { modelo: null as string | null, invalida: false, limite };
}

async function chatClaude(modelo: string, msgs: Msg[], ferr: Ferr[]) {
  const KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!KEY) throw new Error('O Claude não está ativado neste servidor (falta ANTHROPIC_API_KEY). Use o Ollama, que é gratuito.');
  const system = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const out: any[] = [];
  for (const m of msgs.filter((x) => x.role !== 'system')) {
    let item: any;
    if (m.role === 'tool') item = { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content ?? '' }] };
    else if (m.role === 'assistant') item = { role: 'assistant', content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...(m.tool_calls ?? []).map((t) => ({ type: 'tool_use', id: t.id, name: t.name, input: t.arguments ?? {} }))] };
    else item = { role: 'user', content: [{ type: 'text', text: m.content ?? '' }] };
    if (!item.content.length) continue;
    const ult = out[out.length - 1];
    if (ult && ult.role === item.role) ult.content.push(...item.content); else out.push(item);
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo || 'claude-sonnet-5-5', max_tokens: 2048, system, messages: out, tools: ferr.map((f) => ({ name: f.name, description: f.description, input_schema: f.parameters })) }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Claude ${r.status}: ${d?.error?.message ?? ''}`);
  return {
    role: 'assistant', content: d.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n'),
    tool_calls: d.content.filter((b: any) => b.type === 'tool_use').map((b: any) => ({ id: b.id, name: b.name, arguments: b.input })),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const u = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await u.auth.getUser();
  if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
  try {
    const b = await req.json();
    if (b.acao === 'salvar_chave' && b.provedor === 'gemini') {
      const chave = String(b.chave ?? '').trim();
      if (chave.length < 20) return json({ ok: false, mensagem: 'Essa chave parece incompleta. Copie de novo em aistudio.google.com → Get API key.' });
      const a = await acharGemini(chave);
      if (!a.modelo) return json({ ok: false, mensagem: a.invalida ? 'O Google recusou essa chave. Confira se copiou a chave inteira (começa com AIza).' : a.limite ? 'A chave é válida, mas o limite gratuito do Gemini está esgotado agora. Tente daqui a pouco.' : 'Não consegui uma resposta do Gemini com essa chave agora. Tente de novo em instantes.' });
      await admin().from('chaves_ia').upsert({ user_id: user.id, provedor: 'gemini', chave_cifrada: await cifrar(chave), atualizado_em: new Date().toISOString() });
      return json({ ok: true, modelo: a.modelo });
    }
    if (b.acao === 'salvar_chave') {
      const chave = String(b.chave ?? '').trim();
      if (chave.length < 10) return json({ ok: false, mensagem: 'Essa chave parece incompleta. Copie de novo em ollama.com → Settings → Keys.' });
      const v = await validarChave(chave);
      if (!v.ok) return json({ ok: false, mensagem: v.status === 401 || v.status === 403 ? 'O Ollama recusou essa chave. Confira se copiou a chave inteira.' : `Não consegui validar a chave agora (Ollama ${v.status}). Tente de novo em instantes.` });
      const achado = await acharModeloGratis(chave);
      if (!achado.modelo) return json({ ok: false, mensagem: achado.limite ? 'A chave é válida, mas o limite gratuito do Ollama de hoje acabou. Tente amanhã ou use “Ollama no meu computador”.' : 'A chave é válida, mas nenhum modelo da nuvem está liberado no plano gratuito desta conta agora. Use “Ollama no meu computador” (grátis) ou tente mais tarde.' });
      await admin().from('chaves_ia').upsert({ user_id: user.id, provedor: 'ollama_cloud', chave_cifrada: await cifrar(chave), atualizado_em: new Date().toISOString() });
      return json({ ok: true, modelo: achado.modelo, modelos: await listarModelos() });
    }
    if (b.acao === 'remover_chave') {
      await admin().from('chaves_ia').delete().eq('user_id', user.id).eq('provedor', b.provedor ?? 'ollama_cloud');
      return json({ ok: true });
    }
    if (b.acao === 'testar' && b.provedor === 'gemini') {
      const chave = await chaveDe(user.id, 'gemini');
      if (!chave) return json({ ok: false, mensagem: 'Nenhuma chave do Gemini salva ainda.' });
      const a = b.modelo ? await chatGemini(chave, b.modelo, [{ role: 'user', content: 'Responda apenas: ok' }], []).then(() => ({ modelo: b.modelo }), () => acharGemini(chave)) : await acharGemini(chave);
      return json({ ok: !!a.modelo, modelo: a.modelo, mensagem: a.modelo ? `Funcionando ✅ (Gemini ${a.modelo})` : 'O Gemini não respondeu agora (chave recusada ou limite). Gere outra chave ou tente mais tarde.' });
    }
    if (b.acao === 'testar') {
      if (b.provedor === 'claude') return json({ ok: !!Deno.env.get('ANTHROPIC_API_KEY'), modelos: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], mensagem: Deno.env.get('ANTHROPIC_API_KEY') ? 'Claude disponível.' : 'Claude não ativado no servidor.' });
      const chave = await chaveOllama(user.id);
      if (!chave) return json({ ok: false, mensagem: 'Nenhuma chave do Ollama salva ainda.' });
      const v = await validarChave(chave);
      if (!v.ok) return json({ ok: false, modelos: [], mensagem: 'A chave salva não é mais aceita pelo Ollama. Gere uma nova e salve de novo.' });
      const atual = b.modelo && (await testarModelo(chave, b.modelo)) === 200 ? { modelo: b.modelo } : await acharModeloGratis(chave);
      return json({ ok: !!atual.modelo, modelo: atual.modelo, modelos: await listarModelos(), mensagem: atual.modelo ? `Funcionando ✅ (modelo ${atual.modelo})` : 'A chave é válida, mas nenhum modelo gratuito respondeu agora. Use “Ollama no meu computador” ou tente mais tarde.' });
    }
    if (b.acao === 'chat') {
      if (b.provedor === 'claude') return json({ ok: true, mensagem: await chatClaude(b.modelo, b.mensagens, b.ferramentas) });
      if (b.provedor === 'gemini') {
        const chaveG = await chaveDe(user.id, 'gemini');
        if (!chaveG) return json({ ok: false, mensagem: 'Configure sua chave gratuita do Gemini em Configurações → Inteligência artificial.' });
        let modelo = b.modelo || (await acharGemini(chaveG)).modelo;
        if (!modelo) throw new Error('Nenhum modelo do Gemini respondeu agora. Tente de novo em instantes.');
        try { return json({ ok: true, modelo_usado: modelo, mensagem: await chatGemini(chaveG, modelo, b.mensagens, b.ferramentas) }); }
        catch (e) {
          if (!/Gemini (404|403)/.test(String((e as Error).message))) throw e;
          modelo = (await acharGemini(chaveG, [modelo])).modelo;
          if (!modelo) throw e;
          return json({ ok: true, modelo_usado: modelo, mensagem: await chatGemini(chaveG, modelo, b.mensagens, b.ferramentas) });
        }
      }
      const chave = await chaveOllama(user.id);
      if (!chave) return json({ ok: false, mensagem: 'Configure sua chave gratuita do Ollama em Configurações → Inteligência artificial.' });
      let modelo = b.modelo || CANDIDATOS[0];
      try {
        return json({ ok: true, modelo_usado: modelo, mensagem: await chatOllama(chave, modelo, b.mensagens, b.ferramentas) });
      } catch (e) {
        // Modelo passou a exigir créditos (402) ou saiu do ar (404): troca sozinho por outro que funcione
        if (!/Ollama (402|404|403)/.test(String((e as Error).message))) throw e;
        const achado = await acharModeloGratis(chave, [modelo]);
        if (!achado.modelo) throw new Error(achado.limite ? 'O limite gratuito do Ollama de hoje acabou. Tente amanhã ou use “Ollama no meu computador”.' : 'Nenhum modelo gratuito do Ollama está disponível agora. Use “Ollama no meu computador” ou tente mais tarde.');
        modelo = achado.modelo;
        return json({ ok: true, modelo_usado: modelo, mensagem: await chatOllama(chave, modelo, b.mensagens, b.ferramentas) });
      }
    }
    return json({ ok: false, mensagem: 'ação desconhecida' }, 400);
  } catch (e) {
    return json({ ok: false, mensagem: String((e as Error).message ?? e) });
  }
});
