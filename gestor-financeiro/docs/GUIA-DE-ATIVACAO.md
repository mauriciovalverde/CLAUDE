# Gestor Financeiro: guia de ativação

- **Site:** https://mauriciovalverde.github.io/CLAUDE/gestor/
- **Android:** arquivo `GestorFinanceiro-1.0.2.apk` (compartilhe pelo WhatsApp, Drive etc.)

## ✅ Já está pronto e funcionando para qualquer pessoa, sem você fazer nada

- **Criar conta:** na hora, sem e-mail de confirmação. A pessoa recebe um **código de recuperação** para trocar a senha se esquecer.
- **Segurança do banco:** os ajustes já foram aplicados.
- **Cobrar clientes:** botão **💬 WhatsApp**, que abre a conversa com a mensagem pronta, e **✉️ E-mail**, que abre o app de e-mail do celular.
- **Lembrete na agenda:** botão **📅 Agenda**, que abre o Google Agenda com o vencimento preenchido; a pessoa só toca em Salvar.
- **IA grátis (Ollama):** cada pessoa cola a própria chave gratuita, guiada passo a passo pelo app em 2 minutos.
- **PDFs e backup:** no celular, abrem a tela de compartilhar (WhatsApp, Drive, e-mail).

## ⭐ Opcional (só se quiser automação total): Google Agenda e Gmail automáticos

Sem isto, tudo funciona pelos botões acima. Com isto, os lembretes entram sozinhos na agenda e as cobranças saem pelo Gmail com um clique. **É feito uma única vez, por você, e vale para todos os usuários.**

1. Entre em https://console.cloud.google.com/ → **Novo projeto** "Gestor Financeiro".
2. Ative a API da Agenda (https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) e a do Gmail (https://console.cloud.google.com/apis/library/gmail.googleapis.com).
3. Em https://console.cloud.google.com/auth/overview → **Começar**: nome "Gestor Financeiro", público **Externo**.
4. Em **Acesso a dados**, adicione os escopos `calendar.events` e `gmail.send`.
5. Em **Clientes** → **Criar cliente** → **Aplicativo da Web** → URI de redirecionamento: `https://llflvyfzhnuuvhvllvtb.supabase.co/functions/v1/google-oauth/callback`.
6. Em https://supabase.com/dashboard/project/llflvyfzhnuuvhvllvtb/functions/secrets, salve `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
7. Para liberar a todos, envie o app para verificação em **Central de verificação** do Google. Leva de semanas a meses. Até lá, só os e-mails cadastrados em **Público → Usuários de teste** (até 100) conseguem conectar.

## ⭐ Opcional: Claude (IA paga, mais precisa)

Salve `ANTHROPIC_API_KEY` (criada em https://console.anthropic.com/settings/keys) no mesmo lugar dos secrets. O custo é de centavos por mensagem e é cobrado de você.

## Atualizar o app no futuro

Gere um novo APK com a **mesma chave** (`gestor-financeiro.jks` e a senha que você guardou) e um número de versão maior. Quem já tem o app instala por cima, sem perder nada.
