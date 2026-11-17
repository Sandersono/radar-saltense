import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { geometriaRecorte, fotoSite } from './site/util.js';
import { paginaInicial } from './site/inicio.js';
import { paginaVereador } from './site/vereador.js';
import { paginaVotacoes } from './site/votacoes.js';
import { paginaImpostometro } from './site/impostometro.js';
import { paginaGastos } from './site/gastos.js';
import { paginaCamara } from './site/camara.js';
import { paginaPrefeitura } from './site/prefeitura.js';
import { paginaFontes } from './site/fontes.js';
import { paginaSemana, paginaSemanaArquivo } from './site/semana.js';
import { atualizarSemanas, hojeSP } from './regras/semana.js';
import { paginaPromessas } from './site/promessas.js';
import { paginaObras } from './site/obras.js';
import { feedRss } from './site/feed.js';
import { ENDERECO } from './site/base.js';
import { sitemapXml, robotsTxt } from './site/medicao.js';

// Foto quadrada pequena (240 px, WebP), sem cortar a cabeça.
async function recortarFoto(entrada, saida) {
  const { width, height } = await sharp(entrada).metadata();
  const g = geometriaRecorte(width, height);
  await sharp(entrada)
    .extract({ left: g.esquerda, top: 0, width: g.lado, height: g.alturaCorpo })
    .extend({ top: g.folga, extendWith: 'copy' })
    .resize(240, 240)
    .webp({ quality: 78 })
    .toFile(saida);
}

const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

// semanas: arquivo semanal (data/processado/semanas.json); sem ele, é montado agora com os dados atuais.
export async function gerarSite(d, destino, semanasSalvas = null) {
  const semanas = semanasSalvas && Object.keys(semanasSalvas).length
    ? semanasSalvas
    : atualizarSemanas({}, d, hojeSP(d.meta.atualizadoEm), d.meta.novidadesRecentes);
  for (const pasta of ['vereador', 'semana', 'dados', 'fontes', 'fotos', 'marca']) await mkdir(`${destino}/${pasta}`, { recursive: true });
  const paginas = []; // vão para o sitemap.xml
  const pagina = async (caminho, html) => { await writeFile(`${destino}/${caminho}`, html); paginas.push(caminho); };
  await pagina('index.html', paginaInicial(d));
  for (const v of d.vereadores) await pagina(`vereador/${v.id}.html`, paginaVereador(v, d));
  await pagina('votacoes.html', paginaVotacoes(d));
  await pagina('camara.html', paginaCamara(d));
  await pagina('prefeitura.html', paginaPrefeitura(d));
  await pagina('obras.html', paginaObras(d));
  await pagina('fontes.html', paginaFontes(d));
  await pagina('semana.html', paginaSemana(d, ENDERECO, semanas));
  const segundas = Object.keys(semanas).sort();
  for (const [i, s] of segundas.entries()) {
    await pagina(`semana/${s}.html`, paginaSemanaArquivo(semanas[s], d, { anterior: segundas[i - 1], proxima: segundas[i + 1] }, ENDERECO));
  }
  await writeFile(`${destino}/feed.xml`, feedRss(d, ENDERECO, semanas));
  if (d.promessas) await pagina('promessas.html', paginaPromessas(d));
  if (d.receitas) await pagina('impostometro.html', paginaImpostometro(d));
  if (d.gastos) {
    await pagina('gastos.html', paginaGastos(d));
    await writeFile(`${destino}/dados/empresas.json`, JSON.stringify(d.gastos.empresas.map((e) => [e.cnpj, e.nome, e.porMes, e.porOrgao])));
  }
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  for (const [origem, nome] of FONTES) await copyFile(origem, `${destino}/fontes/${nome}`);
  for (const v of d.vereadores) if (v.fotoLocal) await recortarFoto(`data/bruto/${v.fotoLocal}`, `${destino}/${fotoSite(v.fotoLocal)}`);
  for (const nome of await readdir('site/marca')) await copyFile(`site/marca/${nome}`, `${destino}/marca/${nome}`);
  await writeFile(`${destino}/sitemap.xml`, sitemapXml(paginas, ENDERECO, d.meta.atualizadoEm ? new Date(d.meta.atualizadoEm).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : ''));
  await writeFile(`${destino}/robots.txt`, robotsTxt(ENDERECO));
  await writeFile(`${destino}/.nojekyll`, '');
}
