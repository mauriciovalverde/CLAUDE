// Conteúdo editorial inicial. Carregado no banco pelo admin (Admin › Conteúdos › Carregar conteúdo padrão).
export type SecaoPadrao={slug:string;titulo:string;descricao:string;icone:string;ordem:number;aviso:string|null;topicos:{titulo:string;conteudo:string;video_url:string|null;fontes:{nome:string;url:string}[];ordem:number}[]};
export const SECOES_PADRAO: SecaoPadrao[] = [
 {
  "slug": "orientacoes",
  "titulo": "Orientações iniciais",
  "descricao": "Para quem está começando a jornada do diagnóstico ou ainda busca respostas. Leia no seu tempo, um tema de cada vez.",
  "icone": "leaf",
  "ordem": 0,
  "aviso": null,
  "topicos": [
   {
    "titulo": "O que significa ser uma família atípica",
    "conteudo": "Família atípica é o nome usado para famílias que cuidam de uma criança ou adolescente com deficiência, autismo, TDAH, síndromes, atraso no desenvolvimento ou outra condição que pede cuidados e acompanhamento especiais.\n\nA rotina muda: consultas, terapias, adaptações na escola e na casa. É comum sentir cansaço, medo e também amor e orgulho, tudo junto. Nenhum desses sentimentos está errado.\n\nVocê não precisa saber tudo agora. Este aplicativo existe para caminhar com você.",
    "video_url": null,
    "fontes": [],
    "ordem": 0
   },
   {
    "titulo": "Primeiros passos após suspeita ou diagnóstico",
    "conteudo": "Anote o que você observa no dia a dia: fala, brincadeiras, sono, alimentação, reações a barulho e mudanças. Essas anotações ajudam muito na consulta.\n\nProcure a Unidade Básica de Saúde (UBS) ou o pediatra e relate suas observações. Peça encaminhamento para avaliação especializada.\n\nNão espere o laudo para buscar estímulo e apoio. Converse com a escola e procure orientação desde a suspeita.\n\nCuide também de você: procure apoio emocional e outras famílias que já passaram por isso.",
    "video_url": "https://www.youtube.com/results?search_query=primeiros%20passos%20ap%C3%B3s%20diagn%C3%B3stico%20autismo%20para%20pais",
    "fontes": [],
    "ordem": 1
   },
   {
    "titulo": "Como procurar atendimento especializado",
    "conteudo": "A porta de entrada pelo SUS é a UBS. De lá, a criança pode ser encaminhada para neuropediatra, psiquiatra infantil, CAPSi, Centro Especializado em Reabilitação (CER) ou outros serviços da sua região.\n\nLeve documentos, carteira de vacinação, relatórios da escola e suas anotações.\n\nPelo plano de saúde, peça a lista de profissionais credenciados e guarde os protocolos de cada solicitação.",
    "video_url": null,
    "fontes": [],
    "ordem": 2
   },
   {
    "titulo": "Como funciona o acompanhamento multidisciplinar",
    "conteudo": "Multidisciplinar significa que vários profissionais acompanham a criança juntos: por exemplo, médico, psicólogo, fonoaudiólogo, terapeuta ocupacional, fisioterapeuta, psicopedagogo e nutricionista.\n\nCada criança precisa de um plano próprio. Quem define as terapias e a frequência são os profissionais que avaliaram a criança.\n\nPeça que os profissionais conversem entre si e com a escola. Guarde os relatórios de cada um.",
    "video_url": null,
    "fontes": [],
    "ordem": 3
   },
   {
    "titulo": "Importância da estimulação precoce",
    "conteudo": "Os primeiros anos de vida são um período em que o cérebro se desenvolve muito rápido. Por isso, começar cedo os estímulos e terapias costuma trazer bons resultados.\n\nEstimulação não acontece só no consultório: brincar, conversar, cantar e ler com a criança em casa também conta. Veja ideias em \"Atividades em casa\".\n\nSe houver suspeita, não espere: peça orientação ao serviço de saúde.",
    "video_url": null,
    "fontes": [],
    "ordem": 4
   },
   {
    "titulo": "Como conversar com a escola",
    "conteudo": "Peça uma reunião com a coordenação e o professor. Leve relatórios e conte o que ajuda e o que desorganiza seu filho.\n\nPergunte sobre o Atendimento Educacional Especializado (AEE) e sobre as adaptações possíveis.\n\nCombine um canal de contato e registre por escrito o que foi acordado. Veja seus direitos em \"Direitos › Educação\".",
    "video_url": null,
    "fontes": [],
    "ordem": 5
   },
   {
    "titulo": "Como organizar documentos e laudos",
    "conteudo": "Separe uma pasta, física ou digital, só para a criança: documentos pessoais, laudos, relatórios de terapias, receitas, exames e relatórios escolares.\n\nGuarde sempre cópias. Laudos e relatórios são pedidos na escola, no INSS e em outros serviços.\n\nUse a seção \"Documentos importantes\" deste app para marcar o que já tem e o que falta.",
    "video_url": null,
    "fontes": [],
    "ordem": 6
   },
   {
    "titulo": "Como buscar atendimento pelo SUS",
    "conteudo": "Vá à UBS mais perto da sua casa com o Cartão SUS (ou CPF) e um comprovante de residência.\n\nExplique o que observa e peça encaminhamento. Se houver demora, procure a Ouvidoria do SUS (telefone 136) ou a Secretaria Municipal de Saúde.\n\nPergunte sobre CAPSi, CER e outros serviços especializados da sua região.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.080/1990 — Lei Orgânica da Saúde (SUS)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
     },
     {
      "nome": "Ministério da Saúde",
      "url": "https://www.gov.br/saude/pt-br"
     }
    ],
    "ordem": 7
   },
   {
    "titulo": "Perguntas frequentes",
    "conteudo": "Preciso de laudo para começar as terapias? Nem sempre. Muitas orientações e estímulos podem começar com a suspeita. Converse com o serviço de saúde.\n\nMeu filho vai ter direito ao BPC? Depende de critérios de deficiência e de renda. Veja a seção \"Acesso ao BPC\".\n\nA escola pode recusar matrícula? Não. A Lei Brasileira de Inclusão proíbe recusar matrícula por causa de deficiência.\n\nOnde encontro apoio para mim? Veja \"Mãe, você também importa\" e \"Rede de apoio\".",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.146/2015 — Lei Brasileira de Inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
     }
    ],
    "ordem": 8
   }
  ]
 },
 {
  "slug": "bpc",
  "titulo": "Acesso ao BPC",
  "descricao": "Benefício de Prestação Continuada (BPC/LOAS): o que é, quem tem direito e o passo a passo para pedir.",
  "icone": "coin",
  "ordem": 1,
  "aviso": "Orientações informativas. A concessão do BPC depende da análise dos critérios legais e administrativos pelo INSS.",
  "topicos": [
   {
    "titulo": "O que é o BPC",
    "conteudo": "O BPC é um benefício da assistência social, previsto na LOAS (Lei 8.742/1993, art. 20). Ele paga um salário mínimo por mês à pessoa com deficiência, de qualquer idade, e ao idoso com 65 anos ou mais, que não tenham meios de se manter nem de ser mantidos pela família.\n\nNão é aposentadoria: não exige contribuição ao INSS, não paga 13º e não deixa pensão.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.742/1993 — LOAS (BPC, art. 20)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm"
     },
     {
      "nome": "INSS — portal oficial",
      "url": "https://www.gov.br/inss/pt-br"
     }
    ],
    "ordem": 0
   },
   {
    "titulo": "Quem tem direito",
    "conteudo": "Pessoa com deficiência: impedimento de longo prazo (pelo menos 2 anos) de natureza física, mental, intelectual ou sensorial que, junto com barreiras, dificulta a participação plena na sociedade.\n\nRenda: pela regra geral, a renda por pessoa da família precisa ser igual ou menor que 1/4 do salário mínimo. A lei prevê situações em que outros elementos podem ser considerados.\n\nA Lei 15.077/2024 não exige que a deficiência seja grave ou moderada; esse trecho foi vetado.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.742/1993 — LOAS (BPC, art. 20)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm"
     },
     {
      "nome": "Lei 15.077/2024 — mudanças no BPC",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l15077.htm"
     },
     {
      "nome": "Agência Gov — Mudanças no BPC: o que é verdade e o que é boato",
      "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
     }
    ],
    "ordem": 1
   },
   {
    "titulo": "Critérios de renda",
    "conteudo": "Some a renda de todos que moram na mesma casa e fazem parte do grupo familiar e divida pelo número de pessoas.\n\nPela Lei 15.077/2024, só podem ser descontados os valores previstos em lei, como outro BPC ou benefício previdenciário de até um salário mínimo no mesmo grupo familiar, contrato de aprendizagem e estágio supervisionado.\n\nFamiliares que moram em outra casa não entram no cálculo.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.742/1993 — LOAS (BPC, art. 20)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm"
     },
     {
      "nome": "Agência Gov — Mudanças no BPC: o que é verdade e o que é boato",
      "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
     }
    ],
    "ordem": 2
   },
   {
    "titulo": "Inscrição e atualização do CadÚnico",
    "conteudo": "A inscrição no Cadastro Único é obrigatória para pedir o BPC. Ela é feita no CRAS ou no posto do CadÚnico da sua cidade.\n\nTodos da família precisam ter CPF. Leve documentos de todos e comprovante de residência.\n\nO cadastro deve ser atualizado a cada 24 meses, ou antes se mudar endereço, renda ou composição da família. Cadastro desatualizado pode bloquear o benefício.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Cadastro Único — MDS",
      "url": "https://www.gov.br/mds/pt-br/acoes-e-programas/cadastro-unico"
     },
     {
      "nome": "Agência Gov — Mudanças no BPC: o que é verdade e o que é boato",
      "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
     }
    ],
    "ordem": 3
   },
   {
    "titulo": "Como solicitar pelo Meu INSS",
    "conteudo": "Acesse o site meu.inss.gov.br ou o aplicativo Meu INSS e entre com sua conta gov.br.\n\nClique em \"Novo pedido\" e procure \"Benefício Assistencial à Pessoa com Deficiência\".\n\nPreencha os dados, anexe os documentos e guarde o número do protocolo.\n\nSem internet? Ligue 135 ou peça ajuda no CRAS.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Meu INSS (site oficial)",
      "url": "https://meu.inss.gov.br/"
     }
    ],
    "ordem": 4
   },
   {
    "titulo": "Documentos necessários",
    "conteudo": "Documento com foto e CPF da criança e do responsável.\n\nCPF de todas as pessoas da família.\n\nComprovante de residência.\n\nLaudos, relatórios médicos, exames e relatórios de terapias e da escola.\n\nInscrição atualizada no CadÚnico.\n\nUse o checklist acima para marcar o que já tem.",
    "video_url": null,
    "fontes": [],
    "ordem": 5
   },
   {
    "titulo": "Avaliação social e avaliação da deficiência",
    "conteudo": "O INSS faz duas avaliações: a avaliação social, com assistente social, e a avaliação médica, com perito médico federal.\n\nElas analisam a condição de saúde e também as barreiras do dia a dia: escola, transporte, rotina, acesso a serviços.\n\nPara menores de 65 anos, a avaliação da deficiência é obrigatória e deve registrar o código da CID (Lei 15.077/2024).",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 15.077/2024 — mudanças no BPC",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l15077.htm"
     },
     {
      "nome": "Agência Gov — Mudanças no BPC: o que é verdade e o que é boato",
      "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
     }
    ],
    "ordem": 6
   },
   {
    "titulo": "Como funciona a perícia",
    "conteudo": "Chegue com antecedência e leve documentos originais, laudos, receitas e relatórios recentes de terapias e da escola.\n\nConte com calma como é a rotina da criança, as dificuldades e os apoios que ela precisa. Não minimize as dificuldades.\n\nA biometria (cadastro de digitais e foto) passou a ser obrigatória para conceder e manter o BPC.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Agência Gov — Mudanças no BPC: o que é verdade e o que é boato",
      "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
     }
    ],
    "ordem": 7
   },
   {
    "titulo": "O que fazer quando o benefício é negado",
    "conteudo": "Leia com atenção a carta de decisão no Meu INSS: ela diz o motivo da negativa.\n\nSe faltou documento, você pode fazer um novo pedido com a documentação completa.\n\nSe discorda da decisão, pode apresentar recurso ou procurar a Defensoria Pública da União para orientação e, se for o caso, ação judicial.",
    "video_url": null,
    "fontes": [],
    "ordem": 8
   },
   {
    "titulo": "Como apresentar recurso",
    "conteudo": "O recurso é feito pelo Meu INSS, em até 30 dias a partir do conhecimento da decisão. Procure o serviço de recurso na lista de pedidos.\n\nExplique por que discorda e anexe novos laudos e relatórios.\n\nA Defensoria Pública da União pode ajudar gratuitamente quem não pode pagar advogado.",
    "video_url": null,
    "fontes": [],
    "ordem": 9
   },
   {
    "titulo": "Como consultar o andamento do pedido",
    "conteudo": "No Meu INSS, entre em \"Consultar pedidos\" e veja a situação pelo número do protocolo.\n\nFique de olho em exigências: o INSS pode pedir documentos e há prazo para responder.\n\nTambém é possível consultar pelo telefone 135.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Meu INSS (site oficial)",
      "url": "https://meu.inss.gov.br/"
     }
    ],
    "ordem": 10
   }
  ]
 },
 {
  "slug": "alimentacao",
  "titulo": "Dicas de alimentação",
  "descricao": "Orientações gerais sobre alimentação infantil e seletividade alimentar. Recomendações individuais devem ser feitas por nutricionista ou médico.",
  "icone": "utensils",
  "ordem": 2,
  "aviso": "Não existe dieta que sirva para todas as crianças. Mudanças devem ser orientadas por nutricionista ou médico.",
  "topicos": [
   {
    "titulo": "Seletividade alimentar",
    "conteudo": "Muitas crianças atípicas aceitam poucos alimentos por causa de textura, cheiro, cor ou temperatura. Isso é comum e não é \"manha\".\n\nO objetivo é ampliar o cardápio aos poucos, com paciência e sem brigas.",
    "video_url": "https://www.youtube.com/results?search_query=seletividade%20alimentar%20autismo%20dicas",
    "fontes": [],
    "ordem": 0
   },
   {
    "titulo": "Introdução de novos alimentos",
    "conteudo": "Ofereça a novidade em pequena quantidade, ao lado de um alimento que a criança já aceita.\n\nPode levar muitas tentativas até a criança provar. Tocar, cheirar e lamber já são passos.",
    "video_url": null,
    "fontes": [],
    "ordem": 1
   },
   {
    "titulo": "Como lidar com recusa alimentar",
    "conteudo": "Evite obrigar, chantagear ou castigar: isso costuma aumentar a recusa.\n\nMantenha horários regulares e um ambiente calmo. Elogie as tentativas.",
    "video_url": null,
    "fontes": [],
    "ordem": 2
   },
   {
    "titulo": "Estratégias para ampliar o repertório",
    "conteudo": "Mude um detalhe por vez: o formato, a marca, a cor do prato.\n\nEnvolva a criança no preparo: lavar, mexer, montar. Brincar com alimentos fora da refeição também ajuda.",
    "video_url": null,
    "fontes": [],
    "ordem": 3
   },
   {
    "titulo": "Organização das refeições",
    "conteudo": "Refeições em horários parecidos todos os dias trazem previsibilidade.\n\nDesligue a TV e reduza estímulos. Combine quanto tempo dura a refeição.",
    "video_url": null,
    "fontes": [],
    "ordem": 4
   },
   {
    "titulo": "Alimentação e questões sensoriais",
    "conteudo": "Barulho, luz forte e cheiros podem atrapalhar. Observe o que incomoda e ajuste.\n\nTalheres, pratos e copos com texturas e cores preferidas podem facilitar.",
    "video_url": null,
    "fontes": [],
    "ordem": 5
   },
   {
    "titulo": "Hidratação",
    "conteudo": "Ofereça água ao longo do dia, em copo ou garrafinha de que a criança goste.\n\nEm dias quentes e com mais atividade, ofereça com mais frequência.",
    "video_url": null,
    "fontes": [],
    "ordem": 6
   },
   {
    "titulo": "Quando procurar nutricionista",
    "conteudo": "Procure nutricionista ou o pediatra se houver perda de peso, cardápio muito restrito, engasgos, vômitos frequentes ou prisão de ventre persistente.\n\nNão siga dietas restritivas sem orientação profissional: não existe dieta que sirva para todas as crianças.",
    "video_url": null,
    "fontes": [],
    "ordem": 7
   },
   {
    "titulo": "Receitas simples e acessíveis",
    "conteudo": "Panqueca de banana: amasse 1 banana, misture 1 ovo e 2 colheres de aveia; doure em frigideira antiaderente.\n\nPurê colorido: cozinhe batata com cenoura ou abóbora e amasse com um fio de azeite.\n\nUse alimentos que a criança já aceita como base e mude um ingrediente por vez.",
    "video_url": null,
    "fontes": [],
    "ordem": 8
   }
  ]
 },
 {
  "slug": "crise",
  "titulo": "Dicas em momentos de crise",
  "descricao": "Consulta rápida para momentos de desregulação emocional ou crise sensorial. Não substitui atendimento médico ou psicológico.",
  "icone": "alert",
  "ordem": 3,
  "aviso": "Procure emergência (SAMU 192) se houver risco de lesão, alteração importante da consciência, dificuldade para respirar ou outra situação grave.",
  "topicos": [
   {
    "titulo": "Como identificar sinais de sobrecarga",
    "conteudo": "Tapar os ouvidos, choro, agitação, correr, gritar, se esconder, repetir movimentos ou frases, ficar parado e sem responder.\n\nOs sinais variam de criança para criança. Anote os que você percebe no seu filho.",
    "video_url": null,
    "fontes": [],
    "ordem": 0
   },
   {
    "titulo": "O que fazer durante uma crise",
    "conteudo": "Mantenha a calma e fale pouco, com voz baixa e frases curtas.\n\nDê espaço e tempo. Ofereça o que costuma acalmar: um objeto, música baixa, um canto tranquilo.\n\nEvite perguntas, ordens longas e toques que a criança não aceita.",
    "video_url": "https://www.youtube.com/results?search_query=como%20agir%20em%20crise%20sensorial%20autismo",
    "fontes": [],
    "ordem": 1
   },
   {
    "titulo": "Como reduzir estímulos ambientais",
    "conteudo": "Diminua a luz e o barulho, desligue telas e afaste pessoas que não estão ajudando.\n\nFones abafadores, óculos escuros e um cobertor podem ajudar algumas crianças.",
    "video_url": null,
    "fontes": [],
    "ordem": 2
   },
   {
    "titulo": "Como manter a segurança da criança",
    "conteudo": "Afaste objetos que possam machucar e quinas perigosas.\n\nSe a criança se bate ou bate a cabeça, proteja com almofadas, sem segurar com força.\n\nNunca deixe a criança sozinha perto de ruas, água ou altura.",
    "video_url": null,
    "fontes": [],
    "ordem": 3
   },
   {
    "titulo": "Como agir em ambientes públicos",
    "conteudo": "Procure um lugar mais calmo, se possível.\n\nVocê não precisa se explicar para estranhos. Se quiser, diga apenas: \"Ela é autista e está sobrecarregada, já vai passar\".\n\nA CIPTEA e o cordão de girassol ajudam a identificar a necessidade de apoio.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.977/2020 — CIPTEA (Lei Romeo Mion)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l13977.htm"
     }
    ],
    "ordem": 4
   },
   {
    "titulo": "O que evitar durante uma crise",
    "conteudo": "Gritar, ameaçar ou castigar.\n\nMuitas pessoas falando ao mesmo tempo.\n\nTentar ensinar ou conversar sobre o que aconteceu durante a crise.",
    "video_url": null,
    "fontes": [],
    "ordem": 5
   },
   {
    "titulo": "Como ajudar na recuperação após a crise",
    "conteudo": "Depois da crise a criança costuma ficar cansada. Ofereça água, descanso e acolhimento.\n\nConverse sobre o que aconteceu só quando ela estiver calma, com palavras simples ou imagens.",
    "video_url": null,
    "fontes": [],
    "ordem": 6
   },
   {
    "titulo": "Como identificar possíveis gatilhos",
    "conteudo": "Anote o que aconteceu antes de cada crise: lugar, barulho, fome, sono, mudança de rotina.\n\nCom o tempo, padrões aparecem. Leve essas anotações para a equipe que acompanha a criança. Use \"Minha rotina › Anotações\".",
    "video_url": null,
    "fontes": [],
    "ordem": 7
   },
   {
    "titulo": "Como construir um plano individual de prevenção",
    "conteudo": "Liste os sinais de aviso, o que acalma, o que piora e quem chamar.\n\nCombine o plano com a família, a escola e os profissionais.\n\nDeixe os contatos de emergência à mão: SAMU 192, Bombeiros 193, Polícia 190.",
    "video_url": null,
    "fontes": [],
    "ordem": 8
   }
  ]
 },
 {
  "slug": "direitos",
  "titulo": "Direitos",
  "descricao": "Direitos das pessoas com deficiência e de suas famílias, com a lei correspondente e o link para a fonte oficial. Leis e regras podem mudar: confirme sempre na fonte.",
  "icone": "scale",
  "ordem": 4,
  "aviso": "Conteúdo informativo, não substitui orientação jurídica. Procure a Defensoria Pública ou um advogado para casos específicos.",
  "topicos": [
   {
    "titulo": "[Leis gerais] Lei Brasileira de Inclusão (Estatuto da Pessoa com Deficiência)",
    "conteudo": "A Lei 13.146/2015 é chamada de Lei Brasileira de Inclusão (LBI) e também de Estatuto da Pessoa com Deficiência. É a principal lei sobre o tema.\n\nEla garante igualdade e acessibilidade e proíbe discriminação em saúde, educação, trabalho, transporte, cultura e lazer.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.146/2015 — Lei Brasileira de Inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
     }
    ],
    "ordem": 0
   },
   {
    "titulo": "[Leis gerais] Direitos da pessoa autista",
    "conteudo": "A Lei 12.764/2012 (Lei Berenice Piana) criou a Política Nacional de Proteção dos Direitos da Pessoa com TEA.\n\nEla reconhece a pessoa autista como pessoa com deficiência para todos os efeitos legais. Por isso, os direitos da LBI também valem para autistas.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 12.764/2012 — Direitos da pessoa com TEA",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm"
     }
    ],
    "ordem": 1
   },
   {
    "titulo": "[Leis gerais] Carteira de Identificação da Pessoa com TEA (CIPTEA)",
    "conteudo": "Criada pela Lei 13.977/2020 (Lei Romeo Mion), a CIPTEA facilita o atendimento prioritário e o acesso a serviços.\n\nÉ gratuita, emitida pelos órgãos estaduais ou municipais responsáveis e tem validade de 5 anos. Procure a secretaria da sua cidade ou estado.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.977/2020 — CIPTEA (Lei Romeo Mion)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l13977.htm"
     }
    ],
    "ordem": 2
   },
   {
    "titulo": "[Atendimento e transporte] Atendimento prioritário",
    "conteudo": "Pessoas com deficiência têm direito a atendimento prioritário em órgãos públicos, bancos, hospitais e outros estabelecimentos (Lei 10.048/2000 e LBI, art. 9º).\n\nO acompanhante ou atendente pessoal também tem esse direito, junto com a pessoa com deficiência.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 10.048/2000 — Atendimento prioritário",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l10048.htm"
     },
     {
      "nome": "Lei 13.146/2015 — Lei Brasileira de Inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
     }
    ],
    "ordem": 3
   },
   {
    "titulo": "[Atendimento e transporte] Transporte e passe livre",
    "conteudo": "O passe livre interestadual (Lei 8.899/1994) garante viagem gratuita em ônibus, trem e barco entre estados à pessoa com deficiência comprovadamente carente.\n\nPasse livre municipal e intermunicipal dependem de leis locais: procure a prefeitura e o governo do estado.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.899/1994 — Passe livre interestadual",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8899.htm"
     }
    ],
    "ordem": 4
   },
   {
    "titulo": "[Saúde] Direito à saúde",
    "conteudo": "A LBI (arts. 18 a 26) garante atenção integral à saúde da pessoa com deficiência, em todos os níveis de complexidade, pelo SUS.\n\nInclui diagnóstico, intervenção precoce, habilitação e reabilitação, medicamentos, órteses e próteses.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.146/2015 — Lei Brasileira de Inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
     },
     {
      "nome": "Lei 8.080/1990 — Lei Orgânica da Saúde (SUS)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
     }
    ],
    "ordem": 5
   },
   {
    "titulo": "[Saúde] Tratamento pelo SUS",
    "conteudo": "O SUS deve oferecer atendimento multiprofissional. A entrada é pela UBS, que encaminha para serviços especializados como CAPSi e Centros Especializados em Reabilitação.\n\nEm caso de demora ou negativa, registre reclamação na Ouvidoria do SUS (136) e procure a Defensoria Pública.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.080/1990 — Lei Orgânica da Saúde (SUS)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
     },
     {
      "nome": "Ministério da Saúde",
      "url": "https://www.gov.br/saude/pt-br"
     }
    ],
    "ordem": 6
   },
   {
    "titulo": "[Educação] Educação inclusiva",
    "conteudo": "A escola, pública ou particular, não pode recusar matrícula por causa de deficiência (LBI, art. 28).\n\nEscolas particulares não podem cobrar valor adicional pelas adaptações (LBI, art. 28, § 1º).\n\nA LDB (arts. 58 a 60) garante Atendimento Educacional Especializado. A Lei 14.254/2021 garante acompanhamento a estudantes com dislexia, TDAH e outros transtornos de aprendizagem.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.146/2015 — Lei Brasileira de Inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
     },
     {
      "nome": "Lei 9.394/1996 — LDB (educação especial, arts. 58 a 60)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l9394.htm"
     },
     {
      "nome": "Lei 14.254/2021 — Dislexia, TDAH e transtornos de aprendizagem",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14254.htm"
     }
    ],
    "ordem": 7
   },
   {
    "titulo": "[Educação] Acompanhante especializado",
    "conteudo": "A Lei 12.764/2012 (art. 3º, parágrafo único) garante à pessoa com TEA incluída em classe comum o direito a acompanhante especializado, em caso de comprovada necessidade.\n\nPeça à escola por escrito e anexe relatórios que mostrem a necessidade.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 12.764/2012 — Direitos da pessoa com TEA",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm"
     }
    ],
    "ordem": 8
   },
   {
    "titulo": "[Tributos e benefícios] Isenções tributárias aplicáveis",
    "conteudo": "A Lei 8.989/1995 prevê isenção de IPI na compra de carro novo por pessoa com deficiência ou autista, inclusive por meio do representante legal.\n\nIsenções de ICMS e IPVA dependem das leis de cada estado. Confirme as regras e os documentos na Secretaria da Fazenda do seu estado.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.989/1995 — Isenção de IPI na compra de veículo",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8989.htm"
     }
    ],
    "ordem": 9
   },
   {
    "titulo": "[Tributos e benefícios] Direitos previdenciários e assistenciais",
    "conteudo": "BPC: veja a seção \"Acesso ao BPC\".\n\nAuxílio-inclusão (Lei 14.176/2021): pode ser pago a quem recebe o BPC e passa a trabalhar com carteira assinada, dentro das regras da lei.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 8.742/1993 — LOAS (BPC, art. 20)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm"
     },
     {
      "nome": "Lei 14.176/2021 — BPC e auxílio-inclusão",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14176.htm"
     }
    ],
    "ordem": 10
   },
   {
    "titulo": "[Tributos e benefícios] Benefícios estaduais e municipais",
    "conteudo": "Muitos estados e cidades têm benefícios próprios: passe livre local, isenção de IPVA, carteiras de identificação, prioridade em programas habitacionais e outros.\n\nProcure o CRAS, a Secretaria de Assistência Social e a Secretaria da Pessoa com Deficiência da sua cidade.\n\nA administração do Centro pode cadastrar aqui os benefícios da sua região.",
    "video_url": null,
    "fontes": [],
    "ordem": 11
   },
   {
    "titulo": "[Família] Direitos das mães e responsáveis",
    "conteudo": "Servidores públicos federais com filho ou dependente com deficiência têm direito a horário especial, sem compensação de horário (Lei 13.370/2016).\n\nEstados e municípios podem ter regras próprias para seus servidores. Confira no estatuto do seu órgão.\n\nO acompanhante também tem atendimento prioritário junto com a pessoa com deficiência.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 13.370/2016 — Horário especial para servidor federal",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13370.htm"
     },
     {
      "nome": "Lei 10.048/2000 — Atendimento prioritário",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l10048.htm"
     }
    ],
    "ordem": 12
   }
  ]
 },
 {
  "slug": "acolhimento",
  "titulo": "Mãe, você também importa",
  "descricao": "Muitas iniciativas cuidam da criança e esquecem quem cuida. Este espaço é seu.",
  "icone": "heart",
  "ordem": 5,
  "aviso": null,
  "topicos": [
   {
    "titulo": "Orientações sobre autocuidado",
    "conteudo": "Autocuidado não precisa ser uma tarde livre. Pode ser beber água sentada, tomar banho sem pressa ou dar uma volta no quarteirão.\n\nTrês respirações lentas antes de começar o dia já são uma pausa.\n\nPeça ajuda de forma concreta: \"pode ficar com ele das 15h às 16h na quinta?\".",
    "video_url": null,
    "fontes": [],
    "ordem": 0
   },
   {
    "titulo": "Sobrecarga emocional",
    "conteudo": "Cansaço que não passa com descanso, irritação, choro frequente, sensação de viver no automático e se afastar das pessoas são sinais de alerta.\n\nEsses sinais não são fraqueza. São um aviso de que a carga está grande demais para uma pessoa só.\n\nSe durarem semanas, procure ajuda profissional.",
    "video_url": null,
    "fontes": [],
    "ordem": 1
   },
   {
    "titulo": "Sugestões para organizar a rotina",
    "conteudo": "Use \"Minha rotina\" para reunir consultas, terapias, escola e remédios num só lugar.\n\nEscolha só três prioridades por dia. O resto pode esperar.\n\nDivida tarefas com quem mora com você e com a rede de apoio.",
    "video_url": null,
    "fontes": [],
    "ordem": 2
   },
   {
    "titulo": "Onde buscar atendimento psicológico",
    "conteudo": "Pelo SUS: procure a UBS, que pode encaminhar para psicólogo ou para o CAPS da sua região.\n\nClínicas-escola de psicologia das faculdades costumam atender de graça ou a preço baixo.\n\nApoio emocional imediato: CVV, ligue 188 (gratuito, 24 horas) ou acesse cvv.org.br.",
    "video_url": null,
    "fontes": [
     {
      "nome": "CVV — Centro de Valorização da Vida",
      "url": "https://cvv.org.br/"
     }
    ],
    "ordem": 3
   },
   {
    "titulo": "Direitos da cuidadora",
    "conteudo": "Você tem direito a atendimento prioritário quando acompanha seu filho.\n\nSe for servidora pública, verifique o direito a horário especial.\n\nNo CRAS você pode buscar orientação sobre benefícios e programas sociais para a família.",
    "video_url": null,
    "fontes": [
     {
      "nome": "Lei 10.048/2000 — Atendimento prioritário",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l10048.htm"
     },
     {
      "nome": "Lei 13.370/2016 — Horário especial para servidor federal",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13370.htm"
     }
    ],
    "ordem": 4
   }
  ]
 },
 {
  "slug": "atividades",
  "titulo": "Atividades para fazer em casa",
  "descricao": "Brincadeiras e estímulos simples com materiais de casa. Adapte à idade e ao jeito do seu filho e converse com os terapeutas.",
  "icone": "puzzle",
  "ordem": 6,
  "aviso": null,
  "topicos": [
   {
    "titulo": "Brincadeiras educativas",
    "conteudo": "Caça ao tesouro com objetos de uma mesma cor.\n\nJogo da memória feito com fotos da família.\n\nContar e separar tampinhas por cor e tamanho.",
    "video_url": null,
    "fontes": [],
    "ordem": 0
   },
   {
    "titulo": "Atividades sensoriais",
    "conteudo": "Caixa sensorial com arroz, feijão ou macarrão cru e potinhos para encher e esvaziar (sempre com supervisão).\n\nMassinha caseira: 2 xícaras de farinha, 1 de sal, 1 de água e 1 colher de óleo.\n\nGarrafa da calma: água, glicerina e glitter numa garrafa bem fechada.",
    "video_url": null,
    "fontes": [],
    "ordem": 1
   },
   {
    "titulo": "Coordenação motora",
    "conteudo": "Pegar bolinhas de algodão com pregador de roupa.\n\nEnfiar macarrão de tubo num barbante.\n\nCircuito no chão com almofadas para pular, engatinhar e equilibrar.",
    "video_url": null,
    "fontes": [],
    "ordem": 2
   },
   {
    "titulo": "Desenvolvimento da comunicação",
    "conteudo": "Nomeie em voz alta o que vocês fazem: \"agora vamos lavar a mão\".\n\nDê opções com imagens: \"você quer suco ou água?\".\n\nCante músicas com gestos e pause para a criança completar.",
    "video_url": "https://www.youtube.com/results?search_query=estimular%20comunica%C3%A7%C3%A3o%20crian%C3%A7a%20autista%20em%20casa",
    "fontes": [],
    "ordem": 3
   },
   {
    "titulo": "Atividades pedagógicas",
    "conteudo": "Quadro de rotina com imagens do dia.\n\nLeitura compartilhada com livros de figuras grandes.\n\nAtividades curtas, de 5 a 10 minutos, com pausa e elogio.",
    "video_url": null,
    "fontes": [],
    "ordem": 4
   },
   {
    "titulo": "Sugestões de interação familiar",
    "conteudo": "Um momento do dia só para brincar do jeito que a criança gosta.\n\nEnvolva irmãos em brincadeiras de dupla.\n\nPasseios curtos em lugares calmos, avisando antes o que vai acontecer.",
    "video_url": null,
    "fontes": [],
    "ordem": 5
   }
  ]
 }
];
export const BIBLIOTECA_PADRAO = [
 {
  "titulo": "Lei Brasileira de Inclusão — texto oficial",
  "tipo": "lei",
  "categoria": "Direitos",
  "descricao": "Lei 13.146/2015, no site do Planalto.",
  "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"
 },
 {
  "titulo": "Lei 12.764/2012 — Direitos da pessoa com TEA",
  "tipo": "lei",
  "categoria": "Direitos",
  "descricao": "Política Nacional de Proteção dos Direitos da Pessoa com Transtorno do Espectro Autista.",
  "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm"
 },
 {
  "titulo": "Meu INSS",
  "tipo": "link",
  "categoria": "BPC",
  "descricao": "Site oficial para pedir e acompanhar o BPC.",
  "url": "https://meu.inss.gov.br/"
 },
 {
  "titulo": "Cadastro Único — informações oficiais",
  "tipo": "link",
  "categoria": "BPC",
  "descricao": "Como se inscrever e atualizar o CadÚnico.",
  "url": "https://www.gov.br/mds/pt-br/acoes-e-programas/cadastro-unico"
 },
 {
  "titulo": "Mudanças no BPC: o que é verdade e o que é boato",
  "tipo": "link",
  "categoria": "BPC",
  "descricao": "Agência Gov explica as mudanças da Lei 15.077/2024.",
  "url": "https://agenciagov.ebc.com.br/noticias/202501/mudancas-no-bpc-o-que-e-verdade-e-o-que-e-boato"
 },
 {
  "titulo": "Vídeos: primeiros passos após o diagnóstico",
  "tipo": "video",
  "categoria": "Orientações",
  "descricao": "Busca no YouTube. A administração pode trocar por um vídeo escolhido.",
  "url": "https://www.youtube.com/results?search_query=primeiros%20passos%20ap%C3%B3s%20diagn%C3%B3stico%20autismo%20para%20pais"
 },
 {
  "titulo": "Vídeos: seletividade alimentar",
  "tipo": "video",
  "categoria": "Alimentação",
  "descricao": "Busca no YouTube. A administração pode trocar por um vídeo escolhido.",
  "url": "https://www.youtube.com/results?search_query=seletividade%20alimentar%20autismo%20dicas"
 },
 {
  "titulo": "Vídeos: como agir em crise sensorial",
  "tipo": "video",
  "categoria": "Crises",
  "descricao": "Busca no YouTube. A administração pode trocar por um vídeo escolhido.",
  "url": "https://www.youtube.com/results?search_query=como%20agir%20em%20crise%20sensorial%20autismo"
 },
 {
  "titulo": "CVV — apoio emocional 24 horas",
  "tipo": "link",
  "categoria": "Saúde emocional",
  "descricao": "Ligue 188 ou converse pelo chat do site.",
  "url": "https://cvv.org.br/"
 }
] as const;
