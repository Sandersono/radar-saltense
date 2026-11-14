import { normalizar } from '../util/texto.js';

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

export function linkCategoriaAno(html, ano, base) {
  const m = String(html).match(new RegExp(`href="([^"]*presenca-dos-vereadores/category/\\d+-${ano})"`));
  return m ? new URL(m[1], base).href : null;
}

export function linksPdfPresenca(html, base) {
  const links = new Set();
  for (const m of String(html).matchAll(/href="([^"]*\/presenca-dos-vereadores\/[^"]*\.pdf)"/gi)) links.add(new URL(m[1], base).href);
  return [...links];
}

export function mesDoArquivo(url) {
  const n = normalizar(decodeURIComponent(String(url)));
  const m = n.match(/presenca-reunioes-([a-z]+)-(\d{4})/);
  return m ? { mes: MESES[m[1]] ?? null, ano: Number(m[2]) } : null;
}
