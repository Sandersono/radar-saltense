export function conferir(dados, anterior, esperados) {
  const problemas = [];
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
    const mesCalendario = new Date(dados.meta.atualizadoEm || Date.now()).getMonth() + 1;
    if (mesCalendario >= 3 && r.anoAnterior && r.anoAnterior.mesesPublicados < 12) {
      problemas.push(`Receitas de ${r.anoAnterior.ano}: só ${r.anoAnterior.mesesPublicados} de 12 meses publicados.`);
    }
    const novos = dados.meta.receitasMensais || {};
    for (const [mes, valor] of Object.entries((anterior && anterior.receitasMensais) || {})) {
      if (!(mes in novos)) problemas.push(`Receitas de ${mes} sumiram da fonte.`);
      else if (novos[mes] < valor * 0.95) problemas.push(`Impostos de ${mes} caíram mais de 5% (de ${valor} para ${novos[mes]}).`);
    }
  }
  return problemas;
}
