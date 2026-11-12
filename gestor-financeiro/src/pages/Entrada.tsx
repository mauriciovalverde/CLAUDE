import { useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { garantirAcesso, lerAcesso, restaurarComCodigo } from '../lib/acesso';
import { Aviso, Btn, Campo, Textarea } from '../components/ui';
import Login from './Login';

/** Primeira tela: entra sozinho. Sem cadastro, sem e-mail, sem senha. */
export default function Entrada() {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'opcoes' | 'codigo' | 'email'>('carregando');
  const [erro, setErro] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    setEstado('carregando'); setErro('');
    try { await garantirAcesso(); } catch (e: any) { setErro(e.message); setEstado('erro'); }
  }
  useEffect(() => {
    // Primeira abertura neste aparelho: mostra as opções rapidamente, mas entra sozinho se a pessoa não escolher nada
    if (lerAcesso()) { entrar(); return; }
    setEstado('opcoes');
  }, []);

  async function restaurar() {
    setOcupado(true); setErro('');
    try { await restaurarComCodigo(codigo); } catch (e: any) { setErro(e.message); } finally { setOcupado(false); }
  }

  if (estado === 'email') return <div><Login /><p className="pb-6 text-center"><button className="text-sm text-teal-700" onClick={() => setEstado('opcoes')}>← Voltar</button></p></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm pb-40 text-center sm:pb-0">
        <img src="./icone.svg" className="mx-auto mb-3 h-16 w-16" alt="" />
        <h1 className="text-2xl font-bold">Gestor Financeiro</h1>
        <p className="mb-6 text-sm text-slate-500">Suas vendas, contas e empréstimos com ajuda de IA</p>

        {estado === 'carregando' && <div className="flex items-center justify-center gap-2 text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-teal-700" />Abrindo seus dados…</div>}

        {estado === 'erro' && <div className="space-y-3"><Aviso tipo="erro">{erro}</Aviso><Btn className="w-full" onClick={entrar}>Tentar de novo</Btn></div>}

        {estado === 'opcoes' && <div className="space-y-3 text-left">
          <Btn className="w-full !py-3 text-base" onClick={entrar}>Começar a usar</Btn>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" onClick={() => setEstado('codigo')}>
            <Smartphone className="h-4 w-4" />Troquei de celular (tenho meu código)
          </button>
          <p className="text-center text-xs text-slate-500">Não precisa criar conta. Seus dados ficam protegidos e só você vê.</p>
          <p className="text-center"><button className="text-xs text-slate-400 underline" onClick={() => setEstado('email')}>Entrar com e-mail e senha</button></p>
        </div>}

        {estado === 'codigo' && <div className="space-y-3 text-left">
          <Campo rotulo="Código de transferência" dica="Está no celular antigo em Configurações → Trocar de celular (começa com GF1-)"><Textarea rows={3} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="font-mono text-xs" placeholder="GF1-..." /></Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Btn className="w-full" onClick={restaurar} carregando={ocupado} disabled={!codigo.trim()}>Abrir meus dados</Btn>
          <p className="text-center"><button className="text-sm text-teal-700" onClick={() => { setEstado('opcoes'); setErro(''); }}>← Voltar</button></p>
        </div>}
      </div>
    </div>
  );
}
