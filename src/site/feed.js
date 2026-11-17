import { periodoCurto } from './semana.js';

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const dm = (iso8) => iso8.slice(5).split('-').reverse().join('/');

// Semana completa: domingo às 12:00 de São Paulo (UTC-3); semana em andamento: hora da última atualização.
const dataDoItem = (r, atualizadoEm) => (r.completa || !atualizadoEm ? new Date(`${r.domingo}T15:00:00Z`) : new Date(atualizadoEm));

function item(r, url, atualizadoEm) {
  const link = `${url}semana/${r.segunda}.html`;
  const partes = [`Semana de ${dm(r.inicio)} a ${dm(r.fim)}:`];
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  if (r.proposituras.total) partes.push(`${plural(r.proposituras.total, 'proposta nova', 'propostas novas')} na Câmara.`);
  if (r.votacoes.length) partes.push(`${plural(r.votacoes.length, 'votação', 'votações')}.`);
  if (r.respondidos.total) partes.push(`${plural(r.respondidos.total, 'requerimento respondido', 'requerimentos respondidos')}.`);
  partes.push(...r.novidades);
  if (partes.length === 1) partes.push('sem novidades.');
  return `<item>
<title>${x(`Semana de ${periodoCurto(r.segunda, r.domingo)}`)}</title>
<link>${x(link)}</link>
<guid isPermaLink="true">${x(link)}</guid>
<pubDate>${dataDoItem(r, atualizadoEm).toUTCString()}</pubDate>
<description>${x(partes.join(' '))}</description>
</item>`;
}

// url: endereço do site com barra final (ex.: https://radarsaltense.com.br/).
// semanas: arquivo semanal ({ 'AAAA-MM-DD': resumo }); o feed traz as 8 mais recentes, um item por semana,
// com o endereço fixo da página da semana como link e guid (não muda nos dias da mesma semana).
export function feedRss(d, url, semanas = {}) {
  const atualizadoEm = d.meta && d.meta.atualizadoEm;
  const ultimas = Object.keys(semanas).sort().reverse().slice(0, 8).map((k) => semanas[k]);
  const quando = atualizadoEm ? new Date(atualizadoEm) : (ultimas[0] ? dataDoItem(ultimas[0]) : new Date(0));
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Radar Saltense: resumo da semana</title>
<link>${x(url)}</link>
<atom:link href="${x(`${url}feed.xml`)}" rel="self" type="application/rss+xml"/>
<description>${x('O que mudou em Salto na semana, com dados oficiais.')}</description>
<language>pt-BR</language>
<lastBuildDate>${quando.toUTCString()}</lastBuildDate>
${ultimas.map((r) => item(r, url, atualizadoEm)).join('\n')}
</channel>
</rss>
`;
}
