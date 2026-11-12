# Central de Comando com IA

A tela principal é um chat. Também há um botão flutuante, presente em todas as telas, que abre o mesmo chat em um painel lateral (no celular, em tela cheia).

## Como funciona

```
Navegador ──(JWT do usuário)──▶ Edge Function ia-comando ──▶ Claude API (tool use)
                                      │  ◀── tool_use: registrar_venda {...}
                                      ├──▶ supabase.rpc('registrar_venda', p)   ← com o JWT do usuário: o RLS vale
                                      │  ──▶ tool_result: {ok:true, venda_id...} ou {erro:'ESTOQUE_INSUFICIENTE...'}
                                      ├──▶ dispara agenda-sync para as obrigações criadas e espera até 8 s pelo resultado
                                      └──▶ resposta final + grava chat_mensagens e ia_operacoes
```

- A Edge Function cria o cliente Supabase **com o token do usuário** (`Authorization` repassado), nunca com a service_role. Assim a IA só enxerga e grava os dados do próprio usuário.
- Cada mensagem recebe uma `chave_idempotencia` = `ia:<conversa_id>:<id da mensagem>:<índice da ferramenta>`. Se a rede cair e o usuário reenviar, nada é gravado em dobro.
- Loop de ferramentas: no máximo 8 voltas por mensagem. Se o limite estourar, responda dizendo o que foi e o que não foi gravado.
- Histórico: envie as últimas 20 mensagens da conversa e um bloco "Contexto de hoje" (data, fuso, se o Google está conectado, contas e categorias existentes).

## Prompt de sistema (use como está e preencha as variáveis)

```text
Você é o assistente do GESTOR FINANCEIRO INTELIGENTE de {{nome_usuario}}. Hoje é {{hoje_extenso}} ({{hoje_iso}}), fuso {{fuso}}.
Você registra e consulta movimentações financeiras SOMENTE por meio das ferramentas. Fale português do Brasil, de forma curta e objetiva.

REGRAS
1. Nunca diga que algo foi salvo sem uma ferramenta ter retornado ok:true. Se uma ferramenta retornar erro, explique em linguagem simples e diga o que falta.
2. Nunca invente dados (telefone, CPF, preço, custo, data, taxa). Se faltar algo OBRIGATÓRIO, pergunte só isso, numa única pergunta.
   Obrigatórios: venda = cliente, produto, valor (ou quantidade e preço), vencimento ou "pago agora".
   Empréstimo = cliente, valor, taxa, se a taxa é ao mês/dia/ano ou no período todo, prazo ou vencimento, juros simples ou composto (quando houver mais de um período).
   Compra = produto, quantidade, custo unitário ou total, vencimento ou "pago agora". Despesa = descrição, valor, se já foi paga ou o vencimento.
3. Clientes: SEMPRE chame buscar_cliente antes de criar. Se vier telefone, ele manda. Se houver candidatos ambíguos, pergunte qual é.
   Crie um cliente novo só quando a busca não encontrar ninguém e diga na confirmação que é um "novo cadastro".
4. Produtos: chame buscar_produto. Se não existir, crie com cadastrar_produto (só com os dados ditos) e avise que faltam custo/validade, quando for o caso.
   Se o nome sugerir medicamento (princípio ativo, mg, ampola, caneta...), pergunte a classe regulatória e o registro ANVISA antes de cadastrar.
5. Datas: interprete em relação a hoje. "dia 20" = o próximo dia 20 que ainda não passou; "14 de dezembro" = o próximo 14/12; "em 30 dias" = hoje + 30.
   Se a data for vaga ("quando puder", "fim do mês que vem?"), pergunte.
6. Pessoal x comercial: venda, compra, empréstimo e estoque são COMERCIAIS. "Minha casa", contas da família, salário PM são PESSOAIS. Na dúvida, pergunte.
7. Faturamento, recebimento, lucro e saldo são coisas diferentes. Use exatamente o que as ferramentas de consulta retornarem.
8. Juros: se a ferramenta retornar AVISO_LEGAL_PENDENTE, mostre o aviso (taxa equivalente x referência legal) e pergunte se o usuário quer registrar
   mesmo assim, ciente. Só então chame de novo com ciente_aviso_legal=true. Nunca afirme que a taxa é legal.
9. Medicamentos: se a ferramenta bloquear (LICENCA_OBRIGATORIA, RECEITA_OBRIGATORIA, CONTROLADO_BLOQUEADO, REGISTRO_ANVISA_AUSENTE),
   explique o motivo e o que precisa ser cadastrado. Não ofereça meios de contornar.
10. POSSIVEL_DUPLICIDADE: mostre a operação parecida que já existe e pergunte se é outra. Só repita com confirmar_duplicada=true se o usuário confirmar.
11. Pagamento recebido: localize a obrigação com listar_contas (cliente + valor + descrição). Se houver mais de uma em aberto que sirva, pergunte qual.
    Se o valor for menor que o saldo, é pagamento PARCIAL: registre e informe o saldo restante e o próximo vencimento.
12. Toda resposta que gravou algo termina com o bloco de confirmação (modelo abaixo), mostrando os números (#V-, #E-, #OB-) retornados.
    A linha "Google Agenda" usa SOMENTE o status retornado por status_agenda: ✅ sincronizado, ⏳ pendente (com o motivo) ou ❌ erro.

MODELO DE CONFIRMAÇÃO
✅ <Operação> registrada (#<número>)
Cliente/Fornecedor: <nome> (<novo cadastro | cadastro existente>, tel. <telefone, se houver>)
<linhas com produto, quantidade, valores, juros, lucro, conforme o caso>
<A receber | A pagar>: R$ <valor>, vencimento <dd/mm/aaaa> (#OB-<número>)
Google Agenda: <status>
```

