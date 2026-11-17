import { esc } from '../util/texto.js';
import { LINKS_CREDOR, TCE_DESPESAS, SICONFI_RREO } from '../config.js';
import { ORGAOS, GRUPOS_GASTO, LISTA_PUBLICOS, LISTA_NAO_PUBLICOS, formatarCnpj, NOVA_LIMITE } from '../regras/despesas.js';
import { layout, reais, numero, aviso, avisoTce, link } from './base.js';
import { barras, NOMES_MES } from './impostometro.js';

const ATENCAO = 'Isto é um fato tirado dos dados oficiais, não uma acusação. Há explicações comuns para cada caso.';
const linkTce = (cnpj) => `${LINKS_CREDOR.tce}?nr_identificador_despesa=${encodeURIComponent(cnpj)}`;
const mesBR = (chave) => `${NOMES_MES[Number(chave.slice(5, 7)) - 1]} de ${chave.slice(0, 4)}`;
const periodo = (a) => (!a.ultimoMes ? 'sem pagamento publicado ainda' : a.mesesPublicados === 12 ? 'ano fechado' : `até ${mesBR(a.ultimoMes)}`);
const anosOrdenados = (g) => Object.keys(g.anos).sort();

const listaEmpresas = (lista) => (lista.length
  ? `<ol class="lista lista-empresas">${lista.map((e) => `<li><strong>${esc(e.nome)}</strong> <span class="nota">CNPJ <span class="cnpj">${esc(formatarCnpj(e.cnpj))}</span></span><br><span class="valor-linha">${reais(e.total)}</span> ${link(linkTce(e.cnpj), 'ver no TCE-SP')}</li>`).join('')}</ol>`
  : '<p>Nenhuma.</p>');

// As 10 da "Concentração": nome, valor e fatia de cada uma no total pago a empresas e entidades (CNPJ e link na lista acima).
const fatia = (v, total) => `${(Math.round((v / total) * 1000) / 10).toLocaleString('pt-BR')}%`;
const dezMaiores = (a) => {
  const dez = a.topEmpresas.slice(0, 10);
  if (!dez.length || !(a.concentracao.totalEmpresas > 0)) return '';
  return `<ol class="lista lista-compacta">${dez.map((e) => `<li><strong>${esc(e.nome)}</strong>: ${reais(e.total)} <small class="nota">(${fatia(e.total, a.concentracao.totalEmpresas)})</small></li>`).join('')}</ol>
<p class="nota">CNPJ e link para o TCE-SP de cada uma estão na lista "Empresas e entidades que mais receberam", logo acima.</p>`;
};

const pessoasFisicas = (a) => `<p>Pessoas físicas: ${reais(a.pessoasFisicas.total)} para ${numero(a.pessoasFisicas.quantidade)} pessoas. Os nomes de pessoas físicas não aparecem aqui. Para conferir, use a consulta oficial por credor: ${link(LINKS_CREDOR.prefeitura, 'Portal da Transparência da Prefeitura (Despesa Detalhada por Credor)')}, escolhendo a instituição e o ano, ou ${link(LINKS_CREDOR.tce, 'TCE-SP, Despesas por Fornecedor')}.</p>`;

function blocoAno(ano, a) {
  const orgaos = Object.entries(a.porOrgao).filter(([, v]) => v > 0).map(([k, v]) => [ORGAOS[k], v]);
  const grupos = Object.entries(a.porGrupo).map(([k, v]) => [GRUPOS_GASTO[k], v]);
  const areas = a.areas
    ? `<p>Valor liquidado (serviço ou compra entregue e conferido) até ${NOMES_MES[a.areas.bimestre * 2 - 1]} de ${ano}, informado pela Prefeitura ao Tesouro Nacional. Não bate exatamente com o valor pago acima: é outra etapa da despesa e outro período.</p>${barras(a.areas.lista.map((x) => [x.area, x.valor]), a.areas.total)}`
    : '<p>O Tesouro Nacional ainda não publicou a divisão por área deste ano.</p>';
  return `<section class="ano-gastos" data-ano="${ano}" aria-labelledby="t-gastos-${ano}">
<h2 id="t-gastos-${ano}">${ano} <small>(${esc(periodo(a))})</small></h2>
<section class="secao cartao">
<h3>Quanto foi pago</h3>
<p class="numero-grande">${reais(a.total)}</p>
<p>Pago pela Prefeitura, pela Câmara e pelo SAAE em ${ano}, ${esc(periodo(a))}.</p>
${barras(orgaos, a.total)}
<h4>Para quem</h4>
${barras(grupos, a.total)}
${pessoasFisicas(a)}
</section>
<section class="secao cartao">
<h3>Para quais áreas</h3>
${areas}
</section>
<section class="secao cartao">
<h3>Empresas e entidades que mais receberam</h3>
${listaEmpresas(a.topEmpresas)}
</section>
<section class="secao cartao">
<h3>Pontos de atenção</h3>
${aviso(esc(ATENCAO))}
<h4>Concentração</h4>
<p>As 10 empresas e entidades que mais receberam ficaram com <strong>${a.concentracao.percentual}%</strong> do que foi pago a empresas e entidades em ${ano} (${reais(a.concentracao.top10)} de ${reais(a.concentracao.totalEmpresas)}):</p>
${dezMaiores(a)}
<h4>Reservado e depois cancelado</h4>
<p>Empenhar é reservar o dinheiro para uma despesa; anular é cancelar essa reserva, por sobra, troca de contrato ou erro de lançamento. Em ${ano} foram anulados ${reais(a.anulado.total)}. Empresas e entidades com mais valor anulado:</p>
${listaEmpresas(a.anulado.top)}
</section>
</section>`;
}

