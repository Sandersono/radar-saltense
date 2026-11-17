import { segundaDaSemana } from '../regras/semana.js';
import { semanaDe } from './semana.js';

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const dm = (iso8) => iso8.slice(5).split('-').reverse().join('/');

// url: endereço do site com barra final (ex.: https://radarsaltense.com.br/).
// Um item por semana, identificado pela segunda-feira (fuso de São Paulo): o guid não muda nos dias da mesma semana.
export function feedRss(d, url) {
  const r = semanaDe(d);
  const segunda = segundaDaSemana(r.fim);
  const link = `${url}semana.html`;
  const partes = [`Últimos 7 dias (${dm(r.inicio)} a ${dm(r.fim)}):`];
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  if (r.proposituras.total) partes.push(`${plural(r.proposituras.total, 'proposta nova', 'propostas novas')} na Câmara.`);
  if (r.votacoes.length) partes.push(`${plural(r.votacoes.length, 'votação', 'votações')}.`);
  if (r.respondidos.total) partes.push(`${plural(r.respondidos.total, 'requerimento respondido', 'requerimentos respondidos')}.`);
  partes.push(...r.novidades);
  if (partes.length === 1) partes.push('sem novidades.');
  const quando = d.meta && d.meta.atualizadoEm ? new Date(d.meta.atualizadoEm) : new Date(`${segunda}T12:00:00Z`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Radar Saltense: resumo da semana</title>
<link>${x(url)}</link>
<atom:link href="${x(`${url}feed.xml`)}" rel="self" type="application/rss+xml"/>
<description>${x('O que mudou em Salto na semana, com dados oficiais.')}</description>
<language>pt-BR</language>
<lastBuildDate>${quando.toUTCString()}</lastBuildDate>
<item>
<title>${x(`Semana de ${dm(segunda)}`)}</title>
<link>${x(link)}</link>
<guid isPermaLink="false">semana-${x(segunda)}</guid>
<pubDate>${quando.toUTCString()}</pubDate>
<description>${x(partes.join(' '))}</description>
</item>
</channel>
</rss>
`;
}
