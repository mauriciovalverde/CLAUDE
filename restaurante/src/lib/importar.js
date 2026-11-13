// Monta o pacote enviado ao banco (rest_importar_compras) a partir da leitura da planilha.
export function montarImportacao(leitura, arquivo) {
  return {
    arquivo,
    resumo: leitura.resumo,
    avisos: leitura.avisos,
    fornecedores: leitura.fornecedores.map((f) => ({ nome: f.nome, chave: f.chave, grafias: f.grafias, obs: f.obs ?? '' })),
    compras: leitura.compras.map((c) => ({
      data: c.data, fornecedor_nome: c.fornecedor, fornecedor_chave: c.fornecedor_chave, assinatura: c.assinatura,
      desconto: c.desconto, data_estimada: c.data_estimada,
      obs: [c.obs, `Planilha: ${c.celula}`].filter(Boolean).join(' | '),
      itens: c.itens.map((i) => ({
        nome: i.nome, chave: i.chave, categoria: i.categoria, unidade: i.unidade, descricao_original: i.descricao_original,
        quantidade: i.quantidade, peso_kg: i.peso_kg, valor_unitario: i.valor_unitario, valor_total: i.valor_total, celula: i.celula,
      })),
    })),
  };
}

/** Divide em lotes para não estourar o tamanho de uma chamada. */
export function emLotes(pacote, tamanho = 40) {
  const lotes = [];
  for (let i = 0; i < pacote.compras.length; i += tamanho) {
    lotes.push({ ...pacote, compras: pacote.compras.slice(i, i + tamanho), ...(i > 0 ? { fornecedores: [], avisos: [], resumo: { ...pacote.resumo, lote: i / tamanho + 1 } } : {}) });
  }
  return lotes;
}
