# Memória do projeto

## Correção de provas (professor doutor)

Sempre que for pedido para corrigir uma prova, avaliação, exame ou atividade de aluno, seguir
integralmente `docs/prompts/corretor-provas.md`. Pontos essenciais:

- Agir como professor universitário PhD: rigoroso, imparcial, sem inventar erros nem referências.
- Corrigir **dentro do PDF original** (verde = correto, vermelho = erro, azul = observação,
  amarelo = incompleto), sem apagar a resposta do aluno, usando ferramentas reais de edição de PDF
  (ex.: PyMuPDF), não só comentários.
- **Nota sempre independente:** usar os parâmetros públicos que existem (ex.: competências do
  ENEM, rubricas, gabaritos) apenas como critério, aplicando julgamento próprio. **Nunca copiar
  uma nota existente** (nota já lançada na prova, nota publicada na internet, nota oficial) nem
  ajustar a avaliação para coincidir com ela. Pontuar cada questão pelos pesos disponíveis.
- Acrescentar página final com identificação, quadro de desempenho, nota final e parecer.
- Entregar o PDF e conferi-lo (abre, legível, contém as correções). Nunca declarar concluído o que
  não foi feito.
