import { limparHtml, slug } from '../util/texto.js';

export function lerVereadores(html, base) {
  const re = /<a href="(\/vereadora?-[^"]+)">[\s\S]{0,400}?<img src="([^"]+)"[\s\S]{0,400}?<div class="name_profile">([^<]+)<\/div>/g;
  const lista = [];
  const vistos = new Set();
  for (const m of String(html).matchAll(re)) {
    const texto = limparHtml(m[3]);
    const p = texto.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const nome = p ? p[1] : texto;
    const partido = p ? p[2] : '';
    const id = slug(nome);
    if (vistos.has(id)) continue;
    vistos.add(id);
    lista.push({ id, nome, partido, url: new URL(m[1], base).href, foto: m[2] });
  }
  return lista;
}
