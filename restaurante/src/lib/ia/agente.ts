// Central de comando: o administrador escreve em português e a IA consulta/grava usando as ferramentas.
// Modelo: Ollama na nuvem (grátis, chave do próprio usuário guardada cifrada no servidor) ou Claude, via função ia-modelo.
import { funcao, supabase } from '../supabase';
import { FERRAMENTAS } from './ferramentas';
import { executarFerramenta } from './executor';

export type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; tool_calls?: { id: string; name: string; arguments: any }[]; tool_call_id?: string; name?: string };
const GRAVACAO = /^(registrar|marcar)/;
const CFG = 'rest-ia';
export const lerCfgIA = (): { provedor: 'ollama_cloud' | 'claude'; modelo: string } => { try { return { provedor: 'ollama_cloud', modelo: '', ...JSON.parse(localStorage.getItem(CFG) ?? '{}') }; } catch { return { provedor: 'ollama_cloud', modelo: '' }; } };
export const salvarCfgIA = (c: Partial<ReturnType<typeof lerCfgIA>>) => { try { localStorage.setItem(CFG, JSON.stringify({ ...lerCfgIA(), ...c })); } catch { /* ignore */ } };

function hojeTexto() {
  const d = new Date();
  return { iso: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d), ext: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
}

export function promptSistema(restaurante: string) {
  const h = hojeTexto();
  return `Você é o assistente de gestão do restaurante "${restaurante}". Hoje é ${h.ext} (${h.iso}).
Você consulta e grava dados SOMENTE chamando as ferramentas. Responda em português do Brasil, curto e claro.

REGRAS
1. Nunca diga que gravou algo sem a ferramenta ter retornado ok:true. Se der erro, explique em palavras simples.
2. Nunca invente números, preços, fornecedores ou datas. Se faltar algo obrigatório para gravar, faça UMA pergunta curta.
   Compra: fornecedor, produto(s), quantidade e valor, e se já pagou (ou o vencimento). Se o usuário disser que o fornecedor não importa, use "Não informado".
   Gasto genérico de mercadoria ("gastamos R$ 280 com hortaliças"): registrar_compra com um item "Hortaliças diversas" (valor_total), mercadoria_chegou=false.
   Despesa que não é mercadoria (luz, gás, aluguel, salário): registrar_despesa.
3. Solicitação/pedido NÃO é compra. Compra registrada NÃO é necessariamente paga: pergunte se já pagou quando não for dito.
4. "O fornecedor X entregou": marcar_compra_recebida.
5. POSSIVEL_DUPLICIDADE: pergunte se é outra operação; só repita com confirmar_duplicada=true se o usuário confirmar. INCONSISTENTE: peça para conferir os valores.
6. Datas: "ontem", "este mês", "setembro" (do ano atual, ou do anterior se ainda não chegou), "desde julho", "últimos três meses". Use AAAA-MM-DD.
7. Categorias: carne/carnes = acougue; frango = aves; verduras/legumes = hortalicas.
8. Faturamento (vendas), margem bruta, resultado operacional e saldo de caixa são coisas diferentes: diga qual está mostrando.
9. Valores em reais no formato R$ 1.234,56. Ao terminar uma gravação, mostre um resumo:
✅ <o que foi feito> (#número)
Fornecedor: <nome> (<novo cadastro | já cadastrado>)
<itens e total>
<Pago | A pagar até dd/mm/aaaa> · Estoque: <entrada feita | aguardando chegada>`;
}

async function chamarModelo(msgs: Msg[]): Promise<Msg> {
  const cfg = lerCfgIA();
  const r = await funcao('ia-modelo', { acao: 'chat', provedor: cfg.provedor, modelo: cfg.provedor === 'claude' ? 'claude-sonnet-5-5' : cfg.modelo || undefined, mensagens: msgs, ferramentas: FERRAMENTAS });
  if (!r.ok) throw new Error(r.mensagem ?? r.erro ?? 'Falha ao falar com a IA.');
  if (r.modelo_usado && r.modelo_usado !== cfg.modelo) salvarCfgIA({ modelo: r.modelo_usado });
  return r.mensagem;
}

/** Processa uma mensagem. `modelo` pode ser trocado nos testes. */
export async function conversar(texto: string, historico: { papel: string; texto: string }[], restaurante: string, modelo: (m: Msg[]) => Promise<Msg> = chamarModelo) {
  await supabase.from('rest_chat').insert({ papel: 'user', texto });
  const msgs: Msg[] = [{ role: 'system', content: promptSistema(restaurante) }, ...historico.slice(-12).map((m) => ({ role: (m.papel === 'user' ? 'user' : 'assistant') as Msg['role'], content: m.texto })), { role: 'user', content: texto }];
  const log: { nome: string; entrada: any; saida: any }[] = [];
  try {
    for (let volta = 0; volta < 8; volta++) {
      const resp = await modelo(msgs);
      msgs.push(resp);
      if (!resp.tool_calls?.length) {
        const resposta = (resp.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '(sem resposta)';
        await supabase.from('rest_chat').insert({ papel: 'assistant', texto: resposta, ferramentas: log });
        return { ok: true, resposta, ferramentas: log.map((l) => ({ nome: l.nome, ok: l.saida?.ok })) };
      }
      for (const t of resp.tool_calls) {
        const saida = await executarFerramenta(t.name, t.arguments ?? {}).catch((e) => ({ ok: false, mensagem: String(e?.message ?? e) }));
        log.push({ nome: t.name, entrada: t.arguments, saida });
        msgs.push({ role: 'tool', tool_call_id: t.id, name: t.name, content: JSON.stringify(saida) });
      }
    }
    throw new Error('a conversa ficou longa demais; tente dividir o pedido');
  } catch (e: any) {
    const gravadas = log.filter((l) => l.saida?.ok && GRAVACAO.test(l.nome)).map((l) => l.nome);
    const resposta = `❌ ${e?.message ?? e}${gravadas.length ? `\nJá gravado antes do erro: ${gravadas.join(', ')}.` : '\nNada foi gravado.'}`;
    await supabase.from('rest_chat').insert({ papel: 'assistant', texto: resposta, ferramentas: log });
    return { ok: false, resposta, ferramentas: log.map((l) => ({ nome: l.nome, ok: l.saida?.ok })) };
  }
}
