import { esc } from '../util/texto.js';
import { SICONFI_MSC } from '../config.js';
import { periodoOrigem } from '../regras/origem.js';
import { layout, reais, aviso, seloFonte, link, barraProporcao, sumario, ENDERECO } from './base.js';
import { barras, NOMES_MES } from './impostometro.js';

const TCE = 'https://transparencia.tce.sp.gov.br/';
const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
const ateMes = (a, ano) => (a.tipo === 'MSCE' ? `de janeiro a dezembro de ${ano}` : `de janeiro a ${NOMES_MES[a.mes - 1]} de ${ano}`);
const tituloAno = (ano, a) => `<h3>${esc(ano)} <small>(${esc(periodoOrigem(a))})</small></h3>`;
const blocoAno = (ano, conteudo) => `<div class="ano-gastos" data-ano="${esc(ano)}">${conteudo}</div>`;
const fonteMsc = (a) => `<p>${seloFonte(a.url, 'fonte: Tesouro Nacional (MSC)')}</p>`;

function deOndeVem(ano, a) {
  const r = a.receita;
  const pares = a.origem.map((x) => [x.rotulo, x.valor]);
  const intra = r.intra > 0
    ? `<p class="nota">Ficaram fora ${reais(r.intra)} que só passaram de um órgão da cidade para outro (receitas intraorçamentárias), para não contar o mesmo dinheiro duas vezes.</p>`
    : '<p class="nota">A matriz deste período não separa o que só passa de um órgão da cidade para outro (receitas intraorçamentárias); por isso o total fica um pouco acima do impostômetro. Veja a <a href="#conferencia">conferência</a>.</p>';
  const tarifas = a.tarifas > 0 ? `<p class="nota">"Outros" inclui ${reais(a.tarifas)} de tarifas e serviços, quase tudo a conta de água e esgoto paga ao SAAE, além de rendimentos de aplicações, multas e venda de bens.</p>` : '';
  return blocoAno(ano, `${tituloAno(ano, a)}
<p class="numero-grande">${reais(r.total)}</p>
<p>Arrecadados pela Prefeitura, pelo SAAE e pela Câmara ${esc(ateMes(a, ano))}.</p>
${barras(pares, r.total)}
<p>Do ICMS, do IPVA, do FPM e do ITR que chegaram a Salto, ${reais(r.deducaoFundeb)} ficaram retidos para o Fundeb, o fundo da educação básica, que devolveu ${reais((a.origem.find((x) => x.grupo === 'fundeb') || { valor: 0 }).valor)} à cidade. As barras já descontam essa retenção: entraram ${reais(r.bruta)} brutos e ficaram ${reais(r.liquida)} depois das deduções.</p>
${intra}${tarifas}${fonteMsc(a)}`);
}

function livreCarimbado(ano, a) {
  return blocoAno(ano, `${tituloAno(ano, a)}
${barraProporcao([{ rotulo: 'Livre', valor: a.livre, classe: 'd-livre' }, { rotulo: 'Carimbado', valor: a.carimbado, classe: 'd-carimbado' }], reais)}
${fonteMsc(a)}`);
}

function cartaoDestino(x) {
  const fontes = x.principais.length
    ? `<p class="nota">Principais fontes (nome oficial do Tesouro): ${x.principais.map((f) => `${esc(f.nome)} (${reais(f.valor)})`).join('; ')}.</p>`
    : '';
  const areas = x.liquidado > 0 ? barras(x.areas.map((y) => [y.area, y.valor]), x.liquidado) : '<p>Nada liquidado ainda com este dinheiro.</p>';
  return `<div class="secao cartao">
<h4>${esc(x.rotulo)}</h4>
<p>${x.entrou > 0 ? `Entraram <strong>${reais(x.entrou)}</strong>.` : 'Nenhuma receita registrada nestas fontes no período.'} Foram gastos (liquidado) <strong>${reais(x.liquidado)}</strong>; pagos <strong>${reais(x.pago)}</strong>.</p>
${areas}
${fontes}
</div>`;
}

