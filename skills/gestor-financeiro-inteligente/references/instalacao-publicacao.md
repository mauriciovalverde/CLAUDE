# Instalação, configuração e publicação (entregue isto ao usuário)

## Pré-requisitos
- Node.js 20+, Git e a Supabase CLI (`npm i -g supabase`).
- Contas: Supabase (grátis), Anthropic (chave da API em console.anthropic.com), Google Cloud (grátis) e Vercel ou Netlify (grátis).

## 1. Banco e back-end (Supabase)
```bash
supabase login
supabase link --project-ref <ref-do-projeto>
supabase db push                       # aplica supabase/migrations/0001_schema.sql
# No painel: Database → Extensions → habilite pg_cron e pg_net
# SQL Editor: cole os comandos cron.schedule do final do schema (troque <PROJETO>)
#             e guarde a service_role_key no Vault: select vault.create_secret('<chave>', 'service_role_key');
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  GOOGLE_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/google-oauth/callback \
  APP_URL=https://<seu-app>.vercel.app TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32) TZ_PADRAO=America/Bahia
supabase functions deploy ia-comando
supabase functions deploy google-oauth --no-verify-jwt     # o callback recebe o redirecionamento do Google
supabase functions deploy agenda-sync
supabase functions deploy backup
```
Em Authentication → URL Configuration, coloque a `APP_URL` em Site URL e em Redirect URLs.

## 2. Google Agenda
Siga a seção 1 de `google-agenda.md` (projeto, API, tela de consentimento, credencial web e URI de callback). Depois, no app: Configurações → Agenda → **Conectar Google Agenda** → autorize.

## 3. Front-end
```bash
cp .env.example .env     # VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (Settings → API)
npm install
npm run dev              # http://localhost:5173
```

## 4. Publicação
- **Vercel:** importe o repositório, framework Vite, adicione as duas variáveis `VITE_*` e faça o deploy. Configure o domínio próprio se quiser.
- **PWA:** o `manifest.webmanifest` e o service worker permitem "Adicionar à tela inicial" no celular.
- Atualize `APP_URL` e as URLs do OAuth do Google se o domínio mudar.

## 5. Primeiro uso
1. Crie a conta (e-mail e senha) e ative o 2FA em Configurações.
2. Confira as contas financeiras (Carteira pessoal e Caixa do negócio) e informe os saldos iniciais.
3. Conecte o Google Agenda.
4. Se for vender medicamentos, cadastre AFE, licença sanitária e responsável técnico em Configurações → Licenças.
5. Revise o limite de referência de juros em Configurações → Conformidade.
6. Abra a Central IA e escreva: "Comprei 20 unidades de TZ por 80 reais cada, pagamento para dia 20."

## Custos estimados
Supabase e Vercel: grátis no início. Claude API: centavos por comando (Sonnet). Google Calendar API: grátis.

## Backup
Automático e diário (30 versões no Storage). Manual: Configurações → Backup → Exportar (JSON e CSV). Restauração: Configurações → Backup → Restaurar.
