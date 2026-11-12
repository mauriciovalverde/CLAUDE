# Gestor Financeiro: guia de ativação (para o dono do app)

O app já está pronto e publicado:
- **Site:** https://mauriciovalverde.github.io/CLAUDE/gestor/
- **Android:** arquivo `GestorFinanceiro-1.0.1.apk`

Faltam alguns passos que **só você** pode fazer, porque envolvem a sua conta no Supabase e no Google. Faça uma vez só; depois todos os usuários apenas clicam.

---

## Passo 1: Segurança do banco (2 minutos) · obrigatório

1. Abra: https://supabase.com/dashboard/project/llflvyfzhnuuvhvllvtb/sql/new
2. Abra o arquivo `seguranca.sql` (vai junto com este guia), copie **todo** o conteúdo e cole na caixa.
3. Clique em **Run**. Deve aparecer "Success". Se rodar duas vezes por engano, não tem problema.

## Passo 2: Endereço do app nos e-mails de confirmação (1 minuto) · recomendado

1. Abra: https://supabase.com/dashboard/project/llflvyfzhnuuvhvllvtb/auth/url-configuration
2. Em **Site URL**, coloque: `https://mauriciovalverde.github.io/CLAUDE/gestor/` e salve.
3. Em **Redirect URLs**, clique em **Add URL**, cole o mesmo endereço e salve.

> Sem isso o app funciona do mesmo jeito. Só a página que abre depois de confirmar o e-mail dá erro; a conta fica confirmada.

## Passo 3: Google Agenda + Gmail (10 a 15 minutos) · para lembretes e cobranças por e-mail

1. Abra https://console.cloud.google.com/ e entre com sua conta Google.
2. No topo, clique no seletor de projetos → **Novo projeto** → nome "Gestor Financeiro" → **Criar**. Confira que ele ficou selecionado.
3. Ative as duas APIs, clicando em **Ativar** em cada link:
   - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com
4. Abra a tela de consentimento: https://console.cloud.google.com/auth/overview → **Começar**
   - Nome do app: **Gestor Financeiro** · e-mail de suporte: o seu → Próximo
   - Público: **Externo** → Próximo · e-mail de contato: o seu → **Criar**
5. Em **Público**, na seção **Usuários de teste**, clique em **Adicionar usuários** e coloque o seu e-mail e o de cada pessoa que vai usar o app (até 100).
6. Em **Acesso a dados** → **Adicionar ou remover escopos**, marque `.../auth/calendar.events` e `.../auth/gmail.send` → **Atualizar** → **Salvar**.
7. Em **Clientes** → **Criar cliente**:
   - Tipo: **Aplicativo da Web** · Nome: Gestor
   - **URIs de redirecionamento autorizados** → Adicionar: `https://llflvyfzhnuuvhvllvtb.supabase.co/functions/v1/google-oauth/callback`
   - **Criar**. Aparecem o **ID do cliente** e a **Chave secreta do cliente**; deixe essa janela aberta.
8. Abra https://supabase.com/dashboard/project/llflvyfzhnuuvhvllvtb/functions/secrets e adicione dois secrets:
   - Nome `GOOGLE_CLIENT_ID`, com o valor do ID do cliente
   - Nome `GOOGLE_CLIENT_SECRET`, com o valor da chave secreta
   - **Save**.
9. Pronto. No app: **Configurações → Conectar Google (Agenda + Gmail)**.

> Enquanto o Google não "verificar" o app, aparece o aviso "O Google não verificou este app". Clique em **Avançado → Acessar Gestor Financeiro (não seguro)**. Isso é normal para apps próprios. Para vender a muitas pessoas, peça a verificação em "Central de verificação"; leva de semanas a meses.

## Passo 4 (opcional): Claude, a IA premium

1. Crie uma chave em https://console.anthropic.com/settings/keys. É paga por uso: centavos por mensagem.
2. Em https://supabase.com/dashboard/project/llflvyfzhnuuvhvllvtb/functions/secrets, adicione `ANTHROPIC_API_KEY` com a chave.
3. No app, os usuários podem escolher **Claude** em Configurações → Inteligência artificial.

> Sem isso, todos usam o **Ollama**, que é grátis. Cada usuário faz o passo a passo dentro do app, em 2 minutos.

---

## Para cada usuário (o que ele faz sozinho)

1. **Instalar:** abre o arquivo `.apk` no celular → permite instalar desta fonte → **Instalar**. Ou usa o site no navegador.
2. **Criar conta:** e-mail e senha → confirma pelo e-mail recebido → entra.
3. **Assistente:** nome do negócio → dinheiro de hoje → IA (Ollama na nuvem: criar conta grátis em ollama.com, copiar a chave e colar) → conectar Google → pronto.
4. **Usar:** é só escrever no chat, por exemplo "vendi 2 camisetas para Maria, 71 99999-0000, 50 cada, paga dia 20".

## Atualizar o app no futuro

Gere um novo APK com a **mesma chave** (`gestor-financeiro.jks`, guardada por você) e um número de versão maior. Quem já tem o app instala por cima, sem perder nada; os dados ficam no servidor.
