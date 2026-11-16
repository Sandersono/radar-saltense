// Queda do TCE-SP: fonte não coletada (null) reaproveita o último resultado publicado, sem recalcular.
// Receitas -> `receitas` (impostômetro) e meta.receitasMensais; despesas -> `gastos` (Raio-X, com empresas) e meta.despesasMensais.
// SICONFI sozinho fora do ar: mantém os gastos novos e traz as `areas` de cada ano do resultado anterior.
export function reaproveitarTce(dados, coleta, dadosAnt, metaAnt) {
  const ant = dadosAnt || {};
  const metaA = metaAnt || {};
  const saida = { ...dados, meta: { ...dados.meta } };
  if (coleta.receitas === null) {
    if (ant.receitas !== undefined) saida.receitas = ant.receitas;
    if (metaA.receitasMensais) saida.meta.receitasMensais = metaA.receitasMensais;
  }
  if (coleta.despesas === null) {
    if (ant.gastos !== undefined) saida.gastos = ant.gastos;
    if (metaA.despesasMensais) saida.meta.despesasMensais = metaA.despesasMensais;
  } else if (coleta.siconfi === null && saida.gastos) {
    const anosAnt = (ant.gastos && ant.gastos.anos) || {};
    saida.gastos = {
      ...saida.gastos,
      anos: Object.fromEntries(Object.entries(saida.gastos.anos).map(([ano, a]) => [ano, { ...a, areas: (anosAnt[ano] && anosAnt[ano].areas) || null }])),
    };
  }
  return saida;
}
