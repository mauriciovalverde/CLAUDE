import { GraduationCap, Landmark, Stethoscope, type LucideIcon } from "lucide-react";

export type Area = "saude" | "educacao" | "poder_publico";
export const AREAS: { k: Area; nome: string; I: LucideIcon; tom: string; tipos: string[] }[] = [
  { k: "saude", nome: "Saúde", I: Stethoscope, tom: "bg-emergency-soft text-emergency", tipos: ["Pedido de exame", "Consulta", "Encaminhamento", "Autorização", "Resultado e retorno", "Medicamento", "Terapia", "Outro"] },
  { k: "educacao", nome: "Educação", I: GraduationCap, tom: "bg-primary-soft text-primary", tipos: ["Matrícula", "AEE", "Profissional de apoio escolar", "Adaptações", "Reunião com a escola", "Documento solicitado", "Outro"] },
  { k: "poder_publico", nome: "Poder Público", I: Landmark, tom: "bg-warning-soft text-warning", tipos: ["Requerimento", "Denúncia", "Benefício assistencial (BPC etc.)", "Solicitação administrativa", "Recurso", "Outro"] },
];
export const area = (k: string) => AREAS.find((a) => a.k === k) ?? AREAS[0];

export const STATUS_SOL: [string, string, string][] = [
  ["rascunho", "Rascunho", "navy"], ["aguardando_protocolo", "Aguardando protocolo", "amber"], ["protocolado", "Protocolado", "blue"],
  ["em_analise", "Em análise", "blue"], ["pendente", "Pendente", "red"], ["respondido", "Respondido", "green"], ["concluido", "Concluído", "green"],
];
export const statusSol = (k: string) => STATUS_SOL.find((s) => s[0] === k) ?? [k, k, "navy"];
export const ABERTOS = ["aguardando_protocolo", "protocolado", "em_analise", "pendente"];

export type Solicitacao = {
  id: string; area: Area; tipo: string; titulo: string; orgao: string | null; protocolo: string | null; aberta_em: string; prazo: string | null; status: string;
  notas: string | null; documento: string | null; modelo: string | null; lembrete_dias: number; created_at: string; atualizado_em: string;
};

export const diasAte = (d: string) => Math.round((new Date(d + "T12:00").getTime() - new Date(new Date().toISOString().slice(0, 10) + "T12:00").getTime()) / 864e5);

// ------------------------------------------------------------------ Escola Inclusiva: modelos de documento
export type Campos = Record<string, string>;
export type Modelo = { k: string; nome: string; desc: string; tipo: string; campos: [string, string, boolean?][]; texto: (c: Campos) => string; orientacao: string[] };

const cab = (c: Campos) => `À ${c.escola || "[nome da escola]"}${c.rede ? ` – ${c.rede}` : ""}
${c.cidade || "[cidade]"}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.

Eu, ${c.responsavel || "[nome do responsável]"}, ${c.parentesco || "responsável legal"} do(a) estudante ${c.aluno || "[nome do estudante]"}, ${c.serie ? `matriculado(a) no(a) ${c.serie}, ` : ""}venho, respeitosamente, apresentar a seguinte solicitação:`;
const fecho = (c: Campos) => `
Solicito que esta solicitação seja protocolada, com número e data de recebimento, e respondida por escrito em prazo razoável.

Coloco-me à disposição para reunião e para apresentar documentos complementares.

Atenciosamente,

_______________________________________
${c.responsavel || "[nome do responsável]"}
${c.contato ? `Contato: ${c.contato}` : ""}`;

