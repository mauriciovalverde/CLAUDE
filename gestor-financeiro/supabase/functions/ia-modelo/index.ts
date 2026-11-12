// ia-modelo: uma "volta" do modelo de IA, para os provedores que rodam na nuvem.
//   acao 'chat'          { provedor: 'ollama_cloud'|'claude', modelo, mensagens, ferramentas } -> { ok, mensagem }
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
  if (!r.ok) throw new Error(r.status === 401 ? 'Chave do Ollama inválida ou expirada.' : r.status === 429 ? 'Limite gratuito do Ollama Cloud atingido. Tente mais tarde ou use outro modelo.' : `Ollama ${r.status}: ${d?.error ?? ''}`);
  return {
    role: 'assistant', content: d.message?.content ?? '',
    tool_calls: (d.message?.tool_calls ?? []).map((t: any) => ({ id: crypto.randomUUID(), name: t.function?.name, arguments: typeof t.function?.arguments === 'string' ? JSON.parse(t.function.arguments || '{}') : t.function?.arguments ?? {} })),
  };
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
    if (b.acao === 'salvar_chave') {
      const chave = String(b.chave ?? '').trim();
      if (chave.length < 10) return json({ ok: false, mensagem: 'Essa chave parece incompleta. Copie de novo em ollama.com → Settings → Keys.' });
      const v = await validarChave(chave);
      if (!v.ok) return json({ ok: false, mensagem: v.status === 401 || v.status === 403 ? 'O Ollama recusou essa chave. Confira se copiou a chave inteira.' : `Não consegui validar a chave agora (Ollama ${v.status}). Tente de novo em instantes.` });
      await admin().from('chaves_ia').upsert({ user_id: user.id, provedor: 'ollama_cloud', chave_cifrada: await cifrar(chave), atualizado_em: new Date().toISOString() });
      return json({ ok: true, modelos: await listarModelos() });
    }
    if (b.acao === 'remover_chave') {
      await admin().from('chaves_ia').delete().eq('user_id', user.id).eq('provedor', b.provedor ?? 'ollama_cloud');
      return json({ ok: true });
    }
    if (b.acao === 'testar') {
      if (b.provedor === 'claude') return json({ ok: !!Deno.env.get('ANTHROPIC_API_KEY'), modelos: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], mensagem: Deno.env.get('ANTHROPIC_API_KEY') ? 'Claude disponível.' : 'Claude não ativado no servidor.' });
      const chave = await chaveOllama(user.id);
      if (!chave) return json({ ok: false, mensagem: 'Nenhuma chave do Ollama salva ainda.' });
      const v = await validarChave(chave);
      return json({ ok: v.ok, modelos: v.ok ? await listarModelos() : [], mensagem: v.ok ? 'Conectado ao Ollama Cloud.' : 'A chave salva não é mais aceita pelo Ollama. Gere uma nova e salve de novo.' });
    }
    if (b.acao === 'chat') {
      if (b.provedor === 'claude') return json({ ok: true, mensagem: await chatClaude(b.modelo, b.mensagens, b.ferramentas) });
      const chave = await chaveOllama(user.id);
      if (!chave) return json({ ok: false, mensagem: 'Configure sua chave gratuita do Ollama em Configurações → Inteligência artificial.' });
      return json({ ok: true, mensagem: await chatOllama(chave, b.modelo || 'gpt-oss:120b', b.mensagens, b.ferramentas) });
    }
    return json({ ok: false, mensagem: 'ação desconhecida' }, 400);
  } catch (e) {
    return json({ ok: false, mensagem: String((e as Error).message ?? e) });
  }
});
