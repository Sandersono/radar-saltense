import { esc } from '../util/texto.js';
import { reaisCentavos, numero, dataBR, seloFonte, aviso, barraProporcao, cartaoNumero } from './base.js';

export const URL_EMENDAS = 'https://www.camarasalto.sp.gov.br/orcamento-publico/emendas-impositivas';
export const FRASE_EMENDAS = 'Emenda não executada ou devolvida pode ter motivo técnico ou legal; isto é um fato, não uma acusação.';
export const TITULO_2025 = 'Emendas da legislatura anterior (orçamento aprovado em 2024)';

const r2 = (n) => Math.round(n * 100) / 100;
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
// "ANTÔNIO CORDEIRO DOS SANTOS" -> "Antônio Cordeiro dos Santos"
export const nomeProprio = (s) => String(s).toLocaleLowerCase('pt-BR').split(/\s+/)
  .map((p, i) => (i && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1))).join(' ');

// Situações de 2025 em quatro grupos (iniciada e em execução juntas).
const GRUPO_SITUACAO = { 'CONCLUÍDA': 'concluida', 'EM EXECUÇÃO': 'andamento', INICIADA: 'andamento', 'NÃO EXECUTADA': 'nao', DEVOLVIDA: 'devolvida' };
const ROTULO_GRUPO = { concluida: 'Concluídas', andamento: 'Em andamento', nao: 'Não executadas', devolvida: 'Devolvidas' };
const contarGrupos = (situacoes) => {
  const c = { concluida: 0, andamento: 0, nao: 0, devolvida: 0 };
  for (const [s, n] of Object.entries(situacoes || {})) if (GRUPO_SITUACAO[s]) c[GRUPO_SITUACAO[s]] += n;
  return c;
};
const frasesGrupos = (c) => {
  const nomes = { concluida: ['concluída', 'concluídas'], andamento: ['em andamento', 'em andamento'], nao: ['não executada', 'não executadas'], devolvida: ['devolvida', 'devolvidas'] };
  return Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${numero(n)} ${nomes[k][n === 1 ? 0 : 1]}`).join(', ');
};

// Soma de 2026 por tipo de bloco ("livre" e "saude").
function blocos2026(lista) {
  const b = { livre: 0, saude: 0 };
  for (const e of lista) b[e.tipo === 'saude' ? 'saude' : 'livre'] += e.valor || 0;
  return { livre: r2(b.livre), saude: r2(b.saude), total: r2(b.livre + b.saude) };
}

const item2026 = (e) => {
  const titulo = e.entidade || e.projeto || 'Entidade não informada no PDF';
  const sub = e.entidade && e.projeto ? `: ${esc(e.projeto)}` : '';
  const valor = typeof e.valor === 'number' ? reaisCentavos(e.valor) : 'valor não informado';
  return `<li><strong>${valor}</strong> <span class="tag">${e.tipo === 'saude' ? 'saúde' : 'livre'}</span> ${esc(titulo)}${sub}${e.secretaria ? `<br><span class="nota">${esc(e.secretaria)}</span>` : ''}</li>`;
};

const item2025 = (e) => {
  const titulo = e.entidade || e.objeto || 'Entidade não informada no PDF';
  const naoExecutada = e.valor === null || e.valor === undefined;
  const valor = naoExecutada ? '<strong>não executada</strong>' : `<strong>${reaisCentavos(e.valor)}</strong>`;
  const situacao = !naoExecutada && e.situacao ? ` <span class="tag">${esc(e.situacao.toLocaleLowerCase('pt-BR'))}</span>` : '';
  const detalhe = [e.secretaria ? esc(e.secretaria) : '', naoExecutada ? '' : `pago: ${reaisCentavos(e.pago || 0)}`].filter(Boolean).join(' · ');
  return `<li>${valor}${situacao} ${esc(titulo)}${detalhe ? `<br><span class="nota">${detalhe}</span>` : ''}</li>`;
};

// Cartão "Emendas ao orçamento" na página do vereador. 2025 só aparece para quem é autor (vereador também na legislatura anterior).
export function cartaoEmendas(v, d) {
  const e = d.emendas;
  if (!e) return '';
  const a26 = e['2026'];
  const a25 = e['2025'];
  const de26 = ((a26 && a26.emendas) || []).filter((x) => x.vereador === v.id);
  const de25 = ((a25 && a25.emendas) || []).filter((x) => x.vereador === v.id);
  if (!de26.length && !de25.length) return '';
  const partes = [];
  if (de26.length) {
    const b = blocos2026(de26);
    partes.push(`<h3>2026: o que indicou</h3>
<p>Indicou <strong>${reaisCentavos(b.total)}</strong> em ${numero(de26.length)} ${de26.length === 1 ? 'emenda' : 'emendas'}: ${reaisCentavos(b.livre)} de uso livre e ${reaisCentavos(b.saude)} para a saúde.</p>
<details><summary>Ver as ${numero(de26.length)} emendas de 2026</summary><ul class="lista">${de26.map(item2026).join('')}</ul></details>
<p class="nota">Valores planejados, da tabela da Câmara de ${dataBR(a26.atualizadoEm)}. A execução de 2026 ainda não entra aqui.</p>
<p>${seloFonte(a26.fonte, 'tabela de 2026 (PDF da Câmara)')}</p>`);
  }
  if (de25.length) {
    const x = a25.resumo.porVereador[v.id];
    const grupos = contarGrupos(x.situacoes);
    partes.push(`<h3>${TITULO_2025}</h3>
<p>Na legislatura anterior, indicou ${numero(de25.length)} ${de25.length === 1 ? 'emenda' : 'emendas'} para 2025, somando <strong>${reaisCentavos(x.total)}</strong>. Até ${dataBR(a25.atualizadoEm)}, foram pagos <strong>${reaisCentavos(x.pago)}</strong>.</p>
${frasesGrupos(grupos) ? `<p>Situação: ${esc(frasesGrupos(grupos))}.</p>` : ''}
<details><summary>Ver as ${numero(de25.length)} emendas de 2025</summary><ul class="lista">${de25.map(item2025).join('')}</ul></details>
${grupos.nao || grupos.devolvida ? aviso(FRASE_EMENDAS) : ''}
<p>${seloFonte(a25.fonte, 'relatório do 4º trimestre de 2025 (PDF da Câmara)')}</p>`);
  }
  return `<section id="emendas" class="secao cartao">
<h2>Emendas ao orçamento</h2>
<p>Emenda impositiva é a parte do orçamento da Prefeitura que cada vereador indica para onde vai: uma entidade, um projeto ou uma secretaria.</p>
${partes.join('\n')}
</section>`;
}

// Valor mais comum dos blocos de 2026 (em geral, o mesmo para todos os vereadores).
function blocoMaisComum(lista) {
  const somas = new Map();
  for (const e of lista) {
    const k = `${e.vereador}|${e.tipo === 'saude' ? 'saude' : 'livre'}`;
    somas.set(k, r2((somas.get(k) || 0) + (e.valor || 0)));
  }
  const freq = new Map();
  for (const s of somas.values()) freq.set(s, (freq.get(s) || 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Seção "Emendas ao orçamento" da página da Câmara.
export function secaoEmendas(d) {
  const e = d.emendas;
  if (!e) return '';
  const a26 = e['2026'];
  const a25 = e['2025'];
  const nomeAtual = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const partes = [];
  if (a26 && a26.emendas.length) {
    const linhas = d.vereadores.map((v) => ({ v, l: a26.emendas.filter((x) => x.vereador === v.id) })).filter(({ l }) => l.length).map(({ v, l }) => {
      const b = blocos2026(l);
      return `<tr><td data-rotulo="Vereador"><a href="vereador/${esc(v.id)}.html#emendas">${esc(v.nome)}</a></td><td data-rotulo="Uso livre">${reaisCentavos(b.livre)}</td><td data-rotulo="Saúde">${reaisCentavos(b.saude)}</td><td data-rotulo="Total">${reaisCentavos(b.total)}</td><td data-rotulo="Emendas">${numero(l.length)}</td></tr>`;
    }).join('');
    const comum = blocoMaisComum(a26.emendas);
    const ajustes = (a26.ajustes || []).length;
    partes.push(`<h3>2026: o que cada vereador indicou</h3>
<p>Cada vereador indica dois blocos: um de uso livre e um para a saúde${comum ? `, em geral de ${reaisCentavos(comum)} cada (${reaisCentavos(r2(comum * 2))} por vereador)` : ''}.</p>
<table class="tabela-empilha"><thead><tr><th>Vereador</th><th>Uso livre</th><th>Saúde</th><th>Total</th><th>Emendas</th></tr></thead><tbody>${linhas}</tbody></table>
<p class="nota">Valores planejados, como estão na tabela da Câmara de ${dataBR(a26.atualizadoEm)}. A execução de 2026 ainda não entra aqui.${ajustes ? ` Em ${numero(ajustes)} ${ajustes === 1 ? 'valor' : 'valores'} o texto do PDF veio sem os centavos; o site completou pelo total impresso do bloco.` : ''}</p>
<p>${seloFonte(a26.fonte, 'tabela de 2026 (PDF da Câmara)')}</p>`);
  }
  if (a25 && a25.emendas.length) {
    const res = a25.resumo;
    const anteriores = e.anteriores || {};
    const nome = (id) => (nomeAtual[id] ? `<a href="vereador/${esc(id)}.html#emendas">${esc(nomeAtual[id])}</a>` : esc(anteriores[id] ? nomeProprio(anteriores[id]) : id));
    const ordem = Object.keys(res.porVereador).sort((a, b) => (nomeAtual[a] || nomeProprio(anteriores[a] || a)).localeCompare(nomeAtual[b] || nomeProprio(anteriores[b] || b), 'pt-BR'));
    const linhas = ordem.map((id) => {
      const x = res.porVereador[id];
      const g = contarGrupos(x.situacoes);
      return `<tr><td data-rotulo="Vereador">${nome(id)}</td><td data-rotulo="Indicado">${reaisCentavos(x.total)}</td><td data-rotulo="Pago">${reaisCentavos(x.pago)}</td>${Object.keys(ROTULO_GRUPO).map((k) => `<td data-rotulo="${ROTULO_GRUPO[k]}">${numero(g[k])}</td>`).join('')}</tr>`;
    }).join('');
    const g = contarGrupos(res.situacoes);
    partes.push(`<h3>${TITULO_2025}</h3>
<p>As emendas executadas em 2025 foram indicadas pelos vereadores da legislatura anterior, no orçamento aprovado em 2024. Situação em ${dataBR(a25.atualizadoEm)}, segundo o relatório da Câmara.</p>
<div class="grade-numeros">
${cartaoNumero({ valor: reaisCentavos(res.total), rotulo: `indicados em ${numero(a25.emendas.filter((x) => typeof x.valor === 'number').length)} emendas com valor (de ${numero(a25.emendas.length)})` })}
${cartaoNumero({ valor: reaisCentavos(res.pago), rotulo: `pagos até ${dataBR(a25.atualizadoEm)}` })}
</div>
${barraProporcao(Object.keys(ROTULO_GRUPO).map((k) => ({ rotulo: ROTULO_GRUPO[k], valor: g[k], classe: `s-${k}` })))}
<table class="tabela-empilha"><thead><tr><th>Vereador</th><th>Indicado</th><th>Pago</th>${Object.values(ROTULO_GRUPO).map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>
${aviso(FRASE_EMENDAS)}
<p class="nota">"Em andamento" junta as emendas iniciadas e as em execução. Emenda não executada não tem valor no relatório e fica fora das somas. Os nomes com link são de vereadores que também estão na Câmara agora.</p>
<p>${seloFonte(a25.fonte, 'relatório do 4º trimestre de 2025 (PDF da Câmara)')}</p>`);
  }
  if (!partes.length) return '';
  return `<section id="emendas" class="secao cartao">
<h2>Emendas ao orçamento</h2>
<p>Emenda impositiva é a parte do orçamento da Prefeitura que cada vereador indica para onde vai: uma entidade, um projeto ou uma secretaria.</p>
${partes.join('\n')}
<p>${seloFonte(URL_EMENDAS, 'emendas impositivas no site da Câmara')}</p>
</section>`;
}

// Total planejado de 2026 (para o cartão de número da Câmara).
export const total2026 = (d) => (d.emendas && d.emendas['2026'] ? d.emendas['2026'].resumo.total : null);
