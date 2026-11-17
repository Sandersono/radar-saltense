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

// Quando receitas e despesas do TCE-SP vieram da fonte pela última vez: coletadas agora = agora;
// não coletadas = a data guardada na execução anterior (ou, sem ela, a data daquela execução).
export function datasTce(coleta, metaAnt, agora) {
  const ant = (metaAnt && metaAnt.tceColetadoEm) || {};
  const antes = (k) => ant[k] || (metaAnt && metaAnt.atualizadoEm) || null;
  return {
    receitas: coleta.receitas === null ? antes('receitas') : agora,
    despesas: coleta.despesas === null ? antes('despesas') : agora,
  };
}

export const LIMITE_DIAS_TCE = 10;
const NOMES_TCE = { receitas: 'Receitas', despesas: 'Despesas' };
const diaBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Dado repetido até o limite: aviso. Mais velho que o limite: problema (o robô não publica).
export function idadeTce(datas, agora, limite = LIMITE_DIAS_TCE) {
  const avisos = [];
  const problemas = [];
  for (const [k, nome] of Object.entries(NOMES_TCE)) {
    const em = datas && datas[k];
    if (!em || em === agora) continue;
    const dias = Math.floor((Date.parse(agora) - Date.parse(em)) / 86400000);
    if (dias > limite) problemas.push(`${nome} do TCE-SP: a fonte não responde há ${dias} dias (último dado de ${diaBR(em)}); o limite para repetir dado antigo é ${limite} dias. Confira o Portal da Transparência do TCE-SP e rode o robô de novo.`);
    else avisos.push(`${nome} do TCE-SP: o site repete os dados de ${diaBR(em)} (${dias} ${dias === 1 ? 'dia' : 'dias'} atrás); o robô para de publicar se passar de ${limite} dias.`);
  }
  return { avisos, problemas };
}
