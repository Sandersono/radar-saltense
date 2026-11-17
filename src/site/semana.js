import { esc } from '../util/texto.js';
import { layout, dataBR, numero, seloFonte, aviso, ENDERECO } from './base.js';
import { URL_PROPOSITURAS } from './camara.js';
import { hojeSP, resumoSemana, textoWhatsApp, tituloSemana, segundaDaSemana, domingoDe } from '../regras/semana.js';

export const URL_VOTACOES = 'https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dm = (iso8) => iso8.slice(5).split('-').reverse().join('/');
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;

// "03/11 a 09/11/2025"; quando a semana vira o ano, "30/12/2024 a 05/01/2025".
export const periodoCurto = (inicio, fim) => `${inicio.slice(0, 4) === fim.slice(0, 4) ? dm(inicio) : dataBR(inicio)} a ${dataBR(fim)}`;

// "3 a 9 de novembro de 2025", "27 de outubro a 2 de novembro de 2025", "30 de dezembro de 2024 a 5 de janeiro de 2025".
export function periodoExtenso(inicio, fim) {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);
  const ate = `${df} de ${MESES[mf - 1]} de ${af}`;
  if (ai !== af) return `${di} de ${MESES[mi - 1]} de ${ai} a ${ate}`;
  if (mi !== mf) return `${di} de ${MESES[mi - 1]} a ${ate}`;
  return `${di} a ${ate}`;
}

// Usa o resumo já calculado (d.semana) ou calcula com a data da última atualização.
export const semanaDe = (d) => d.semana ?? resumoSemana(d, hojeSP(d.meta.atualizadoEm), d.meta.marcosAnteriores ?? null);

const lista = (itens) => `<ul class="lista">${itens.map((i) => `<li>${i}</li>`).join('')}</ul>`;

// Página do site onde cada tipo de novidade aparece.
export function paginaDaNovidade(texto) {
  if (/receitas/i.test(texto)) return 'impostometro.html';
  if (/gastos/i.test(texto)) return 'gastos.html';
  if (/folha/i.test(texto)) return 'camara.html#custo';
  if (/IEGM/.test(texto)) return 'prefeitura.html#nota';
  if (/obra/i.test(texto)) return 'obras.html';
  return null;
}

// Seções de um resumo (últimos 7 dias ou semana de calendário). prefixo: '' na raiz, '../' em semana/.
function secoesSemana(r, d, prefixo) {
  const atuais = new Set((d.vereadores ?? []).map((v) => v.id));
  const verLista = (xs) => xs.map((x) => `${atuais.has(x.id) ? `<a href="${prefixo}vereador/${esc(x.id)}.html">${esc(x.nome)}</a>` : esc(x.nome)}: ${numero(x.total)}`);
  const s = [];
  if (r.proposituras.total) {
    s.push(`<section class="secao cartao">
<h2>Propostas novas</h2>
<p><strong>${numero(r.proposituras.total)}</strong> ${r.proposituras.total === 1 ? 'proposta nova' : 'propostas novas'} na Câmara.</p>
${lista(verLista(r.proposituras.porVereador))}
${r.proposituras.bairros.length ? `<p>Bairros mais citados: ${r.proposituras.bairros.map((b) => `${esc(b.nome)} (${numero(b.total)})`).join(', ')}.</p>` : ''}
<p>${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}</p>
</section>`);
  }
  if (r.votacoes.length) {
    s.push(`<section class="secao cartao">
<h2>Votações da semana</h2>
${lista(r.votacoes.map((v) => `<strong>${esc(v.rotulo)}</strong>, ${dataBR(v.data)}: ${esc(v.resultado)}${v.contra.length ? `. Votaram contra: ${v.contra.map(esc).join(', ')}` : ''}`))}
<p><a href="${prefixo}votacoes.html">Todas as votações</a> ${seloFonte(URL_VOTACOES, 'resultado das votações (PDF da Câmara)')}</p>
</section>`);
  }
  if (r.respondidos.total) {
    s.push(`<section class="secao cartao">
<h2>Requerimentos respondidos</h2>
<p><strong>${numero(r.respondidos.total)}</strong> ${r.respondidos.total === 1 ? 'requerimento recebeu resposta' : 'requerimentos receberam resposta'} da Prefeitura.</p>
${lista(verLista(r.respondidos.porVereador))}
<p><a href="${prefixo}camara.html#respostas">Como contamos as respostas</a> ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}</p>
</section>`);
  }
  if (r.novidades.length) {
    s.push(`<section class="secao cartao">
<h2>Dados oficiais novos</h2>
${lista(r.novidades.map((t) => { const p = paginaDaNovidade(t); return p ? `<a href="${prefixo}${p}">${esc(t)}</a>` : esc(t); }))}
</section>`);
  }
  return s.length ? s.join('\n') : '<section class="secao cartao"><p>Nada de novo nos dados oficiais desta semana.</p></section>';
}