## Ferramentas (definições para a Claude API)

Cada ferramenta corresponde a uma RPC do schema ou a uma consulta. Todas recebem e devolvem JSON. Abaixo, `input_schema` resumido (escreva o JSON Schema completo no código).

| Ferramenta | Faz | Entrada principal |
|---|---|---|
| `buscar_cliente` | `rpc('buscar_clientes', {p_texto})` | `texto` (nome ou telefone) |
| `cadastrar_ou_atualizar_cliente` | `rpc('upsert_cliente')`; se vier CPF ou endereço, a Edge Function cifra antes de gravar | `nome`, `telefone?`, `cpf?`, `endereco?`, `observacoes?` |
| `buscar_produto` | `select` em `produtos` por `nome_busca % texto` ou código | `texto` |
| `cadastrar_produto` | `insert` em `produtos` | `nome`, `preco_venda?`, `preco_compra?`, `unidade?`, `classe_regulatoria?`, `registro_anvisa?`, `principio_ativo?`, `apresentacao?`, `estoque_minimo?` |
| `registrar_venda` | `rpc('registrar_venda', {p})` | `cliente_id`, `itens[{produto_id, quantidade, preco_unitario, desconto?}]`, `vencimento?`, `pago_na_hora?`, `forma_pagamento?`, `desconto?`, `receita_medica_id?`, `confirmar_duplicada?` |
| `registrar_compra` | `rpc('registrar_compra', {p})` | `fornecedor_nome?` ou `fornecedor_id?`, `itens[{produto_id, quantidade, custo_unitario, lote?, validade?}]`, `vencimento?`, `parcelas?`, `pago_na_hora?` |
| `registrar_emprestimo` | `rpc('registrar_emprestimo', {p})` | `cliente_id`, `principal`, `taxa_pct`, `periodicidade`, `modalidade`, `periodos`, `parcelas?`, `vencimento`, `ciente_aviso_legal?` |
| `registrar_pagamento` | `rpc('registrar_pagamento')` | `obrigacao_id`, `valor`, `data?`, `forma?` |
| `registrar_conta` | `rpc('registrar_conta')`: despesa (`tipo:'pagar'`) ou receita avulsa (`'receber'`) | `descricao`, `valor`, `escopo`, `categoria_slug`, `pago?`, `vencimento?`, `parcelas?` |
| `criar_recorrencia` | `insert` em `recorrencias` | `descricao`, `tipo`, `escopo`, `categoria_slug`, `valor`, `dia_vencimento` |
| `alterar_vencimento` | `rpc('alterar_vencimento')` | `obrigacao_id`, `nova_data`, `motivo?` |
| `renegociar_emprestimo` | `rpc('renegociar_emprestimo')` | `emprestimo_id`, novas condições |
| `estornar_pagamento` | `rpc('estornar_pagamento')`: só depois de o usuário confirmar | `pagamento_id`, `motivo` |
| `registrar_contracheque` | `rpc('registrar_contracheque')` | `competencia`, `data_pagamento`, `itens[]` |
| `registrar_receita_medica` | `insert` em `receitas_medicas` | `cliente_id`, `prescritor`, `registro_prescritor`, `data_emissao`, `tipo`, `retida` |
| `listar_contas` | `select` em `v_obrigacoes` com filtros | `tipo?`, `cliente_id?`, `situacao?`, `de?`, `ate?`, `texto?` |
| `consultar_cliente` | `v_clientes_resumo` + últimas vendas, empréstimos e pagamentos | `cliente_id` |
| `consultar_emprestimos` | `emprestimos` + `emprestimo_eventos` | `cliente_id?`, `status?` |
| `consultar_estoque` | `produtos` + `v_estoque_alertas` | `texto?` |
| `resumo_financeiro` | KPIs do período (ver calculos-financeiros.md) | `de`, `ate`, `escopo?` |
| `status_agenda` | lê `agenda_eventos` das obrigações informadas, depois de a função ter disparado `agenda-sync` | `obrigacao_ids[]` |

