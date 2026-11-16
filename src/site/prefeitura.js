import { esc } from '../util/texto.js';
import { FAIXAS_IEGM, DIMENSOES_IEGM, MUNICIPIOS_IEGM } from '../regras/iegm.js';
import { layout, reais, numero, quandoBR, seloFonte, aviso, cartaoNumero } from './base.js';
import { cartaoCampanha } from './campanha.js';

export const URL_IEGM = 'https://iegm.tce.sp.gov.br/';
export const URL_OBRAS = 'https://paineldeobras.tce.sp.gov.br/';
export const URL_PNCP = 'https://pncp.gov.br/app/orgaos/46634507000106';

const NIVEL = { C: 1, 'C+': 2, B: 3, 'B+': 4, A: 5 };
const significado = (f) => (FAIXAS_IEGM[f] || '').toLowerCase();
const cnpjBR = (c) => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const pct = (v, total) => `${Math.round((v / total) * 1000) / 10}`.replace('.', ',');

// Linha de barra com um texto no lugar do número (faixa do IEGM) ou um número de contratações.
const linhaBarra = (rotulo, largura, num, destaque = false) =>
  `<li><span class="rotulo">${destaque ? `<strong>${esc(rotulo)}</strong>` : esc(rotulo)}</span><span class="trilho"><span class="barra" style="width:${largura.toFixed(1)}%"></span></span><span class="num">${num}</span></li>`;

const barraFaixa = (rotulo, f, destaque) => (NIVEL[f]
  ? linhaBarra(rotulo, (NIVEL[f] / 5) * 100, `<strong>${esc(f)}</strong> <small>${esc(significado(f))}</small>`, destaque)
  : `<li><span class="rotulo">${esc(rotulo)}</span><span class="trilho"><span class="vazio">sem nota</span></span><span class="num"></span></li>`);

function secaoNota(p) {
  if (!p.iegm) return '';
  const anos = Object.keys(p.iegm.anos).filter((a) => p.iegm.anos[a].Salto).sort();
  if (!anos.length) return '';
  const ult = anos[anos.length - 1];
  const s = p.iegm.anos[ult].Salto;
  const linhaTempo = anos.map((a) => barraFaixa(`ano-base ${a} · divulgado em ${Number(a) + 1}`, p.iegm.anos[a].Salto.iegm, a === ult)).join('');
  const areas = Object.entries(DIMENSOES_IEGM).filter(([k]) => k !== 'iegm').map(([k, nome]) => barraFaixa(nome, s[k])).join('');
  const cidades = ['Salto', ...MUNICIPIOS_IEGM.filter((m) => m !== 'Salto')].filter((m) => p.iegm.anos[ult][m]);
  const tabela = cidades.map((m) => {
    const f = p.iegm.anos[ult][m].iegm;
    return `<tr><td data-rotulo="Cidade">${m === 'Salto' ? '<strong>Salto</strong>' : esc(m)}</td><td data-rotulo="Nota geral">${f ? esc(f) : '—'}</td><td data-rotulo="O que significa">${esc(significado(f)) || '—'}</td></tr>`;
  }).join('');
  return `<section id="nota" class="secao cartao">
<h2>A nota do Tribunal de Contas</h2>
<p>O Tribunal de Contas do Estado (TCE-SP) dá uma nota à gestão de cada cidade, o IEG-M. A nota vai de C (baixo nível de adequação) até A (altamente efetiva).</p>
<div class="grade-numeros">
${cartaoNumero({ valor: s.iegm || '—', rotulo: `${s.iegm ? `${significado(s.iegm)}; ` : ''}ano-base ${ult}, divulgado em ${Number(ult) + 1}` })}
</div>
<h3>Ano a ano</h3>
<ul class="barras">${linhaTempo}</ul>
<h3>Por área, em ${ult}</h3>
<ul class="barras">${areas}</ul>
<h3>Salto e cidades vizinhas, em ${ult}</h3>
<table class="tabela-empilha"><thead><tr><th>Cidade</th><th>Nota geral</th><th>O que significa</th></tr></thead><tbody>${tabela}</tbody></table>
<p class="nota">O ano-base ${ult} é o IEG-M divulgado em ${Number(ult) + 1}. A nota mede a gestão em cada área a partir de questionários e dados enviados ao TCE.</p>
<p>${seloFonte(URL_IEGM, 'painel do IEG-M (TCE-SP)')}</p>
</section>`;
}

