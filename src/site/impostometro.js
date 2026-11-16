import { POPULACAO } from '../config.js';
import { esc } from '../util/texto.js';
import { GRUPOS_RECEITA, TIPOS_IMPOSTO } from '../regras/receitas.js';
import { layout, dataBR, reais, reaisCentavos, seloFonte, aviso } from './base.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);

// Contador: o HTML traz o valor OFICIAL (sem JavaScript, nada é estimado); busca.js troca pelo valor correndo.
export function blocoContador(r, prefixo, grande) {
  const ritmo = `estimativa pelo ritmo dos últimos ${r.mesesRitmo} meses publicados`;
  const oficialAte = r.temOficialAno
    ? `Oficial até ${dataBR(r.fimOficial)}: ${reaisCentavos(r.oficialAno)} · daqui em diante é ${ritmo}.`
    : `Ainda não há mês oficial de ${r.anoAtual}: todo o valor é ${ritmo}.`;
  return `<div class="contador-impostos${grande ? ' grande' : ''}" data-oficial="${r.oficialAno}" data-ritmo="${r.ritmoDiario}" data-inicio="${instanteBR(r.inicioEstimativa)}" data-fim="${instanteBR(`${r.anoAtual + 1}-01-01`)}" data-populacao="${POPULACAO.valor}">
<p class="rotulo">Impostos e taxas pagos à cidade em ${r.anoAtual}</p>
<p class="valor" aria-live="off">${reaisCentavos(r.oficialAno)}</p>
<p class="nota">(parte oficial + estimativa)</p>
<p class="por-morador">Dividido pelos ${POPULACAO.valor.toLocaleString('pt-BR')} moradores: <strong>${reaisCentavos(r.oficialAno / POPULACAO.valor)}</strong> por pessoa</p>
<p class="nota">${esc(oficialAte)}</p>
<p>${seloFonte('https://transparencia.tce.sp.gov.br/', 'fonte: TCE-SP')}</p>
${grande ? '' : `<p><a class="botao" href="${prefixo}impostometro.html">De onde vem o dinheiro de Salto →</a></p>`}
</div>`;
}

export const barras = (pares, total) => `<ul class="barras">${pares.map(([rotulo, v]) => `<li><span class="rotulo">${esc(rotulo)}</span><span class="trilho"><span class="barra" style="width:${total > 0 ? Math.max(0, (v / total) * 100).toFixed(1) : 0}%"></span></span><span class="num">${reais(v)}${total > 0 ? ` <small>(${((v / total) * 100).toFixed(1).replace('.', ',')}%)</small>` : ''}</span></li>`).join('')}</ul>`;

export function paginaImpostometro(d) {
  const r = d.receitas;
  const tipos = Object.entries(r.tiposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_IMPOSTO[k] || k, v]);
  const totalTipos = tipos.reduce((s, [, v]) => s + v, 0);
  const grupos = Object.entries(r.gruposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [GRUPOS_RECEITA[k] || k, v]);
  const totalGrupos = grupos.reduce((s, [, v]) => s + v, 0);
  const anoAnt = r.anoAnterior;
  const serieAtual = r.serie[r.anoAtual];
  const serieAnt = r.serie[anoAnt.ano];
  const maiorMes = Math.max(1, ...serieAtual.filter((v) => v !== null), ...serieAnt.filter((v) => v !== null));
  const linhaMes = (ano, v) => v === null
    ? `<span class="trilho"><span class="vazio">ainda não publicado</span></span><span class="num"></span>`
    : `<span class="trilho"><span class="barra${ano === r.anoAtual ? '' : ' anterior'}" style="width:${((v / maiorMes) * 100).toFixed(1)}%"></span></span><span class="num">${reais(v)}</span>`;
  const meses = MESES.map((nome, i) => `<li><span class="rotulo">${nome}</span><div class="par"><div><span>${anoAnt.ano}</span>${linhaMes(anoAnt.ano, serieAnt[i])}</div><div><span>${r.anoAtual}</span>${linhaMes(r.anoAtual, serieAtual[i])}</div></div></li>`).join('');
  const ultimoIdx = serieAnt.reduce((acc, v, i) => (v === null ? acc : i), -1);
  const fechamento = anoAnt.fechado
    ? `${anoAnt.ano} fechado em ${reais(anoAnt.total)} (oficial).`
    : ultimoIdx < 0
      ? `${anoAnt.ano}: nenhum mês publicado.`
      : `${anoAnt.ano}: ${reais(anoAnt.total)} oficial até ${NOMES_MES[ultimoIdx]}.`;
  const avisoPainel = r.anoPainel !== r.anoAtual ? aviso(`Ainda não há mês oficial de ${r.anoAtual}; os quadros abaixo mostram ${r.anoPainel}.`) : '';

  const corpo = `<h1>Impostômetro de Salto</h1>
${blocoContador(r, '', true)}
<p>A parte oficial é o que a Prefeitura registrou no Tribunal de Contas do Estado (TCE-SP), que publica os números com cerca de um mês e meio de atraso. Depois do último mês oficial, o contador sobe no ritmo médio dos últimos ${r.mesesRitmo} meses publicados: é uma estimativa e se corrige sozinha quando sai um mês novo.</p>
${aviso(esc(fechamento))}
${avisoPainel}
<section class="secao cartao">
<h2>Os impostos da cidade em ${r.anoPainel}</h2>
<p>Impostos e taxas que o morador e as empresas pagam direto à Prefeitura. O Imposto de Renda retido é o que a Prefeitura desconta dos salários e de outros pagamentos que faz e, por lei, fica com a cidade.</p>
${barras(tipos, totalTipos)}
</section>
<section class="secao cartao">
<h2>Mês a mês</h2>
<ul class="meses">${meses}</ul>
</section>
<section class="secao cartao">
<h2>De onde vem o dinheiro de Salto</h2>
<p>Toda a arrecadação oficial de ${r.anoPainel}, até o último mês publicado. Os repasses do Estado e da União vêm, em boa parte, de impostos que eles arrecadam (como ICMS, IPVA e Imposto de Renda) e dividem com as cidades por regras da lei.</p>
${barras(grupos, totalGrupos)}
<p class="nota">Ficaram fora do total ${reais(r.foraPainel)} que só passaram de um órgão público da cidade para outro (receitas intraorçamentárias), para não contar o mesmo dinheiro duas vezes.</p>
</section>
<section id="fontes-impostometro" class="secao">
<h2>De onde vêm os números</h2>
<ul>
<li><a href="https://transparencia.tce.sp.gov.br/">Portal da Transparência Municipal do TCE-SP</a>, receitas de Salto mês a mês. Os dados vêm da API pública https://transparencia.tce.sp.gov.br/api/json/receitas/salto/&lt;ano&gt;/&lt;mês&gt;. Último mês oficial: ${r.ultimoMesOficial ? esc(r.ultimoMesOficial.split('-').reverse().join('/')) : 'nenhum'}.</li>
<li>População: ${POPULACAO.valor.toLocaleString('pt-BR')} habitantes. Fonte: ${esc(POPULACAO.fonte)}.</li>
<li>Tipos de imposto: IPTU e ITBI (códigos 1112), Imposto de Renda retido (1113), ISS (1114) e Taxas (112).</li>
<li>Grupos: impostos da cidade (códigos 111 e 112), repasses do Estado (172 e 242), repasses da União (171 e 241), FUNDEB (175), empréstimos (21), água e esgoto (tudo o que entra no SAAE) e outras receitas (o resto).</li>
</ul>
</section>`;
  return layout({ titulo: 'Impostômetro de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