export function chamadaGastos(g) {
  const anos = anosOrdenados(g);
  if (!anos.length) return '';
  const ano = anos[anos.length - 1];
  const a = g.anos[ano];
  return `<a class="cartao cartao-numero chamada-gastos" href="gastos.html"><span class="numero-rotulo">Raio-X dos gastos</span><span class="numero-grande">${reais(a.total)}</span><span class="numero-rotulo">pagos pela Prefeitura, Câmara e SAAE em ${ano} (${esc(periodo(a))}). Veja para quem e para quais áreas →</span></a>`;
}

export function paginaGastos(d) {
  const g = d.gastos;
  const anos = anosOrdenados(g);
  const seletor = `<div class="anos" role="group" aria-label="Escolher o ano">${anos.map((ano, i) => `<button type="button" class="chip" data-ano-botao="${ano}" aria-pressed="${i === anos.length - 1}">${ano}</button>`).join('')}</div>`;
  const ultimos = anos.map((ano) => `${ano}: ${esc(periodo(g.anos[ano]))}`).join('; ');
  const sic = anos.filter((ano) => g.anos[ano].areas).map((ano) => `${ano}: até ${NOMES_MES[g.anos[ano].areas.bimestre * 2 - 1]}`).join('; ') || 'nenhum';
  const corpo = `<h1>Raio-X dos gastos</h1>
${avisoTce(d, 'despesas')}
<p>Quanto a Prefeitura, a Câmara e o SAAE pagaram, para quais áreas e para quais empresas, ano a ano desde o início do mandato. Tudo sai do Tribunal de Contas do Estado (TCE-SP), que publica com cerca de um mês e meio de atraso, e do Tesouro Nacional.</p>
<nav class="sumario" aria-label="Nesta página"><a class="chip" href="#por-ano">Por ano</a><a class="chip" href="#novas">Ponto de atenção</a><a class="chip" href="#busca-empresas">Buscar empresa</a><a class="chip" href="#fontes-gastos">Fontes</a></nav>
<div id="por-ano">
${seletor}
${anos.map((ano) => blocoAno(ano, g.anos[ano])).join('\n')}
</div>
<section id="novas" class="secao cartao" aria-labelledby="t-novas">
<h2 id="t-novas">Ponto de atenção do mandato: novas com valor alto</h2>
${aviso(esc(ATENCAO))}
<p>Empresas e entidades que não receberam nada da cidade em 2024 e que, desde ${anos[0] || ''}, já receberam mais de ${reais(NOVA_LIMITE)}. Empresa nova pode ser fruto de licitação nova, troca de contrato ou mudança de CNPJ.</p>
${g.novas.length ? `<ol class="lista lista-empresas">${g.novas.map((e) => `<li><strong>${esc(e.nome)}</strong> <span class="nota">CNPJ <span class="cnpj">${esc(formatarCnpj(e.cnpj))}</span> · primeiro pagamento em ${esc(mesBR(e.primeiroMes))}</span><br><span class="valor-linha">${reais(e.total)}</span> ${link(linkTce(e.cnpj), 'ver no TCE-SP')}</li>`).join('')}</ol>` : '<p>Nenhuma.</p>'}
</section>
<section class="secao cartao" id="busca-empresas">
<h2>Busca por empresa</h2>
<p>Digite parte do nome ou o CNPJ (com ou sem pontos). Pessoas físicas não entram na busca.</p>
<label class="sr-only" for="busca-empresa">Nome ou CNPJ da empresa</label>
<input id="busca-empresa" class="busca" type="search" placeholder="Ex.: nome da empresa ou CNPJ" autocomplete="off">
<p id="contagem-empresa" class="nota" aria-live="polite"></p>
<div id="resultado-empresa"></div>
<noscript><p>A busca precisa de JavaScript. Sem ele, use a ${link(LINKS_CREDOR.tce, 'consulta do TCE-SP')}.</p></noscript>
</section>
<section id="fontes-gastos" class="secao">
<h2>De onde vêm os números</h2>
<ul>
<li>Pagamentos: API pública de despesas do TCE-SP, ${esc(TCE_DESPESAS)}/&lt;ano&gt;/&lt;mês&gt; (Prefeitura, Câmara e SAAE). Conta o evento "Valor Pago". Último mês publicado: ${esc(ultimos)}.</li>
<li>Por área: Tesouro Nacional (SICONFI), Relatório Resumido da Execução Orçamentária, Anexo 2, despesa liquidada por função (${esc(SICONFI_RREO)}). Último bimestre: ${esc(sic)}.</li>
<li>"Órgãos públicos, impostos e folha" junta quem recebe e tem no nome: ${esc(LISTA_PUBLICOS.join(', '))}, a não ser que o nome também tenha ${esc(LISTA_NAO_PUBLICOS.join(', '))}. O resto com CNPJ é "Empresas e entidades" (inclui MEI e organizações sociais).</li>
<li>Para conferir nomes de quem recebeu: ${link(LINKS_CREDOR.prefeitura, 'Portal da Transparência da Prefeitura')} e ${link(LINKS_CREDOR.tce, 'TCE-SP, Despesas por Fornecedor')}.</li>
</ul>
</section>`;
  return layout({ titulo: 'Raio-X dos gastos de Salto: Radar Saltense', descricao: 'Para onde vai o dinheiro da Prefeitura de Salto/SP: gastos por área e por mês e as empresas que mais receberam, com dados do TCE-SP.', caminho: 'gastos.html', corpo, atualizadoEm: d.meta.atualizadoEm });
}
