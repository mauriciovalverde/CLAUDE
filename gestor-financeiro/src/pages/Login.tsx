import { useState } from 'react';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { salvarArquivo } from '../lib/nativo';
import { Aviso, Btn, Campo, Input, toast } from '../components/ui';

// Cadastro e recuperação sem e-mail: a conta é criada já confirmada e a pessoa recebe um código de recuperação.
export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'recuperar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState<{ t: 'erro' | 'ok'; m: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState<string | null>(null);
  const [anotei, setAnotei] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setCarregando(true); setMsg(null);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        if (senha !== senha2) throw new Error('As duas senhas não são iguais.');
        const r = modo === 'criar'
          ? await funcao('conta', { acao: 'criar', email: email.trim(), senha })
          : await funcao('conta', { acao: 'recuperar', email: email.trim(), codigo, nova_senha: senha });
        if (!r.ok) throw new Error(r.mensagem ?? 'Falhou. Tente de novo.');
        setCodigoNovo(r.codigo);
      }
    } catch (e: any) {
      const m = String(e.message ?? e);
      setMsg({ t: 'erro', m: m.includes('Invalid login') ? 'E-mail ou senha incorretos. Se esqueceu, use “Esqueci a senha”.' : m });
    } finally { setCarregando(false); }
  }

  async function continuar() {
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) { setMsg({ t: 'erro', m: error.message }); setCodigoNovo(null); setModo('entrar'); }
  }

  if (codigoNovo) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ShieldCheck className="h-10 w-10 text-teal-700" />
        <h2 className="text-lg font-bold">{modo === 'criar' ? 'Conta criada! ✅' : 'Senha trocada! ✅'}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Este é o seu <b>código de recuperação</b>. Se um dia esquecer a senha, é com ele que você cria uma nova. <b>Anote ou tire um print agora</b>: ele não aparece de novo.</p>
        <div className="rounded-xl border-2 border-dashed border-teal-600 bg-teal-50 p-4 text-center font-mono text-2xl font-bold tracking-widest text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">{codigoNovo}</div>
        <div className="flex gap-2">
          <Btn variante="secundario" className="flex-1" onClick={() => { navigator.clipboard?.writeText(codigoNovo); toast('Código copiado', 'info'); }}><Copy className="h-4 w-4" />Copiar</Btn>
          <Btn variante="secundario" className="flex-1" onClick={() => salvarArquivo('codigo-recuperacao-gestor.txt', btoa(unescape(encodeURIComponent(`Gestor Financeiro\nE-mail: ${email.trim()}\nCódigo de recuperação: ${codigoNovo}\n`))), 'text/plain')}>Salvar arquivo</Btn>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anotei} onChange={(e) => setAnotei(e.target.checked)} />Guardei meu código em lugar seguro</label>
        <Btn className="w-full" disabled={!anotei} carregando={carregando} onClick={continuar}>Entrar no app</Btn>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3"><img src="./icone.svg" className="h-12 w-12" alt="" /><div><h1 className="text-xl font-bold">Gestor Financeiro</h1><p className="text-sm text-slate-500">Inteligente</p></div></div>
        <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta grátis' : 'Criar nova senha'}</h2>
          <Campo rotulo="E-mail"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          {modo === 'recuperar' && <Campo rotulo="Código de recuperação" dica="O código que apareceu quando você criou a conta (ex.: ABCD-EF23-GH45)"><Input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" className="font-mono" /></Campo>}
          <Campo rotulo={modo === 'recuperar' ? 'Nova senha' : 'Senha'}><Input type="password" required autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
          {modo !== 'entrar' && <Campo rotulo="Repita a senha" dica="Mínimo de 8 caracteres"><Input type="password" required autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} /></Campo>}
          {msg && <Aviso tipo={msg.t}>{msg.m}</Aviso>}
          <Btn className="w-full" carregando={carregando}>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Trocar senha'}</Btn>
          <div className="flex justify-between text-sm text-teal-700 dark:text-teal-400">
            {modo !== 'entrar' ? <button type="button" onClick={() => { setModo('entrar'); setMsg(null); }}>Já tenho conta</button> : <button type="button" onClick={() => { setModo('criar'); setMsg(null); }}>Criar conta</button>}
            {modo === 'entrar' && <button type="button" className="flex items-center gap-1" onClick={() => { setModo('recuperar'); setMsg(null); }}><KeyRound className="h-3.5 w-3.5" />Esqueci a senha</button>}
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Seus dados ficam protegidos e separados por usuário. Ninguém mais vê suas informações (LGPD).</p>
      </div>
    </div>
  );
}
