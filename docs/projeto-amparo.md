# AMPARO – Centro de Apoio à Família Atípica: identidade visual e app

Guia para qualquer conversa deste projeto (site, PowerPoint, PDF, vídeo, posts). Use estes arquivos e cores; não redesenhe nem recrie a logo.

## Marca oficial: AMPARO (kit "AMPARO_Kit_Completo_Atualizado.zip", enviado em 20/11/2026)
Substitui a marca antiga "Centro de Acolhimento à Família Atípica". O app já usa esta marca: nome, logo, símbolo no ícone do app (fundo branco), favicon e paleta (commit "Nova identidade AMPARO"; `src/components/app/kit.tsx`, `NOME = "AMPARO – Centro de Apoio à Família Atípica"`).

**Como é a logo:** uma casa azul-marinho no topo; embaixo, um coração de fitas em degradê (azul-celeste→azul-royal à esquerda; amarelo→laranja→vermelho→verde à direita). Dentro, mãe, pai e criança em silhueta azul-marinho, e a criança com peças de quebra-cabeça coloridas no peito. Abaixo, "AMPARO" grande em azul-marinho, faixa amarela curva e "CENTRO DE APOIO À FAMÍLIA ATÍPICA" entre dois traços amarelos.

**Arquivos do kit:**
- 01_PNG: Marca Principal Transparente (1207×980, é a marca APROVADA), Símbolo Transparente, Fundo Branco, Fundo Azul, Monocromática Azul, Monocromática Branca, Vetorial Redesenhada.
- 02_SVG_Vetorial: marca e símbolo redesenhados. Atenção: é uma reinterpretação simplificada, NÃO a cópia fiel; para a marca oficial use o PNG aprovado.
- 03_Aplicacoes: App, Crachá, Camisa, Caneca, Fachada, Banner.
- 04_Manual: Manual de Identidade Visual (PDF).
- Observações: no PNG "Fundo Azul" o texto e as silhuetas azul-marinho quase somem no fundo. Para fundo escuro use a versão do app `public/kit/logo-fundo-escuro.png` (silhuetas e texto em branco, coração colorido mantido) ou a Monocromática Branca.
- Versões prontas para uso (link direto do GitHub): `https://raw.githubusercontent.com/mauriciovalverde/CLAUDE/main/public/kit/logo-fundo-claro.png`, `.../logo-fundo-escuro.png`, `.../simbolo.png`, `.../manual-identidade-visual.pdf`.

**Regras:** respiro mínimo de 10% da largura da marca; não distorcer nem esticar. Tipografia: sans-serif geométrica, caixa alta (no app: Montserrat nos títulos, Inter no texto).

## Paleta oficial (manual AMPARO)
| Nome | HEX |
|---|---|
| Azul-marinho | #082F70 |
| Azul royal | #0876E8 |
| Azul celeste | #00C5F2 |
| Verde | #00A35B |
| Amarelo | #FFCD00 |
| Laranja | #F47A16 |
| Vermelho | #E92E35 |

No app (tons ajustados para leitura): azul de botões/links #0868D0, verde #008A4C, laranja de texto #C2530A, vermelho #D1252E, fundo claro #F6F9FE; faixa fina com o degradê das cores da marca sob o cabeçalho; tema escuro em azul-marinho profundo (#061A3D).

## AMPARO: seis letras, uma missão (regra de identidade, desde 20/11/2026)
O nome AMPARO representa seis compromissos. **Preserve exatamente as palavras e a ordem das letras, sem substituições.** O significado das letras é complementar à marca e **não altera a logomarca oficial**. Use de forma consistente em todo o site institucional, principalmente na página inicial e na seção "O AMPARO".

- **A – ACOLHER:** Receber cada família com empatia, respeito, escuta e atenção às suas necessidades.
- **M – MOBILIZAR:** Unir famílias, profissionais, instituições e a sociedade na construção de uma rede solidária e participativa.
- **P – PROTEGER:** Promover o conhecimento dos direitos, a inclusão, a segurança e a dignidade das pessoas atípicas e seus familiares.
- **A – ACOMPANHAR:** Estar presente na jornada das famílias, facilitando o acompanhamento de solicitações, atendimentos e necessidades.
- **R – REGISTRAR:** Facilitar o registro de demandas, denúncias, solicitações e dificuldades enfrentadas pelas famílias, contribuindo para sua documentação e encaminhamento.
- **O – ORIENTAR:** Oferecer informações confiáveis e acessíveis sobre saúde, educação, direitos, benefícios e serviços de apoio.

**Frase de encerramento:** "Mais do que um nome, AMPARO é um compromisso com cada família. Acolher, Mobilizar, Proteger, Acompanhar, Registrar e Orientar."

**Como aplicar no visual:**
- Título: "AMPARO: seis letras, uma missão.", com uma faixa amarelo→laranja embaixo, como a da marca.
- Primeira letra de cada palavra em amarelo #FFCD00 ou laranja #F47A16; o resto em branco (fundo azul-marinho #082F70) ou azul-marinho (fundo claro).
- Ícones discretos e uma breve descrição em cada item; no celular empilhados, no computador em grade 3×2; animações suaves ao rolar.
- **No código:** `src/components/app/Amparo.tsx` (constante `AMPARO`, `AMPARO_FRASE` e `<AmparoSecao fundo="escuro|claro" />`, âncora `#o-amparo`). Sempre use a constante; nunca reescreva os textos à mão. Seção na página inicial (`src/routes/index.tsx`), antes do rodapé.

