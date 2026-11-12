# Arquitetura técnica

## Stack recomendada

| Camada | Tecnologia | Por quê |
|---|---|---|
| Front-end | React 19 + Vite + TypeScript, TanStack Router e Query, Tailwind 4 + shadcn/ui, Recharts, lucide-react, sonner | Responsivo, rápido, com ótimo suporte a PWA (instala no celular) |
| Banco | Supabase Postgres com RLS em todas as tabelas, mais `pg_trgm`, `pgcrypto`, `pg_cron` e `pg_net` | Persistência real, segurança por usuário, busca aproximada de nomes, tarefas agendadas |
| Autenticação | Supabase Auth (e-mail e senha, com 2FA TOTP opcional) | Sessão segura e recuperação de senha |
| Back-end | Supabase Edge Functions (Deno) | Onde ficam os segredos: chave da Anthropic, client secret do Google, chave de criptografia |
| IA | Claude API (Messages, com tool use). Modelo padrão `claude-sonnet-5-5`; para frases difíceis, `claude-opus-5-5` | Bom em português e em chamadas de ferramenta |
| Agenda | Google Calendar API v3 com OAuth 2.0 (fluxo web, servidor) | Integração oficial |
| PDF | `pdfmake` no navegador (tabelas e totais) + gráficos Recharts exportados como SVG ou PNG | Sem servidor extra |
| Hospedagem | Front em Vercel, Netlify, GitHub Pages ou Lovable; back no Supabase | Gratuito ou barato para começar |

Se o usuário já usa o Lovable, o "Lovable Cloud" é Supabase: o mesmo schema e as mesmas Edge Functions servem.

## Estrutura de pastas

```
gestor-financeiro/
├─ src/
│  ├─ routes/            # telas: /, /chat, /clientes, /clientes/$id, /estoque, /compras, /vendas,
│  │                     # /emprestimos, /contas, /pessoal, /salario, /comparativo, /relatorios,
│  │                     # /configuracoes, /entrar
│  ├─ components/        # AppShell (menu lateral + chat flutuante), cards, tabelas, gráficos
│  ├─ lib/
│  │  ├─ supabase.ts     # cliente com chave publicável
│  │  ├─ calculos.ts     # cópia de scripts/calculos.mjs (fonte única dos cálculos)
│  │  ├─ formatos.ts     # BRL, datas pt-BR, telefone, CPF
│  │  └─ pdf/            # um gerador por relatório
├─ supabase/
│  ├─ migrations/0001_schema.sql   # = assets/schema.sql
│  └─ functions/
│     ├─ ia-comando/        # chat + tool use
│     ├─ google-oauth/      # /iniciar e /callback
│     ├─ agenda-sync/       # processa a fila (cron a cada 5 min + chamada imediata)
│     └─ backup/            # exporta JSON criptografado para o Storage (cron diário)
└─ .env.example
```

## Uma única porta de escrita

Toda gravação passa por **funções SQL (RPC) `security invoker`** definidas no schema (`registrar_venda`, `registrar_compra`, `registrar_emprestimo`, `registrar_pagamento`, `registrar_despesa`, `alterar_vencimento`, `upsert_cliente`...). As telas e as ferramentas da IA chamam as mesmas funções. Com isso, as regras (estoque, saldos, agenda, auditoria, duplicidade) valem igual para os dois caminhos.

Cada função roda dentro de uma transação: ou grava tudo (venda + itens + baixa de estoque + obrigação + item na fila da agenda), ou não grava nada.

## Variáveis de ambiente e segredos

Front (`.env`, público por natureza; quem protege os dados é o RLS):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Segredos das Edge Functions (`supabase secrets set ...`; **nunca** no código nem no git):
```
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<projeto>.supabase.co/functions/v1/google-oauth/callback
APP_URL=https://<domínio do app>
TOKEN_ENCRYPTION_KEY=   # 32 bytes em base64, gerado com: openssl rand -base64 32
TZ_PADRAO=America/Bahia
```

## Segurança

- **RLS** em todas as tabelas: `user_id = auth.uid()`. Ninguém lê dados de outro usuário, nem com a chave publicável.
- **Criptografia:** os tokens do Google (refresh e access) são cifrados com AES-256-GCM na Edge Function, com a chave `TOKEN_ENCRYPTION_KEY`; o banco guarda só o texto cifrado e o IV. CPF e endereço ficam cifrados com `pgp_sym_encrypt`, com a chave guardada no Supabase Vault; para buscar, usa-se o hash do CPF.
- **Permissões:** a tabela `membros` tem os papéis `dono`, `operador` (lança, mas não exclui nem exporta) e `leitura`. Isso já prepara o sistema para um contador ou sócio no futuro.
- **Proteção contra exclusão acidental:** exclusão lógica (`excluido_em`), lixeira com restauração em 30 dias e exclusão definitiva só para o `dono`, digitando "EXCLUIR".
- **Histórico de alterações:** o trigger `auditar()` grava antes e depois (JSON) de cada INSERT, UPDATE e DELETE na tabela `auditoria`.
- **Logs de operação:** `ia_operacoes` (cada comando da IA, com as ferramentas chamadas e o resultado) e `agenda_sync_fila` (cada tentativa, com o erro).
- **Tratamento de erros:** toda Edge Function devolve `{ ok, erro, codigo }`; o front mostra um aviso (toast) e nunca diz "salvo" quando houve erro.
- **Backup:** `pg_cron` diário chama a função `backup`, que exporta as tabelas do usuário em JSON cifrado para um bucket privado do Storage e guarda 30 versões. Em Configurações há "Exportar meus dados" (JSON e CSV) e "Restaurar".

## LGPD

- Base legal: execução de contrato e legítimo interesse do titular da conta. Os clientes cadastrados são terceiros: registre só o necessário (nome e telefone; CPF e endereço são opcionais e ficam cifrados).
- Tenha uma tela de Privacidade explicando quais dados são guardados, por quê e por quanto tempo.
- Direitos do titular: exportar e excluir os dados de um cliente (anonimização mantendo os valores contábeis).
- Nada de dados pessoais em logs de erro ou em serviços de terceiros, exceto o necessário: Anthropic para interpretar a mensagem e Google para o evento. Avise o usuário disso na tela de Configurações.

## Preparado para expansão

- A tabela `contas_financeiras` (carteira, banco, cartão) existe desde o início; todo lançamento aponta para uma conta. Integrações bancárias (Open Finance, extrato OFX) entram depois, gravando em `lancamentos` com `origem='importacao'`.
- `integracoes` é genérica (provedor, tokens cifrados, status). O Google é o primeiro provedor; WhatsApp ou um banco podem entrar depois.
