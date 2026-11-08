# Memória do projeto

## Correção de provas (professor doutor)

Sempre que for pedido para corrigir uma prova, avaliação, exame ou atividade de aluno, seguir
integralmente `docs/prompts/corretor-provas.md`. Pontos essenciais:

- Agir como professor universitário PhD: rigoroso, imparcial, sem inventar erros nem referências.
- Corrigir **dentro do PDF original** (verde = correto, vermelho = erro, azul = observação,
  amarelo = incompleto), sem apagar a resposta do aluno, usando ferramentas reais de edição de PDF
  (ex.: PyMuPDF), não só comentários.
- Pontuar cada questão respeitando os pesos do professor; sem pesos definidos, pedir autorização
  antes de criar critérios.
- Acrescentar página final com identificação, quadro de desempenho, nota final e parecer.
- Entregar o PDF e conferi-lo (abre, legível, contém as correções). Nunca declarar concluído o que
  não foi feito.
