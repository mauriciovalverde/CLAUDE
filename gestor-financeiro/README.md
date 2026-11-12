# Gestor Financeiro Inteligente

Sistema web de finanças pessoais e comerciais operado por IA em português: vendas, compras, estoque (com lotes e validade),
empréstimos (juros simples/compostos, parciais, prorrogação, renegociação), clientes, contas a pagar/receber,
finanças pessoais, salário da PM, dashboard, comparativo mensal e relatórios em PDF. Vencimentos sincronizados com o Google Agenda.

- **Publicado em:** https://mauriciovalverde.github.io/CLAUDE/gestor/ (após o merge na `main`)
- **Banco:** Supabase (projeto `llflvyfzhnuuvhvllvtb`), schema em `../skills/gestor-financeiro-inteligente/assets/schema.sql`
- **Funções do servidor:** `supabase/functions/` (ia-comando, google-oauth, agenda-sync)

## Rodar localmente
```bash
npm install
npm run dev
```

## Segredos necessários (Supabase → Edge Functions → Secrets)
| Nome | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | Central de Comando com IA (console.anthropic.com) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Conexão OAuth com o Google Agenda |
| `APP_URL` (opcional) | URL do app, padrão `https://mauriciovalverde.github.io/CLAUDE/gestor/` |

Os tokens do Google são cifrados (AES-256-GCM) com chave derivada da service role, que só existe no servidor.