function paraOnde(ano, a) {
  return blocoAno(ano, `${tituloAno(ano, a)}
${a.destino.map(cartaoDestino).join('\n')}
${fonteMsc(a)}`);
}

function emendas(ano, a, linkCamara) {
  const e = a.emendas;
  const corpo = e.total > 0
    ? `<p class="numero-grande">${reais(e.total)}</p>
<p>Recebidos ${esc(ateMes(a, ano))} por indicação de deputados e senadores (emendas da União) e de deputados estaduais (emendas do Estado), contando os rendimentos da aplicação desse dinheiro.</p>
${barras(e.receita.map((x) => [x.rotulo, x.valor]), e.total)}
<h4>O que já foi gasto com emendas</h4>
${e.liquidado > 0 ? `<p>Liquidados <strong>${reais(e.liquidado)}</strong>, inclusive com saldo de emendas recebidas em anos anteriores. Por área:</p>${barras(e.areas.map((x) => [x.area, x.valor]), e.liquidado)}` : '<p>Nada liquidado ainda com dinheiro de emendas.</p>'}`
    : '<p>Nenhuma entrada marcada como emenda parlamentar neste período.</p>';
  return blocoAno(ano, `${tituloAno(ano, a)}
${corpo}
${linkCamara}
${fonteMsc(a)}`);
}

function conferencia(ano, a) {
  const c = a.conferencia;
  const linhas = [];
  if (c.receita) {
    const semIntra = c.receitaIntraTce > 0 ? ` (${reais(c.receitaSemIntraTce)} sem as intraorçamentárias, que o impostômetro deixa de fora, mais ${reais(c.receitaIntraTce)} entre órgãos da cidade)` : '';
    linhas.push(`<li>Arrecadado ${esc(ateMes(a, ano))}: Tesouro Nacional ${reais(c.receita.msc)}; TCE-SP ${reais(c.receita.tce)}${semIntra}. Diferença: ${reais(Math.abs(c.receita.diferenca))} (${pct(c.receita.percentual)}).</li>`);
  } else linhas.push(`<li>Arrecadado: os dados do TCE-SP desta atualização não cobrem todos os meses ${esc(ateMes(a, ano))}; a conferência fica para depois.</li>`);
  if (c.pago) {
    linhas.push(`<li>Pago ${esc(ateMes(a, ano))}: Tesouro Nacional ${reais(c.pago.msc)}; TCE-SP ${reais(c.pago.tce)} (mesma base do Raio-X dos gastos). Diferença: ${reais(Math.abs(c.pago.diferenca))} (${pct(c.pago.percentual)}).</li>`);
  } else linhas.push(`<li>Pago: os dados do TCE-SP desta atualização não cobrem todos os meses ${esc(ateMes(a, ano))}; a conferência fica para depois.</li>`);
  const intra = a.tipo === 'MSCC' && !(a.receita.intra > 0)
    ? '<p class="nota">Neste ano, a matriz do Tesouro não separa o que passa de um órgão da cidade para outro (cerca de 1,5% do total). Por isso o total arrecadado desta página fica um pouco acima do impostômetro, que deixa essa parte de fora.</p>'
    : '';
  const alerta = c.acimaDoLimite ? aviso('Os números do Tesouro Nacional e do TCE-SP diferem mais de 3% neste período. Os dois aparecem aqui como foram publicados, sem ajuste; a diferença foi registrada para conferência.') : '';
  return blocoAno(ano, `${tituloAno(ano, a)}
<ul>${linhas.join('')}</ul>
${alerta}${intra}`);
}

