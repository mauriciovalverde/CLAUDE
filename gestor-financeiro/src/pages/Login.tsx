import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { urlApp } from '../lib/nativo';
import { Aviso, Btn, Campo, Input } from '../components/ui';

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'recuperar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ t: 'erro' | 'ok'; m: string } | null>(null);
  const [carregando, setCarregando] = useState(false);


  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setCarregando(true); setMsg(null);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modo === 'criar') {
        if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: urlApp() } });
        if (error) throw error;
        if (!data.session) setMsg({ t: 'ok', m: 'Conta criada. Abra o e-mail de confirmação que enviamos e depois entre aqui.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlApp() });
        if (error) throw error;
        setMsg({ t: 'ok', m: 'Enviamos um link para redefinir a senha.' });
      }
    } catch (e: any) {
      const m = String(e.message ?? e);
      setMsg({ t: 'erro', m: m.includes('Invalid login') ? 'E-mail ou senha incorretos.' : m.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).' : m });
    } finally { setCarregando(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3"><img src="./icone.svg" className="h-12 w-12" alt="" /><div><h1 className="text-xl font-bold">Gestor Financeiro</h1><p className="text-sm text-slate-500">Inteligente</p></div></div>
        <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}</h2>
          <Campo rotulo="E-mail"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          {modo !== 'recuperar' && <Campo rotulo="Senha"><Input type="password" required autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>}
          {msg && <Aviso tipo={msg.t}>{msg.m}</Aviso>}
          <Btn className="w-full" carregando={carregando}>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</Btn>
          <div className="flex justify-between text-xs text-teal-700 dark:text-teal-400">
            {modo !== 'entrar' ? <button type="button" onClick={() => setModo('entrar')}>Já tenho conta</button> : <button type="button" onClick={() => setModo('criar')}>Criar conta</button>}
            {modo === 'entrar' && <button type="button" onClick={() => setModo('recuperar')}>Esqueci a senha</button>}
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Seus dados ficam protegidos por usuário (RLS) e não são compartilhados. LGPD.</p>
      </div>
    </div>
  );
}
