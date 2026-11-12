import { Cabecalho, Card } from '../components/ui';

const TOPICOS: [string, string[]][] = [
  ['Como registrar uma venda', ['Pelo chat: escreva como falaria. Ex.: “Vendi 2 camisetas para João, 71 98888-7777, 50 reais cada, paga dia 15”.', 'Ou pela tela Vendas → “Nova venda”.', 'O estoque baixa sozinho e a cobrança vai para o Google Agenda.']],
  ['Como registrar que alguém pagou', ['Chat: “João pagou os 100 reais”.', 'Ou em Contas → botão “Receber” na linha. Se pagar só uma parte, digite o valor menor: o resto continua em aberto.']],
  ['Como cadastrar uma compra de mercadoria', ['Chat: “Comprei 20 unidades de X por 10 reais cada, pago dia 5”.', 'Ou em Compras → “Nova compra”. O estoque aumenta sozinho.']],
  ['Como lançar contas da casa', ['Chat: “Paguei 150 de energia” ou “Internet de 100 reais vence todo dia 10” (fica recorrente).', 'Ou em Pessoal → “Nova despesa/receita”.']],
  ['Como mandar cobrança por e-mail', ['Conecte o Google em Configurações (um clique).', 'Cadastre o e-mail do cliente na ficha dele.', 'Em Contas, clique no envelope ✉️ da conta, ou peça no chat: “manda cobrança para a Maria”.', 'A mensagem é educada e sai do seu próprio Gmail.']],
  ['Como enviar um relatório em PDF por e-mail', ['Relatórios → escolha o que quer → “Enviar por e-mail” → digite o e-mail (do contador, por exemplo).']],
  ['A IA não responde', ['Vá em Configurações → Inteligência artificial e clique em “Testar”.', 'Ollama na nuvem: confira se a chave foi salva; no plano grátis há limite diário. Se acabar, espere ou troque de modelo.', 'Ollama no computador: o programa Ollama precisa estar aberto e o app aberto no mesmo computador.', 'Mesmo sem IA, todas as telas funcionam normalmente.']],
  ['A agenda não sincroniza', ['Configurações → Google → “Conectar”. Se já estava conectado há muito tempo, clique em “Desconectar” e conecte de novo.', 'Nada se perde: o que ficou pendente sincroniza sozinho depois de conectar.']],
  ['Meus dados estão seguros?', ['Cada usuário só vê os próprios dados (proteção no banco).', 'Nada é apagado de verdade sem confirmação; pagamentos só podem ser estornados.', 'Em Configurações você pode baixar uma cópia de tudo (backup).']],
  ['Empréstimos e juros', ['O sistema calcula juros simples ou compostos e avisa quando a taxa passa da referência legal para empréstimos entre pessoas (Lei de Usura). Ele registra o que você combinou, mas não garante que a taxa seja permitida.']],
  ['Venda de medicamentos', ['Só é liberada para estabelecimentos com autorização da ANVISA, licença sanitária e farmacêutico responsável, cadastrados em Configurações. Remédios com receita exigem o registro da receita.']],
];

export default function Ajuda() {
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Ajuda" sub="Passo a passo de tudo, em linguagem simples" />
      {TOPICOS.map(([t, itens]) => (
        <Card key={t}><details><summary className="cursor-pointer font-semibold">{t}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{itens.map((i) => <li key={i}>{i}</li>)}</ul></details></Card>
      ))}
      <Card><button className="text-sm font-medium text-teal-700" onClick={async () => { const { supabase } = await import('../lib/supabase'); const { data: { user } } = await supabase.auth.getUser(); await supabase.from('configuracoes').update({ onboarding_concluido: false }).eq('user_id', user!.id); location.reload(); }}>Refazer a configuração inicial</button></Card>
    </div>
  );
}
