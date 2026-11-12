# Integração com o Google Agenda (obrigatória)

**Regra:** toda obrigação com vencimento (`obrigacoes` com status `pendente` ou `parcial`) tem um evento no Google Agenda. O banco garante isso com o trigger `obrigacoes_agenda`, que coloca a obrigação na fila; a Edge Function `agenda-sync` cria, atualiza ou cancela o evento. A sincronização só conta como feita quando a API do Google responde 200 e o `google_event_id` é salvo.

## 1. Configuração no Google Cloud (o dono do app faz uma vez)

1. Acesse console.cloud.google.com, crie o projeto "Gestor Financeiro" e ative a **Google Calendar API**.
2. Em "Tela de consentimento OAuth", escolha o tipo **Externo**, informe o nome do app e o e-mail de suporte, e adicione o escopo `https://www.googleapis.com/auth/calendar.events`. Inclua a conta Google do usuário em "Usuários de teste" (enquanto o app não for verificado pelo Google).
3. Em "Credenciais", crie um **ID do cliente OAuth** do tipo "Aplicativo da Web":
   - Origem JavaScript: a URL do app (`APP_URL`).
   - URI de redirecionamento: `https://<projeto>.supabase.co/functions/v1/google-oauth/callback`.
4. Grave os segredos no Supabase: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=... TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)`.

> Em modo "Teste", o Google expira o refresh token em 7 dias. Para uso contínuo, publique o app na tela de consentimento. Para uso pessoal, com menos de 100 usuários, não é preciso passar pela verificação completa, apenas aceitar o aviso de "app não verificado".

## 2. Fluxo OAuth 2.0 (Edge Function `google-oauth`)

**`POST /google-oauth/iniciar`** (com o JWT do usuário):
1. Gera um `state` aleatório de 32 bytes e grava em `integracoes.oauth_state`, válido por 10 min (a tabela é acessada via service_role).
2. Devolve a URL `https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=…&response_type=code&scope=https://www.googleapis.com/auth/calendar.events%20openid%20email&access_type=offline&prompt=consent&include_granted_scopes=true&state=…`.
3. O front abre essa URL e o usuário autoriza.

**`GET /google-oauth/callback?code&state`**:
1. Procura a integração pelo `state`, confere a validade e apaga o `state` (anti-CSRF).
2. `POST https://oauth2.googleapis.com/token` com `grant_type=authorization_code`.
3. Cifra `access_token` e `refresh_token` com AES-256-GCM (`crypto.subtle`, IV aleatório de 12 bytes, formato `base64(iv).base64(cifra)`).
4. Salva `status='conectado'`, `conta_email` (do id_token), `expira_em` e `escopos`.
5. **Reprocessa a fila:** `update agenda_sync_fila set proxima_tentativa = now(), tentativas = 0 where user_id = … and processado_em is null`, e chama `agenda-sync`.
6. Redireciona para `APP_URL/configuracoes?google=conectado`.

**Renovação:** antes de cada chamada, se `expira_em < now() + 60s`, faça `grant_type=refresh_token`. Se a resposta for `invalid_grant`, marque `status='revogado'`, mantenha os itens na fila e mostre no app o aviso "Reconectar Google Agenda".

**Desconectar:** `POST https://oauth2.googleapis.com/revoke?token=…`, apague os tokens e marque `desconectado`. A fila continua guardando as alterações.

## 3. Processador da fila (Edge Function `agenda-sync`)

Chamado pelo `pg_cron` a cada 5 minutos, logo após cada operação (pela `ia-comando` e pelas telas) e após a reconexão. Usa a service_role; com `{obrigacao_ids}`, processa só essas.

```
para cada item da fila com processado_em is null e proxima_tentativa <= now()  (lote de 50, "for update skip locked"):
  integ = integracoes do user;  se status != 'conectado' → ultimo_erro='google_desconectado', reagenda em 1h, continue
  o = v_obrigacoes(item.obrigacao_id);  ev = agenda_eventos(item.obrigacao_id)
  decidir:
    item.acao='cancelar' ou o excluída/cancelada/renegociada  → DELETE do evento (se existir); ev.status='cancelado'
    o.saldo = 0 (pago):
        sem google_event_id → ev.status='cancelado' (não houve pendência; nada a criar)
        config.agenda_ao_pagar='excluir'     → DELETE; ev.status='cancelado'
        config.agenda_ao_pagar='marcar_pago' → PATCH título "✅ PAGO - <título>", colorId "2" (verde), remove lembretes
    pendente/parcial:
        corpo = montarEvento(o)                       (abaixo)
        hash = sha256(JSON(corpo));  se hash == ev.hash_conteudo e ev.status='sincronizado' → nada a fazer
        se ev.google_event_id → PATCH events/{id}
            404/410 (apagado à mão no Google) → cria de novo (passo abaixo)
        senão → antes de criar, procure um evento órfão:
            GET events?privateExtendedProperty=gfi_obrigacao_id=<o.id>   (evita duplicar se uma resposta anterior se perdeu)
            achou → PATCH nele; não achou → POST events
  sucesso (2xx) → salva google_event_id, html_link, hash, status='sincronizado', ultima_sync=now(); item.processado_em=now()
  erro → tentativas+1; proxima_tentativa = now() + min(2^tentativas, 360) min; ultimo_erro = mensagem; ev.status='erro'
         401 → renova o token e tenta 1 vez;  429/5xx → backoff;  depois de 10 tentativas, alerta no app
```

