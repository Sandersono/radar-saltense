export function relatorio(d, problemas) {
  const l = [];
  l.push('# Conferência do Radar Saltense', '', `Dados de ${d.meta.atualizadoEm}`, '');
  l.push('## Barreira automática', '');
  l.push(...(problemas.length ? problemas.map((p) => `- ❌ ${p}`) : ['- ✅ Tudo certo. Pode publicar.']), '');
  l.push('## Avisos', '');
  l.push(...(d.avisos.length ? d.avisos.map((a) => `- ${a}`) : ['- nenhum']), '');
  l.push('## Números por vereador', '', 'Abra a ficha oficial de 2 ou 3 vereadores e compare com esta tabela.', '');
  l.push('| Vereador | Presenças | Faltas | AJ | Sessões | Pedidos | Cobranças | Homenagens | Leis | Outros | Votou contra | Ausente em votação |');
  l.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of d.vereadores) {
    l.push(`| ${v.nome} | ${v.presenca.P} | ${v.presenca.A} | ${v.presenca.AJ} | ${v.presenca.total} | ${v.porGrupo.melhoria} | ${v.porGrupo.cobranca} | ${v.porGrupo.homenagem} | ${v.porGrupo.lei} | ${v.porGrupo.outros} | ${v.votosContra} | ${v.ausenciasVotacao} |`);
  }
  l.push('', '## PDFs de presença lidos', '', ...d.presencasLidas.map((p) => `- ${p.arquivo}: ${p.linhas} linhas`));
  l.push('', '## PDFs de votação lidos', '', ...d.votacoesLidas.map((v) => `- ${v.ano}: ${v.blocos} projetos (${v.semEventos} sem votação lida)`));
  l.push('', '## Nomes não atribuídos (ficaram de fora do site)', '');
  l.push(...(d.naoAtribuidos.length ? d.naoAtribuidos.map((n) => `- ${n.fonte}: "${n.nome}"`) : ['- nenhum']));
  l.push('', '## O que é estimativa', '');
  l.push('- Grupos de propostas: regra automática pela categoria e por palavras da ementa (publicada no site).');
  l.push(`- Ruas e bairros: lidos do texto da ementa. Pedidos de melhoria sem lugar identificado: ${d.meta.semLocal}.`);
  l.push('- Votações: leitura do PDF oficial; primeiro nome ligado ao vereador. Votos a favor não são deduzidos.');
  l.push('- Presença: sessões extraordinárias não são separadas das ordinárias.');
  return `${l.join('\n')}\n`;
}
