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

// Fonte do TCE-SP fora do ar nunca impede a publicação (regra do projeto). `datas` vem de datasTce:
// igual a `agora` = coletado agora; outra data = repetido desde ela; null = repetido, sem data conhecida.
// avisos: texto para o leitor (vai para fontes.html). manutencao: só no conferencia.md (inclui o limite de dias).
export function idadeTce(datas, agora, limite = LIMITE_DIAS_TCE) {
  const fora = Object.keys(NOMES_TCE).filter((k) => datas && k in datas && datas[k] !== agora);
  const manutencao = [];
  for (const k of fora) {
    const em = datas[k];
    if (!em) { manutencao.push(`${NOMES_TCE[k]} do TCE-SP: a fonte não respondeu e não há data da última coleta boa.`); continue; }
    const dias = Math.floor((Date.parse(agora) - Date.parse(em)) / 86400000);
    manutencao.push(dias > limite
      ? `${NOMES_TCE[k]} do TCE-SP: a fonte não responde há ${dias} dias (último dado de ${diaBR(em)}), mais que o limite de ${limite} dias. O site segue publicando com a nota; confira o Portal da Transparência do TCE-SP.`
      : `${NOMES_TCE[k]} do TCE-SP: o site repete os dados de ${diaBR(em)} (${dias} ${dias === 1 ? 'dia' : 'dias'}).`);
  }
  const quando = (k) => (datas[k] ? diaBR(datas[k]) : '');
  const frase = (nome, dia) => `${nome} do TCE-SP${dia ? ` até ${dia}` : ''}: a fonte não respondeu nas últimas atualizações.`;
  const avisos = fora.length === 2 && quando('receitas') === quando('despesas')
    ? [frase('Receitas e gastos', quando('receitas'))]
    : fora.map((k) => frase(k === 'receitas' ? 'Receitas' : 'Gastos', quando(k)));
  return { avisos, manutencao };
}
