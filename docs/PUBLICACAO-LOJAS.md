# Publicação nas lojas (Google Play e App Store)

O app já funciona como PWA: no celular, abra o site e toque em **"Adicionar à tela inicial"**.
Para publicar nas lojas, empacote o mesmo site com o **Capacitor**.

## 1. Preparar (uma vez, num computador com Node 20+)

```bash
git clone <repositório do GitHub conectado ao Lovable>
cd <pasta>
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/push-notifications @capacitor/local-notifications
npx cap init "Acolhimento" "br.org.centroacolhimento.app" --web-dir=.output/public
```

Como o app usa renderização no servidor, o mais simples é o app abrir o site publicado.
No `capacitor.config.ts` deixe:

```ts
server: { url: "https://SEU-DOMINIO-PUBLICADO", cleartext: false }
```

## 2. Android (Google Play)

```bash
npx cap add android
npx cap open android   # abre o Android Studio
```

- Ícones: use `public/icon-512.png` e `public/icon-maskable-512.png` (Android Studio → Image Asset).
- Gere o **AAB assinado** (Build → Generate Signed Bundle) e envie no Google Play Console (taxa única de US$ 25).
- Formulário "Segurança dos dados": declarar nome, e-mail, telefone, CPF, dados de saúde (opcional, com consentimento), fotos; criptografia em trânsito; exclusão de conta disponível no app (Perfil → Excluir minha conta).
- Público-alvo: adultos (responsáveis). Não marcar como app para crianças.

## 3. iOS (App Store)

```bash
npx cap add ios
npx cap open ios       # abre o Xcode (precisa de Mac)
```

- Conta Apple Developer (US$ 99/ano).
- Em "Privacy Nutrition Labels", declarar os mesmos dados acima.
- A Apple exige exclusão de conta dentro do app: já existe em Perfil.

## 4. Notificações push nativas (opcional)

Hoje os avisos chegam pelo sino do app, como notificação do navegador e em tempo real.
Para push com o app fechado, configure o Firebase Cloud Messaging (Android) e APNs (iOS),
salve o token em `preferencias_notificacao.push_token` e crie uma função de envio no backend.

## 5. Textos sugeridos para a loja

- **Nome:** Centro de Acolhimento à Família Atípica
- **Subtítulo:** Apoio para mães atípicas
- **Descrição curta:** Informação, acolhimento, diário da criança e busca de especialistas para famílias atípicas.
- **Categoria:** Saúde e fitness / Educação
- **Política de privacidade:** `https://SEU-DOMINIO/privacidade`
