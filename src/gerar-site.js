import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { paginaInicial } from './site/inicio.js';
import { paginaVereador } from './site/vereador.js';
import { paginaVotacoes } from './site/votacoes.js';
import { paginaImpostometro } from './site/impostometro.js';
import { paginaFontes } from './site/fontes.js';

const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

export async function gerarSite(d, destino) {
  for (const pasta of ['vereador', 'dados', 'fontes', 'fotos']) await mkdir(`${destino}/${pasta}`, { recursive: true });
  await writeFile(`${destino}/index.html`, paginaInicial(d));
  for (const v of d.vereadores) await writeFile(`${destino}/vereador/${v.id}.html`, paginaVereador(v, d));
  await writeFile(`${destino}/votacoes.html`, paginaVotacoes(d));
  await writeFile(`${destino}/fontes.html`, paginaFontes(d));
  if (d.receitas) await writeFile(`${destino}/impostometro.html`, paginaImpostometro(d));
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  for (const [origem, nome] of FONTES) await copyFile(origem, `${destino}/fontes/${nome}`);
  for (const v of d.vereadores) if (v.fotoLocal) await copyFile(`data/bruto/${v.fotoLocal}`, `${destino}/${v.fotoLocal}`);
  await writeFile(`${destino}/.nojekyll`, '');
}
