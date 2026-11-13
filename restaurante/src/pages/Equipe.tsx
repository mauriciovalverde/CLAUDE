import { useState } from 'react';
import { Plus } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { PAPEIS, useEu, type Papel } from '../lib/sessao';
import { dataHora, tel } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Tabela, toast, useDados } from '../components/ui';

export default function Equipe() {
  const { rest } = useEu();
  const [editar, setEditar] = useState<any>(null);
  const [aba, setAba] = useState<'equipe' | 'auditoria'>('equipe');
  const { dados } = useDados(() => q<any[]>(supabase.from('rest_funcionarios').select('*').order('ativo', { ascending: false }).order('nome')), []);
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Equipe e acessos" sub="Cada pessoa entra com o próprio nome e PIN e só vê o que a função permite" acoes={<Btn onClick={() => setEditar({})}><Plus className="h-4 w-4" />Adicionar pessoa</Btn>} />
      <Card><div className="text-sm">Código do restaurante para a equipe entrar: <b className="font-mono text-lg tracking-widest text-brand-700">{rest.codigo}</b></div>
        <a className="mt-2 inline-flex rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Acesse o app do ${rest.nome}: https://mauriciovalverde.github.io/CLAUDE/restaurante/\nCódigo do restaurante: ${rest.codigo}\nDepois toque no seu nome e digite o seu PIN.`)}`}>Enviar convite pelo WhatsApp</a></Card>
      <div className="flex gap-2">{(['equipe', 'auditoria'] as const).map((a) => <button key={a} onClick={() => setAba(a)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${aba === a ? 'bg-brand-700 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'}`}>{a === 'equipe' ? 'Equipe' : 'Histórico de alterações'}</button>)}</div>
      {aba === 'equipe' ? <Tabela linhas={dados} aoClicar={setEditar} colunas={[
        { k: 'nome', t: 'Nome', r: (f) => <span className={f.ativo ? '' : 'text-slate-400 line-through'}>{f.nome}</span> },
        { k: 'p', t: 'Funções', r: (f) => f.papeis.map((p: string) => PAPEIS.find((x) => x.id === p)?.nome).join(', ') },
        { k: 's', t: 'Setor', r: (f) => f.setor ?? '—', esconderCelular: true },
        { k: 'u', t: 'Último acesso', r: (f) => dataHora(f.ultimo_acesso), esconderCelular: true },
      ]} /> : <Auditoria />}
      {editar && <EditarPessoa f={editar} fechar={() => setEditar(null)} />}
    </div>
  );
}

function EditarPessoa({ f, fechar }: { f: any; fechar: () => void }) {
  const [d, setD] = useState({ nome: f.nome ?? '', papeis: (f.papeis ?? ['solicitante']) as Papel[], setor: f.setor ?? '', telefone: f.telefone ?? '', pin: '', ativo: f.ativo ?? true });
  const [salvando, setSalvando] = useState(false);
  const alternar = (p: Papel) => setD({ ...d, papeis: d.papeis.includes(p) ? d.papeis.filter((x) => x !== p) : [...d.papeis, p] });
  return (
    <Modal aberto fechar={fechar} titulo={f.id ? f.nome : 'Nova pessoa na equipe'}>
      <div className="space-y-3">
        <Campo rotulo="Nome (como aparece na tela de entrada)"><Input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <div><span className="mb-1 block text-sm font-medium">Funções</span>
          <div className="space-y-1.5">{PAPEIS.map((p) => <label key={p.id} className={`flex cursor-pointer gap-2 rounded-xl border p-2 text-sm ${d.papeis.includes(p.id) ? 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-800'}`}><input type="checkbox" checked={d.papeis.includes(p.id)} onChange={() => alternar(p.id)} className="mt-0.5 h-4 w-4" /><span><b>{p.nome}</b><br /><span className="text-xs text-slate-500">{p.desc}</span></span></label>)}</div></div>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Setor"><Select value={d.setor} onChange={(e) => setD({ ...d, setor: e.target.value })}><option value="">—</option>{['Cozinha', 'Salão', 'Bar', 'Caixa', 'Limpeza', 'Estoque', 'Administração'].map((x) => <option key={x}>{x}</option>)}</Select></Campo>
          <Campo rotulo="Telefone"><Input value={tel(d.telefone)} onChange={(e) => setD({ ...d, telefone: e.target.value })} inputMode="tel" /></Campo>
        </div>
        <Campo rotulo={f.id ? 'Novo PIN (deixe vazio para manter)' : 'PIN (4 a 6 números)'} dica="Combine com a pessoa. Ela pode trocar depois em Configurações."><Input type="password" inputMode="numeric" maxLength={6} value={d.pin} onChange={(e) => setD({ ...d, pin: e.target.value.replace(/\D/g, '') })} /></Campo>
        {f.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} />Acesso ativo (desmarque quando a pessoa sair da equipe)</label>}
        <Aviso>Os dados da equipe (nome, telefone) são usados só para o acesso e o histórico de operações (LGPD).</Aviso>
        <Btn className="w-full" carregando={salvando} disabled={d.nome.trim().length < 2 || !d.papeis.length || (!f.id && d.pin.length < 4)} onClick={async () => {
          setSalvando(true);
          const r = f.id
            ? await funcao('rest-acesso', { acao: 'alterar_funcionario', id: f.id, nome: d.nome.trim(), papeis: d.papeis, setor: d.setor, telefone: d.telefone.replace(/\D/g, ''), ativo: d.ativo, ...(d.pin ? { pin: d.pin } : {}) })
            : await funcao('rest-acesso', { acao: 'criar_funcionario', nome: d.nome.trim(), papeis: d.papeis, setor: d.setor, telefone: d.telefone.replace(/\D/g, ''), pin: d.pin });
          setSalvando(false);
          if (!r.ok) toast(r.mensagem ?? 'Não deu certo', 'erro'); else { toast('Salvo'); avisarMudanca(); fechar(); }
        }}>Salvar</Btn>
      </div>
    </Modal>
  );
}

const TABELAS: Record<string, string> = { rest_ponto_marcacoes: 'Ponto: marcação', rest_ponto_ajustes: 'Ponto: correção', rest_ponto_ausencias: 'Ponto: ausência', rest_ponto_jornadas: 'Ponto: jornada', rest_ponto_fechamentos: 'Ponto: fechamento do mês', rest_func_ficha: 'Ficha do funcionário', rest_ponto_locais: 'Ponto: local', rest_ponto_folgas: 'Ponto: folga', rest_contas: 'Conta', rest_compras: 'Compra', rest_fechamentos: 'Fechamento de caixa', rest_vendas: 'Venda', rest_notas: 'Nota fiscal', rest_estoque_movs: 'Estoque', rest_produtos: 'Produto', rest_fornecedores: 'Fornecedor', rest_funcionarios: 'Equipe', rest_restaurantes: 'Restaurante', rest_solicitacoes: 'Solicitação' };
function Auditoria() {
  const [t, setT] = useState('');
  const { dados } = useDados(() => { let x = supabase.from('rest_auditoria').select('*').order('em', { ascending: false }).limit(200); if (t) x = x.eq('tabela', t); return q<any[]>(x); }, [t]);
  const { dados: equipe } = useDados(() => q<any[]>(supabase.from('rest_funcionarios').select('id,nome')), []);
  const quem = (id: string) => equipe?.find((e) => e.id === id)?.nome ?? '—';
  const mudou = (a: any) => a.acao !== 'update' || !a.antes ? '' : Object.keys(a.depois ?? {}).filter((k) => JSON.stringify(a.antes[k]) !== JSON.stringify(a.depois[k]) && !['atualizado_em', 'saldo_apos'].includes(k)).map((k) => `${k}: ${a.antes[k] ?? '—'} → ${a.depois[k] ?? '—'}`).join('; ');
  return (
    <>
      <Select className="!w-auto" value={t} onChange={(e) => setT(e.target.value)}><option value="">Tudo</option>{Object.entries(TABELAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Tabela linhas={dados} vazio="Sem registros." colunas={[
        { k: 'em', t: 'Quando', r: (a) => dataHora(a.em) }, { k: 'q', t: 'Quem', r: (a) => quem(a.funcionario_id) },
        { k: 't', t: 'O quê', r: (a) => `${TABELAS[a.tabela] ?? a.tabela} · ${a.acao === 'insert' ? 'criado' : a.acao === 'update' ? 'alterado' : 'excluído'}` },
        { k: 'd', t: 'Detalhe', r: (a) => <span className="text-xs text-slate-500">{mudou(a).slice(0, 160)}</span>, esconderCelular: true },
      ]} />
    </>
  );
}
