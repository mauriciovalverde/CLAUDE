// Lista padrão de produtos de restaurante, por categoria (pode ser editada e excluída depois no app).
// Formato: [nome, unidade]. Itens repetidos em duas categorias ficam numa só (a mais adequada).
export const CATALOGO_PADRAO = {
  hortalicas: [['Alface', 'un'], ['Rúcula', 'maço'], ['Couve', 'maço'], ['Tomate', 'kg'], ['Tomate-cereja', 'kg'], ['Cebola', 'kg'], ['Alho', 'kg'], ['Batata', 'kg'], ['Batata-doce', 'kg'], ['Cenoura', 'kg'], ['Pimentão', 'kg'], ['Pepino', 'kg'], ['Abobrinha', 'kg'], ['Brócolis', 'un'], ['Couve-flor', 'un'], ['Cheiro-verde', 'maço']],
  frutas: [['Limão', 'kg'], ['Laranja', 'kg'], ['Abacaxi', 'un'], ['Maracujá', 'kg'], ['Manga', 'kg'], ['Morango', 'bandeja'], ['Banana', 'kg'], ['Abacate', 'kg'], ['Mamão', 'kg'], ['Melancia', 'kg']],
  acougue: [['Carne moída', 'kg'], ['Acém', 'kg'], ['Alcatra', 'kg'], ['Contrafilé', 'kg'], ['Picanha', 'kg'], ['Maminha', 'kg'], ['Costela', 'kg'], ['Filé mignon', 'kg'], ['Linguiça', 'kg'], ['Bacon', 'kg'], ['Hambúrguer', 'un'], ['Carne seca', 'kg']],
  aves: [['Peito de frango', 'kg'], ['Filé de frango', 'kg'], ['Coxa e sobrecoxa', 'kg'], ['Asa de frango', 'kg'], ['Frango inteiro', 'kg'], ['Frango desfiado', 'kg'], ['Linguiça de frango', 'kg'], ['Nuggets', 'pct'], ['Peru', 'kg'], ['Chester', 'kg']],
  peixes: [['Tilápia', 'kg'], ['Salmão', 'kg'], ['Merluza', 'kg'], ['Pescada', 'kg'], ['Sardinha', 'kg'], ['Bacalhau', 'kg'], ['Atum', 'kg'], ['Camarão', 'kg'], ['Lula', 'kg'], ['Filé de peixe', 'kg']],
  cereais: [['Arroz branco', 'kg'], ['Arroz integral', 'kg'], ['Feijão', 'kg'], ['Lentilha', 'kg'], ['Grão-de-bico', 'kg'], ['Ervilha', 'kg'], ['Milho', 'kg'], ['Aveia', 'kg'], ['Quinoa', 'kg'], ['Farinha de trigo', 'kg'], ['Fubá', 'kg'], ['Farinha de mandioca', 'kg']],
  mercearia: [['Óleo de soja', 'un'], ['Azeite', 'un'], ['Vinagre', 'un'], ['Sal', 'kg'], ['Açúcar', 'kg'], ['Café', 'pct'], ['Macarrão', 'pct'], ['Molho de tomate', 'un'], ['Extrato de tomate', 'un'], ['Maionese', 'un'], ['Ketchup', 'un'], ['Mostarda', 'un'], ['Caldos e temperos', 'un'], ['Farinha de rosca', 'kg'], ['Batata palha', 'pct'], ['Conservas e enlatados', 'un']],
  laticinios: [['Leite', 'L'], ['Creme de leite', 'un'], ['Leite condensado', 'un'], ['Queijo muçarela', 'kg'], ['Queijo parmesão', 'kg'], ['Requeijão', 'un'], ['Cream cheese', 'un'], ['Manteiga', 'un'], ['Margarina', 'un'], ['Presunto', 'kg'], ['Peito de peru', 'kg'], ['Iogurte', 'un']],
  bebidas: [['Água mineral', 'un'], ['Água com gás', 'un'], ['Refrigerantes', 'un'], ['Suco natural', 'L'], ['Suco concentrado', 'un'], ['Polpas de frutas', 'kg'], ['Cervejas', 'un'], ['Vinhos', 'garrafa'], ['Destilados', 'garrafa'], ['Energéticos', 'un'], ['Chás', 'un'], ['Gelo', 'kg']],
  padaria: [['Pão francês', 'kg'], ['Pão de hambúrguer', 'un'], ['Pão de cachorro-quente', 'un'], ['Pão de forma', 'pct'], ['Pão integral', 'pct'], ['Pão de alho', 'pct'], ['Pão sírio', 'pct'], ['Pão de queijo', 'kg'], ['Torradas', 'pct'], ['Croissants', 'un'], ['Bolos', 'un'], ['Sobremesas prontas', 'un']],
  embalagens: [['Marmita de isopor', 'pct'], ['Marmita de alumínio', 'pct'], ['Potes para molho', 'pct'], ['Potes para sobremesa', 'pct'], ['Copos descartáveis', 'pct'], ['Tampas', 'pct'], ['Pratos descartáveis', 'pct'], ['Talheres descartáveis', 'pct'], ['Guardanapos', 'pct'], ['Sacolas para delivery', 'pct'], ['Papel-alumínio', 'un'], ['Filme plástico', 'un'], ['Papel-manteiga', 'un'], ['Canudos', 'pct']],
  limpeza: [['Detergente', 'un'], ['Desengordurante', 'un'], ['Sabão em pó', 'un'], ['Água sanitária', 'un'], ['Desinfetante', 'un'], ['Sanitizante para alimentos', 'un'], ['Álcool', 'un'], ['Esponjas', 'pct'], ['Panos de limpeza', 'pct'], ['Luvas descartáveis', 'cx'], ['Toucas', 'pct'], ['Aventais', 'un'], ['Sacos de lixo', 'pct'], ['Papel-toalha', 'pct'], ['Papel higiênico', 'pct'], ['Sabonete líquido', 'un']],
  outros: [['Gás de cozinha', 'un'], ['Carvão', 'kg'], ['Fósforos', 'cx'], ['Acendedores', 'un'], ['Papel térmico para impressora', 'un'], ['Etiquetas', 'pct'], ['Filme PVC', 'un'], ['Sacos para armazenamento', 'pct'], ['Controle de pragas (iscas)', 'un'], ['Utensílios de cozinha', 'un'], ['Produtos sazonais', 'un'], ['Itens promocionais', 'un']],
};

/** Linhas prontas para gravar (chave padronizada evita duplicar o que já existe). */
export function linhasCatalogo(chaveProduto) {
  const vistos = new Set();
  const out = [];
  for (const [categoria, itens] of Object.entries(CATALOGO_PADRAO)) {
    for (const [nome, unidade] of itens) {
      const chave = chaveProduto(nome);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ nome, chave, categoria, unidade, status: 'ativo', grafias: [nome] });
    }
  }
  return out;
}
