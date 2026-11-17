import { esc } from '../util/texto.js';
import { amostraBoa } from '../regras/respostas.js';
import { ORIGENS_CAMPANHA } from '../regras/campanha.js';
import { GRUPOS_FOLHA } from '../regras/folha.js';
import { layout, reais, reaisCentavos, numero, link, seloFonte, aviso, cartaoNumero, sumario } from './base.js';
import { barras, NOMES_MES } from './impostometro.js';
import { secaoEmendas, total2026 } from './emendas.js';

export const URL_RH_CAMARA = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=839:8';
export const URL_VIAGENS = 'https://www.camarasalto.sp.gov.br/contas-publicas/category/619-despesas-viagens-vereadores-servidores';
export const URL_PROPOSITURAS = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92';

export const mesAno = (aaaamm) => {
  const [a, m] = aaaamm.split('-').map(Number);
  return `${NOMES_MES[m - 1]} de ${a}`;
};
export const totalMes = (r) => Object.values(r.grupos).reduce((s, g) => s + g.total, 0);
export const origemMaior = (c) => {
  const [k, v] = Object.entries(c.origens).sort((a, b) => b[1] - a[1])[0] || [];
  return v > 0 ? { nome: ORIGENS_CAMPANHA[k], valor: v } : null;
};

function secaoFolha(d) {
  const f = d.camara.folha;
  if (!f.ultimoMes) return '';
  const completos = Object.keys(f.meses).filter((m) => !f.meses[m].parcial);
  const ult = f.meses[f.ultimoMes];
  const total = totalMes(ult);
  const grupos = Object.entries(GRUPOS_FOLHA).map(([k, nome]) => [`${nome} (${ult.grupos[k].pessoas})`, ult.grupos[k].total]);
  const salarios = Object.values(ult.porVereador);
  const piso = Math.min(...salarios);
  const teto = Math.max(...salarios);
  const frase = salarios.length
    ? `Salário de vereador: ${reais(piso)}${teto > piso ? ` (presidente: ${reais(teto)})` : ''} por mês, antes dos descontos.`
    : '';
  const anoUlt = f.ultimoMes.slice(0, 4);
  const doAno = completos.filter((m) => m.startsWith(anoUlt));
  const somaAno = doAno.reduce((s, m) => s + totalMes(f.meses[m]), 0);
  const somaTudo = completos.reduce((s, m) => s + totalMes(f.meses[m]), 0);

  // Série mês a mês, de janeiro de 2025 até o mês da atualização.
  const atual = d.meta.atualizadoEm ? new Date(d.meta.atualizadoEm).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7) : f.ultimoMes;
  const primeiro = Object.keys(f.meses)[0];
  const fim = atual > f.ultimoMes ? atual : f.ultimoMes;
  const maior = Math.max(1, ...completos.map((m) => totalMes(f.meses[m])));
  const linhas = [];
  for (let [a, m] = primeiro.split('-').map(Number); `${a}-${String(m).padStart(2, '0')}` <= fim; m === 12 ? (a++, m = 1) : m++) {
    const k = `${a}-${String(m).padStart(2, '0')}`;
    const r = f.meses[k];
    const rotulo = `${NOMES_MES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
    let miolo;
    if (!r) miolo = `<span class="trilho"><span class="vazio">${k === fim && k > f.ultimoMes ? 'ainda não publicado' : 'não publicado'}</span></span><span class="num"></span>`;
    else if (r.parcial) miolo = `<span class="trilho"><span class="vazio">dados incompletos no portal</span></span><span class="num"></span>`;
    else miolo = `<span class="trilho"><span class="barra" style="width:${((totalMes(r) / maior) * 100).toFixed(1)}%"></span></span><span class="num">${reais(totalMes(r))}</span>`;
    linhas.push(`<li><span class="rotulo">${rotulo}</span>${miolo}</li>`);
  }
  return `<section id="custo" class="secao cartao">
<h2>Quanto custa a Câmara</h2>
<div class="grade-numeros">
${cartaoNumero({ valor: reais(total), rotulo: `de folha em ${mesAno(f.ultimoMes)}, antes dos descontos` })}
${cartaoNumero({ valor: reais(somaAno), rotulo: `somados em ${anoUlt} (${doAno.length} ${doAno.length === 1 ? 'mês publicado' : 'meses publicados'})` })}
</div>
<p>Desde janeiro de 2025, a folha publicada soma <strong>${reais(somaTudo)}</strong> (${completos.length} meses).</p>
${barras(grupos, total)}
${frase ? `<p>${esc(frase)}</p>` : ''}
${aviso('Cada vereador tem 1 assessor parlamentar. O portal não diz qual assessor é de qual vereador.')}
<details><summary>Mês a mês</summary><ul class="barras">${linhas.join('')}</ul></details>
<p class="nota">Valor bruto: o que a Câmara paga antes dos descontos. Meses que o portal não publicou, ou publicou incompletos, ficam de fora das somas.</p>
<p>${seloFonte(URL_RH_CAMARA, 'folha no portal da Câmara')} ${seloFonte(URL_VIAGENS, 'diárias e viagens (PDFs)')}</p>
</section>`;
}

function secaoRespostas(d) {
  const r = d.camara.respostas;
  const g = r.geral;
  if (!g.feitos) return '';
  const linhas = d.vereadores.map((v) => ({ v, x: r.porVereador[v.id] })).filter(({ x }) => x)
    .map(({ v, x }) => `<tr><td data-rotulo="Vereador"><a href="vereador/${esc(v.id)}.html">${esc(v.nome)}</a></td><td data-rotulo="Feitos">${numero(x.feitos)}</td><td data-rotulo="Conferidos">${numero(x.conferidos)}</td><td data-rotulo="Respondidos">${numero(x.respondidos)}</td><td data-rotulo="%">${amostraBoa(x) ? `${x.percentual}%` : '—'}</td><td data-rotulo="Tempo típico">${amostraBoa(x) && x.medianaDias !== null ? `${x.medianaDias} dias` : '—'}</td></tr>`).join('');
  return `<section id="respostas" class="secao cartao">
<h2>Requerimentos respondidos</h2>
<p>Requerimento é uma pergunta ou cobrança do vereador à Prefeitura. Aqui contamos quantos tiveram resposta anexada no portal da Câmara.</p>
${amostraBoa(g) ? `<div class="grade-numeros">
${cartaoNumero({ valor: `${g.percentual}%`, rotulo: `respondidos (${numero(g.respondidos)} de ${numero(g.conferidos)} conferidos)` })}
${cartaoNumero({ valor: g.medianaDias === null ? '—' : `${g.medianaDias} dias`, rotulo: 'tempo típico até a resposta' })}
</div>` : `<p>${numero(g.conferidos)} de ${numero(g.feitos)} conferidos até agora; o percentual aparece quando o robô terminar de conferir.</p>`}
${amostraBoa(g) && r.pendentes > 0 ? aviso(`Ainda faltam conferir ${numero(r.pendentes)} de ${numero(g.feitos)} requerimentos. Eles ficam de fora da conta até o robô conferir.`) : ''}
<table class="tabela-empilha"><thead><tr><th>Vereador</th><th>Feitos</th><th>Conferidos</th><th>Respondidos</th><th>%</th><th>Tempo típico</th></tr></thead><tbody>${linhas}</tbody></table>
<p class="nota">Resposta = documento "Resposta Requerimento" anexado no portal da Câmara. O percentual é sobre os requerimentos já conferidos. Indicações não entram: o portal não registra resposta a elas. Requerimento com mais de um autor conta para cada autor.</p>
<p>${seloFonte(URL_PROPOSITURAS, 'portal de proposituras')}</p>
</section>`;
}

function secaoCampanha(d) {
  const cand = d.camara.campanha.candidatos;
  const lista = d.vereadores.map((v) => ({ v, c: cand[v.id] })).filter(({ c }) => c).sort((a, b) => b.c.total - a.c.total);
  if (!lista.length) return '';
  const linhas = lista.map(({ v, c }) => {
    const m = origemMaior(c);
    return `<tr><td data-rotulo="Vereador"><a href="vereador/${esc(v.id)}.html">${esc(v.nome)}</a></td><td data-rotulo="Total">${reais(c.total)}</td><td data-rotulo="Maior origem">${m ? `${esc(m.nome)} <small>(${Math.round((m.valor / c.total) * 100)}%)</small>` : '—'}</td><td data-rotulo="Fonte">${link(c.link, 'TSE')}</td></tr>`;
  }).join('');
  return `<section id="campanha" class="secao cartao">
<h2>Campanha de 2024</h2>
<p>Dinheiro que cada vereador declarou ter recebido na campanha de 2024, em ordem do maior para o menor.</p>
<table class="tabela-empilha"><thead><tr><th>Vereador</th><th>Total</th><th>Maior origem</th><th>Fonte</th></tr></thead><tbody>${linhas}</tbody></table>
<p class="nota">Desde 2015 empresas não podem doar. Os nomes dos doadores estão no site do TSE.</p>
<p>${seloFonte('https://divulgacandcontas.tse.jus.br/divulga/', 'DivulgaCandContas (TSE)')}</p>
</section>`;
}

export function paginaCamara(d) {
  const secoes = `${secaoFolha(d)}
${secaoRespostas(d)}
${secaoEmendas(d)}
${secaoCampanha(d)}`;
  const corpo = `<h1>A Câmara de Salto</h1>
<p>Quanto a Câmara custa, o que os vereadores cobram da Prefeitura, para onde indicam dinheiro do orçamento e de onde veio o dinheiro das campanhas deles.</p>
${sumario(secoes, [['custo', 'Custo'], ['respostas', 'Respostas'], ['emendas', 'Emendas'], ['campanha', 'Campanha']])}
<section class="secao">
<div class="grade-numeros">
${cartaoNumero({ valor: String(d.vereadores.length), rotulo: 'Os vereadores', href: 'index.html#vereadores' })}
${cartaoNumero({ valor: numero(d.votacoes.length), rotulo: 'Votações', href: 'votacoes.html' })}
${total2026(d) ? cartaoNumero({ valor: reaisCentavos(total2026(d)), rotulo: 'em emendas dos vereadores para 2026 (planejado)', href: '#emendas' }) : ''}
</div>
</section>
${secoes}`;
  return layout({ titulo: 'A Câmara de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
