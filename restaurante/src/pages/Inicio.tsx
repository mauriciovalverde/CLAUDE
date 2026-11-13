import { supabase } from '../lib/supabase';
import { MODULOS, podeVer } from '../lib/modulos';
import { useEu } from '../lib/sessao';
import { brl, hoje, inicioMes } from '../lib/fmt';
import { useDados } from '../components/ui';
import { contadores, meusComunicados } from '../lib/comunicados';
import { Megaphone } from 'lucide-react';

async function contar(t: string, f: (x: any) => any) { const { count } = await f(supabase.from(t).select('id', { count: 'exact', head: true })); return count ?? 0; }

export default function Inicio() {
  const { eu, rest, pode } = useEu();
  const { dados: n } = useDados(async () => {
    const r: Record<string, number> = {};
    const tarefas: Promise<void>[] = [];
    const add = (k: string, p: Promise<number>) => tarefas.push(p.then((v) => { r[k] = v; }));
    if (pode('compras')) {
      add('solicitacoes', contar('rest_solicitacoes', (x) => x.in('status', ['enviada', 'em_analise'])));
      add('notas', contar('rest_notas', (x) => x.eq('status', 'pendente')));
    }
    if (pode('compras') || pode('estoque')) add('compras', contar('rest_compras', (x) => x.eq('status', 'comprada')));
    if (pode('estoque')) {
      const { data } = await supabase.from('rest_produtos').select('estoque_atual,estoque_minimo').eq('status', 'ativo').gt('estoque_minimo', 0);
      r.estoque = (data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo)).length;
    }
    if (pode('admin')) {
      add('fechamento', contar('rest_fechamentos', (x) => x.eq('status', 'encerrado')));
      add('financeiro', contar('rest_contas', (x) => x.eq('status', 'pendente').eq('tipo', 'pagar').lte('vencimento', hoje())));
    } else if (pode('caixa')) {
      add('fechamento', contar('rest_fechamentos', (x) => x.eq('operador_id', eu.id).in('status', ['aberto', 'devolvido'])));
    }
    tarefas.push(meusComunicados(eu.id).then((l) => { const c = contadores(l); r.comunicados = c.pendentes; r._urg = c.urgentes; r._conf = c.confirmadas; r._prazo = c.prazoProximo; r._venc = c.vencidas; }).catch(() => {}));
    add('pedir', contar('rest_solicitacoes', (x) => x.eq('solicitante_id', eu.id).eq('status', 'em_elaboracao')));
    await Promise.all(tarefas);
    return r;
  }, [eu.id]);
  const { dados: resumo } = useDados(async () => (pode('admin') ? (await supabase.rpc('rest_painel', { p_de: inicioMes(), p_ate: hoje() })).data : null), [eu.id]);

  const blocos = MODULOS.filter((m) => podeVer(m.id, pode) && !['configuracoes', 'ajuda'].includes(m.id));
  const hora = new Date().getHours();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <img src="./icone-192.png" className="h-14 w-14 rounded-2xl shadow-sm" alt="" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}, {eu.nome.split(' ')[0]}!</h1>
          <p className="text-sm text-slate-500">{rest.nome} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {n && <a href="#/comunicados" className={`flex items-center gap-3 rounded-2xl p-4 shadow-sm ${n.comunicados ? (n._urg ? 'animate-pulse bg-red-600 text-white' : 'bg-brand-700 text-white') : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
        <Megaphone className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1"><div className="font-bold">COMUNICADOS E AVISOS</div>
          <div className={`text-sm ${n.comunicados ? 'opacity-90' : 'text-slate-500'}`}>{n.comunicados ? `${n.comunicados} comunicado(s) pendente(s)` : 'Nenhum comunicado pendente'}{n._urg ? ` · ${n._urg} urgente(s)` : ''}{n._prazo ? ` · ${n._prazo} com prazo próximo` : ''}{n._venc ? ` · ${n._venc} vencido(s)` : ''} · {n._conf ?? 0} confirmado(s)</div></div>
        {n.comunicados > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-brand-700">{n.comunicados}</span>}
      </a>}

      {resumo && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Vendas hoje', brl(resumo.vendas_hoje)], ['Compras hoje', brl(resumo.compras_hoje)], ['Contas vencidas', brl(resumo.vencidas)], ['Saldo de caixa (estimado)', brl(resumo.saldo_caixa)]].map(([t, v]) => (
          <a key={t} href="#/dashboard" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t}</div><div className="mt-0.5 text-lg font-bold tabular-nums">{v}</div></a>
        ))}
      </div>}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {blocos.map((m) => {
          const qtd = n?.[m.id] ?? 0;
          return (
            <a key={m.id} href={`#/${m.id}`} className={`relative flex aspect-[1.15] flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center shadow-sm transition active:scale-[.97] ${m.cor} dark:brightness-90`}>
              {qtd > 0 && <span className="absolute right-1.5 top-1.5 min-w-[1.4rem] rounded-full bg-brand-700 px-1.5 py-0.5 text-xs font-bold text-white">{qtd}</span>}
              <m.i className={`h-7 w-7 sm:h-8 sm:w-8 ${m.tinta}`} strokeWidth={1.7} />
              <span className="text-[13px] font-semibold leading-tight text-slate-900 sm:text-base">{m.t}</span>
              <span className="hidden text-xs text-slate-600 sm:block">{m.desc}</span>
            </a>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 text-sm"><a href="#/configuracoes" className="text-slate-500 underline-offset-2 hover:underline">Configurações</a><a href="#/ajuda" className="text-slate-500 underline-offset-2 hover:underline">Ajuda</a></div>
    </div>
  );
}
