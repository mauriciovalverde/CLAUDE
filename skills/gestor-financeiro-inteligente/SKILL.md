---
name: gestor-financeiro-inteligente
description: Constrói e mantém o GESTOR FINANCEIRO INTELIGENTE, um sistema web real (banco persistente, login, Google Agenda via OAuth, PDFs) para finanças pessoais e comerciais, operado por uma IA que entende português. Cobre vendas e compras de medicamentos com estoque, empréstimos a juros, clientes, contas a pagar e a receber, salário da Polícia Militar, dashboards, comparativo mensal e relatórios. Use quando o usuário pedir para criar, instalar, publicar, corrigir ou ampliar esse sistema ou qualquer módulo dele.
---

# GESTOR FINANCEIRO INTELIGENTE

Gerenciador financeiro pessoal e comercial. O diferencial é a **Central de Comando com IA**: o usuário escreve em português ("Venda TZ para Valverde, 71 99401-4023, paga dia 14/12, R$ 150") e a IA cadastra, consulta e atualiza tudo no banco, sincronizando cada vencimento com o Google Agenda.

**Regra de ouro: nada é simulado.** Não diga que uma função está pronta enquanto ela não funcionar de verdade: dados salvos no banco, evento confirmado pela API do Google, PDF gerado. Se faltar uma credencial (chave da Anthropic, OAuth do Google, projeto Supabase), monte o fluxo de conexão e peça autorização ao usuário. Nunca invente valores de chaves.

## Arquivos desta skill (leia antes de cada fase)

| Arquivo | Quando ler |
|---|---|
| `references/arquitetura.md` | Fase 1: stack, pastas, variáveis de ambiente, segurança, LGPD, backup |
| `assets/schema.sql` | Fase 2: banco completo com RLS, auditoria, exclusão segura, idempotência. Aplique como está e só depois adapte |
| `references/modulos-e-telas.md` | Fase 3: campos, telas, filtros e indicadores de cada módulo |
| `references/ia-central-de-comando.md` | Fase 4: prompt de sistema, ferramentas (tool use), fluxos de exemplo, formato da confirmação |
| `references/google-agenda.md` | Fase 5: OAuth 2.0, fila de sincronização, formato dos eventos, lembretes, recuperação de falhas |
| `references/calculos-financeiros.md` | Juros, pagamentos parciais, renegociação, KPIs (faturamento ≠ lucro ≠ recebimento ≠ saldo) |
| `scripts/calculos.mjs` | Implementação de referência dos cálculos, testada. Copie para o projeto em vez de reescrever |
| `references/conformidade-legal.md` | Antes de criar os módulos de empréstimo e de medicamentos: usura, ANVISA, LGPD |
| `references/relatorios-pdf.md` | Fase 7: os 13 relatórios e o layout dos PDFs |
| `references/testes.md` | Fases 8 e 9: roteiro de testes com o resultado esperado no banco e na agenda |
| `references/instalacao-publicacao.md` | Fase 10: o passo a passo que você entrega ao usuário |

## Plano de execução (siga na ordem)

1. **Arquitetura.** Confirme a stack recomendada (React + Vite + TypeScript + Tailwind/shadcn no front; Supabase: Postgres, Auth, Edge Functions, Vault; Claude API na Edge Function; Google Calendar API). Se o ambiente do usuário já tiver outra (por exemplo Lovable Cloud, que é Supabase), adapte sem perder nenhuma regra.
2. **Banco.** Aplique `assets/schema.sql`. Confira que todas as tabelas têm RLS ativo e que um usuário não enxerga dados de outro.
3. **Módulos.** Clientes → Produtos/Estoque → Compras → Vendas → Empréstimos → Contas a pagar e receber → Finanças pessoais → Salário PM. Cada módulo grava pelas mesmas funções de serviço que a IA usa (uma única porta de escrita).
4. **Central de Comando com IA.** Edge Function `ia-comando` com tool use. A IA só escreve no banco por ferramentas; a resposta final é montada a partir do retorno real das ferramentas.
5. **Google Agenda.** OAuth com `access_type=offline`, tokens criptografados no banco, fila `agenda_sync_fila` processada por Edge Function agendada (cron) e também logo após cada operação.
6. **Dashboards** com filtros de mês, trimestre, semestre, ano e período personalizado.
7. **PDFs** (`references/relatorios-pdf.md`).
8. **Testes de fluxo** (`references/testes.md`): venda, compra, empréstimo, pagamento total e parcial, despesa, duplicidade.
9. **Teste real da agenda** com a conta do usuário: criar, alterar vencimento, pagar e ver o evento mudar no Google Agenda.
10. **Entrega:** instruções de instalação e publicação, mais uma lista honesta do que foi testado e do que depende de ação do usuário.

