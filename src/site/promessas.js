import { esc } from '../util/texto.js';
import { STATUS_PROMESSA } from '../regras/promessas.js';
import { layout, numero, link, seloFonte, aviso, barraProporcao } from './base.js';
import { idPromessa, tituloCurto } from './obras.js';

export const FRASE_PROMESSAS = "Plano registrado no TSE em 2024. O status é atualizado à mão, sempre com prova oficial; 'sem informação' quer dizer que ainda não achamos prova, não que a promessa foi esquecida.";
const CLASSE = { 'sem informação': 'p-sem', 'em andamento': 'p-andamento', cumprida: 'p-cumprida' };
const ROTULO = { 'sem informação': 'Sem informação', 'em andamento': 'Em andamento', cumprida: 'Cumpridas' };

const barraStatus = (porStatus) => barraProporcao(STATUS_PROMESSA.map((s) => ({ rotulo: ROTULO[s], valor: porStatus[s] || 0, classe: CLASSE[s] })));

// Frase curta sobre o andamento geral.
function fraseStatus(r) {
  const c = r.porStatus.cumprida || 0;
  const a = r.porStatus['em andamento'] || 0;
  if (!c && !a) return 'Por enquanto, nenhuma tem prova oficial de andamento ou de cumprimento.';
  const partes = [];
  if (c) partes.push(`${numero(c)} ${c === 1 ? 'cumprida' : 'cumpridas'}`);
  if (a) partes.push(`${numero(a)} em andamento`);
  return `Com prova oficial: ${partes.join(' e ')}.`;
}

// `obras`: obras da página obras.html ligadas à mão a esta promessa (data/referencia/obras-ligacoes.json).
const itemPromessa = (it, obras = []) => {
  const status = it.status && it.status !== 'sem informação' ? ` <strong class="status-promessa">${esc(it.status)}</strong>` : '';
  const provas = (it.provas || []).filter((p) => p && p.url).map((p) => link(p.url, esc(p.titulo || 'prova oficial'))).join(' · ');
  const ligadas = obras.map((o) => `<a href="obras.html#${esc(o.id)}">${esc(tituloCurto(o))}</a>`).join(' · ');
  return `<li id="${esc(idPromessa(it.numero))}"><span class="tag">${esc(it.numero)}</span> ${esc(it.texto)}${status}${provas ? `<br><span class="nota">Prova: ${provas}</span>` : ''}${ligadas ? `<br><span class="nota">Obras ligadas: ${ligadas}</span>` : ''}</li>`;
};

// Itens na ordem do arquivo (os números, como "16.5-b", são identificadores e não são reordenados).
// O campo opcional `grupo` vira subtítulo dentro da área.
function itensDaArea(itens, obrasPorPromessa = new Map()) {
  const blocos = [];
  for (const it of itens) {
    const g = it.grupo || '';
    if (!blocos.length || blocos[blocos.length - 1].grupo !== g) blocos.push({ grupo: g, itens: [] });
    blocos[blocos.length - 1].itens.push(it);
  }
  return blocos.map((b) => `${b.grupo ? `<h3>${esc(b.grupo)}</h3>` : ''}<ul class="lista">${b.itens.map((it) => itemPromessa(it, obrasPorPromessa.get(String(it.numero)))).join('')}</ul>`).join('');
}

// Cartão de entrada na página da Prefeitura.
export function cartaoPromessas(d) {
  const p = d.promessas;
  if (!p) return '';
  const r = p.resumo;
  return `<section id="promessas" class="secao cartao">
<h2>Promessas do plano de governo</h2>
<p>${numero(r.total)} promessas em ${numero(p.areas.length)} áreas, no plano de governo do prefeito registrado no TSE em 2024. ${esc(fraseStatus(r))}</p>
${barraStatus(r.porStatus)}
<p><a class="botao" href="promessas.html">Ver as promessas</a></p>
</section>`;
}

export function paginaPromessas(d) {
  const p = d.promessas;
  const r = p.resumo;
  const prefeito = d.prefeitura && d.prefeitura.campanhaPrefeito;
  const obrasPorPromessa = new Map();
  for (const o of (d.obras && d.obras.lista) || []) {
    for (const n of o.promessas) obrasPorPromessa.set(n, [...(obrasPorPromessa.get(n) || []), o]);
  }
  const areas = p.areas.map((a, i) => {
    const x = r.porArea[i];
    const feitas = (x.porStatus.cumprida || 0) + (x.porStatus['em andamento'] || 0);
    return `<details><summary>${esc(a.area)} <span class="num">${numero(a.itens.length)}${feitas ? ` · ${numero(feitas)} com prova` : ''}</span></summary>${itensDaArea(a.itens, obrasPorPromessa)}</details>`;
  }).join('\n');
  const corpo = `<h1>Promessas do prefeito</h1>
<p>${esc(p.titulo || 'Plano de governo 2025–2028')}. São ${numero(r.total)} promessas em ${numero(p.areas.length)} áreas, com o texto e a numeração do plano.</p>
${aviso(esc(FRASE_PROMESSAS))}
<section class="secao cartao">
<h2>Como estão</h2>
<p>${esc(fraseStatus(r))}</p>
${barraStatus(r.porStatus)}
</section>
<section class="secao">
<h2>Por área</h2>
${areas}
</section>
<section class="secao cartao">
<h2>De onde vem</h2>
<p>O plano é o PDF que a chapa registrou no Tribunal Superior Eleitoral (TSE) na eleição de 2024. Itens gerais, como "incentivar" ou "aprimorar", ficam como estão no plano; o site não julga.</p>
<p>${prefeito && prefeito.link ? `${seloFonte(prefeito.link, 'candidatura no DivulgaCandContas (TSE), com o plano em PDF')} ` : ''}${seloFonte(p.fonte, 'dados abertos do TSE (arquivo zip)')}</p>
${p.pdf ? `<p class="nota">No arquivo zip do TSE, o plano é o arquivo ${esc(p.pdf)}.</p>` : ''}
</section>`;
  return layout({ titulo: 'Promessas do prefeito de Salto: Radar Saltense', descricao: 'As promessas do plano de governo do prefeito de Salto/SP, área por área, com o texto do plano registrado no TSE e o que já tem prova oficial.', caminho: 'promessas.html', corpo, atualizadoEm: d.meta.atualizadoEm });
}