// "Semanas anteriores": um details por ano (o mais recente aberto), da semana mais nova para a mais velha.
function secaoAnteriores(semanas, atual) {
  const chaves = Object.keys(semanas).filter((k) => k < atual).sort().reverse();
  const anos = new Map();
  for (const k of chaves) {
    const ano = semanas[k].domingo.slice(0, 4);
    anos.set(ano, [...(anos.get(ano) ?? []), k]);
  }
  const blocos = [...anos].map(([ano, ks], i) => `<details${i === 0 ? ' open' : ''}><summary>${ano} <span class="num">${numero(ks.length)}</span></summary><ul class="lista">${ks.map((k) => {
    const r = semanas[k];
    return `<li><a href="semana/${k}.html">${dm(r.segunda)} a ${dm(r.domingo)}</a>: ${plural(r.proposituras.total, 'proposta', 'propostas')}, ${plural(r.votacoes.length, 'votação', 'votações')}</li>`;
  }).join('')}</ul></details>`).join('\n');
  return `<section id="semanas-anteriores" class="secao">
<h2>Semanas anteriores</h2>
${blocos || '<p>Ainda não há semanas anteriores.</p>'}
</section>`;
}

// url: endereço do site com barra final; o link do WhatsApp aponta para a página da semana.
// semanas: arquivo semanal ({ 'AAAA-MM-DD': resumo }), para o link da semana corrente e a lista das anteriores.
export function paginaSemana(d, url = ENDERECO, semanas = {}) {
  const r = semanaDe(d);
  const atual = segundaDaSemana(r.fim);
  const temArquivo = Object.keys(semanas).length > 0;
  const daSemana = semanas[atual]
    ? `<p>Semana de calendário (${periodoCurto(atual, domingoDe(atual))}): <a href="semana/${atual}.html">resumo de segunda a domingo</a>, com link fixo.</p>`
    : '';
  const zap = `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(r, `${url}semana.html`))}`;
  const corpo = `<h1>Resumo da semana</h1>
<p>${esc(tituloSemana(r).replace('Resumo da semana de', 'De'))}. Só entra aqui o que mudou.</p>
${daSemana}
${secoesSemana(r, d, '')}
<p><a class="botao" href="${esc(zap)}">Compartilhar no WhatsApp</a></p>
<p class="nota">O resumo é refeito todo dia com os dados oficiais da Câmara, da Prefeitura e do TCE-SP, sempre dos últimos 7 dias. <a href="feed.xml">Assinar por RSS</a> (um item por semana).</p>
${temArquivo ? secaoAnteriores(semanas, atual) : ''}`;
  return layout({
    titulo: 'Resumo da semana em Salto: Radar Saltense',
    descricao: 'O que mudou em Salto/SP nos últimos 7 dias: propostas novas na Câmara, votações, requerimentos respondidos e dados oficiais novos.',
    caminho: 'semana.html',
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}

export const descricaoSemana = (r) =>
  `Em Salto, de ${periodoCurto(r.segunda, r.domingo)}: ${plural(r.proposituras.total, 'proposta nova', 'propostas novas')} na Câmara, ${plural(r.votacoes.length, 'votação', 'votações')}, ${plural(r.respondidos.total, 'requerimento respondido', 'requerimentos respondidos')}.`;

// Página fixa de uma semana de calendário: semana/AAAA-MM-DD.html (a segunda-feira).
// vizinhas: { anterior, proxima } com as segundas das semanas ao lado que têm página.
export function paginaSemanaArquivo(r, d, vizinhas = {}, url = ENDERECO) {
  const caminho = `semana/${r.segunda}.html`;
  const permanente = `${url}${caminho}`;
  const h1 = `Semana de ${periodoExtenso(r.segunda, r.domingo)} em Salto`;
  const descricao = descricaoSemana(r);
  const zap = `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(r, permanente))}`;
  const nav = [
    vizinhas.anterior ? `<a class="botao-secundario" href="${esc(vizinhas.anterior)}.html" rel="prev"><span aria-hidden="true">←</span> Semana anterior</a>` : '',
    vizinhas.proxima ? `<a class="botao-secundario" href="${esc(vizinhas.proxima)}.html" rel="next">Próxima semana <span aria-hidden="true">→</span></a>` : '',
    '<a class="semana-todas" href="../semana.html#semanas-anteriores">Todas as semanas</a>',
  ].filter(Boolean).join('\n');
  const corpo = `<h1>${esc(h1)}</h1>
<p>De segunda a domingo, o que mudou nos dados oficiais da Câmara, da Prefeitura e do TCE-SP.</p>
${r.completa ? '' : aviso('Semana em andamento: atualizada todo dia até domingo.')}
${secoesSemana(r, d, '../')}
<p><a class="botao" href="${esc(zap)}">Compartilhar no WhatsApp</a></p>
<nav class="semana-nav" aria-label="Outras semanas">
${nav}
</nav>
<p class="nota">Cada número vem dos dados oficiais, com o link da fonte em cada bloco. <a href="../fontes.html">De onde vêm os números</a>. <a href="../feed.xml">Assinar por RSS</a> (um item por semana).</p>`;
  return layout({
    titulo: `Semana de ${periodoCurto(r.segunda, r.domingo)} em Salto: Radar Saltense`,
    descricao,
    caminho,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: h1,
      description: descricao,
      url: permanente,
      mainEntityOfPage: permanente,
      datePublished: r.segunda,
      dateModified: r.completa ? r.domingo : d.meta.atualizadoEm,
      inLanguage: 'pt-BR',
      about: { '@type': 'City', name: 'Salto (SP)' },
      publisher: { '@type': 'Organization', name: 'Radar Saltense', url: ENDERECO },
    },
    corpo,
    prefixo: '../',
    atualizadoEm: d.meta.atualizadoEm,
  });
}
