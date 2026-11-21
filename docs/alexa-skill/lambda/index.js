// Skill "Diário AMPARO": a mãe fala e o registro vai para o Diário da criança no app AMPARO.
const Alexa = require('ask-sdk-core');

const API = 'https://c--7499007a-709a-468a-9b29-4ec2f4fac67b-prod.lovable.cloud/rest/v1/rpc/';
const CHAVE_PUBLICA = 'sb_publishable_-f4vwR9q-MlQH3aYSc1O1Q_GoX6oihp';
const CHAVE_SKILL = process.env.AMPARO_CHAVE_SKILL || 'COLE_AQUI_A_CHAVE_DA_SKILL';

async function chamar(funcao, corpo) {
  try {
    const r = await fetch(API + funcao, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (!r.ok) return 'Não consegui falar com o AMPARO agora. Tente de novo em instantes.';
    return await r.json();
  } catch (e) { return 'Não consegui falar com o AMPARO agora. Tente de novo em instantes.'; }
}
const usuario = (h) => h.requestEnvelope.context.System.user.userId;
const AJUDA = 'Diga, por exemplo: registre que Marcio tomou risperidona agora. Ou: registre que Ana teve uma crise forte por causa do barulho. Para ligar esta Alexa ao seu diário, gere um código no app AMPARO e diga: o código é, seguido dos seis números.';

const Abrir = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: (h) => h.responseBuilder.speak('Diário AMPARO. O que você quer registrar?').reprompt(AJUDA).getResponse(),
};
const Registrar = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'RegistrarIntent',
  async handle(h) {
    const frase = Alexa.getSlotValue(h.requestEnvelope, 'frase');
    if (!frase) return h.responseBuilder.speak('O que você quer registrar?').reprompt(AJUDA).getResponse();
    const resp = await chamar('voz_registrar_alexa', { _chave: CHAVE_SKILL, _alexa_user: usuario(h), _frase: frase });
    return h.responseBuilder.speak(String(resp)).withSimpleCard('Diário AMPARO', String(resp)).getResponse();
  },
};
const Parear = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'ParearIntent',
  async handle(h) {
    const codigo = String(Alexa.getSlotValue(h.requestEnvelope, 'codigo') || '').padStart(6, '0');
    const resp = await chamar('voz_parear_alexa', { _chave: CHAVE_SKILL, _alexa_user: usuario(h), _codigo: codigo });
    return h.responseBuilder.speak(String(resp)).getResponse();
  },
};
const Ajuda = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && ['AMAZON.HelpIntent', 'AMAZON.FallbackIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.speak(AJUDA).reprompt('O que você quer registrar?').getResponse(),
};
const Sair = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.speak('Até logo. Cuide-se também.').getResponse(),
};
const Fim = { canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest', handle: (h) => h.responseBuilder.getResponse() };
const Erro = { canHandle: () => true, handle: (h) => h.responseBuilder.speak('Desculpe, algo deu errado. Tente de novo.').reprompt(AJUDA).getResponse() };

exports.handler = Alexa.SkillBuilders.custom().addRequestHandlers(Abrir, Registrar, Parear, Ajuda, Sair, Fim).addErrorHandlers(Erro).lambda();