Descrições das ferramentas: escreva em português, dizendo **quando usar** e **o que nunca fazer**. Exemplo para `registrar_venda`: "Grava uma venda já confirmada pelo usuário. Antes, obtenha cliente_id com buscar_cliente/cadastrar_ou_atualizar_cliente e produto_id com buscar_produto. Não use para empréstimos."

## Os 5 exemplos do usuário: sequência esperada

**1. "Venda TZ para Valverde, telefone 71 99401-4023, pagamento será dia 14 de dezembro, valor 150 reais."**
`buscar_cliente("71 99401-4023")` → vazio → `cadastrar_ou_atualizar_cliente({nome:"Valverde", telefone:"71 99401-4023"})` → `buscar_produto("TZ")` → (se não existir: `cadastrar_produto({nome:"TZ", preco_venda:150})`) → `registrar_venda({cliente_id, itens:[{produto_id, quantidade:1, preco_unitario:150}], vencimento:"2026-12-14"})` → `status_agenda([obrigacao_id])` → confirmação com "COBRAR VALVERDE - R$ 150 - VENDA TZ".
Se o TZ não tiver estoque, a RPC devolve `ESTOQUE_INSUFICIENTE`: pergunte se quer lançar a compra antes ou ajustar o estoque.

**2. "Emprestei 1.000 reais para João, juros de 10%, pagamento em 30 dias."**
Faltam a modalidade e a base da taxa. Como é um único período de 30 dias, simples e composto dão o mesmo valor; pergunte só "Os 10% são ao mês ou no período todo?" quando isso mudar o resultado (aqui não muda: os dois dão R$ 1.100). → `buscar_cliente("João")` (se houver vários Joões, pergunte) → `registrar_emprestimo({principal:1000, taxa_pct:10, periodicidade:"mensal", modalidade:"simples", periodos:1, vencimento: hoje+30})` → `AVISO_LEGAL_PENDENTE` → mostre o aviso → com o "sim" do usuário, repita com `ciente_aviso_legal:true` → confirmação: principal R$ 1.000, juros R$ 100, total R$ 1.100, vencimento, "RECEBER JOÃO - R$ 1.100 - EMPRÉSTIMO".

**3. "Valverde pagou os 150 reais da venda TZ."**
`buscar_cliente("Valverde")` → `listar_contas({cliente_id, tipo:"receber", situacao:["pendente","parcial","atrasado"], texto:"TZ"})` → uma obrigação de R$ 150 → `registrar_pagamento({obrigacao_id, valor:150})` → `status_agenda` → "Recebimento registrado. Venda #V-… quitada. Evento marcado como PAGO na agenda."

**4. "Comprei 20 unidades de TZ por 80 reais cada, pagamento para dia 20."**
`buscar_produto("TZ")` → `registrar_compra({itens:[{produto_id, quantidade:20, custo_unitario:80}], vencimento:"2026-11-20"})` → confirmação: estoque passou de X para X+20, custo unitário R$ 80, total R$ 1.600, a pagar em 20/11, "PAGAR FORNECEDOR - R$ 1.600". O fornecedor não foi dito: grave sem fornecedor e pergunte depois, de forma opcional ("Quer informar o fornecedor?"). Para medicamento, pergunte o lote e a validade (são obrigatórios para a rastreabilidade).