export function paginaOrigem(d) {
  const o = d.origem;
  const anos = Object.keys(o.anos).sort();
  const seletor = `<div class="anos" role="group" aria-label="Escolher o ano">${anos.map((ano, i) => `<button type="button" class="chip" data-ano-botao="${esc(ano)}" aria-pressed="${i === anos.length - 1}">${esc(ano)}</button>`).join('')}</div>`;
  const porAno = (f) => anos.map((ano) => f(ano, o.anos[ano])).join('\n');
  const linkCamara = d.emendas ? '<p class="nota">Estas vêm de deputados federais, senadores e deputados estaduais. As emendas dos vereadores ao orçamento da própria cidade são outra coisa e estão na <a href="camara.html#emendas">página da Câmara</a>.</p>' : '<p class="nota">Estas vêm de deputados federais, senadores e deputados estaduais. As emendas dos vereadores ao orçamento da própria cidade são outra coisa.</p>';
  const consultas = anos.map((ano) => `<li>${esc(ano)} (${esc(periodoOrigem(o.anos[ano]))}): ${link(o.anos[ano].url, `consulta da ${o.anos[ano].tipo === 'MSCE' ? 'matriz de encerramento' : 'matriz mensal'}`)}.</li>`).join('');
  const secoes = `<section id="de-onde-vem" class="secao cartao" aria-labelledby="t-de-onde-vem">
<h2 id="t-de-onde-vem">De onde vem</h2>
<p>Tudo o que entrou nos cofres da cidade, pelo tipo de receita.</p>
${porAno(deOndeVem)}
</section>
<section id="livre-carimbado" class="secao cartao" aria-labelledby="t-livre">
<h2 id="t-livre">Dinheiro livre e dinheiro carimbado</h2>
<p>O dinheiro <strong>livre</strong> pode ir para qualquer área. O <strong>carimbado</strong> só pode ser usado na finalidade dele: saúde, educação, assistência social, uma obra de convênio, a parcela de um financiamento. Parte dos impostos livres também é carimbada pela lei: a cidade precisa aplicar ao menos 25% em educação e 15% em saúde, e essa parte aparece aqui como carimbada.</p>
<p class="nota">A fonte de cada receita é escolhida pela Prefeitura ao registrar a conta. Por isso o mesmo tipo de receita pode mudar de grupo de um ano para outro: a tarifa de água e esgoto do SAAE, por exemplo.</p>
${porAno(livreCarimbado)}
</section>
<section id="destino" class="secao" aria-labelledby="t-destino">
<h2 id="t-destino">Para onde foi cada fonte</h2>
<p>Cada grupo junta as "fontes de recursos" oficiais do Tesouro Nacional. <strong>Liquidado</strong> quer dizer que o serviço foi feito ou a compra entregue, e a Prefeitura conferiu; <strong>pago</strong> é o dinheiro que já saiu do caixa. O gasto de um grupo pode passar do que entrou por dois motivos: o que entrou num ano pode ser gasto no ano seguinte, e na saúde e na educação a Prefeitura pode gastar com impostos livres mais do que o mínimo que a lei carimba.</p>
${aviso('O pagamento a cada empresa não é ligado a uma fonte: a base do TCE-SP usada no Raio-X dos gastos não informa de qual fonte saiu cada pagamento.')}
${porAno(paraOnde)}
</section>
<section id="emendas-recebidas" class="secao cartao" aria-labelledby="t-emendas">
<h2 id="t-emendas">Emendas parlamentares recebidas</h2>
${porAno((ano, a) => emendas(ano, a, linkCamara))}
</section>
<section id="conferencia" class="secao cartao" aria-labelledby="t-conferencia">
<h2 id="t-conferencia">Conferência com o TCE-SP</h2>
<p>Os mesmos totais, no mesmo período, vistos pelo Tribunal de Contas do Estado (${link(TCE, 'TCE-SP')}), a fonte do <a href="impostometro.html">impostômetro</a> e do <a href="gastos.html">Raio-X dos gastos</a>.</p>
${porAno(conferencia)}
</section>
<section id="fontes-origem" class="secao" aria-labelledby="t-fontes-origem">
<h2 id="t-fontes-origem">De onde vêm os números</h2>
<ul>
<li>Tesouro Nacional (SICONFI), Matriz de Saldos Contábeis (MSC), que a Prefeitura envia todo mês: receita realizada e despesa empenhada, liquidada e paga, por fonte de recurso e por área. Endereço da API: ${esc(SICONFI_MSC)}.</li>
${consultas}
<li>Ano fechado: matriz de encerramento, a mesma que gera a prestação de contas anual. Ano corrente: a última matriz mensal publicada, que soma de janeiro até aquele mês.</li>
<li>Nomes das fontes: ${o.planilha ? link(o.planilha, 'tabela oficial de fontes de recursos do Tesouro') : 'tabela oficial de fontes de recursos do Tesouro'} (Portaria STN nº 710/2021 e atualizações)${o.paginaFontes ? `, ${link(o.paginaFontes, 'página do Tesouro')}` : ''}.</li>
<li>Termos: <strong>empenhado</strong> é o dinheiro reservado para uma despesa; <strong>liquidado</strong>, o serviço feito ou a compra entregue e conferida; <strong>pago</strong>, o dinheiro que saiu do caixa.</li>
<li>De onde vem, pelo código da natureza da receita: impostos e taxas da cidade (1.1 e 1.2), repasses da União (1.7.1 e 2.4.1), do Estado (1.7.2 e 2.4.2), Fundeb (1.7.5.1), financiamentos (2.1) e convênios (1.7.1.7, 1.7.2.4, 2.4.1.7 e 2.4.2.2). Emenda parlamentar é reconhecida antes de tudo, pelas fontes 706 e 710 (transferências especiais) e pelos códigos de acompanhamento 3110 a 3249.</li>
<li>Para onde foi, pela fonte de recurso: livre (500 a 503), educação (540 a 599), saúde (600 a 659), assistência social (660 a 669), convênios (700 a 703), financiamentos (574, 634 e 754) e outras vinculadas (o resto, como taxas e tarifas com uso definido em lei e multas de trânsito). Os códigos de acompanhamento valem antes: 1001 (mínimo da educação) conta como educação, 1002 (mínimo da saúde) como saúde e os de emenda como convênios e emendas.</li>
</ul>
</section>`;
  const corpo = `<h1>De onde vem e para onde vai o dinheiro de Salto</h1>
<p>Quanto entrou nos cofres da cidade, de onde veio, para que esse dinheiro é carimbado e em que áreas foi gasto. Os números são do Tesouro Nacional, informados pela própria Prefeitura, e incluem a Prefeitura, o SAAE e a Câmara.</p>
${sumario(secoes, [['de-onde-vem', 'De onde vem'], ['livre-carimbado', 'Livre ou carimbado'], ['destino', 'Para onde foi'], ['emendas-recebidas', 'Emendas'], ['conferencia', 'Conferência'], ['fontes-origem', 'Fontes']])}
${seletor}
${secoes}`;
  const ultimo = anos[anos.length - 1];
  return layout({
    titulo: 'De onde vem e para onde vai o dinheiro de Salto: Radar Saltense',
    descricao: 'O dinheiro de Salto/SP por fonte de recurso: de onde vem, quanto é livre ou carimbado e em que áreas foi gasto, com dados do Tesouro Nacional.',
    caminho: 'origem.html',
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Origem e destino do dinheiro de Salto (SP) por fonte de recurso',
      description: `Receita realizada e despesa liquidada e paga de Salto/SP por fonte de recurso e por área, de ${anos[0]} a ${ultimo} (${periodoOrigem(o.anos[ultimo])}).`,
      url: `${ENDERECO}origem.html`,
      inLanguage: 'pt-BR',
      isBasedOn: SICONFI_MSC,
      spatialCoverage: { '@type': 'City', name: 'Salto (SP)' },
      temporalCoverage: `${anos[0]}/${ultimo}`,
    },
  });
}
