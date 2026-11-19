import { esc, slug } from '../util/texto.js';
import { layout, reais, numero, dataBR, seloFonte, aviso, cartaoNumero, sumario } from './base.js';

const URL_TCE = 'https://paineldeobras.tce.sp.gov.br/';
const URL_PNCP_API = 'https://pncp.gov.br/api/consulta/v1/';
const URL_OBRASGOV_API = 'https://api-publica.obrasgov.gestao.gov.br/obras/docs';
const URL_PARALISADAS = 'https://salto.sp.gov.br/consulta-de-obras-paralisadas/';
export const ABERTURA_OBRAS = 'Lista montada todo dia com as licitações e contratos de obras que a Prefeitura e o SAAE publicam no Portal Nacional de Contratações Públicas (PNCP) e com as obras que recebem dinheiro federal no Obrasgov.br. O TCE-SP só classifica (no prazo, atrasada, paralisada) as obras que a Prefeitura declarou ao Tribunal.';

// [grupo, título, âncora, explicação]
export const GRUPOS = [
  ['paralisada', 'Paralisadas', 'paralisadas', 'Obras que a própria Prefeitura, o TCE-SP ou o Obrasgov.br declaram paralisadas ou inacabadas. A palavra é da fonte, citada em cada obra.'],
  ['execucao', 'Em execução ou contratadas', 'em-execucao', 'Contrato publicado no PNCP e ainda em vigência, ou obra em execução segundo o TCE-SP ou o Obrasgov.br.'],
  ['licitacao', 'Em licitação', 'em-licitacao', 'Edital recebendo propostas, ou licitação já homologada cujo contrato ainda não foi publicado no PNCP.'],
  ['federal', 'Dinheiro federal registrado, obra não iniciada no sistema', 'dinheiro-federal', 'Recurso do Governo Federal registrado no Obrasgov.br ("Cadastrada"). A obra ainda não começou no sistema e não achamos licitação dela no PNCP.'],
  ['encerrada', 'Encerradas em 2025 e 2026', 'encerradas', 'Contratos com a vigência terminada, ou obras concluídas segundo o Obrasgov.br ou o TCE-SP.'],
];

const pctBR = (v) => `${String(Math.round(v * 100) / 100).replace('.', ',')}%`;
const diaBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
export const idPromessa = (n) => `promessa-${slug(String(n))}`;
// Título curto para listas (ex.: "Obras ligadas" na página de promessas).
export const tituloCurto = (o, max = 80) => (o.titulo.length <= max ? o.titulo : `${o.titulo.slice(0, o.titulo.lastIndexOf(' ', max)).replace(/[\s,;.:\-–]+$/, '')}…`);

export function situacao(o) {
  const tce = o.tce ? `${o.tce.situacao.replace(/\s+-\s+/, ', ').toLowerCase()}, segundo o TCE-SP` : '';
  // Registro do Obrasgov.br de onde veio a situação (o mais grave, quando a obra tem mais de um).
  const og = o.obrasgovSituacao;
  const segundoOg = og ? `segundo o Obrasgov.br (${og.id})` : 'segundo o Obrasgov.br';
  switch (o.grupo) {
    case 'paralisada':
      if (o.prefeitura) return `Paralisada, declarada pela Prefeitura${o.prefeitura.pct != null ? ` (cerca de ${pctBR(o.prefeitura.pct)} feito)` : ''}`;
      if (o.tce && o.tce.paralisada) return `${o.tce.situacao}, segundo o TCE-SP`;
      return `${og.situacao}, ${segundoOg}`;
    case 'execucao':
      if (o.contrato) return o.vigente ? (o.fimVigencia ? `Contrato em vigência até ${dataBR(o.fimVigencia)}` : 'Contrato em vigência') : `Vigência do contrato terminou em ${dataBR(o.fimVigencia)}; em execução ${tce ? 'segundo o TCE-SP' : segundoOg}`;
      if (o.tce) return tce.charAt(0).toUpperCase() + tce.slice(1);
      return `Em execução, ${segundoOg}`;
    case 'licitacao': {
      const l = o.licitacao;
      if (/suspens/i.test(l.situacao || '')) return 'Licitação suspensa, segundo o PNCP';
      if (o.propostasAbertas) return `Recebendo propostas até ${dataBR(l.encerramento)}`;
      if (l.homologado) return 'Licitação homologada; contrato não publicado no PNCP';
      return l.encerramento ? `Propostas encerradas em ${dataBR(l.encerramento)}; resultado ainda não publicado no PNCP` : 'Em licitação';
    }
    case 'federal':
      return 'Recurso federal registrado; obra não iniciada no sistema';
    default:
      if (o.contrato && o.fimVigencia) return `Vigência do contrato terminou em ${dataBR(o.fimVigencia)}`;
      if (o.tce) return `${o.tce.situacao}, segundo o TCE-SP`;
      return `Concluída, ${segundoOg}`;
  }
}