**5. "Paguei 350 reais de energia da minha casa."**
`registrar_conta({tipo:"pagar", descricao:"Energia - casa", valor:350, escopo:"pessoal", categoria_slug:"energia", pago:true})` → confirmação: despesa pessoal, categoria Energia, paga hoje, saldo pessoal atualizado. Não há evento na agenda porque não ficou nada pendente.

## Esqueleto da Edge Function `ia-comando` (Deno)

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { TOOLS, executarFerramenta } from './ferramentas.ts';   // definições + switch que chama as RPCs
import { montarSystemPrompt } from './prompt.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ ok: false, erro: 'nao_autenticado' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },              // RLS do próprio usuário
  });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ ok: false, erro: 'sessao_invalida' }, 401);

  const { conversa_id, mensagem_id, texto } = await req.json();
  const { data: op } = await db.from('ia_operacoes').insert({ conversa_id, mensagem: texto }).select().single();
  await db.from('chat_mensagens').insert({ conversa_id, papel: 'user', conteudo: { texto } });

  const historico = await carregarHistorico(db, conversa_id, 20);    // [{role, content}]
  const messages = [...historico, { role: 'user', content: texto }];
  const log: unknown[] = [];
  const obrigacoesTocadas = new Set<string>();

  try {
    for (let volta = 0; volta < 8; volta++) {
      const resp = await anthropic.messages.create({
        model: Deno.env.get('IA_MODELO') ?? 'claude-sonnet-5-5',
        max_tokens: 2048,
        system: await montarSystemPrompt(db, user),
        tools: TOOLS,
        messages,
      });
      messages.push({ role: 'assistant', content: resp.content });
      if (resp.stop_reason !== 'tool_use') {
        const resposta = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        await db.from('chat_mensagens').insert({ conversa_id, papel: 'assistant', conteudo: { texto: resposta } });
        await db.from('ia_operacoes').update({ ferramentas: log, resposta, status: 'concluida' }).eq('id', op.id);
        return json({ ok: true, resposta });
      }
      const resultados = [];
      for (const [i, bloco] of resp.content.filter((b) => b.type === 'tool_use').entries()) {
        const chave = `ia:${conversa_id}:${mensagem_id}:${volta}:${i}`;
        const t0 = Date.now();
        const saida = await executarFerramenta(db, bloco.name, bloco.input, chave, obrigacoesTocadas);
        log.push({ nome: bloco.name, entrada: bloco.input, saida, ms: Date.now() - t0 });
        resultados.push({ type: 'tool_result', tool_use_id: bloco.id, content: JSON.stringify(saida), is_error: !saida.ok });
      }
      messages.push({ role: 'user', content: resultados });
    }
    throw new Error('limite_de_voltas');
  } catch (e) {
    await db.from('ia_operacoes').update({ ferramentas: log, status: 'erro', erro: String(e) }).eq('id', op.id);
    return json({ ok: false, erro: 'Não consegui concluir. Nada além do que aparece no histórico foi gravado.', detalhe: String(e) }, 500);
  }
});
```

Em `executarFerramenta`:
- Capture o erro da RPC e devolva `{ ok:false, codigo, mensagem }`, com o `codigo` sendo o prefixo antes de ":" na mensagem (`ESTOQUE_INSUFICIENTE`, `AVISO_LEGAL_PENDENTE`, ...).
- Em `status_agenda`, chame `agenda-sync` com `{ obrigacao_ids }` e espere até 8 s. Depois leia `agenda_eventos`. Se o Google estiver desconectado, devolva `pendente` com o motivo `google_desconectado`.

## Tela do chat

- Bolhas, com a confirmação mostrada como um cartão (ícone, números e links para o registro).
- Os "chips" de status da agenda atualizam sozinhos (Supabase Realtime em `agenda_eventos`).
- Sugestões rápidas: "Quem está me devendo?", "Resumo do mês", "Estoque baixo", "Vencimentos desta semana".
- Entrada por voz (Web Speech API, `pt-BR`) no celular.
- Botão "Desfazer" nas confirmações dos últimos 10 minutos: chama `estornar_pagamento` ou faz o cancelamento lógico, sempre com uma pergunta de confirmação antes.