export const MODELOS: Modelo[] = [
  {
    k: "apoio", nome: "Profissional de apoio escolar", tipo: "Profissional de apoio escolar",
    desc: "Pedido de profissional de apoio (ou acompanhante especializado) quando houver necessidade comprovada.",
    campos: [["aluno", "Nome do estudante", true], ["serie", "Série/turma"], ["escola", "Escola", true], ["rede", "Rede (municipal, estadual, particular)"], ["cidade", "Cidade", true], ["responsavel", "Seu nome", true], ["parentesco", "Parentesco"], ["necessidades", "Quais apoios a criança precisa no dia a dia escolar (alimentação, higiene, locomoção, comunicação, regulação…)", true], ["documentos", "Documentos que vai anexar (relatório médico, terapêutico etc.)"], ["contato", "Telefone ou e-mail para resposta"]],
    texto: (c) => `${cab(c)}

1. O(a) estudante necessita de apoio no ambiente escolar, conforme descrito: ${c.necessidades || "[descrever as necessidades]"}.

2. A Lei Brasileira de Inclusão (Lei nº 13.146/2015) assegura a oferta de profissional de apoio escolar (art. 3º, XIII, e art. 28, XVII). Para estudantes com Transtorno do Espectro Autista, a Lei nº 12.764/2012 (art. 3º, parágrafo único) prevê o direito a acompanhante especializado em casos de comprovada necessidade.

3. Diante disso, solicito a avaliação das necessidades do(a) estudante pela equipe pedagógica e a disponibilização do profissional de apoio escolar adequado, com informação por escrito sobre a decisão e os prazos.
${c.documentos ? `\n4. Seguem anexos: ${c.documentos}.` : ""}
${fecho(c)}`,
    orientacao: ["A necessidade é avaliada caso a caso: leve relatórios que descrevam as dificuldades concretas na escola, não só o diagnóstico.", "Entregue em duas vias e peça para carimbarem e datarem a sua cópia (ou envie por e-mail institucional e guarde a resposta).", "Escolas públicas: se não houver resposta, procure a Secretaria de Educação. Persistindo, Defensoria Pública ou Promotoria de Educação do Ministério Público.", "Escolas particulares não podem cobrar valor extra pelo profissional de apoio (LBI, art. 28, § 1º)."],
  },
  {
    k: "aee", nome: "Atendimento Educacional Especializado (AEE)", tipo: "AEE",
    desc: "Pedido de matrícula no AEE, na sala de recursos multifuncionais, no contraturno.",
    campos: [["aluno", "Nome do estudante", true], ["serie", "Série/turma"], ["escola", "Escola", true], ["rede", "Rede"], ["cidade", "Cidade", true], ["responsavel", "Seu nome", true], ["parentesco", "Parentesco"], ["turno", "Turno em que o estudante estuda"], ["contato", "Telefone ou e-mail para resposta"]],
    texto: (c) => `${cab(c)}

1. Solicito a inclusão do(a) estudante no Atendimento Educacional Especializado (AEE), ofertado preferencialmente em sala de recursos multifuncionais, no turno inverso ao da escolarização${c.turno ? ` (o estudante estuda no turno ${c.turno})` : ""}.

2. O AEE é garantido pela Constituição Federal (art. 208, III), pela Lei nº 9.394/1996 – LDB (arts. 58 e 59), pela Lei nº 13.146/2015 (art. 28, III) e regulamentado pelo Decreto nº 7.611/2011 e pela Resolução CNE/CEB nº 4/2009.

3. Peço também a elaboração do Plano de AEE e a articulação entre o professor do AEE e o professor da sala comum.
${fecho(c)}`,
    orientacao: ["O AEE complementa, não substitui, a sala de aula comum.", "Se a escola não tiver sala de recursos, a rede deve oferecer em outra escola próxima ou em centro de AEE.", "Peça uma cópia do Plano de AEE quando estiver pronto."],
  },
  {
    k: "matricula", nome: "Denúncia de recusa de matrícula", tipo: "Matrícula",
    desc: "Registro de recusa, cobrança extra ou dificuldade imposta à matrícula por causa da deficiência.",
    campos: [["aluno", "Nome do estudante", true], ["escola", "Escola que recusou", true], ["rede", "Rede"], ["cidade", "Cidade", true], ["responsavel", "Seu nome", true], ["parentesco", "Parentesco"], ["data", "Data da recusa", true], ["quem", "Quem atendeu (nome/cargo, se souber)"], ["relato", "O que aconteceu (o que foi dito, cobrado ou exigido)", true], ["contato", "Telefone ou e-mail para resposta"]],
    texto: (c) => `À Secretaria de Educação / Órgão competente
${c.cidade || "[cidade]"}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.

Eu, ${c.responsavel || "[nome]"}, ${c.parentesco || "responsável legal"} do(a) estudante ${c.aluno || "[nome]"}, venho comunicar e pedir providências sobre o seguinte fato:

1. Em ${c.data || "[data]"}, ao procurar a matrícula na escola ${c.escola || "[escola]"}${c.rede ? ` (${c.rede})` : ""}, ${c.quem ? `fui atendido(a) por ${c.quem} e ` : ""}a matrícula foi dificultada ou recusada: ${c.relato || "[relato]"}.

2. É vedado recusar, cobrar valores adicionais, suspender ou dificultar a matrícula de estudante em razão de deficiência (Lei nº 7.853/1989, art. 8º, I, com redação da Lei nº 13.146/2015; Lei nº 13.146/2015, art. 27 e art. 28, § 1º). Para estudantes com autismo, a Lei nº 12.764/2012 (art. 7º) prevê multa ao gestor escolar que recusar a matrícula.

3. Solicito a apuração dos fatos, a garantia imediata da matrícula e resposta por escrito sobre as providências adotadas.
${fecho(c)}`,
    orientacao: ["Anote data, hora e nomes. Mensagens e áudios também servem como prova.", "Procure a Secretaria de Educação e, se não resolver, a Defensoria Pública ou o Ministério Público. Também é possível registrar no Disque 100.", "Você pode registrar este caso também na Ouvidoria do AMPARO para acompanhamento da equipe."],
  },
  {
    k: "adaptacoes", nome: "Adaptações razoáveis e acessibilidade", tipo: "Adaptações",
    desc: "Pedido de adaptações de atividades, avaliações, materiais, comunicação ou espaço físico.",
    campos: [["aluno", "Nome do estudante", true], ["serie", "Série/turma"], ["escola", "Escola", true], ["rede", "Rede"], ["cidade", "Cidade", true], ["responsavel", "Seu nome", true], ["parentesco", "Parentesco"], ["adaptacoes", "Quais adaptações você pede (tempo extra, prova adaptada, comunicação alternativa, rampa, abafador…)", true], ["contato", "Telefone ou e-mail para resposta"]],
    texto: (c) => `${cab(c)}

1. Solicito as seguintes adaptações razoáveis e recursos de acessibilidade para o(a) estudante: ${c.adaptacoes || "[listar]"}.

2. A Lei nº 13.146/2015 garante adaptações razoáveis, recursos de acessibilidade e práticas pedagógicas inclusivas (art. 3º, VI, e art. 28, II, V, VI e XVI), bem como a elaboração de plano de atendimento educacional especializado.

3. Peço que as adaptações sejam registradas no planejamento pedagógico do estudante e informadas aos professores.
${fecho(c)}`,
    orientacao: ["Seja específico: diga o que funciona com seu filho em casa e nas terapias.", "Peça uma reunião para construir o plano junto com a escola.", "Guarde a resposta e registre aqui as reuniões e combinados."],
  },
];

export const CANAIS_ESCOLA: [string, string][] = [
  ["Escola", "Direção e coordenação pedagógica: primeiro passo, sempre por escrito e com protocolo."],
  ["Secretaria de Educação", "Rede municipal ou estadual: quando a escola não resolve ou não responde."],
  ["Conselho Municipal dos Direitos da Pessoa com Deficiência", "Acompanha políticas locais e recebe denúncias."],
  ["Defensoria Pública", "Orientação jurídica gratuita para quem não pode pagar advogado."],
  ["Ministério Público (Promotoria de Educação)", "Fiscaliza o direito à educação inclusiva; recebe representações."],
  ["Disque 100", "Denúncia de violação de direitos de crianças e de pessoas com deficiência."],
];