## Repositório e publicação
- Código em `mauriciovalverde/CLAUDE` (conta GitHub **mauriciovalverde**, diferente da conta mauriciovalverdelima). Um push na `main` publica sozinho no GitHub Pages (workflow "Publicar no GitHub Pages").
- Logos no app: `public/logo-claro*.webp`, `public/logo-escuro*.webp` (1200×968 e 600) e `public/marca*.webp` (símbolo, 512 e 192), usados em `src/components/app/kit.tsx`. Ícones `public/icon-*.png` (símbolo AMPARO em fundo branco), cache `?v=5`.
- Banco: Lovable Cloud (Supabase). Scripts SQL em `docs/sql/` (ouvidoria, classificados, rede-familias, amparo-modulos, agendamento).
- App ao vivo: https://mauriciovalverde.github.io/CLAUDE/

**Layout do app:** barra do topo com o símbolo (e o nome AMPARO em telas maiores) à esquerda e botões redondos A+, sino e SOS vermelho à direita; faixa colorida da marca sob o topo; barra inferior com Início, Buscar, Diário, Apoio, Perfil (e Admin para a equipe); cartões brancos bem arredondados sobre fundo claro, botões em pílula azul, títulos em Montserrat azul-marinho; cabeçalhos de módulo em degradê azul-marinho→azul-royal com a faixa colorida.

## O que o app faz hoje
- **Botão SOS / pânico:** um toque liga para o SAMU, o CVV ou o contato de emergência; também aciona os Números Anjo.
- **Diário e agenda da criança (destaque):** crises, sono, alimentação, humor, remédios e conquistas; gráficos mensais e relatório em PDF para médicos e terapeutas.
- **Teleconsulta com psicólogo (Google Meet):** só para a titular do cadastro; não atende a criança. Pedido PENDENTE + WhatsApp do AMPARO com mensagem pronta → o psicólogo confirma, recusa ou propõe outro horário.
- **Psicólogo:** abre a agenda tocando nos dias do calendário; vê o paciente só pelo código interno e primeiro nome; ficha clínica em sigilo.
- **Classificados Solidários – Oportunidades que acolhem** (`/classificados`): empregos inclusivos, profissionais e serviços adaptados, cupons de parceiros e negócios de famílias atípicas; busca, categorias, cidade, distância, preço e condições; parceiros em destaque; cupons com código protegido e limite de uso; PUBLICAR ANÚNCIO em 4 etapas; MEUS ANÚNCIOS; conversa interna e WhatsApp opcional; denúncia. Todo anúncio passa pela equipe (Admin → Classificados).
- **Rede de Famílias** (`/comunidade`): participação voluntária; busca de famílias por raio de 1 a 100 km (só distância aproximada, nunca endereço), cidade, bairro, idade dos filhos, interesses e apoio; conexões e mensagens privadas entre conectados; bloquear e denunciar; grupos de bairro, cidade e interesse e núcleos locais com moderadores; encontros dos grupos; mural com relatos, perguntas e dicas, inclusive anônimos (apoio mútuo, não terapia).
- **Minhas Solicitações** (`/solicitacoes`): Saúde, Educação e Poder Público, com órgão, protocolo, prazo, situação, anexos privados, histórico, reuniões, lembretes de prazo e PDF. Só a família vê.
- **Escola Inclusiva** (`/escola-inclusiva`): modelos editáveis (profissional de apoio escolar, AEE, denúncia de recusa de matrícula, adaptações razoáveis), impressão/PDF, acompanhamento e a quem recorrer.
- **Ouvidoria:** Denúncia, Reclamação, Solicitação, Sugestão ou Elogio, com área (saúde, educação, assistência, transporte, acessibilidade, discriminação, atendimento, negativa de serviço, outras), foto, vídeo, áudio, PDF, GPS ou mapa; protocolo interno OUV-2026-000123 separado do protocolo oficial do órgão; encaminhamento oficial só com protocolo do órgão ou comprovante; prazo e resposta do órgão; relatório em PDF; equipe em Admin → Ouvidoria.
- **Número Anjo** (`/anjo` e na tela SOS): até 5 contatos de confiança confirmados por link; acionamento segurando 2 segundos, localização opcional, cancelamento; sem provedor de SMS/WhatsApp contratado, a família envia pelo próprio WhatsApp e o app nunca diz "entregue".
- **Assistente de voz** (`/assistente-voz` e microfone no Diário): a mãe fala "registre que Marcio tomou risperidona agora" ou "Ana teve uma crise forte por causa do barulho" e o registro vai para o Diário (criança, tipo, remédio, intensidade e horário entendidos pelo servidor). Funciona pelo microfone do app (Android e iPhone), pela Siri (atalho com chave pessoal) e pela Alexa (skill "Diário AMPARO", pareada com código de 6 dígitos; pacote em `docs/alexa-skill/`, precisa ser publicada numa conta Amazon de desenvolvedor). Google Assistente não permite.
- **Painel de Impacto Social** (Admin → Impacto social): indicadores agregados por período e município, com municípios de menos de 5 famílias ocultados; exporta CSV.
- **Outras funções:** direitos e BPC, serviços perto de você, rotina e lembretes, grupo de WhatsApp e avisos do AMPARO.
- **Privacidade (LGPD):** psicólogo não vê telefone, e-mail, endereço nem CPF; prontuário só com o psicólogo responsável; Ouvidoria e Solicitações privadas; localização sempre aproximada na Rede e nos Classificados; testes de invasão aprovados (31 agendamento, 24 Ouvidoria, 30 Classificados, 36 Rede, 24 Solicitações/Anjo/Impacto).

**Pendências de integração (não simuladas):** envio automático de SMS/WhatsApp (Número Anjo, avisos) depende de contratar um provedor; integração direta com órgãos públicos não existe — o encaminhamento oficial é registrado pela equipe com comprovante.

**Materiais já feitos (com a marca antiga):** folheto de funcionalidades, plano de serviços em PDF (13 páginas) e vídeo institucional 9:16 com a voz Francisca.
