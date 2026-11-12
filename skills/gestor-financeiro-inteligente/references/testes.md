# Roteiro de testes (fases 8 e 9)

Rode contra o banco real do projeto, com um usuário de teste, e mostre ao usuário o resultado de cada passo. Este roteiro já foi validado no Postgres 16 com o `assets/schema.sql`. Os números esperados abaixo são os obtidos nesse teste.

## A. Cálculos
`node --test scripts/calculos.test.mjs` → 11 testes passando (juros simples e composto, taxa equivalente, parcelas, imputação no pagamento, faturamento × lucro, crescimento, datas em português, telefone, títulos de evento).

## B. Fluxos no banco (como usuário autenticado)

| # | Ação | Esperado |
|---|---|---|
| 1 | `inicializar_usuario()` duas vezes | 21 categorias, 2 contas, sem duplicar |
| 2 | `upsert_cliente('Valverde','71 99401-4023')` | `criado` |
| 3 | `upsert_cliente('Valverdi','(71) 99401-4023')` | `existente` (pelo telefone) |
| 4 | `buscar_clientes('994014023')` e `buscar_clientes('Valverd')` | encontra Valverde |
| 5 | Compra de 20 TZ a R$ 80, vencimento 20/11 | total 1.600; estoque 20; custo 80; margem 46,67% |
| 6 | Venda de 1 TZ a R$ 150 para o Valverde, vencimento 14/12, chave `msg-001` | total 150; custo 80; lucro 70; estoque 19 |
| 7 | Repetir com a mesma chave | devolve `repetida:true`, sem gravar |
| 8 | Repetir sem chave | `POSSIVEL_DUPLICIDADE`; estoque continua 19 |
| 9 | Fila da agenda | 2 itens (compra e venda), um por obrigação |
| 10 | Pagamento de 150 | obrigação e venda `pago`; a fila continua com 1 item para essa obrigação (upsert → marcar PAGO) |
| 11 | Empréstimo de R$ 1.000 ao João, 10% a.m., 1 período, sem ciência | `AVISO_LEGAL_PENDENTE` (10% contra 1% de referência) |
| 12 | O mesmo com `ciente_aviso_legal:true` | juros 100; total 1.100; `acima_limite_legal` |
| 13 | Pagamento parcial de 500 | juros 100 + principal 400; saldo 600; `parcial` |
| 14 | Lançamentos | saída patrimonial 1.000; entrada operacional 100 (juros); entrada patrimonial 400 |
| 15 | `alterar_vencimento` +45 dias | evento `prorrogacao`; a fila atualiza o mesmo evento |
| 16 | Pagamento de 700 | `VALOR_ACIMA_DO_SALDO` |
| 17 | Pagamento de 600 | empréstimo `quitado`; lucro com juros = 100 |
| 18 | Despesa de energia de R$ 350, paga | escopo pessoal, categoria Energia |
| 19 | Contracheque: 5.200 + 1.300 − 650 − 400 | bruto 6.500; descontos 1.050; líquido 5.450 |
| 20 | Venda de antimicrobiano sem licença | `LICENCA_OBRIGATORIA` |
| 21 | Saldos | Carteira pessoal 5.100,00; Caixa do negócio 250,00 |
| 22 | `v_vendas_mensal` | faturamento 150; lucro 70; margem 46,67; ticket 150; 1 cliente novo |
| 23 | `select` na tabela `integracoes` | `permission denied` (tokens protegidos) |
| 24 | `delete from vendas` | `EXCLUSAO_BLOQUEADA` |
| 25 | Logar como outro usuário | vê 0 clientes, 0 vendas e 0 obrigações (RLS) |

## C. IA (Edge Function `ia-comando`), com o usuário de teste

Envie os 5 comandos do pedido original, na ordem: compra, venda, pagamento, empréstimo e despesa. Para cada um, confira que:
- a resposta tem o bloco de confirmação com os números retornados pelo banco;
- `ia_operacoes.ferramentas` mostra as chamadas esperadas (ver ia-central-de-comando.md);
- reenviar a mesma mensagem (mesmo `mensagem_id`) não duplica nada.

Casos de borda: "Vendi para o João" (vários Joões → pergunta qual); "Emprestei 500 pro Pedro" (falta a taxa → pergunta); "Pedro pagou 100" (pagamento parcial → informa o saldo); "Vendi TZ" sem estoque → pergunta se quer lançar a compra.

## D. Google Agenda (com a conta real do usuário)

Siga a seção 6 de google-agenda.md e anexe ao relatório final os `htmlLink` dos eventos criados e atualizados.

## E. Front-end

- Recarregar a página não perde nada; tudo vem do banco.
- Celular (375 px): menu inferior, chat em tela cheia, tabelas viram cartões.
- `npm run build` sem erros; teste de fumaça com Playwright: login → chat → venda → aparece em Vendas e em Contas.
