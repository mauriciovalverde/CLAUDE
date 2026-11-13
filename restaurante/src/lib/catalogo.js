// Catálogo: categorias, padronização de nomes de produtos/fornecedores e classificação automática.
// Usado pelo importador da planilha, pelo cadastro manual, pela leitura de notas e pela IA.

export const CATEGORIAS = [
  { id: 'hortalicas', nome: 'Hortaliças e verduras', emoji: '🥬', cor: 'bg-[#D3E9CD]' },
  { id: 'frutas', nome: 'Frutas', emoji: '🍎', cor: 'bg-[#FDE2C4]' },
  { id: 'acougue', nome: 'Açougue', emoji: '🥩', cor: 'bg-[#F4CFCB]' },
  { id: 'aves', nome: 'Aves', emoji: '🍗', cor: 'bg-[#F6E3C0]' },
  { id: 'peixes', nome: 'Peixes', emoji: '🐟', cor: 'bg-[#CFE3F6]' },
  { id: 'cereais', nome: 'Cereais e grãos', emoji: '🌾', cor: 'bg-[#EADFCB]' },
  { id: 'mercearia', nome: 'Mercearia', emoji: '🥫', cor: 'bg-[#E6D3C4]' },
  { id: 'laticinios', nome: 'Laticínios e frios', emoji: '🧀', cor: 'bg-[#FBF0C4]' },
  { id: 'bebidas', nome: 'Bebidas', emoji: '🥤', cor: 'bg-[#CBE9F0]' },
  { id: 'padaria', nome: 'Padaria', emoji: '🥖', cor: 'bg-[#F1DCC5]' },
  { id: 'embalagens', nome: 'Embalagens e descartáveis', emoji: '📦', cor: 'bg-[#E3E0DD]' },
  { id: 'limpeza', nome: 'Limpeza e higiene', emoji: '🧴', cor: 'bg-[#D9D5F3]' },
  { id: 'outros', nome: 'Outros', emoji: '➕', cor: 'bg-[#EDE7F6]' },
];
export const nomeCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nome ?? 'Outros';

export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Correções de grafia e abreviações vistas na planilha (chave já sem acento, maiúscula)
const TROCAS = [
  [/\bREFRIG\b\.?/g, 'REFRIGERANTE'], [/\bEXT\b\.? TOMATE/g, 'EXTRATO DE TOMATE'], [/\bCHAMPINGNON\b/g, 'CHAMPIGNON'],
  [/\bIOGURT\b/g, 'IOGURTE'], [/\bSHOYO\b/g, 'SHOYU'], [/\bLIQ\b\.?/g, 'LIQUIDO'], [/\bCOXA E SOB\b\.?$/g, 'COXA E SOBRECOXA'],
  [/\bFARINHA TRIGO\b/g, 'FARINHA DE TRIGO'], [/\bS\/ ?GAS\b/g, 'SEM GAS'], [/\bC\/ ?GAS\b/g, 'COM GAS'], [/\bS\/ ?CAROCO\b/g, 'SEM CAROCO'],
  [/\bCATCHUP\b/g, 'KETCHUP'], [/\bMUSSARELA\b/g, 'MUCARELA'], [/\bH2O\b/g, 'H2OH'],  [/\bDEF\b\.?$/g, 'DEFUMADO'], [/\bCHOC\b\.?/g, 'CHOCOLATE'], [/\bPC\b/g, 'PCT'],
  [/\bANTAR?T?C?TICA\b/g, 'ANTARTICA'], [/\bANTART\b/g, 'ANTARTICA'], [/\bLIMONTO\b/g, 'LIMONETO'], [/\bPARBOLIZADO\b/g, 'PARBOILIZADO'], [/\bOVOS\b/g, 'OVO'], [/\bBUC HO\b/g, 'BUCHO'],
];