const ROTULO_VALOR = { contrato: 'Valor do contrato', homologado: 'Valor homologado', estimado: 'Valor estimado', previsto: 'Valor previsto' };

function cartaoObra(o, tceDataBase) {
  const og = o.obrasgov;
  const linhas = [['Órgão', esc(o.orgao)]];
  if (o.empresa) linhas.push(['Empresa', esc(o.empresa)]);
  else if (o.grupo === 'licitacao' && o.licitacao && o.licitacao.homologado) linhas.push(['Empresa', 'não informada no PNCP']);
  if (o.valor && o.tipoValor) linhas.push([ROTULO_VALOR[o.tipoValor], `${reais(o.valor)}${o.tipoValor === 'previsto' ? ' (Obrasgov.br)' : ''}`]);
  if (o.assinatura) linhas.push(['Assinatura', dataBR(o.assinatura)]);
  if (o.fimVigencia) linhas.push(['Fim da vigência', dataBR(o.fimVigencia)]);
  if (o.prefeitura && o.prefeitura.inicio) linhas.push(['Início (Prefeitura)', dataBR(o.prefeitura.inicio)]);
  if (o.prefeitura && o.prefeitura.termino) linhas.push(['Previsão de término (Prefeitura)', dataBR(o.prefeitura.termino)]);
  const ex = o.execucao; // a atualização mais recente entre os registros do Obrasgov.br
  if (ex) linhas.push(['Executado', `${pctBR(ex.pct)}${ex.em ? ` em ${dataBR(ex.em)}` : ''}, informado ao Governo Federal (Obrasgov.br${og.length > 1 ? ` ${esc(ex.id)}` : ''})`]);
  if (o.tce) linhas.push(['Situação no TCE-SP', `${esc(o.tce.situacao)}${tceDataBase ? ` (data-base ${esc(tceDataBase)})` : ''}`]);
  const repasse = [...new Set(og.map((p) => p.repassador).filter(Boolean))];
  if (repasse.length) linhas.push(['Dinheiro federal', esc(repasse.map((r) => r.charAt(0) + r.slice(1).toLocaleLowerCase('pt-BR')).join('; '))]);
  const notas = [];
  if (og.length > 1) notas.push(`Registrada ${og.length} vezes no Obrasgov.br.`);
  if (o.grupo === 'execucao' && !o.contrato && !o.tce && !o.prefeitura) notas.push('Contrato não encontrado no PNCP a partir de 2025.');
  const links = [];
  if (o.contrato && o.contrato.url) links.push(seloFonte(o.contrato.url, 'contrato no PNCP'));
  if (o.licitacao && o.licitacao.url) links.push(seloFonte(o.licitacao.url, 'licitação no PNCP'));
  for (const p of og) links.push(seloFonte(p.url, `Obrasgov.br ${p.id}`));
  if (o.tce) links.push(seloFonte(URL_TCE, 'Painel de Obras do TCE-SP'));
  if (o.prefeitura) {
    links.push(seloFonte(URL_PARALISADAS, 'obras paralisadas (Prefeitura)'));
    if (o.prefeitura.link) links.push(seloFonte(o.prefeitura.link, 'página da obra (Prefeitura)'));
  }
  // O texto oficial inteiro fica a um toque quando o título foi encurtado.
  const completo = o.objeto && o.objeto.length > o.titulo.length + 10;
  return `<li class="cartao obra" id="${esc(o.id)}">
<h3>${esc(o.titulo)}</h3>
${completo ? `<details><summary>ver descrição completa</summary><p>${esc(o.objeto)}</p></details>` : ''}
<p class="obra-situacao">${esc(situacao(o))}</p>
<dl class="obra-dados">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
${notas.length ? `<p class="nota">${esc(notas.join(' '))}</p>` : ''}
${o.promessas.length ? `<p class="obra-promessas">${o.promessas.map((n) => `<a class="tag" href="promessas.html#${esc(idPromessa(n))}">Promessa ${esc(n)}</a>`).join(' ')}</p>` : ''}
<p class="obra-links">${links.join(' ')}</p>
</li>`;
}

