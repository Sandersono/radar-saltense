import { tituloSemana } from '../regras/semana.js';
import { semanaDe } from './semana.js';

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// url: endereço do site com barra final (ex.: https://radarsaltense.com.br/).
export function feedRss(d, url) {
  const r = semanaDe(d);
  const link = `${url}semana.html`;
  const partes = [];
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  if (r.proposituras.total) partes.push(`${plural(r.proposituras.total, 'proposta nova', 'propostas novas')} na Câmara.`);
  if (r.votacoes.length) partes.push(`${plural(r.votacoes.length, 'votação', 'votações')}.`);
  if (r.respondidos.total) partes.push(`${plural(r.respondidos.total, 'requerimento respondido', 'requerimentos respondidos')}.`);
  partes.push(...r.novidades);
  const descricao = partes.length ? partes.join(' ') : 'Sem novidades nesta semana.';
  const pub = new Date(`${r.inicio}T12:00:00Z`).toUTCString();
  const atualizado = d.meta && d.meta.atualizadoEm ? `\n<lastBuildDate>${new Date(d.meta.atualizadoEm).toUTCString()}</lastBuildDate>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Radar Saltense: resumo da semana</title>
<link>${x(url)}</link>
<description>${x('O que mudou em Salto na semana, com dados oficiais.')}</description>
<language>pt-BR</language>${atualizado}
<item>
<title>${x(tituloSemana(r))}</title>
<link>${x(link)}</link>
<guid isPermaLink="false">semana-${x(r.inicio)}</guid>
<pubDate>${pub}</pubDate>
<description>${x(descricao)}</description>
</item>
</channel>
</rss>
`;
}
