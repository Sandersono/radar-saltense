import { mkdir, writeFile, copyFile, readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { geometriaRecorte, fotoSite } from './site/util.js';
import { paginaInicial } from './site/inicio.js';
import { paginaVereador } from './site/vereador.js';
import { paginaVotacoes } from './site/votacoes.js';
import { paginaImpostometro } from './site/impostometro.js';
import { paginaGastos } from './site/gastos.js';
import { paginaOrigem } from './site/origem.js';
import { paginaCamara } from './site/camara.js';
import { paginaPrefeitura } from './site/prefeitura.js';
import { paginaFontes } from './site/fontes.js';
import { paginaSemana, paginaSemanaArquivo, semanaVazia } from './site/semana.js';
import { atualizarSemanas, hojeSP } from './regras/semana.js';
import { paginaPromessas } from './site/promessas.js';
import { paginaObras } from './site/obras.js';
import { feedRss } from './site/feed.js';
import { paginaBairro, paginaBairros } from './site/bairros.js';
import { paginaSobre, pagina404 } from './site/sobre.js';
import { paginaEntenda, paginaArtigo, paginaFaq, validarEntenda, errosArtigo, errosFaq, destinoValido, valoresEntenda } from './site/entenda.js';
import { gerarCartaoVereador, icoDePng } from './site/og.js';
import { montarBairros, bairrosComPagina, validarApelidos, validarNomes } from './regras/bairros.js';
import { indiceOficial, situacoesOficiais, avisosOficiais } from './regras/bairros-oficiais.js';
import { hashConteudo, registrarLastmod, diaDe, serializarLastmod } from './regras/lastmod.js';
import { ENDERECO, isoSP, definirPaginasAusentes } from './site/base.js';
import { sitemapXml, robotsTxt } from './site/medicao.js';
import { conjuntosDeDados, paginaDados, llmsTxt, securityTxt, manifesto, paginaExiste } from './site/dados-abertos.js';

// Foto quadrada pequena (240 px, WebP), sem cortar a cabeça.
async function recortarFoto(entrada, saida) {
  const { width, height } = await sharp(entrada).metadata();
  const g = geometriaRecorte(width, height);
  // Recorte + folga primeiro (quadrado), redimensiona depois: no mesmo pipeline o sharp redimensiona antes de estender
  // e a foto saía 240x293 (o CSS cortava em cima e embaixo).
  const quadrado = await sharp(entrada)
    .extract({ left: g.esquerda, top: 0, width: g.lado, height: g.alturaCorpo })
    .extend({ top: g.folga, extendWith: 'copy' })
    .toBuffer();
  await sharp(quadrado).resize(240, 240).webp({ quality: 78 }).toFile(saida);
}

const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

export const ARQUIVO_ENTENDA = 'data/referencia/entenda.json';
export const ARQUIVO_LASTMOD = 'data/processado/lastmod.json';
export const ARQUIVO_OFICIAIS = 'data/referencia/bairros-oficiais.json';

async function lerJson(caminho) {
  try { return JSON.parse(await readFile(caminho, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// semanas: arquivo semanal (data/processado/semanas.json); sem ele, é montado agora com os dados atuais.
// opcoes.lastmod: onde ler e gravar a data real de mudança de cada página (null = não grava).
export async function gerarSite(d, destino, semanasSalvas = null, { lastmod: arquivoLastmod = ARQUIVO_LASTMOD, entenda: arquivoEntenda = ARQUIVO_ENTENDA } = {}) {
  const manutencao = []; // avisos de manutenção do próprio gerador (devolvidos a quem chamou)
  const avisar = (texto) => { console.warn(texto); manutencao.push(texto); };
  // Peça que falha nunca derruba o robô: ela sai desta vez e vira aviso de manutenção.
  const tentar = async (nome, f) => { try { return await f(); } catch (e) { avisar(`${nome} não gerado: ${e.message}`); return null; } };
  let semanas = semanasSalvas && Object.keys(semanasSalvas).length ? semanasSalvas : null;
  if (!semanas) {
    // Erro no arquivo semanal nunca impede publicar: o site sai sem as páginas de semana desta vez.
    try { semanas = atualizarSemanas({}, d, hojeSP(d.meta.atualizadoEm), d.meta.novidadesRecentes); }
    catch (e) { console.warn(`Arquivo semanal não montado: ${e.message}`); semanas = {}; }
  }
  for (const pasta of ['vereador', 'semana', 'bairro', 'dados', 'fontes', 'fotos', 'marca/og', 'entenda']) await mkdir(`${destino}/${pasta}`, { recursive: true });

  // Entenda e perguntas frequentes (data/referencia/entenda.json): sem o arquivo, as páginas ficam de fora.
  let entenda = null;
  try { entenda = await lerJson(arquivoEntenda); } catch (e) { avisar(`Entenda: ${arquivoEntenda} ilegível (${e.message}); páginas Entenda e Perguntas frequentes não geradas.`); }
  if (!entenda && !manutencao.some((m) => m.startsWith('Entenda'))) avisar(`Entenda: ${arquivoEntenda} não existe; páginas Entenda e Perguntas frequentes não geradas.`);
  let artigos = [];
  let faq = [];
  if (entenda) {
    for (const erro of validarEntenda(entenda)) avisar(`Entenda: ${erro}`);
    const slugs = new Set((entenda.artigos || []).map((a) => a && a.slug));
    const ok = destinoValido(slugs);
    const vistos = new Set();
    artigos = (Array.isArray(entenda.artigos) ? entenda.artigos : []).filter((a, i) => {
      const bom = errosArtigo(a, i, ok).length === 0 && !vistos.has(a.slug);
      if (bom) vistos.add(a.slug);
      return bom;
    });
    faq = (Array.isArray(entenda.faq) ? entenda.faq : []).filter((q, i) => errosFaq(q, i, ok).length === 0);
  }

  // Páginas que não saem nesta rodada somem do rodapé e das listas (links nunca quebram).
  const ausentes = [
    !d.promessas && 'promessas.html', !d.receitas && 'impostometro.html', !d.origem && 'origem.html', !d.gastos && 'gastos.html',
    !artigos.length && 'entenda.html', !faq.length && 'perguntas-frequentes.html',
  ].filter(Boolean);
  const existentes = new Set(artigos.map((a) => `entenda/${a.slug}.html`));
  definirPaginasAusentes(ausentes);
  const existe = (c) => { const p = c.split('#')[0]; return p.startsWith('entenda/') ? existentes.has(p) : !ausentes.includes(p); };

  // lastmod: a data só muda quando o conteúdo principal muda.
  let lastmodAnterior = {};
  try { lastmodAnterior = (arquivoLastmod && await lerJson(arquivoLastmod)) || {}; } catch (e) { avisar(`lastmod.json ilegível (${e.message}); datas recomeçam hoje.`); }
  const agora = isoSP(d.meta.atualizadoEm);
  const lastmod = {};
  const paginas = []; // vão para o sitemap.xml
  // html: texto ou função (datas) => texto, para páginas que mostram a própria data de mudança (dateModified).
  // sitemap: false tira a página do sitemap (404, semana vazia); fixa: data imposta (semana fechada).
  const pagina = async (caminho, html, { sitemap = true, fixa = null } = {}) => {
    let texto = typeof html === 'function' ? html(null) : html;
    if (sitemap) {
      lastmod[caminho] = registrarLastmod(lastmodAnterior, caminho, hashConteudo(texto), agora, fixa);
      if (typeof html === 'function') texto = html(lastmod[caminho]);
      paginas.push(caminho);
    }
    await writeFile(`${destino}/${caminho}`, texto);
  };

  // Bairros (spec 2026-11-17): montados aqui, a partir das propostas; vêm antes porque vereador e semana linkam para eles.
  let ref = {};
  try { ref = JSON.parse(await readFile('data/referencia/bairros-apelidos.json', 'utf8')); }
  catch (e) { console.warn(`Lista de apelidos de bairro não lida: ${e.message}`); }
  const apelidos = ref.apelidos || {};
  const nomes = ref.nomes || {};
  const nomesVistos = d.proposituras.flatMap((p) => (p.locais || []).filter((l) => l.tipo === 'bairro').map((l) => l.nome));
  for (const erro of validarApelidos(apelidos, nomesVistos)) console.warn(`Apelido de bairro: ${erro}`);
  const todosBairros = montarBairros(d.proposituras, apelidos, nomes);
  for (const erro of validarNomes(nomes, todosBairros)) console.warn(`Nome de bairro: ${erro}`);
  const bairros = bairrosComPagina(todosBairros);
  // Bairro novo que passou do corte: a página sai com a grafia mais comum até o nome ser fixado na lista.
  for (const b of bairros) {
    if (b.fixo) continue;
    avisar(`Bairro novo com página e sem nome fixo em data/referencia/bairros-apelidos.json (nomes): "${b.chave}" (${b.nome}).`);
  }
  // Nome oficial (cadastro da Prefeitura, data/referencia/bairros-oficiais.json). Nunca trava: arquivo ausente ou
  // ilegível vira aviso e as páginas saem sem a linha do nome oficial; bairro novo sem conferência também vira aviso.
  let situacoes = new Map();
  let pgvUrl = '';
  try {
    const { indice, erros } = indiceOficial(JSON.parse(await readFile(ARQUIVO_OFICIAIS, 'utf8')));
    for (const e of erros) avisar(`Bairros oficiais: ${e}`);
    if (indice.size) {
      pgvUrl = [...indice.values()][0].url;
      situacoes = situacoesOficiais(bairros, ref, indice);
      for (const a of avisosOficiais(bairros, situacoes)) avisar(a);
    }
  } catch (e) { avisar(`Bairros oficiais: ${ARQUIVO_OFICIAIS} não lido (${e.message}); páginas de bairro sem o nome oficial.`); }
  // Nome visto nos dados (qualquer grafia) -> endereço da página do bairro.
  const linksBairros = new Map(bairros.flatMap((b) => [b.nome, ...b.grafias].map((n) => [n, b.slug])));

  // Prévia (og:image) por vereador; sem ela, a página usa a prévia geral.
  const cartoes = new Set();
  for (const v of d.vereadores) {
    const ok = await tentar(`Prévia de ${v.id}`, async () => {
      await gerarCartaoVereador(v, v.fotoLocal ? `data/bruto/${v.fotoLocal}` : null, `${destino}/marca/og/vereador-${v.id}.png`);
      return true;
    });
    if (ok) cartoes.add(v.id);
  }

  await pagina('index.html', paginaInicial(d));
  for (const v of d.vereadores) await pagina(`vereador/${v.id}.html`, paginaVereador(v, d, { bairros, cartao: cartoes.has(v.id) }));
  await pagina('votacoes.html', paginaVotacoes(d));
  await pagina('camara.html', paginaCamara(d));
  await pagina('prefeitura.html', paginaPrefeitura(d));
  await pagina('obras.html', paginaObras(d));
  await pagina('fontes.html', paginaFontes(d));
  await pagina('semana.html', paginaSemana(d, ENDERECO, semanas, linksBairros));
  const segundas = Object.keys(semanas).sort();
  for (const [i, s] of segundas.entries()) {
    const r = semanas[s];
    // Semana sem nenhum dado: noindex e fora do sitemap. Semana fechada: a data é o domingo.
    await pagina(`semana/${s}.html`, (datas) => paginaSemanaArquivo(r, d, { anterior: segundas[i - 1], proxima: segundas[i + 1] }, ENDERECO, { bairros: linksBairros, modificado: datas && datas.quando }),
      { sitemap: !semanaVazia(r), fixa: r.completa ? `${r.domingo}T23:59:59-03:00` : null });
  }
  await pagina('bairros.html', paginaBairros(bairros, d, situacoes, pgvUrl));
  for (const b of bairros) {
    const s = situacoes.get(b.chave);
    await pagina(`bairro/${b.slug}.html`, paginaBairro(b, d, todosBairros, s ? { situacao: s, url: pgvUrl } : null));
  }
  await writeFile(`${destino}/feed.xml`, feedRss(d, ENDERECO, semanas));
  if (d.promessas) await pagina('promessas.html', paginaPromessas(d));
  if (d.receitas) await pagina('impostometro.html', paginaImpostometro(d));
  if (d.origem) await pagina('origem.html', paginaOrigem(d));
  if (d.gastos) {
    await pagina('gastos.html', paginaGastos(d));
    await writeFile(`${destino}/dados/empresas.json`, JSON.stringify(d.gastos.empresas.map((e) => [e.cnpj, e.nome, e.porMes, e.porOrgao])));
  }
  await tentar('Página Sobre', () => pagina('sobre.html', paginaSobre(d)));
  await tentar('Página 404', () => pagina('404.html', pagina404(d), { sitemap: false }));
  // Dados abertos: dados.html e os arquivos de dist/dados/ (sem CPF e sem nome de pessoa física), refeitos a cada geração.
  const conjuntos = (await tentar('Dados abertos', async () => {
    const lista = conjuntosDeDados(d);
    for (const c of lista) await writeFile(`${destino}/${c.arquivo}`, c.conteudo);
    await pagina('dados.html', paginaDados(d, lista));
    return lista;
  })) || [];

  // Entenda e FAQ. Placeholder sem dado: a frase sai e o aviso vai para a manutenção.
  if (artigos.length) {
    const valores = valoresEntenda(d);
    const faltas = new Set();
    await tentar('Entenda', async () => {
      for (const a of artigos) await pagina(`entenda/${a.slug}.html`, (datas) => paginaArtigo(a, artigos, d, valores, { datas, faltas, existe }));
      await pagina('entenda.html', paginaEntenda(artigos, d, valores, { faltas, existe }));
      if (faq.length) await pagina('perguntas-frequentes.html', paginaFaq(faq, artigos, d, valores, { faltas, existe }));
    });
    for (const k of faltas) avisar(`Entenda: placeholder {{${k}}} sem dado ou desconhecido; a frase foi omitida.`);
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
  await tentar('favicon.ico', async () => writeFile(`${destino}/favicon.ico`, icoDePng(await sharp('site/marca/icone-32.png').resize(32, 32).png().toBuffer(), 32)));
  const dataPadrao = d.meta.atualizadoEm ? hojeSP(d.meta.atualizadoEm) : '';
  await writeFile(`${destino}/sitemap.xml`, sitemapXml(paginas, ENDERECO, dataPadrao, Object.fromEntries(Object.entries(lastmod).map(([c, x]) => [c, diaDe(x.quando)]))));
  await writeFile(`${destino}/robots.txt`, robotsTxt(ENDERECO));
  await writeFile(`${destino}/.nojekyll`, '');
  // Arquivos para máquinas. O .well-known só é publicado com include-hidden-files no upload-pages-artifact (atualizar.yml).
  await tentar('llms.txt', () => writeFile(`${destino}/llms.txt`, llmsTxt({ atualizadoEm: d.meta.atualizadoEm, conjuntos, existe: paginaExiste })));
  await tentar('security.txt', async () => {
    await mkdir(`${destino}/.well-known`, { recursive: true });
    await writeFile(`${destino}/.well-known/security.txt`, securityTxt(d.meta.atualizadoEm));
  });
  await tentar('site.webmanifest', () => writeFile(`${destino}/site.webmanifest`, manifesto()));
  // Não há fonte vetorial do ícone: o de 512 px é ampliado do de 192 px.
  await tentar('icone-512.png', () => sharp('site/marca/icone-192.png').resize(512, 512, { kernel: 'lanczos3' }).png().toFile(`${destino}/marca/icone-512.png`));
  if (arquivoLastmod) await tentar('lastmod.json', () => writeFile(arquivoLastmod, serializarLastmod(lastmod)));
  return { manutencao };
}