// Fonte que não respondeu na última atualização: o dado é de outro dia.
function avisosFontes(f, atualizadoEm) {
  const hoje = diaBR(atualizadoEm);
  const nomes = [['pncp', 'PNCP'], ['obrasgov', 'Obrasgov.br'], ['paralisadas', 'página de obras paralisadas da Prefeitura']];
  const lista = nomes.filter(([k]) => f[k] && diaBR(f[k]) !== hoje)
    .map(([k, nome]) => aviso(`Dados do ${esc(nome)} de ${esc(diaBR(f[k]))}; a fonte não respondeu na última atualização.`));
  if (!f.pncp) lista.push(aviso('O PNCP ainda não respondeu à primeira leitura; as licitações e os contratos de obra aparecem nas próximas atualizações.'));
  else if (f.pncpIncompleto) lista.push(aviso('A primeira leitura do PNCP ainda não terminou; a lista de licitações e contratos pode estar incompleta e se completa nas próximas atualizações.'));
  return lista.join('\n');
}

function secaoFontes(f) {
  return `<section id="fontes-obras" class="secao cartao">
<h2>De onde vêm estes dados</h2>
<ul>
<li><strong>PNCP:</strong> licitações por concorrência e contratos de obra da Prefeitura, do SAAE e do Consórcio do Ribeirão Piraí publicados desde 2025. Conta como obra o que é concorrência, categoria "obras" ou "serviços de engenharia", ou contratação de emergência, e tem palavras de obra no objeto (construção, reforma, pavimentação, rede, ETA…).${f.pncp ? ` Dados de ${esc(diaBR(f.pncp))}.` : ''} ${seloFonte(URL_PNCP_API, 'API do PNCP')}</li>
<li><strong>Obrasgov.br:</strong> obras de Salto com dinheiro federal executadas pela Prefeitura ou pelo SAAE, com a porcentagem já feita informada ao Governo Federal.${f.obrasgov ? ` Dados de ${esc(diaBR(f.obrasgov))}.` : ''} ${seloFonte(URL_OBRASGOV_API, 'API do Obrasgov.br')}</li>
<li><strong>Painel de Obras do TCE-SP:</strong> a situação (no prazo, atrasada, paralisada) das obras que a Prefeitura declarou ao Tribunal. O painel é atualizado duas vezes por ano e não traz obras abaixo de R$ 96.050.${f.tceDataBase ? ` Data-base: ${esc(f.tceDataBase)}.` : ''} ${seloFonte(URL_TCE, 'Painel de Obras (TCE-SP)')}</li>
<li><strong>Consulta de Obras Paralisadas:</strong> página da Prefeitura com as obras que ela mesma declara paralisadas.${f.paralisadasModificado ? ` Página atualizada em ${esc(diaBR(f.paralisadasModificado))}.` : ''} ${seloFonte(f.paralisadasLink || URL_PARALISADAS, 'página da Prefeitura')}</li>
</ul>
<p class="nota">"Paralisada", "atrasada" e "no prazo" são palavras das fontes, sempre com o nome de quem disse. A ligação entre uma obra e uma promessa do plano de governo é conferida à mão. Empresas aparecem pelo nome; contratado pessoa física aparece só como "pessoa física".</p>
</section>`;
}