function secaoObras(p) {
  const o = p.obras;
  if (!o) return '';
  const paralisadas = o.obras.filter((x) => x.paralisada).length;
  const total = o.obras.reduce((s, x) => s + x.valor, 0);
  const linhas = o.obras.map((x) => `<tr><td data-rotulo="Obra">${esc(x.objeto)}${x.contratante ? `<br><small>${esc(x.contratante)}</small>` : ''}</td><td data-rotulo="Situação">${x.paralisada ? `<strong class="situacao-paralisada">${esc(x.situacao)}</strong>` : esc(x.situacao) || '—'}</td><td data-rotulo="Empresa">${esc(x.contratado)}${x.cnpj ? `<br><small>CNPJ ${cnpjBR(x.cnpj)}</small>` : ''}</td><td data-rotulo="Valor">${x.valor ? reais(x.valor) : '—'}</td><td data-rotulo="Ano">${x.ano || '—'}</td></tr>`).join('');
  return `<section id="obras" class="secao cartao">
<h2>Obras no painel do TCE-SP</h2>
<p>${numero(o.obras.length)} ${o.obras.length === 1 ? 'obra cadastrada' : 'obras cadastradas'}, somando <strong>${reais(total)}</strong>. ${paralisadas ? `${numero(paralisadas)} ${paralisadas === 1 ? 'está paralisada' : 'estão paralisadas'}` : 'Nenhuma está paralisada'}. Data-base do painel: ${esc(o.dataBase)}.</p>
<table class="tabela-empilha"><thead><tr><th>Obra</th><th>Situação</th><th>Empresa</th><th>Valor</th><th>Ano</th></tr></thead><tbody>${linhas}</tbody></table>
<p class="nota">Só aparecem obras que o órgão cadastrou no sistema do TCE. O painel não informa datas nem o quanto já foi feito.</p>
<p>${seloFonte(URL_OBRAS, 'Painel de Obras (TCE-SP)')}</p>
</section>`;
}

const barrasQuantidade = (pares, total) => `<ul class="barras">${pares.map(([rotulo, q]) => linhaBarra(rotulo, total > 0 ? (q / total) * 100 : 0, `${numero(q)} <small>(${pct(q, total)}%)</small>`)).join('')}</ul>`;

function blocoAno(ano, x) {
  const cd = x.contratacoes;
  const ct = x.contratos;
  const mods = Object.values(cd.porModalidade).sort((a, b) => b.quantidade - a.quantidade).map((m) => [m.nome, m.quantidade]);
  const top = ct.top.map((e) => `<tr><td data-rotulo="Empresa">${esc(e.nome)}<br><small>CNPJ ${cnpjBR(e.cnpj)}</small></td><td data-rotulo="Contratos">${numero(e.contratos)}</td><td data-rotulo="Valor">${reais(e.valor)}</td></tr>`).join('');
  return `<h3>Compras em ${ano}</h3>
<p>Em ${ano}, <strong>${cd.semDisputa.pctQuantidade}%</strong> das contratações (${numero(cd.semDisputa.quantidade)} de ${numero(cd.total.quantidade)}) foram por dispensa ou inexigibilidade, sem disputa entre empresas.</p>
<p class="nota">A lei permite comprar sem licitação em casos como valor baixo, emergência ou fornecedor único. Isto é um fato, não uma acusação.</p>
${barrasQuantidade(mods, cd.total.quantidade)}
<p class="nota">O PNCP não traz o valor final de ${numero(cd.semHomologado.quantidade)} das ${numero(cd.total.quantidade)} contratações; por isso aqui contamos quantas foram, não quanto custaram.</p>
<h3>Contratos assinados em ${ano}</h3>
<p><strong>${numero(ct.quantidade)}</strong> contratos, somando <strong>${reais(ct.valor)}</strong>.${ct.empenhos.quantidade ? ` Outros ${numero(ct.empenhos.quantidade)} registros são empenhos (${reais(ct.empenhos.valor)}) e ficam fora dessa soma.` : ''}</p>
${top ? `<h3>As 10 empresas com mais valor contratado em ${ano}</h3>
<table class="tabela-empilha"><thead><tr><th>Empresa</th><th>Contratos</th><th>Valor</th></tr></thead><tbody>${top}</tbody></table>
<p class="nota">Valor total dos contratos publicados no ano, que pode valer por mais de um ano. Só empresas com CNPJ aparecem pelo nome.</p>` : ''}
<p class="nota">Dados coletados em ${esc(quandoBR(x.coletadoEm))}.</p>`;
}

