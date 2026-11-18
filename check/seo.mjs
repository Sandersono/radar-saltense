import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { layout, tituloCompleto, encurtar, trilhaJsonLd, definirPaginasAusentes, isoSP, hrefDe } from '../src/site/base.js';
import { conteudoPrincipal, hashConteudo, registrarLastmod, serializarLastmod } from '../src/regras/lastmod.js';
import { preencher, valoresEntenda, paginaArtigo, paginaFaq } from '../src/site/entenda.js';
import { tituloBairro } from '../src/site/bairros.js';
import { semanaVazia } from '../src/site/semana.js';
import { pagina404 } from '../src/site/sobre.js';
import { icoDePng, quebrarLinhas } from '../src/site/og.js';
import { vistoriar } from '../src/vistoria.js';

const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const AGORA = '2026-11-17T21:00:00-03:00';

// lastmod: o hash ignora "Atualizado em", a data de coleta e os números do contador; a data só muda quando o hash muda.
const pag = (miolo, dia = '17/11/2026') => `<head><title>x</title></head><main><p class="atualizado">Atualizado em ${dia}</p>${miolo}<div class="contador-impostos" data-oficial="${dia}">1</div></main><footer>${dia}</footer>`;
assert.equal(hashConteudo(pag('<p>a</p>')), hashConteudo(pag('<p>a</p>', '18/11/2026')));
assert.notEqual(hashConteudo(pag('<p>a</p>')), hashConteudo(pag('<p>b</p>')));
assert.ok(!conteudoPrincipal(pag('<p>a</p>')).includes('Atualizado'));
const h = hashConteudo(pag('<p>a</p>'));
const antes = { 'x.html': { hash: h, quando: '2026-11-01T03:00:00-03:00', criado: '2026-10-01T03:00:00-03:00' } };
assert.deepEqual(registrarLastmod(antes, 'x.html', h, AGORA), antes['x.html']);
assert.deepEqual(registrarLastmod(antes, 'x.html', 'outro', AGORA), { hash: 'outro', quando: AGORA, criado: '2026-10-01T03:00:00-03:00' });
assert.deepEqual(registrarLastmod({}, 'y.html', h, AGORA), { hash: h, quando: AGORA, criado: AGORA });
assert.equal(registrarLastmod(antes, 'x.html', 'outro', AGORA, '2026-11-15T23:59:59-03:00').quando, '2026-11-15T23:59:59-03:00');
assert.deepEqual(Object.keys(JSON.parse(serializarLastmod({ b: 1, a: 2 }))), ['a', 'b']);
assert.equal(isoSP('2026-11-18T00:43:00.037Z'), '2026-11-17T21:43:00-03:00');

// Títulos: sufixo uniforme e até 70 caracteres.
for (const t of ['Obras em Salto/SP', 'Como pedir informação à Prefeitura de Salto pela Lei de Acesso à Informação', 'x'.repeat(120), 'Dinheiro livre e carimbado: os mínimos de educação e saúde em Salto']) {
  assert.ok(tituloCompleto(t).endsWith(' | Radar Saltense'), t);
  assert.ok(tituloCompleto(t).length <= 70, tituloCompleto(t));
}
assert.equal(encurtar('Dinheiro livre e carimbado: os mínimos de educação e saúde em Salto', 53), 'Dinheiro livre e carimbado');
assert.equal(encurtar('Como pedir informação à Prefeitura de Salto pela Lei de Acesso à Informação', 53), 'Como pedir informação à Prefeitura de Salto');
for (const n of ['Centro', 'Jardim Nova Era', 'Conjunto Habitacional Nossa Senhora do Monte Serrat']) assert.ok(`${tituloBairro(n)} | Radar Saltense`.length <= 65 || tituloBairro(n) === n, n);

// Trilha: visível e BreadcrumbList com posições e endereços absolutos; início é a raiz canônica.
const trilha = [{ nome: 'Bairros', caminho: 'bairros.html' }, { nome: 'Centro', caminho: 'bairro/centro.html' }];
assert.deepEqual(trilhaJsonLd(trilha).itemListElement.map((x) => [x.position, x.item]), [[1, 'https://radarsaltense.com.br/'], [2, 'https://radarsaltense.com.br/bairros.html'], [3, 'https://radarsaltense.com.br/bairro/centro.html']]);
const comTrilha = layout({ titulo: 'Centro, Salto/SP', corpo: '<h1>Centro</h1>', prefixo: '../', caminho: 'bairro/centro.html', atualizadoEm: '2026-11-17T12:00:00Z', trilha, mostrarAtualizado: true });
assert.ok(ld(comTrilha).some((x) => x['@type'] === 'BreadcrumbList'));
assert.match(comTrilha, /<nav class="trilha" aria-label="Você está em"><ol><li><a href="\.\.\/">Início<\/a>/);
assert.match(comTrilha, /<span aria-current="page">Centro<\/span>/);
assert.match(comTrilha, /<\/h1>\n<p class="atualizado">Atualizado em <time datetime="2026-11-17">17\/11\/2026<\/time><\/p>/);
assert.match(comTrilha, /<title>Centro, Salto\/SP \| Radar Saltense<\/title>/);
assert.match(comTrilha, /<meta name="twitter:image" content="https:\/\/radarsaltense\.com\.br\/marca\/previa\.png">/);
assert.match(comTrilha, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
assert.match(comTrilha, /<link rel="preload" href="\.\.\/fontes\/inter-400\.woff2" as="font"/);
// Links internos nunca apontam para index.html (o canônico é a raiz).
assert.ok(!/href="[^"]*index\.html/.test(comTrilha));
assert.equal(hrefDe('index.html#vereadores', '../'), '../#vereadores');
assert.equal(hrefDe('index.html', ''), './');
// Rodapé: página ausente sai da lista.
definirPaginasAusentes(['entenda.html']);
const semEntenda = layout({ titulo: 't', corpo: '', atualizadoEm: '2026-11-17T12:00:00Z' });
assert.ok(!semEntenda.includes('href="entenda.html"') && semEntenda.includes('href="sobre.html"'));
definirPaginasAusentes([]);

