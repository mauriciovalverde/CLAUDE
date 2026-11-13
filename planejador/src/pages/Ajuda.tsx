import { Cabecalho, Card } from '../components/ui';

const TOPICOS: [string, string[]][] = [
  ['Caixa: meu dinheiro do dia a dia', ['Informe uma vez quanto tem hoje (lápis em “Meu ano”).', 'Depois o caixa se atualiza sozinho: recebeu (+), pagou uma conta ou a fatura do cartão, inteira ou parte (−), guardou num sonho (−), retirou do sonho (+).', 'Em Contas → aba “💰 Caixa” você vê o extrato com o saldo depois de cada movimento.', 'Se o valor real ficar diferente, ajuste pelo lápis.']],
  ['Como começar', ['Em “Meu ano”, toque no lápis e diga quanto dinheiro você tem hoje.', 'Em Contas, lance o salário e as contas fixas (aluguel, luz, internet…) marcando “Todo mês”.', 'Em Cartão, envie o PDF da fatura.', 'Em Sonhos, crie seus objetivos.', 'Pronto: “Meu ano” mostra mês a mês quanto entra, quanto sai e quanto sobra.']],
  ['Como ler a fatura do cartão', ['Baixe a fatura em PDF no app do seu banco (Nubank, Itaú, Bradesco, Inter, C6…).', 'Em Cartão, toque em “Escolher PDF da fatura”.', 'Confira as compras, o vencimento e o total, e toque em “Importar fatura”.', 'Compras parceladas (ex.: 3/10) já entram nos meses seguintes da projeção.', 'Se o PDF tiver senha, o app pede (geralmente são os primeiros dígitos do CPF).', 'O PDF é lido no seu celular e não é enviado para ninguém.']],
  ['Fatura por foto ou print', ['Em Cartão, toque em “Enviar foto ou print da fatura”.', 'Pode escolher várias imagens (uma por página da fatura).', 'Foto reta, com boa luz, sem cortar os valores. Prints da tela do app do banco funcionam melhor.', 'Confira os valores antes de importar: a leitura de foto pode trocar algum número.']],
  ['Fatura com o meu cartão e o da minha esposa', ['Quando a fatura tem mais de um cartão (titular e adicional), o app separa as compras pelo final do cartão.', 'Marque só o que deve entrar (ex.: só o seu) e dê apelidos como “Eu” e “Esposa”.', 'O app lembra a escolha e os apelidos nas próximas faturas.', 'Parcelas futuras só entram para os cartões marcados.']],
  ['Paguei só uma parte (fatura ou outra conta)', ['Em Contas, toque em “Paguei” e escolha “Paguei uma parte”.', 'Digite quanto pagou: o app registra esse valor como pago e lança o restante como uma nova conta, na data que você escolher (o padrão é o mês seguinte).', 'Se souber, some os juros/encargos ao restante.', 'No cartão, o restante vem na próxima fatura: ao importá-la, o app pergunta e remove o lançamento do restante para não contar duas vezes.']],
  ['Contas que se repetem', ['Ao lançar, escolha “Todo mês” e por quantos meses (ex.: 12).', 'Para remover uma série, toque na lixeira e escolha “Esta e as próximas”.']],
  ['Compras parceladas fora do cartão', ['Lance como “Parcelado”, com o valor TOTAL e o número de parcelas: o app divide e coloca uma em cada mês.']],
  ['Sonhos', ['Crie o sonho com o valor e a data que quer realizar.', 'Toque em “Guardar” sempre que separar dinheiro, dizendo onde guardou (poupança, consórcio, CDB, caixinha…).', 'O app calcula quanto guardar por mês e reserva esse valor na projeção do ano.']],
  ['Saldo negativo na projeção', ['Significa que, se tudo acontecer como lançado, vai faltar dinheiro naquele mês.', 'Você pode adiar um gasto, renegociar uma conta ou diminuir o que guarda para os sonhos naquele período.']],
  ['Instalar no iPhone', ['Abra no Safari: mauriciovalverde.github.io/CLAUDE/planejador', 'Toque em Compartilhar → “Adicionar à Tela de Início”.']],
  ['Troquei de celular', ['No celular antigo: Configurações → Trocar de celular → Salvar / enviar para mim.', 'No novo: abra o app, toque em “Troquei de celular” e cole o código.']],
];

export default function Ajuda() {
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Ajuda" sub="Passo a passo em linguagem simples" />
      {TOPICOS.map(([t, itens]) => <Card key={t}><details><summary className="cursor-pointer font-semibold">{t}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{itens.map((i) => <li key={i}>{i}</li>)}</ul></details></Card>)}
    </div>
  );
}
