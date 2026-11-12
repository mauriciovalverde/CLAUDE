# Conformidade legal: empréstimos, medicamentos e LGPD

> O sistema **registra, avisa e bloqueia o que é claramente proibido**. Ele não emite parecer jurídico. As referências abaixo servem como ponto de partida e devem ser confirmadas com um advogado ou contador antes do uso comercial, porque leis e normas mudam. Mostre essa ressalva na tela de Configurações → Conformidade.

## 1. Empréstimo de dinheiro a juros entre particulares

O que considerar (confirme a redação em vigor):

- **Lei de Usura (Decreto 22.626/1933):** limita os juros nos contratos entre particulares e veda o anatocismo (juros sobre juros) em período inferior a um ano (art. 4º; Súmula 121 do STF). A Lei 14.905/2024 afastou a Lei de Usura para alguns casos (por exemplo, obrigações entre pessoas jurídicas e com instituições financeiras), mas **não** para o mútuo entre pessoas físicas.
- **Código Civil:** art. 591 (mútuo com fins econômicos: juros presumidos, limitados à taxa do art. 406 e capitalização só anual); art. 406 (taxa legal, redefinida pela Lei 14.905/2024 como Selic menos IPCA); art. 354 (pagamento abate primeiro os juros).
- **Lei 1.521/1951, art. 4º:** cobrar juros acima da taxa permitida em lei é **crime contra a economia popular** (usura pecuniária).
- **Lei 7.492/1986, art. 16:** operar como instituição financeira sem autorização (por exemplo, emprestar a juros de forma habitual, como atividade) pode configurar crime contra o sistema financeiro.
- **Cobrança:** é proibido expor o devedor ao ridículo ou fazer ameaças (CP art. 147 e art. 345, exercício arbitrário das próprias razões). Os lembretes do sistema são só para o usuário, nunca mensagens automáticas ao devedor.

Como o sistema aplica isso:

1. `configuracoes.limite_juros_mensal_pct` começa em **1% a.m.** (referência conservadora de 12% a.a.). O usuário pode alterar, e a tela avisa que o valor deve ser confirmado com um advogado.
2. Todo empréstimo calcula a **taxa mensal equivalente**. Acima do limite, a RPC devolve `AVISO_LEGAL_PENDENTE` e a IA mostra:
   > "⚠️ A taxa informada equivale a 10% ao mês. Para empréstimo entre pessoas físicas, a legislação limita os juros (Lei de Usura e Código Civil) e a cobrança acima do permitido pode ser crime (Lei 1.521/51). O sistema não garante que essa taxa seja legal. Deseja registrar mesmo assim, ciente disso?"
3. Com a confirmação, grava `acima_limite_legal=true` e `ciencia_aviso_legal_em`. O empréstimo aparece com um selo ⚠️ e o relatório de empréstimos traz uma seção "Condições acima da referência legal".
4. Juros compostos com período menor que um ano geram uma observação de vedação nas `condicoes_texto`. Sugira juros simples.
5. As condições contratuais ficam registradas de forma transparente em `condicoes_texto`: principal, taxa, base, modalidade, períodos, parcelas, vencimentos e taxa equivalente. Daí sai um PDF "Resumo das condições", que pode servir de base para um contrato redigido por um advogado.

## 2. Compra e venda de medicamentos

O que considerar:

- **Lei 5.991/1973 e Lei 13.021/2014:** só farmácias e drogarias licenciadas, com responsável técnico farmacêutico presente, podem dispensar medicamentos ao consumidor.
- **Lei 6.360/1976:** todo medicamento precisa de registro ou notificação na ANVISA. Vender produto sem registro, falsificado ou de procedência ignorada é crime hediondo (Código Penal, art. 273).
- **AFE (Autorização de Funcionamento da ANVISA)**, licença sanitária local (Vigilância Sanitária municipal ou estadual) e Certidão de Regularidade do CRF.
- **RDC 44/2009** (boas práticas farmacêuticas) e **RDC 471/2021** (antimicrobianos: receita em 2 vias, com retenção).
- **Portaria SVS/MS 344/1998** (controle especial, listas A, B, C...): exige Autorização Especial, notificação de receita, escrituração e transmissão ao **SNGPC**. Itens dessa portaria **não podem ser tratados como mercadoria comum**.
- **Rastreabilidade:** lote e validade em cada entrada e saída. O Sistema Nacional de Controle de Medicamentos (SNCM, Lei 11.903/2009) prevê o código único (IUM); confirme a etapa de implantação em vigor.
- Agonistas de GLP-1 e GIP (semaglutida, tirzepatida e similares) são medicamentos de **venda sob prescrição**, e a ANVISA tem determinado a apreensão de versões sem registro e manipuladas irregulares. Produtos assim devem ser cadastrados com `classe_regulatoria='tarja_vermelha'` ou superior, e com o registro ANVISA preenchido.

Como o sistema aplica isso (função `checar_venda_medicamento` no schema):

| Situação | Comportamento |
|---|---|
| `classe_regulatoria='nao_medicamento'` (mercadoria comum ou correlato) | Venda livre |
| Qualquer medicamento sem AFE, licença sanitária e responsável técnico em Configurações | **Bloqueia** (`LICENCA_OBRIGATORIA`) |
| Licença vencida | **Bloqueia** (`LICENCA_VENCIDA`) |
| Medicamento sem registro ANVISA cadastrado | **Bloqueia** (`REGISTRO_ANVISA_AUSENTE`) |
| Tarja vermelha sem receita registrada | **Bloqueia** (`RECEITA_OBRIGATORIA`) |
| Antimicrobiano ou Portaria 344 sem receita retida | **Bloqueia** (`RECEITA_RETENCAO`) |
| Portaria 344 sem `autorizado_controlados=true` | **Bloqueia** (`CONTROLADO_BLOQUEADO`) |
| Lote vencido | Nunca é vendido (FEFO ignora o lote) |

- No cadastro de produto, a classe regulatória é obrigatória quando o item é medicamento. A IA deve perguntar a classe ao cadastrar um produto que pareça ser medicamento.
- A IA nunca ensina a contornar esses bloqueios. Ela explica o que precisa ser regularizado.
- Cada receita fica guardada (`receitas_medicas`), ligada à venda, com o arquivo da imagem no Storage privado.

## 3. LGPD (Lei 13.709/2018)

- Os dados de clientes (terceiros) entram com finalidade definida: gestão de vendas, empréstimos e cobrança.
- Colete o mínimo necessário. CPF e endereço são opcionais e ficam cifrados.
- Dados de saúde (receitas) são **dados pessoais sensíveis** (art. 11): acesso restrito, Storage privado e registro do acesso na auditoria.
- Em Configurações → Privacidade: exportar todos os dados (portabilidade), anonimizar um cliente e explicar quais terceiros recebem dados (Anthropic, para interpretar mensagens; Google, para os eventos).
- Incidentes de segurança: o registro na `auditoria` e nos logs ajuda a cumprir o dever de comunicação (art. 48).

## 4. Salário

O salário da PM é **receita pessoal** (`escopo='pessoal'`, categoria Salário PM). Ele nunca entra no faturamento comercial nem nos relatórios do negócio.