// 404: noindex, sem canonical, caminhos absolutos.
const d = JSON.parse(await readFile('check/fixtures/dados-seo.json', 'utf8'));
const p404 = pagina404(d);
assert.match(p404, /<meta name="robots" content="noindex">/);
assert.ok(!/rel="canonical"/.test(p404) && !/og:url/.test(p404));
assert.match(p404, /href="\/estilo\.css"/);
assert.ok(!/(?:href|src)="(?!\/|https?:|#)/.test(p404), 'todo caminho da 404 é absoluto');

// Placeholders: valor formatado com a referência; desconhecido ou sem dado, a frase sai; nunca publica "{{".
const valores = valoresEntenda(d);
const sp = (x) => String(x).replace(/\u00a0/g, ' '); // toLocaleString usa espaço fixo depois de "R$"
assert.equal(valores.numeroVereadores, '11');
assert.equal(sp(valores.arrecadacaoAno), 'R$ 192.825.486 (de janeiro a setembro de 2026)');
assert.equal(sp(valores.pagoAno), 'R$ 599.452.214 (de janeiro a setembro de 2026)');
assert.equal(sp(valores.salarioVereador), 'R$ 10.000 (valor bruto de outubro de 2026)');
assert.equal(sp(valores.emendasPorVereador2026), 'de R$ 556.306,60 a R$ 571.306,60 (valor planejado na tabela da Câmara de 31/08/2026)');
assert.equal(valores.notaIegm, 'C (baixo nível de adequação)');
assert.equal(valores.anoIegm, '2024');
assert.equal(preencher('A Câmara tem {{numeroVereadores}} vereadores. O art. 29 fixa o limite.', valores), 'A Câmara tem 11 vereadores. O art. 29 fixa o limite.');
const faltas = new Set();
assert.equal(preencher('Primeira frase. Custa {{custoInventado}} por mês. Última frase.', valores, faltas), 'Primeira frase. Última frase.');
assert.deepEqual([...faltas], ['custoInventado']);
assert.equal(preencher('Só isto {{numeroVereadores}.', valores), '');
assert.equal(preencher('Sem dado: {{obrasParalisadas}}.', {}), '');

// Entenda: Article sem FAQPage; FAQ: FAQPage com as mesmas perguntas visíveis.
const exemplo = JSON.parse(await readFile('check/fixtures/entenda-exemplo.json', 'utf8'));
const art = paginaArtigo(exemplo.artigos[0], exemplo.artigos, d, { numeroVereadores: '11' });
assert.ok(!art.includes('{{'));
assert.ok(!art.includes('A folha da Câmara')); // custoCamaraMes sem valor: frase omitida
assert.deepEqual(ld(art).map((x) => x['@type']), ['Article', 'BreadcrumbList']);
assert.match(art, /<meta property="og:type" content="article">/);
assert.match(art, /href="\.\.\/#vereadores"/);
const faq = paginaFaq(exemplo.faq, exemplo.artigos, d, valores);
const faqLd = ld(faq).find((x) => x['@type'] === 'FAQPage');
assert.deepEqual(faqLd.mainEntity.map((q) => q.name), [...faq.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1]));
assert.equal(faqLd.mainEntity.length, 3);
assert.match(faq, /href="\.\/#vereadores"/);

// Semana sem nenhum dado.
const r = (n) => ({ proposituras: { total: n }, votacoes: [], respondidos: { total: 0 }, novidades: [] });
assert.equal(semanaVazia(r(0)), true);
assert.equal(semanaVazia(r(1)), false);

// Vistoria: "{{" bloqueia; links absolutos e da raiz resolvem.
const corpo = (x) => `<h1>t</h1><main>${'texto '.repeat(120)}<a href="fontes.html">f</a>${x}</main>`;
const base = ['index.html', 'camara.html', 'prefeitura.html', 'votacoes.html', 'semana.html', 'fontes.html'].map((c) => ({ caminho: c, html: corpo(c === 'index.html' ? '<p id="bairro">b</p>' : '') }));
const arquivos = [...base.map((p) => p.caminho), '404.html', 'favicon.ico'];
assert.deepEqual(vistoriar([...base, { caminho: '404.html', html: corpo('<a href="/">i</a><a href="/#bairro">b</a><a href="/camara.html">c</a><link href="/favicon.ico">') }], arquivos), { bloqueios: [], avisos: [] });
assert.equal(vistoriar([...base, { caminho: '404.html', html: corpo('<p>{{numeroVereadores}}</p>') }], arquivos).bloqueios.length, 1);
assert.equal(vistoriar([...base, { caminho: '404.html', html: corpo('<a href="/nada.html">x</a>') }], arquivos).avisos.length, 1);

// favicon.ico: cabeçalho ICO com uma imagem PNG de 32 px; cartão do vereador quebra o nome sem cortar palavras.
const ico = icoDePng(Buffer.from([1, 2, 3]), 32);
assert.deepEqual([...ico.subarray(0, 8)], [0, 0, 1, 0, 1, 0, 32, 32]);
assert.equal(ico.readUInt32LE(18), 22);
assert.deepEqual(quebrarLinhas('Michel Oliveira Rodrigues da Silva', 19), ['Michel Oliveira', 'Rodrigues da Silva']);
console.log('seo: ok');
