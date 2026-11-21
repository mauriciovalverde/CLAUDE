# Skill da Alexa "Diário AMPARO"

A mãe fala com a Alexa e o registro vai direto para o Diário da criança no app AMPARO.

- "Alexa, peça ao Diário AMPARO para registrar que Marcio tomou risperidona agora"
- "Alexa, abra Diário AMPARO" → "registre que Ana teve uma crise forte há 20 minutos por causa do barulho"

O servidor entende a criança (pelo nome), o tipo (medicação, crise, sono, alimentação, conquista, terapia, escola, humor, saúde), o remédio cadastrado, a intensidade da crise ("leve", "forte"…) e o horário ("agora", "há 20 minutos"), e responde o que gravou.

## Publicar (uma vez, pela equipe do AMPARO)
1. Entre em https://developer.amazon.com/alexa/console/ask com uma conta Amazon da instituição.
2. **Create Skill** → nome "Diário AMPARO", idioma **Portuguese (BR)**, modelo **Custom**, hospedagem **Alexa-hosted (Node.js)** (grátis).
3. Em **Build → JSON Editor**, cole `skill-package/interactionModels/custom/pt-BR.json` → **Save** → **Build skill**.
4. Em **Code**, substitua `index.js` e `package.json` pelos desta pasta. Em `index.js`, troque `COLE_AQUI_A_CHAVE_DA_SKILL` pela chave da skill (enviada à parte, NÃO publique no GitHub). **Deploy**.
5. Em **Test**, ative "Development" e teste: "abra diário amparo".
6. Para as famílias usarem: **Distribution** (descrição, ícone, política de privacidade: https://mauriciovalverde.github.io/CLAUDE/privacidade) e **Certification → Submit**. Enquanto a Amazon não aprova, dá para liberar como **Beta** para até 500 e-mails.

## Segurança
- Cada Alexa só grava depois de parear com um código de 6 dígitos gerado no app (vale 10 minutos, uso único).
- O servidor só aceita chamadas com a chave da skill; o ID da Alexa e as chaves ficam guardados só como hash.
- A família desliga qualquer assistente em **Assistente de voz** no app.
- Limite de 30 registros por hora por família.
