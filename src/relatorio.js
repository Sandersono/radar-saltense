import { fichaOficial } from './config.js';
import { GRUPOS_RECEITA, TIPOS_IMPOSTO } from './regras/receitas.js';
import { GRUPOS_GASTO } from './regras/despesas.js';

export function relatorio(d, problemas) {
  const l = [];
  l.push('# Conferência do Radar Saltense', '', `Dados de ${d.meta.atualizadoEm}`, '');
  l.push('## Barreira automática', '');
  l.push(...(problemas.length ? problemas.map((p) => `- ❌ ${p}`) : ['- ✅ Tudo certo. Pode publicar.']), '');
  l.push('## Avisos', '');
  l.push(...(d.avisos.length ? d.avisos.map((a) => `- ${a}`) : ['- nenhum']), '');
  if (d.avisosFotos?.length) l.push(...d.avisosFotos.map((a) => `- Fotos: ${a}`), '');
  l.push('## Propostas sem data no portal', '');
  const semData = d.proposituras.filter((p) => !p.data);
  l.push(...(semData.length ? semData.map((p) => `- ${p.categoria} ${p.numero} (${p.autoresTexto}): ${fichaOficial(p.id)}`) : ['- nenhuma']), '');
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
  const r = d.receitas;
  const reais = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  l.push('', '## Impostômetro', '');
  if (!r) {
    l.push('- Receitas não coletadas.');
  } else {
    l.push(`- Último mês oficial: ${r.ultimoMesOficial || 'nenhum'} (fim ${r.fimOficial || '-'})`);
    l.push(`- Impostos da cidade em ${r.anoAtual}, oficial: ${reais(r.oficialAno)}`);
    const lacunas = [];
    for (const ano of [r.anoAnterior.ano, r.anoAtual]) {
      (r.serie[ano] || []).forEach((v, i) => {
        const k = `${ano}-${String(i + 1).padStart(2, '0')}`;
        if (v === null && r.ultimoMesOficial && k < r.ultimoMesOficial) lacunas.push(k);
      });
    }
    l.push(`- Meses sem dados antes do último mês oficial: ${lacunas.length ? lacunas.join(', ') : 'nenhum'}`);
    l.push(`- Ritmo diário (últimos ${r.mesesRitmo} meses publicados): ${reais(r.ritmoDiario)} por dia`);
    l.push(`- ${r.anoAnterior.ano}: ${r.anoAnterior.mesesPublicados} meses publicados, ${reais(r.anoAnterior.total)}`);
    l.push('', 'Por tipo de imposto (ano atual):', ...Object.entries(r.tiposAno).map(([k, v]) => `- ${TIPOS_IMPOSTO[k] || k}: ${reais(v)}`));
    l.push('', 'Por grupo (ano atual):', ...Object.entries(r.gruposAno).map(([k, v]) => `- ${GRUPOS_RECEITA[k] || k}: ${reais(v)}`));
    l.push(`- Fora do total (receitas intraorçamentárias, dinheiro que só passa de um órgão público para outro): ${reais(r.foraAno)}`);
  }
  const g = d.gastos;
  l.push('', '## Raio-X dos gastos', '');
  if (!g) {
    l.push('- Despesas não coletadas.');
  } else {
    for (const [ano, a] of Object.entries(g.anos)) {
      l.push(`### ${ano}`, '');
      l.push(`- Último mês: ${a.ultimoMes || 'nenhum'} (${a.mesesPublicados} meses)`);
      l.push(`- Total pago: ${reais(a.total)}`);
      l.push(...Object.entries(a.porGrupo).map(([k, v]) => `- ${GRUPOS_GASTO[k]}: ${reais(v)}`));
      l.push(`- Pessoas físicas: ${a.pessoasFisicas.quantidade}`);
      l.push(...a.topEmpresas.slice(0, 5).map((e) => `- Top: ${e.nome} (${e.cnpj}): ${reais(e.total)}`));
      l.push(`- Anulado: ${reais(a.anulado.total)}`);
      l.push(`- SICONFI: ${a.areas ? `bimestre ${a.areas.bimestre}, total liquidado ${reais(a.areas.total)}` : 'ainda não publicado'}`, '');
    }
    l.push(`- Novas com valor alto no mandato: ${g.novas.length}`);
  }
  l.push('', '## O que é estimativa', '');
  l.push('- Impostômetro: depois do último mês oficial, o contador soma o ritmo médio diário dos últimos meses publicados; não considera a sazonalidade (o IPTU concentra em jan/fev).');
  l.push('- Grupos de propostas: regra automática pela categoria e por palavras da ementa (publicada no site).');
  l.push(`- Ruas e bairros: lidos do texto da ementa. Pedidos de melhoria sem lugar identificado: ${d.meta.semLocal}.`);
  l.push('- Votações: leitura do PDF oficial. O nome é ligado ao vereador pelo primeiro nome (e por um sobrenome, quando o documento traz o nome completo), e só quando o vereador aparece na tabela de presença daquele mês. Votos a favor não são deduzidos.');
  l.push('- Nomes completos (presença e autores) exigem primeiro nome e um sobrenome em comum com o vereador.');
  l.push('- Presença: sessões extraordinárias não são separadas das ordinárias. O total de sessões pode variar entre vereadores quando a tabela oficial de um mês traz outros nomes (veja Avisos); nesse mês só contam os vereadores que aparecem nela.');
  return `${l.join('\n')}\n`;
}