**Por que não há duplicidade:** (1) o índice único `agenda_fila_unica` permite um só item pendente por obrigação; (2) `agenda_eventos.obrigacao_id` é único; (3) cada evento leva `extendedProperties.private.gfi_obrigacao_id`, então mesmo que o banco perca o ID, o evento é reencontrado em vez de recriado.

## 4. Formato do evento

```json
{
  "summary": "COBRAR VALVERDE - R$ 150 - VENDA TZ",
  "description": "Cliente: Valverde\nTelefone: (71) 99401-4023\nValor em aberto: R$ 150,00 (total R$ 150,00)\nOperação: Venda #V-000123 · Parcela 1/1\nVencimento: 14/12/2026\nID no sistema: OB-000231 (a9f3…)\nAbrir: https://app/contas/a9f3…",
  "start": { "dateTime": "2026-12-14T09:00:00", "timeZone": "America/Bahia" },
  "end":   { "dateTime": "2026-12-14T09:30:00", "timeZone": "America/Bahia" },
  "reminders": { "useDefault": false, "overrides": [
      { "method": "popup", "minutes": 4320 }, { "method": "popup", "minutes": 1440 }, { "method": "popup", "minutes": 0 } ] },
  "extendedProperties": { "private": { "gfi_obrigacao_id": "a9f3…", "gfi_origem": "venda", "gfi_versao": "1" } },
  "colorId": "11"
}
```

- Títulos: venda → `COBRAR <CLIENTE> - R$ <valor> - VENDA <PRODUTOS>`; empréstimo → `RECEBER <CLIENTE> - R$ <valor> - EMPRÉSTIMO` (com ` (2/3)` quando houver parcelas); compra ou fornecedor → `PAGAR <FORNECEDOR> - R$ <valor>`; despesa pessoal → `PAGAR <DESCRIÇÃO> - R$ <valor>`. Use `tituloEvento()` de `scripts/calculos.mjs`.
- O valor no título é o **saldo em aberto**. Num pagamento parcial, o evento é atualizado com o novo saldo e a descrição ganha "Pago até agora: R$ X".
- Lembretes vêm de `configuracoes.lembretes_minutos` (padrão: 3 dias, 1 dia e no dia), editáveis em Configurações → Agenda. O Google aceita no máximo 5 lembretes, de até 40.320 min (4 semanas). Mudar a configuração coloca todos os eventos pendentes na fila.
- Horário: `configuracoes.hora_evento` (padrão 09:00) no fuso do usuário.
- Cores: a receber em vermelho (11), a pagar em laranja (6), pago em verde (2).

## 5. Indicador de sincronização

- Na barra superior: o ponto verde "Agenda sincronizada" aparece quando a fila está vazia e o status é `conectado`. "⏳ N pendentes" quando há itens na fila. Vermelho, com "Reconectar", quando o status é `revogado` ou `erro`.
- Em cada linha de conta a pagar ou a receber: um ícone de status (`v_obrigacoes.agenda_status`) e um link para o evento (`agenda_link`).
- Em Configurações → Agenda: conta conectada, últimos erros, botão "Sincronizar agora" (chama `agenda-sync`) e botão "Reconstruir agenda" (coloca todas as obrigações em aberto na fila; não duplica nada, graças ao `gfi_obrigacao_id`).

## 6. Teste real (obrigatório antes de dizer que está pronto)

1. Conecte a conta Google do usuário.
2. Registre a venda do Valverde e confira no Google Agenda o evento em 14/12, às 09:00, com 3 lembretes. Registre o `htmlLink` no relatório.
3. Altere o vencimento para 15/12: é **o mesmo** evento que muda de dia (o ID não muda).
4. Registre um pagamento parcial de R$ 50: o título passa a ser "COBRAR VALVERDE - R$ 100 - VENDA TZ".
5. Registre o restante: o título vira "✅ PAGO - …" (ou o evento some, se a configuração for `excluir`).
6. Desconecte o Google, registre uma despesa com vencimento (ela fica ⏳ pendente), reconecte e veja o evento ser criado sozinho.
7. Apague um evento à mão no Google e clique em "Sincronizar agora": ele é recriado, uma vez só.