/** Grafia corrigida (sem acento, maiúscula, abreviações expandidas). */
function grafiaBase(nome) {
  let s = semAcento(nome).toUpperCase().replace(/[*"']/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, por] of TROCAS) s = s.replace(re, por);
  return s.replace(/[^A-Z0-9/%,. ]/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Chave de comparação: duas grafias do mesmo produto viram a mesma chave ("FARINHA DE ROSCA" = "FARINHA ROSCA"). */
export function chaveProduto(nome) {
  return grafiaBase(nome).replace(/\b(DE|DA|DO|DAS|DOS)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'em', 'a', 'o']);
const SIGLAS = new Set(['UN', 'KG', 'ML', 'L', 'G', 'PCT', 'CX', 'H2OH', 'S/N']);
/** Nome padronizado para exibição: "FILÉ DE PEITO DE FRANGO" → "Filé de Peito de Frango". Mantém acentos do original. */
const ACENTOS = { MUCARELA: 'MUÇARELA', LIQUIDO: 'LÍQUIDO', GAS: 'GÁS', CAROCO: 'CAROÇO', ALCOOL: 'ÁLCOOL', FEIJAO: 'FEIJÃO', MACA: 'MAÇÃ', LIMAO: 'LIMÃO', MAMAO: 'MAMÃO', MELAO: 'MELÃO', PAO: 'PÃO', FRANCES: 'FRANCÊS', ABOBORA: 'ABÓBORA', BROCOLIS: 'BRÓCOLIS', PIMENTAO: 'PIMENTÃO', ACUCAR: 'AÇÚCAR', OLEO: 'ÓLEO', AGUA: 'ÁGUA', JAPONES: 'JAPONÊS', FILE: 'FILÉ', CAFE: 'CAFÉ', MACARRAO: 'MACARRÃO', GUARANA: 'GUARANÁ', ENERGETICO: 'ENERGÉTICO', PORO: 'PORÓ', REQUEIJAO: 'REQUEIJÃO', SUINO: 'SUÍNO', SUINA: 'SUÍNA', CHA: 'CHÃ', ESPINHACO: 'ESPINHAÇO', ACAFRAO: 'AÇAFRÃO', DESCARTAVEL: 'DESCARTÁVEL', SANITARIA: 'SANITÁRIA', PLASTICA: 'PLÁSTICA', TERMICA: 'TÉRMICA', INGLES: 'INGLÊS', PETROPOLIS: 'PETRÓPOLIS', SAO: 'SÃO', CAMARAO: 'CAMARÃO', SALMAO: 'SALMÃO', LINGUICA: 'LINGUIÇA', ACEM: 'ACÉM', MUSCULO: 'MÚSCULO', FIGADO: 'FÍGADO', COXAO: 'COXÃO', CORACAO: 'CORAÇÃO', AGRIAO: 'AGRIÃO', RUCULA: 'RÚCULA', JILO: 'JILÓ', MARACUJA: 'MARACUJÁ', ANTARTICA: 'ANTÁRTICA', SAGU: 'SAGU', GRAO: 'GRÃO', LINHACA: 'LINHAÇA', QUEIJO: 'QUEIJO', MANJERICAO: 'MANJERICÃO', HORTELA: 'HORTELÃ', SABAO: 'SABÃO', ALUMINIO: 'ALUMÍNIO', LIMPEZA: 'LIMPEZA', CONDICIONADOR: 'CONDICIONADOR', CHAMPIGNON: 'CHAMPIGNON' };
/** Nome padronizado para exibição: "FILÉ DE PEITO DE FRANGO" → "Filé de Peito de Frango"; "REFRIG COCA" → "Refrigerante Coca". */
export function nomePadrao(original) {
  const limpo = String(original ?? '').replace(/[*"]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const chave = grafiaBase(limpo);
  // sem correções: mantém os acentos do original; com correções: reacentua as palavras conhecidas
  const base = chave === semAcento(limpo).replace(/[^A-Z0-9/%,. ]/g, ' ').replace(/\s+/g, ' ').trim() ? limpo : chave.split(' ').map((p) => ACENTOS[p] ?? p).join(' ');
  return base.split(' ').map((p, i) => {
    if (/\d/.test(p)) return p.replace(/ML$/, 'ml').replace(/KG$/, 'kg').replace(/(\d)L$/, '$1L').replace(/(\d)G$/, '$1g');
    if (SIGLAS.has(p)) return p;
    const l = p.toLowerCase();
    if (i > 0 && MINUSCULAS.has(l)) return l;
    return l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ');
}

// Classificação por palavras (ordem importa: a primeira lista que casar vence)
const REGRAS = [
  ['mercearia', /^EXTRATO|^MOLHO|^TEMP\b|TEMPERO|GOIABADA|CHIMICHURI|LEMON PEPPER|CURRY|PAPRICA|NOZ MOSCADA|CANELA|LOURO|COLORAU|COMINHO|OREGANO|ACAFRAO|ACUCAREIRO|ADOCANTE/],
  ['limpeza', /DETERGENTE|DETERG|\bDET\b|SANITARIA|ALCOOL|SABAO|\bSAB\b|SABONETE|DESINF|SACO (PARA )?LIXO|SACO \d+ ?L\b|ESPONJA|BUCHA|CONDICIONADOR|SHAMPOO|\bSHAM\b|S\/N|PAPEL HIG|PAPEL TOALHA|LIMPADOR|\bLIMPA\b|\bLIMP\b|POLIDOR|CLORO|\bVEJA\b|MULTIUSO|LUVA|PALHA ACO|BOMBRIL|AMACIANTE|ALFAZEMA|\bALV\b|ALVEJANTE|\bCIF\b|ESCOVA|LAVA LOUCA|LAVA ROUPA|PA LIXO|PANO|VASSOURA|RODO|FLANELA|DESOD|BARBEADOR|DENTAL|REPARADOR|PEDRA SANITARIA/],
  ['embalagens', /COPO|SACOLA|EMBALAGEM|EMBALAR|SACO PLASTICO|MARMITEX|QUENTINHA|GUARDANAPO|ALUMINIO|PAPEL FILME|FILME PVC|DESCARTAVEL|CANUDO|TALHER|COLHER|GARFO|\bFACA\b|PALITO DENTE|\bPOTE\b|ISOPOR|BANDEJA|TAMPA/],
  ['bebidas', /REFRIGERANTE|\bSUCO\b|\bAGUA\b|CERVEJA|ENERGETICO|H2OH|GUARANA|\bCOCA\b|FANTA|SPRITE|ANTARTICA|VINHO|CACHACA|VODKA|WHISKY|ISOTONICO|\bMATTE\b|\bMATE\b|TODDYNHO|\bGELO\b|HIBISCO/],
  ['peixes', /PEIXE|BACALHAU|CAMARAO|KANI|SALMAO|TILAPIA|CORVINA|PESCADA|MERLUZA|SIRI|LULA|POLVO|MARISCO|ARRAIA/],
  ['aves', /FRANGO|COXA|SOBRECOXA|CAPOTE|\bPERU\b|CHESTER|GALINHA|\bASA\b|ASINHA|MOELA|NUGGETS|PEITO DE FRANGO|OVO CODORNA/],
  ['laticinios', /QUEIJO|PRESUNTO|MUCARELA|MUSSARELA|REQUEIJAO|\bREQ\b|IOGURTE|\bLEITE\b(?! (CONDENSADO|COCO|PO|EM PO))|MANTEIGA|MARGARINA|SALSICHA|RICOTA|MORTADELA|SALAME|NATA|CREAM CHEESE|CATUPIRY|CHEDDAR|CREME LEITE/],
  ['acougue', /CARNE|BIFE|\bCHA FORA\b|\bCHA DENTRO\b|BUCHO|TOSCANA|CALABRESA|LINGUICA|COSTELA|\bCOST\b|CHARQUE|SALPRESA|SUINO|SUINA|ESPINHACO|(?<!MAIONESE )BACON|PICANHA|ALCATRA|PATINHO|ACEM|MUSCULO|FIGADO|MOCOTO|COXAO|MAMINHA|FRALDINHA|CUPIM|LOMBO|LOMBINHO|PERNIL|PALETA|MOIDA|CORACAO|RABADA|BOFE|LINGUA|PAULISTA|BOVINO|PONTA AGULHA|CRUZ MACHADO|HAMBUR/],
  ['padaria', /\bPAO\b|PAES|BISCOITO|BOLACHA|TORRADA|\bBOLO\b|CROISSANT|BAGUETE|BRIOCHE|RAP10|TORTILHA/],
  ['cereais', /ARROZ|FEIJAO|QUINOA|LINHACA|CHIA|GERGELIM|AVEIA|LENTILHA|GRAO BICO|PIPOCA|CANJICA|AMENDOIM|CASTANHA|GRANOLA|FLOCAO|CUSCUZ|TAPIOCA|SAGU/],
  ['frutas', /ABACAXI|MAMAO|MELAO|MELANCIA|\bMACA\b|MANGA|BANANA|LIMAO|LARANJA|\bUVA\b(?! PASSA)|ABACATE|KIWI|MORANGO|MARACUJA|GOIABA|ACEROLA|\bPERA\b|AMEIXA(?! SECA)|COCO VERDE|TANGERINA|CAJU|GRAVIOLA|PITAYA|CARAMBOLA|CAQUI|JACA|CAJA|UMBU/],
  ['hortalicas', /TOMATE(?! PELADO)|CEBOLA|CENOURA|BATATA(?! (PALITO|PALHA|FRITA))|\bALHO\b|PIMENTAO|PEPINO|REPOLHO|COUVE|ALFACE|BROCOLIS|CHUCHU|ABOBORA|ABOBRINHA|BERINJELA|BETERRABA|VAGEM|QUIABO|MAXIXE|AIPIM|MANDIOCA|INHAME|ACELGA|COENTRO|CEBOLINHA|\bSALSA\b|SALSINHA|PIMENTA(?! REINO)|RUCULA|AGRIAO|ESPINAFRE|GENGIBRE|HORTELA|MANJERICAO|RABANETE|JILO|CHEIRO VERDE|\bFEIRA\b/],
  ['mercearia', /OLEO|VINAGRE|FARINHA|ACUCAR|\bSAL\b|MOLHO|EXTRATO|KETCHUP|MAIONESE|MOSTARDA|MASSA|MACARRAO|\bMAC\b|MIOJO|LASANHA|CAFE|ERVILHA|MILHO|SARDINHA|ATUM|CHAMPIGNON|COCO|CONDENSADO|CORANTE|AROMA|CHOCOLATE|FOUNDANT|FONDANT|MOLEQUE|UVA PASSA|AMEIXA SECA|AZEITE|AZEITONA|PALMITO|CALDO|FERMENTO|GELATINA|AMIDO|MAIZENA|BATATA PALITO|BATATA PALHA|BATATA FRITA|\bOVO\b|ACHOCOLATADO|DOCE|\bMEL\b|TOMATE PELADO|CONSERVA|ROSCA|PASTEL|SOJA|PROTEINA|BARBECUE|KIBE|ERVA DOCE/],
];

/**
 * Sugere a categoria a partir do nome. Retorna 'outros' quando não reconhece.
 * @param {string} nome
 * @returns {string}
 */
export function categorizar(nome) {
  const k = chaveProduto(nome);
  for (const [cat, re] of REGRAS) if (/** @type {RegExp} */ (re).test(k)) return String(cat);
  return 'outros';
}

/** Padroniza o "LOCAL" da planilha: "HORTFRUT (TRAZ NA PORTA)" → { nome: "Hortfrut", obs: "traz na porta" } */
export function padronizarFornecedor(texto) {
  let s = String(texto ?? '').replace(/^\s*LOCAL\s*:?\s*/i, '').replace(/\s+/g, ' ').trim();
  let obs = '';
  const m = s.match(/\(([^)]*)\)/);
  if (m) { obs = m[1].trim().toLowerCase(); s = s.replace(m[0], '').trim(); }
  const nome = s.split(' ').map((p) => {
    const l = p.toLowerCase();
    if (['e', 'de', 'da', 'do', 'dos', 'das', 'com', '-'].includes(l)) return l;
    if (p === 'PH' || p === 'HP') return p;
    return l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ').replace(/\bCom$/, 'Com.');
  return { nome, chave: chaveFornecedor(nome), obs };
}
export const chaveFornecedor = (nome) => semAcento(String(nome ?? '')).toUpperCase().replace(/\([^)]*\)/g, '').replace(/[^A-Z0-9]/g, '');

/** Lê "2PC", "3UN", "12", "—" → { qtd, unidade } */
export function lerQuantidade(v) {
  if (v == null || v === '') return { qtd: null, unidade: null };
  if (typeof v === 'number') return { qtd: v, unidade: null };
  const s = String(v).trim().toUpperCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(PC|PCT|PACOTE|UN|UND|UNID|CX|CAIXA|FD|FARDO|KG|G|L|LT|DZ|DUZIA|BD|BANDEJA|MACO|MOLHO)?S?$/);
  if (!m) return { qtd: null, unidade: null };
  const u = { PC: 'pct', PCT: 'pct', PACOTE: 'pct', UN: 'un', UND: 'un', UNID: 'un', CX: 'cx', CAIXA: 'cx', FD: 'fardo', FARDO: 'fardo', KG: 'kg', G: 'g', L: 'L', LT: 'L', DZ: 'dz', DUZIA: 'dz', BD: 'bandeja', BANDEJA: 'bandeja', MACO: 'maço', MOLHO: 'maço' }[m[2] ?? ''] ?? null;
  return { qtd: Number(m[1]), unidade: u };
}

export const UNIDADES = ['kg', 'g', 'un', 'pct', 'cx', 'fardo', 'L', 'ml', 'dz', 'maço', 'bandeja', 'lata', 'garrafa'];
