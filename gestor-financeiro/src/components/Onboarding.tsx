import { useEffect, useState } from 'react';
import { Bot, CalendarCheck, Mail, PartyPopper, Wallet } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { abrirExterno, aoVoltarAoApp, ehNativo } from '../lib/nativo';
import { Aviso, Btn, Campo, Input, toast } from './ui';
import ConfigIA from './ConfigIA';

const PASSOS = ['Boas-vindas', 'Seu dinheiro hoje', 'Inteligência artificial', 'Google Agenda e Gmail', 'Pronto!'];
const ler = () => { try { return Number(localStorage.getItem('gfi-onb') ?? 0); } catch { return 0; } };

export default function Onboarding({ aoTerminar }: { aoTerminar: () => void }) {
  const [passo, setPassoS] = useState(ler);
  const setPasso = (n: number) => { setPassoS(n); try { localStorage.setItem('gfi-onb', String(n)); } catch { /* ignore */ } };
  const [nome, setNome] = useState('');
  const [contas, setContas] = useState<any[]>([]);
  const [saldos, setSaldos] = useState<Record<string, string>>({});
  const [google, setGoogle] = useState<string>('desconectado');
  const [msgGoogle, setMsgGoogle] = useState('');
  useEffect(() => {
    supabase.from('configuracoes').select('nome_negocio').maybeSingle().then(({ data }) => setNome(data?.nome_negocio ?? ''));
    supabase.from('contas_financeiras').select('*').is('excluido_em', null).order('escopo').then(({ data }) => setContas(data ?? []));
    const st = () => supabase.from('v_integracoes').select('status').maybeSingle().then(({ data }) => { setGoogle(data?.status ?? 'desconectado'); if (data?.status === 'conectado') setMsgGoogle(''); });
    st(); aoVoltarAoApp(() => setTimeout(st, 800));
  }, []);
  const uid = async () => (await supabase.auth.getUser()).data.user!.id;

  async function salvarNome() { await supabase.from('configuracoes').update({ nome_negocio: nome.trim() || null }).eq('user_id', await uid()); setPasso(1); }
  async function salvarSaldos() {
    for (const c of contas) if (saldos[c.id] != null && saldos[c.id] !== '') {
      const v = saldos[c.id].includes(',') ? Number(saldos[c.id].replace(/\./g, '').replace(',', '.')) : Number(saldos[c.id]);
      if (!isNaN(v)) await supabase.from('contas_financeiras').update({ saldo_inicial: v }).eq('id', c.id);
    }
    setPasso(2);
  }
  async function conectarGoogle() {
    setPasso(3);
    const r = await funcao('google-oauth/iniciar', { retorno: ehNativo() ? 'app' : 'web' });
    if (r.ok) { await abrirExterno(r.url); if (ehNativo()) setMsgGoogle('Autorize no navegador que abriu e depois volte para o app. A tela atualiza sozinha.'); }
    else setMsgGoogle(r.erro === 'google_nao_configurado' ? 'Sem problema! Mesmo sem conectar, você já pode cobrar pelo WhatsApp ou e-mail e adicionar cada vencimento ao Google Agenda com um toque (botões 💬 ✉️ 📅 em Contas). Pode clicar em “Fazer depois”.' : (r.erro ?? 'Falha ao iniciar.'));
  }
  async function concluir() {
    await supabase.from('configuracoes').update({ onboarding_concluido: true }).eq('user_id', await uid());
    try { localStorage.removeItem('gfi-onb'); } catch { /* ignore */ }
    toast('Tudo pronto! 🎉'); aoTerminar();
  }

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 flex items-center gap-2"><img src="./icone.svg" className="h-9 w-9" alt="" /><span className="font-bold">Configuração inicial</span><span className="ml-auto text-xs text-slate-500">Passo {passo + 1} de {PASSOS.length}</span></div>
        <div className="mb-6 flex gap-1">{PASSOS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-800'}`} />)}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-xl font-bold">{PASSOS[passo]}</h2>

          {passo === 0 && <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">Em poucos minutos você deixa tudo pronto. Depois é só <b>conversar</b>: “vendi 2 unidades para Maria por 300, ela paga dia 10” — e o sistema anota, calcula e te lembra na agenda.</p>
            <Campo rotulo="Nome do seu negócio (aparece nos e-mails e relatórios)"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Loja da Ana" /></Campo>
            <Btn onClick={salvarNome}>Começar</Btn>
          </div>}

          {passo === 1 && <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Wallet className="h-4 w-4" />Quanto dinheiro você tem hoje? (pode deixar 0 e ajustar depois)</p>
            {contas.map((c) => <Campo key={c.id} rotulo={`${c.nome} (${c.escopo === 'pessoal' ? 'seu dinheiro pessoal' : 'dinheiro do negócio'})`}><Input inputMode="decimal" placeholder="0,00" value={saldos[c.id] ?? ''} onChange={(e) => setSaldos({ ...saldos, [c.id]: e.target.value })} /></Campo>)}
            <Aviso>O sistema separa sempre o <b>pessoal</b> do <b>negócio</b>, para você saber o lucro de verdade.</Aviso>
            <div className="flex gap-2"><Btn variante="secundario" onClick={() => setPasso(0)}>Voltar</Btn><Btn onClick={salvarSaldos}>Continuar</Btn></div>
          </div>}

          {passo === 2 && <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Bot className="h-4 w-4" />Escolha a IA que vai entender suas mensagens. A opção “Ollama na nuvem” é grátis e a mais fácil.</p>
            <ConfigIA aoConcluir={() => setPasso(3)} />
            <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"><Btn variante="secundario" onClick={() => setPasso(1)}>Voltar</Btn><Btn variante="fantasma" onClick={() => setPasso(3)}>Fazer depois</Btn></div>
          </div>}

          {passo === 3 && <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><CalendarCheck className="mb-1 h-5 w-5 text-teal-700" /><b>Agenda:</b> cada vencimento vira um lembrete no seu Google Agenda (3 dias antes, 1 dia antes e no dia).</div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><Mail className="mb-1 h-5 w-5 text-teal-700" /><b>Gmail:</b> envie cobranças educadas e relatórios em PDF pelo seu próprio e-mail, com um clique.</div>
            </div>
            {google === 'conectado' ? <Aviso tipo="ok">✅ Google conectado!</Aviso> : <>
              <p className="text-sm text-slate-600 dark:text-slate-300">Clique no botão, escolha sua conta Google e aperte <b>Permitir</b>. Se aparecer “o Google não verificou este app”, clique em <b>Avançado → Acessar</b>.</p>
              <Btn onClick={conectarGoogle}>Conectar minha conta Google</Btn>
              {msgGoogle && <Aviso tipo="alerta">{msgGoogle}</Aviso>}
            </>}
            <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"><Btn variante="secundario" onClick={() => setPasso(2)}>Voltar</Btn><Btn variante={google === 'conectado' ? 'primario' : 'fantasma'} onClick={() => setPasso(4)}>{google === 'conectado' ? 'Continuar' : 'Fazer depois'}</Btn></div>
          </div>}

          {passo === 4 && <div className="space-y-4">
            <PartyPopper className="h-10 w-10 text-teal-700" />
            <p className="text-sm">Pronto! Experimente escrever no chat:</p>
            <ul className="space-y-1.5 text-sm">
              {['Comprei 10 unidades de sabonete por 3 reais cada', 'Vendi 2 sabonetes para Maria, 71 99999-0000, por 8 reais cada, ela paga dia 20', 'Paguei 120 reais de internet', 'Quem está me devendo?', 'Manda cobrança por e-mail para a Maria'].map((t) => <li key={t} className="rounded-lg bg-slate-50 px-3 py-2 italic dark:bg-slate-800/50">“{t}”</li>)}
            </ul>
            <p className="text-xs text-slate-500">Dúvidas? O menu <b>Ajuda</b> tem um passo a passo de tudo.</p>
            <Btn onClick={concluir}>Ir para o app</Btn>
          </div>}
        </div>
      </div>
    </div>
  );
}