## As 14 regras do sistema (não negociáveis)

1. Toda operação é salva no banco. A IA só confirma depois que o banco retornou sucesso.
2. Nada some ao recarregar a página: o estado vem do banco, nunca só da memória do navegador.
3. Um cliente = um cadastro. Busque por telefone normalizado (só dígitos, com DDD) e depois por nome aproximado (`pg_trgm`). Se houver mais de um candidato, pergunte.
4. Cada venda fica ligada ao cliente e aos produtos (`venda_itens`).
5. Cada empréstimo tem histórico próprio (`emprestimo_eventos` + `pagamentos`).
6. Toda obrigação com vencimento gera um evento no Google Agenda (via `obrigacoes` → `agenda_eventos`).
7. Mudar o vencimento atualiza o mesmo evento (pelo `google_event_id` salvo), sem criar outro.
8. Pagamentos atualizam saldos automaticamente (trigger `aplicar_pagamento`).
9. Pessoal e comercial não se misturam: a coluna `escopo` ('pessoal' | 'comercial') é obrigatória em obrigações e lançamentos, e os relatórios filtram por ela.
10. Faturamento (vendido), recebimento (entrou no caixa), lucro (faturamento − custo) e saldo disponível (caixa) são indicadores diferentes, com fórmulas em `references/calculos-financeiros.md`.
11. Sem duplicidade: chave de idempotência por comando da IA e verificação de operação igual (mesmo cliente, valor e data) nos últimos 10 minutos, com pergunta antes de gravar.
12. Toda ação da IA termina com uma confirmação que mostra o que foi gravado, os IDs e a situação da agenda.
13. Exclusão é sempre lógica (`excluido_em`). A exclusão definitiva exige uma segunda confirmação digitada, e tudo vai para a `auditoria`.
14. Taxas de juros e vendas de medicamentos passam pelas checagens de `references/conformidade-legal.md`. O sistema registra e avisa; não presume que algo é legal.

## Como a IA deve se comportar (resumo; detalhes em `ia-central-de-comando.md`)

- Interpreta datas em relação a hoje, no fuso `America/Bahia`: "dia 14 de dezembro" é o próximo 14/12 que ainda não passou; "em 30 dias" é hoje + 30.
- Pergunta **só** o que falta para gravar. Exemplo: um empréstimo sem modalidade de juros vira a pergunta "Juros simples ou composto? Os 10% são ao mês ou no período todo?". Nunca chuta.
- Nunca inventa telefone, CPF, preço ou custo. Se o produto não tem custo cadastrado, grava a venda e avisa que o lucro fica pendente até o custo ser informado.
- Formato da confirmação:

```
✅ Venda registrada (#V-000123)
Cliente: Valverde (novo cadastro, tel. (71) 99401-4023)
Produto: TZ × 1, R$ 150,00
A receber: R$ 150,00, vencimento 14/12/2026 (#OB-000231)
Google Agenda: ✅ evento criado "COBRAR VALVERDE - R$ 150 - VENDA TZ"
   (ou ⏳ pendente: Google desconectado, vai sincronizar ao reconectar)
```

## Verificação antes de dizer que terminou

- Rode `node scripts/calculos.test.mjs` (os cálculos precisam passar).
- Rode o roteiro de `references/testes.md` contra o banco real e mostre as linhas gravadas.
- Mostre o evento criado no Google Agenda (ID e link `htmlLink` retornados pela API).
- Liste com franqueza: ✅ testado e funcionando / ⏳ depende do usuário (credenciais, domínio) / ❌ não feito.
