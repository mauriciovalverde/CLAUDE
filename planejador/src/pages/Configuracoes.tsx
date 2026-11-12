import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { codigoTransferencia } from '../lib/acesso';
import { salvarTexto, salvarArquivo } from '../lib/nativo';
import { Btn, Cabecalho, Card, Input, toast } from '../components/ui';

export default function Configuracoes() {
  const [ver, setVer] = useState(false);
  const [chave, setChave] = useState('');
  const [testando, setTestando] = useState(false);
  const cod = codigoTransferencia();

  async function salvarChave() {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'salvar_chave', provedor: 'ollama_cloud', chave });
    setTestando(false);
    if (!r.ok) { toast(r.mensagem, 'erro'); return; }
    await supabase.from('plan_config').update({ ia_modelo: r.modelo }).eq('user_id', (await supabase.auth.getUser()).data.user!.id);
    setChave(''); toast(`IA funcionando ✅ (modelo ${r.modelo})`);
  }
  async function exportar() {
    const out: any = { exportado_em: new Date().toISOString() };
    for (const t of ['plan_config', 'plan_contas', 'plan_faturas', 'plan_fatura_itens', 'plan_sonhos', 'plan_sonho_movs']) out[t] = (await supabase.from(t).select('*')).data ?? [];
    await salvarArquivo(`planejador-backup-${new Date().toISOString().slice(0, 10)}.json`, btoa(unescape(encodeURIComponent(JSON.stringify(out, null, 1)))), 'application/json');
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Configurações" />
      {cod && <Card titulo="📱 Trocar de celular / guardar meus dados">
        <p className="text-sm text-slate-600 dark:text-slate-300">Para abrir seus dados em outro celular (ou se reinstalar o app), use este código. <b>Guarde-o</b> (mande para você no WhatsApp ou salve no Drive) e não compartilhe com ninguém.</p>
        {ver && <div className="mt-2 break-all rounded-xl bg-slate-100 p-3 font-mono text-xs dark:bg-slate-800">{cod}</div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variante="secundario" onClick={() => setVer(!ver)}>{ver ? 'Esconder' : 'Mostrar código'}</Btn>
          <Btn variante="secundario" onClick={() => { navigator.clipboard?.writeText(cod); toast('Código copiado.', 'info'); }}>Copiar</Btn>
          <Btn onClick={() => salvarTexto('codigo-planejador.txt', `Planejador Financeiro - código para abrir seus dados em outro celular.\nNo app novo, toque em "Troquei de celular" e cole:\n\n${cod}\n`)}>Salvar / enviar para mim</Btn>
        </div>
      </Card>}
      <Card titulo="IA para faturas difíceis (opcional)">
        <p className="text-sm text-slate-600 dark:text-slate-300">O app lê a maioria das faturas sozinho. Para modelos de fatura que ele não reconhece, dá para usar a IA gratuita do Ollama:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Crie uma conta grátis em <a className="inline-flex items-center gap-1 font-medium text-teal-700 underline" href="https://ollama.com/signup" target="_blank" rel="noreferrer">ollama.com <ExternalLink className="h-3 w-3" /></a></li>
          <li>Abra <a className="inline-flex items-center gap-1 font-medium text-teal-700 underline" href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Settings → Keys <ExternalLink className="h-3 w-3" /></a>, toque em <b>Add API Key</b> e copie.</li>
          <li>Cole aqui:</li>
        </ol>
        <div className="mt-2 flex gap-2"><Input type="password" placeholder="cole a chave aqui" value={chave} onChange={(e) => setChave(e.target.value)} /><Btn onClick={salvarChave} carregando={testando} disabled={!chave.trim()}>Salvar e testar</Btn></div>
      </Card>
      <Card titulo="Backup"><Btn variante="secundario" onClick={exportar}>Baixar uma cópia dos meus dados</Btn></Card>
    </div>
  );
}
