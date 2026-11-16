export function conferir(dados, anterior, esperados) {
  const problemas = [];
  const reais = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  if (dados.vereadores.length !== esperados) problemas.push(`Esperava ${esperados} vereadores, vieram ${dados.vereadores.length}.`);
  if (dados.presencasLidas.length === 0) problemas.push('Nenhum PDF de presença lido.');
  if (dados.votacoesLidas.length === 0) problemas.push('Nenhum PDF de votações lido.');
  for (const p of dados.presencasLidas) {
    if (p.linhas !== esperados) problemas.push(`PDF de presença ${p.arquivo}: ${p.linhas} linhas lidas (esperado ${esperados}).`);
  }
  for (const v of dados.votacoesLidas) {
    if (v.blocos === 0) problemas.push(`PDF de votações de ${v.ano}: nenhum projeto lido.`);
  }
  if (!dados.proposituras.length) problemas.push('Nenhuma propositura coletada.');
  if (anterior && dados.meta.totalProposituras < anterior.totalProposituras) {
    problemas.push(`O total de proposituras caiu de ${anterior.totalProposituras} para ${dados.meta.totalProposituras}.`);
  }
  const r = dados.receitas;
  if (!r) {
    problemas.push('Receitas do impostômetro não foram coletadas.');
  } else {
    const novos = dados.meta.receitasMensais || {};
    const desde = `${r.anoAnterior ? r.anoAnterior.ano : r.anoAtual}-01`;
    const dica = 'Confira o mês no Portal da Transparência do TCE-SP; se a mudança for real, ajuste receitasMensais em data/processado/meta.json e rode o robô de novo.';
    for (const [mes, valor] of Object.entries((anterior && anterior.receitasMensais) || {})) {
      if (mes < desde) continue; // fora da janela coletada
      if (!(mes in novos)) problemas.push(`Receitas de ${mes} sumiram da fonte. ${dica}`);
      else if (novos[mes] < valor * 0.95) problemas.push(`Impostos de ${mes} caíram mais de 5% (de ${reais(valor)} para ${reais(novos[mes])}). ${dica}`);
    }
  }
  const g = dados.gastos;
  if (!g) {
    problemas.push('Despesas do Raio-X dos gastos não foram coletadas.');
  } else {
    const novosD = dados.meta.despesasMensais || {};
    const dicaD = 'Confira o mês no Portal da Transparência do TCE-SP; se a mudança for real, ajuste despesasMensais em data/processado/meta.json e rode o robô de novo.';
    for (const [mes, valor] of Object.entries((anterior && anterior.despesasMensais) || {})) {
      if (!(mes in novosD)) problemas.push(`Despesas de ${mes} sumiram da fonte. ${dicaD}`);
      else if (novosD[mes] < valor * 0.95) problemas.push(`Total pago em ${mes} caiu mais de 5% (de ${reais(valor)} para ${reais(novosD[mes])}). ${dicaD}`);
    }
    for (const [ano, a] of Object.entries(g.anos)) {
      if (a.areas && a.areas.total !== null && Math.abs(a.areas.somaAreas - a.areas.total) > 1) {
        problemas.push(`SICONFI ${ano}: a soma das áreas (${reais(a.areas.somaAreas)}) não bate com o total (${reais(a.areas.total)}).`);
      }
    }
  }
  const folhaNova = dados.meta.folhaMensal || {};
  for (const [mes, valor] of Object.entries((anterior && anterior.folhaMensal) || {})) {
    if (mes in folhaNova && valor > 0 && folhaNova[mes] < valor * 0.8) {
      problemas.push(`Folha da Câmara de ${mes} caiu mais de 20% (de ${reais(valor)} para ${reais(folhaNova[mes])}). Confira o mês no Portal da Transparência da Câmara; se a mudança for real, ajuste folhaMensal em data/processado/meta.json e rode o robô de novo.`);
    }
  }
  return problemas;
}

export function aumentosDespesas(meta, anterior) {
  const reais = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  const novos = (meta && meta.despesasMensais) || {};
  const avisos = [];
  for (const [mes, valor] of Object.entries((anterior && anterior.despesasMensais) || {})) {
    if (mes in novos && valor > 0 && novos[mes] > valor * 1.05) {
      avisos.push(`Total pago em ${mes} subiu mais de 5% (de ${reais(valor)} para ${reais(novos[mes])}); publicado mesmo assim.`);
    }
  }
  return avisos;
}