function secaoCompras(p) {
  const anos = Object.keys(p.contratos).sort().reverse();
  if (!anos.length) return '';
  const [recente, ...outros] = anos;
  return `<section id="compras" class="secao cartao">
<h2>Como a Prefeitura compra</h2>
<p>Toda compra ou contratação da Prefeitura vai para o Portal Nacional de Contratações Públicas (PNCP). Aqui estão as contratações, por modalidade, e as empresas com contratos assinados.</p>
${blocoAno(recente, p.contratos[recente])}
${outros.map((a) => `<details><summary>Compras em ${a}</summary>${blocoAno(a, p.contratos[a])}</details>`).join('\n')}
<p>${seloFonte(URL_PNCP, 'PNCP, página da Prefeitura')}</p>
</section>`;
}

function atalhos(d, p) {
  const c = [];
  if (p.iegm) {
    const anos = Object.keys(p.iegm.anos).filter((a) => p.iegm.anos[a].Salto).sort();
    const ult = anos[anos.length - 1];
    const f = ult && p.iegm.anos[ult].Salto.iegm;
    if (f) c.push(cartaoNumero({ valor: f, rotulo: `nota do TCE à gestão (ano-base ${ult})`, href: '#nota' }));
  }
  if (p.obras) {
    const par = p.obras.obras.filter((x) => x.paralisada).length;
    c.push(cartaoNumero({ valor: numero(p.obras.obras.length), rotulo: `obras no painel do TCE${par ? ` (${numero(par)} ${par === 1 ? 'paralisada' : 'paralisadas'})` : ''}`, href: '#obras' }));
  }
  const anosC = Object.keys(p.contratos).sort();
  if (anosC.length) {
    const a = anosC[anosC.length - 1];
    c.push(cartaoNumero({ valor: numero(p.contratos[a].contratacoes.total.quantidade), rotulo: `contratações em ${a}`, href: '#compras' }));
  }
  if (p.campanhaPrefeito) c.push(cartaoNumero({ valor: reais(p.campanhaPrefeito.total), rotulo: 'de campanha do prefeito em 2024', href: '#campanha' }));
  if (d.gastos) {
    const ano = Object.keys(d.gastos.anos).sort().pop();
    c.push(cartaoNumero({ valor: reais(d.gastos.anos[ano].total), rotulo: `pagos em ${ano} (Raio-X dos gastos)`, href: 'gastos.html' }));
  }
  if (d.receitas) c.push(cartaoNumero({ valor: reais(d.receitas.oficialAno), rotulo: `de impostos da cidade em ${d.receitas.anoAtual} (Impostômetro)`, href: 'impostometro.html' }));
  return c.length ? `<section class="secao"><div class="grade-numeros">\n${c.join('\n')}\n</div></section>` : '';
}

export function paginaPrefeitura(d) {
  const p = d.prefeitura || { iegm: null, obras: null, contratos: {}, campanhaPrefeito: null };
  const vazio = !p.iegm && !p.obras && !Object.keys(p.contratos).length
    ? aviso('Os dados da Prefeitura ainda não foram coletados.')
    : '';
  const corpo = `<h1>A Prefeitura de Salto</h1>
<p>A nota que o Tribunal de Contas dá à gestão, as obras, como a Prefeitura compra e de onde veio o dinheiro da campanha do prefeito.</p>
${vazio}
${atalhos(d, p)}
${secaoNota(p)}
${secaoObras(p)}
${secaoCompras(p)}
${p.campanhaPrefeito ? `<div id="campanha">${cartaoCampanha(p.campanhaPrefeito, { titulo: 'Campanha do prefeito em 2024', sujeito: `${p.campanhaPrefeito.nome} recebeu` })}</div>` : ''}`;
  return layout({ titulo: 'A Prefeitura de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