// Cartão-resumo na página da Prefeitura.
export function cartaoObras(d) {
  const o = d.obras;
  if (!o) return '';
  const g = o.resumo.porGrupo;
  const partes = [
    g.paralisada && `${numero(g.paralisada)} ${g.paralisada === 1 ? 'paralisada' : 'paralisadas'}`,
    g.execucao && `${numero(g.execucao)} em execução ou contratadas`,
    g.licitacao && `${numero(g.licitacao)} em licitação`,
    g.federal && `${numero(g.federal)} só com dinheiro federal registrado`,
  ].filter(Boolean);
  return `<section id="obras" class="secao cartao">
<h2>Obras em Salto</h2>
<p>${numero(o.resumo.total)} ${o.resumo.total === 1 ? 'obra na lista' : 'obras na lista'}${partes.length ? `: ${partes.join(', ')}` : ''}. Os contratos em execução ou paralisados somam <strong>${reais(o.resumo.valorContratado)}</strong>.</p>
<p class="nota">A lista junta o PNCP, o Obrasgov.br, o Painel de Obras do TCE-SP e a página de obras paralisadas da Prefeitura.</p>
<p><a class="botao" href="obras.html">Ver as obras</a></p>
</section>`;
}

export function paginaObras(d) {
  const o = d.obras;
  if (!o) {
    const corpo = `<h1>Obras em Salto</h1>
<p>${esc(ABERTURA_OBRAS)}</p>
${aviso('Os dados de obras ainda não foram coletados.')}`;
    return layout({ titulo: 'Obras em Salto/SP', trilha: [{ nome: 'Prefeitura', caminho: 'prefeitura.html' }, { nome: 'Obras', caminho: 'obras.html' }], mostrarAtualizado: true, descricao: 'Licitações, contratos e obras de Salto/SP no PNCP e no Obrasgov.br, e a situação que o TCE-SP dá às obras declaradas: no prazo, atrasada ou paralisada.', caminho: 'obras.html', corpo, atualizadoEm: d.meta.atualizadoEm });
  }
  const r = o.resumo;
  const secoes = GRUPOS.map(([g, titulo, ancora, explica]) => {
    const itens = o.lista.filter((x) => x.grupo === g);
    if (!itens.length) return '';
    const lista = `<ul class="lista-obras">\n${itens.map((x) => cartaoObra(x, o.fontes.tceDataBase)).join('\n')}\n</ul>`;
    if (g === 'encerrada') {
      return `<section id="${ancora}" class="secao">
<details><summary>${esc(titulo)} <span class="num">${numero(itens.length)}</span></summary>
<p class="nota">${esc(explica)}</p>
${lista}
</details>
</section>`;
    }
    return `<section id="${ancora}" class="secao">
<h2>${esc(titulo)} <small class="contagem">${numero(itens.length)}</small></h2>
<p class="nota">${esc(explica)}</p>
${lista}
</section>`;
  }).join('\n');
  const tudo = `${secoes}\n${secaoFontes(o.fontes)}`;
  const corpo = `<h1>Obras em Salto</h1>
<p>${esc(ABERTURA_OBRAS)}</p>
${avisosFontes(o.fontes, d.meta.atualizadoEm)}
<section class="secao" aria-label="Resumo">
<div class="grade-numeros">
${cartaoNumero({ valor: numero(r.total), rotulo: 'obras na lista, fora as encerradas' })}
${cartaoNumero({ valor: reais(r.valorContratado), rotulo: 'em contratos de obras em execução ou paralisadas' })}
${cartaoNumero({ valor: numero(r.paralisadas), rotulo: `${r.paralisadas === 1 ? 'obra paralisada' : 'obras paralisadas'}, segundo a Prefeitura, o TCE-SP ou o Obrasgov.br`, href: r.paralisadas ? '#paralisadas' : undefined })}
</div>
</section>
${sumario(tudo, [...GRUPOS.map(([, titulo, ancora]) => [ancora, titulo.replace(/,.*$/, '')]), ['fontes-obras', 'Fontes']])}
${tudo}`;
  return layout({ titulo: 'Obras em Salto/SP', trilha: [{ nome: 'Prefeitura', caminho: 'prefeitura.html' }, { nome: 'Obras', caminho: 'obras.html' }], mostrarAtualizado: true, descricao: 'Licitações, contratos e obras de Salto/SP no PNCP e no Obrasgov.br, e a situação que o TCE-SP dá às obras declaradas: no prazo, atrasada ou paralisada.', caminho: 'obras.html', corpo, atualizadoEm: d.meta.atualizadoEm });
}
