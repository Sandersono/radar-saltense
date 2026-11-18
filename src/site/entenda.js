import { esc } from '../util/texto.js';
import { FAIXAS_IEGM } from '../regras/iegm.js';
import { layout, ENDERECO, ORGANIZACAO, reais, reaisCentavos, numero, dataBR, link, hrefDe, paginaAusente, diaSP, isoSP, encurtar } from './base.js';
import { NOMES_MES } from './impostometro.js';
import { totalMes, mesAno } from './camara.js';

// Textos explicativos ("Entenda") e perguntas frequentes, escritos em data/referencia/entenda.json.
// Os números de Salto entram por {{chave}}: só estas chaves, sempre calculadas dos dados oficiais.
export const PLACEHOLDERS = [
  'numeroVereadores', 'custoCamaraMes', 'salarioVereador',
  'arrecadacaoAno', 'pagoAno', 'percentualLivre',
  'emendas2026Total', 'emendasPorVereador2026',
  'obrasEmExecucao', 'obrasParalisadas',
  'notaIegm', 'anoIegm', 'promessasEmAndamento',
  'dataAtualizacao',
];

// Páginas para onde "relacionados" e o "link" do FAQ podem apontar (com ou sem âncora), e o nome do link.
export const PAGINAS_DESTINO = {
  'index.html': 'Página inicial', 'camara.html': 'A Câmara de Salto', 'prefeitura.html': 'A Prefeitura de Salto',
  'obras.html': 'Obras em Salto', 'gastos.html': 'Raio-X dos gastos', 'origem.html': 'De onde vem e para onde vai o dinheiro',
  'impostometro.html': 'Impostômetro', 'promessas.html': 'Promessas do prefeito', 'votacoes.html': 'Votações da Câmara',
  'bairros.html': 'Bairros de Salto', 'semana.html': 'Resumo da semana', 'fontes.html': 'De onde vêm os números',
  'sobre.html': 'Sobre o site', 'entenda.html': 'Entenda', 'perguntas-frequentes.html': 'Perguntas frequentes',
};

const CHAVE = /\{\{\s*([^{}]*?)\s*\}\}/g;
export const chavesDe = (texto) => [...String(texto ?? '').matchAll(CHAVE)].map((m) => m[1]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const texto = (x) => typeof x === 'string' && x.trim().length > 0;
const https = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

// Todos os textos de um objeto (para conferir placeholders).
const textos = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(textos) : x && typeof x === 'object' ? Object.values(x).flatMap(textos) : []);

function errosPlaceholders(onde, obj) {
  const erros = [];
  for (const t of textos(obj)) {
    for (const k of chavesDe(t)) if (!PLACEHOLDERS.includes(k)) erros.push(`${onde}: placeholder desconhecido {{${k}}}`);
    if (/\{\{|\}\}/.test(t.replace(CHAVE, ''))) erros.push(`${onde}: chaves {{ }} mal fechadas`);
  }
  return erros;
}

// destinoOk(caminho): o link existe no site (página fixa ou outro texto do Entenda).
export function errosArtigo(a, i, destinoOk = () => true) {
  const onde = `artigo ${a && texto(a.slug) ? a.slug : i + 1}`;
  if (!a || typeof a !== 'object') return [`${onde}: não é um objeto`];
  const e = [];
  if (!texto(a.slug) || !SLUG.test(a.slug)) e.push(`${onde}: slug inválido (só minúsculas, números e hífens)`);
  if (!texto(a.titulo)) e.push(`${onde}: falta o título`);
  else if (chavesDe(a.titulo).length) e.push(`${onde}: o título não pode ter placeholder`);
  if (!texto(a.descricao)) e.push(`${onde}: falta a descrição`);
  else if (a.descricao.length > 155) e.push(`${onde}: descrição com ${a.descricao.length} caracteres (máximo 155)`);
  if (!texto(a.resumo)) e.push(`${onde}: falta o resumo`);
  if (!Array.isArray(a.secoes) || !a.secoes.length) e.push(`${onde}: falta "secoes"`);
  else a.secoes.forEach((s, j) => {
    if (!s || !texto(s.titulo)) e.push(`${onde}: seção ${j + 1} sem título`);
    if (!s || !Array.isArray(s.paragrafos) || !s.paragrafos.length || !s.paragrafos.every(texto)) e.push(`${onde}: seção ${j + 1} sem parágrafos`);
  });
  if (!Array.isArray(a.perguntas)) e.push(`${onde}: "perguntas" precisa ser uma lista`);
  else a.perguntas.forEach((q, j) => {
    if (!q || !texto(q.pergunta) || !q.pergunta.trim().endsWith('?')) e.push(`${onde}: pergunta ${j + 1} sem texto ou sem "?"`);
    if (!q || !texto(q.resposta)) e.push(`${onde}: pergunta ${j + 1} sem resposta`);
  });
  if (!Array.isArray(a.fontes) || !a.fontes.length) e.push(`${onde}: falta "fontes"`);
  else a.fontes.forEach((f, j) => {
    if (!f || !texto(f.titulo)) e.push(`${onde}: fonte ${j + 1} sem título`);
    if (!f || !https(f.url)) e.push(`${onde}: fonte ${j + 1} sem link https`);
  });
  if (!Array.isArray(a.relacionados)) e.push(`${onde}: "relacionados" precisa ser uma lista`);
  else for (const r of a.relacionados) if (!texto(r) || !destinoOk(r)) e.push(`${onde}: relacionado inexistente "${r}"`);
  return [...e, ...errosPlaceholders(onde, a)];
}

export function errosFaq(q, i, destinoOk = () => true) {
  const onde = `faq ${i + 1}`;
  if (!q || typeof q !== 'object') return [`${onde}: não é um objeto`];
  const e = [];
  if (!texto(q.grupo)) e.push(`${onde}: falta o grupo`);
  if (!texto(q.pergunta) || !q.pergunta.trim().endsWith('?')) e.push(`${onde}: pergunta sem texto ou sem "?"`);
  if (!texto(q.resposta)) e.push(`${onde}: falta a resposta`);
  if (!texto(q.link) || !destinoOk(q.link)) e.push(`${onde}: link inexistente "${q.link}"`);
  return [...e, ...errosPlaceholders(onde, q)];
}

// Destino válido: página fixa do site (com ou sem âncora) ou outro texto do Entenda.
export const destinoValido = (slugs) => (r) => {
  const pagina = String(r).split('#')[0];
  if (Object.hasOwn(PAGINAS_DESTINO, pagina)) return true;
  const m = pagina.match(/^entenda\/([a-z0-9-]+)\.html$/);
  return Boolean(m && slugs.has(m[1]));
};

// Confere o arquivo inteiro (contrato da spec 2026-11-17). Devolve a lista de problemas.
export function validarEntenda(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['entenda.json não é um objeto'];
  const erros = [];
  const artigos = Array.isArray(e.artigos) ? e.artigos : [];
  if (!artigos.length) erros.push('"artigos" precisa ser uma lista com ao menos um texto');
  const slugs = new Set(artigos.map((a) => a && a.slug));
  const ok = destinoValido(slugs);
  const vistos = new Set();
  artigos.forEach((a, i) => {
    if (a && texto(a.slug)) { if (vistos.has(a.slug)) erros.push(`artigo ${a.slug}: slug repetido`); vistos.add(a.slug); }
    erros.push(...errosArtigo(a, i, ok));
  });
  if (!Array.isArray(e.faq)) erros.push('"faq" precisa ser uma lista');
  else e.faq.forEach((q, i) => erros.push(...errosFaq(q, i, ok)));
  return erros;
}

// Valores dos placeholders, já formatados e com a data de referência quando ela importa.
// Dado ausente: a chave fica de fora (a frase que a usa é omitida).
export function valoresEntenda(d) {
  const v = {};
  const tentar = (k, f) => {
    try { const x = f(); if (x !== null && x !== undefined && x !== '') v[k] = String(x); } catch { /* sem dado: a frase sai */ }
  };
  const ateMes = (a, ano) => (a.tipo === 'MSCE' ? `de janeiro a dezembro de ${ano}` : `de janeiro a ${NOMES_MES[a.mes - 1]} de ${ano}`);
  const origem = () => { const ano = Object.keys(d.origem.anos).sort().pop(); return [ano, d.origem.anos[ano]]; };
  tentar('numeroVereadores', () => (d.vereadores.length ? numero(d.vereadores.length) : null));
  tentar('dataAtualizacao', () => dataBR(diaSP(d.meta.atualizadoEm)));
  tentar('custoCamaraMes', () => {
    const f = d.camara.folha;
    const m = f.meses[f.ultimoMes];
    return m && !m.parcial ? `${reais(totalMes(m))} (folha de ${mesAno(f.ultimoMes)}, antes dos descontos)` : null;
  });
  tentar('salarioVereador', () => {
    const f = d.camara.folha;
    const s = Object.values(f.meses[f.ultimoMes].porVereador);
    return s.length ? `${reais(Math.min(...s))} (valor bruto de ${mesAno(f.ultimoMes)})` : null;
  });
  // Impostos e taxas pagos à Prefeitura no ano: a parte oficial do impostômetro (TCE-SP).
  tentar('arrecadacaoAno', () => {
    const r = d.receitas;
    const m = Number(String(r.ultimoMesOficial || '').slice(5, 7));
    return r.temOficialAno && m ? `${reais(r.oficialAno)} (de janeiro a ${NOMES_MES[m - 1]} de ${r.anoAtual})` : null;
  });
  tentar('percentualLivre', () => {
    const [ano, a] = origem();
    const total = a.livre + a.carimbado;
    return total > 0 ? `${((a.livre / total) * 100).toFixed(1).replace('.', ',')}% (${ateMes(a, ano)})` : null;
  });
  // Total pago no ano, o mesmo do Raio-X dos gastos (TCE-SP).
  tentar('pagoAno', () => {
    const ano = Object.keys(d.gastos.anos).sort().pop();
    const g = d.gastos.anos[ano];
    const m = Number(String(g.ultimoMes).slice(5, 7));
    return m ? `${reais(g.total)} (de janeiro a ${NOMES_MES[m - 1]} de ${ano})` : null;
  });
  const e26 = () => d.emendas['2026'];
  const ref26 = () => `valor planejado na tabela da Câmara de ${dataBR(e26().atualizadoEm)}`;
  tentar('emendas2026Total', () => (e26().resumo.total > 0 ? `${reaisCentavos(e26().resumo.total)} (${ref26()})` : null));
  tentar('emendasPorVereador2026', () => {
    const vals = Object.values(e26().resumo.porVereador).map((x) => x.total).filter((x) => x > 0);
    if (!vals.length) return null;
    const [min, max] = [Math.min(...vals), Math.max(...vals)];
    return `${min === max ? reaisCentavos(min) : `de ${reaisCentavos(min)} a ${reaisCentavos(max)}`} (${ref26()})`;
  });
  tentar('obrasEmExecucao', () => (Number.isFinite(d.obras.resumo.porGrupo.execucao) ? numero(d.obras.resumo.porGrupo.execucao) : null));
  tentar('obrasParalisadas', () => (Number.isFinite(d.obras.resumo.paralisadas) ? numero(d.obras.resumo.paralisadas) : null));
  const iegm = () => {
    const anos = Object.keys(d.prefeitura.iegm.anos).filter((a) => d.prefeitura.iegm.anos[a].Salto && d.prefeitura.iegm.anos[a].Salto.iegm).sort();
    const ano = anos[anos.length - 1];
    return ano ? [ano, d.prefeitura.iegm.anos[ano].Salto.iegm] : [null, null];
  };
  tentar('notaIegm', () => { const [, f] = iegm(); return f ? `${f} (${(FAIXAS_IEGM[f] || '').toLowerCase()})`.replace(' ()', '') : null; });
  tentar('anoIegm', () => iegm()[0]);
  tentar('promessasEmAndamento', () => (Number.isFinite(d.promessas.resumo.porStatus['em andamento']) ? numero(d.promessas.resumo.porStatus['em andamento']) : null));
  return v;
}

// Troca {{chave}} pelo valor. Chave desconhecida ou sem dado: a frase inteira sai e a chave vai para `faltas`.
// Nunca devolve "{{" nem "}}".
export function preencher(t, valores, faltas = new Set()) {
  const s = String(t ?? '');
  if (!/\{\{|\}\}/.test(s)) return s;
  return s.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(])/).flatMap((frase) => {
    let ok = true;
    const nova = frase.replace(CHAVE, (m, k) => {
      if (Object.hasOwn(valores, k)) return valores[k];
      faltas.add(k);
      ok = false;
      return m;
    });
    if (!ok) return [];
    if (/\{\{|\}\}/.test(nova)) { faltas.add('(chaves mal fechadas)'); return []; }
    return [nova];
  }).join(' ').trim();
}

const notaNumeros = (d, usou) => (usou
  ? `<p class="nota atualizado">Os números de Salto neste texto saem dos dados oficiais e foram atualizados em ${esc(dataBR(diaSP(d.meta.atualizadoEm)))}.</p>`
  : '');

// existe(caminho): a página foi gerada (sem ela, o link não aparece).
const existePadrao = (c) => !paginaAusente(c);

function nomeDestino(r, artigos) {
  const m = String(r).split('#')[0].match(/^entenda\/([a-z0-9-]+)\.html$/);
  if (m) { const a = artigos.find((x) => x.slug === m[1]); return a ? a.titulo : r; }
  return PAGINAS_DESTINO[String(r).split('#')[0]] || r;
}

// Um texto do Entenda: entenda/<slug>.html. datas: { criado, quando } do lastmod (ISO com fuso), se houver.
export function paginaArtigo(a, artigos, d, valores, { datas = null, faltas = new Set(), existe = existePadrao } = {}) {
  const f = (x) => preencher(x, valores, faltas);
  const caminho = `entenda/${a.slug}.html`;
  const url = `${ENDERECO}${caminho}`;
  const secoes = a.secoes.map((s) => {
    const ps = s.paragrafos.map(f).filter(Boolean);
    const titulo = f(s.titulo);
    return ps.length && titulo ? `<section class="secao">\n<h2>${esc(titulo)}</h2>\n${ps.map((p) => `<p>${esc(p)}</p>`).join('\n')}\n</section>` : '';
  }).filter(Boolean).join('\n');
  const perguntas = (a.perguntas || []).map((q) => ({ pergunta: f(q.pergunta), resposta: f(q.resposta) })).filter((q) => q.pergunta && q.resposta);
  const vivos = (a.relacionados || []).filter((r) => existe(r));
  const veja = [
    ...vivos.map((r) => `<li><a href="${esc(hrefDe(r, '../'))}">${esc(nomeDestino(r, artigos))}</a></li>`),
    '<li><a href="../entenda.html">Todos os textos do Entenda</a></li>',
    ...(existe('perguntas-frequentes.html') ? ['<li><a href="../perguntas-frequentes.html">Perguntas frequentes</a></li>'] : []),
  ];
  const resumo = f(a.resumo);
  const descricao = f(a.descricao) || encurtar(resumo, 155);
  const corpo = `<article class="texto-entenda">
<h1>${esc(a.titulo)}</h1>
${resumo ? `<p class="resumo-entenda">${esc(resumo)}</p>` : ''}
${secoes}
${perguntas.length ? `<section id="perguntas" class="secao">
<h2>Perguntas sobre este tema</h2>
${perguntas.map((q) => `<h3>${esc(q.pergunta)}</h3>\n<p>${esc(q.resposta)}</p>`).join('\n')}
</section>` : ''}
<section id="fontes-texto" class="secao cartao">
<h2>Fontes</h2>
<ul class="lista">${a.fontes.map((x) => `<li>${link(x.url, esc(x.titulo))}</li>`).join('')}</ul>
${notaNumeros(d, chavesDe(JSON.stringify(a)).length > 0)}
</section>
<nav class="secao" aria-labelledby="t-veja">
<h2 id="t-veja">Veja também</h2>
<ul class="lista">${veja.join('')}</ul>
</nav>
</article>`;
  const publicado = datas && datas.criado;
  const modificado = (datas && datas.quando) || isoSP(d.meta.atualizadoEm);
  return layout({
    titulo: a.titulo,
    descricao,
    caminho,
    prefixo: '../',
    trilha: [{ nome: 'Entenda', caminho: 'entenda.html' }, { nome: a.titulo, caminho }],
    artigo: { publicado, modificado, secao: 'Entenda' },
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: encurtar(a.titulo, 110),
      description: descricao,
      url,
      mainEntityOfPage: url,
      inLanguage: 'pt-BR',
      image: `${ENDERECO}marca/previa.png`,
      author: ORGANIZACAO,
      publisher: ORGANIZACAO,
      ...(publicado ? { datePublished: publicado } : {}),
      dateModified: modificado,
      citation: a.fontes.map((x) => x.url),
    },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// Índice: entenda.html.
export function paginaEntenda(artigos, d, valores, { faltas = new Set(), existe = existePadrao } = {}) {
  const corpo = `<h1>Entenda</h1>
<p>Textos curtos que explicam como funcionam a Câmara, a Prefeitura e o dinheiro público de Salto/SP, sempre com o link para a lei ou para a fonte oficial.</p>
<ul class="lista-artigos">
${artigos.map((a) => `<li class="cartao"><a href="entenda/${esc(a.slug)}.html"><strong>${esc(a.titulo)}</strong></a><p>${esc(preencher(a.descricao, valores, faltas))}</p></li>`).join('\n')}
</ul>
${existe('perguntas-frequentes.html') ? '<p><a class="botao-secundario" href="perguntas-frequentes.html">Perguntas frequentes</a></p>' : ''}`;
  return layout({
    titulo: 'Entenda a Câmara e a Prefeitura de Salto/SP',
    descricao: 'Textos curtos e neutros sobre o que faz um vereador, como funciona o orçamento de Salto/SP, emendas, obras e como pedir informação, com link para a lei.',
    caminho: 'entenda.html',
    trilha: [{ nome: 'Entenda', caminho: 'entenda.html' }],
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Entenda', url: `${ENDERECO}entenda.html`, inLanguage: 'pt-BR', publisher: ORGANIZACAO },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// Perguntas frequentes: as mesmas perguntas visíveis viram o FAQPage (só nesta página).
export function paginaFaq(faq, artigos, d, valores, { faltas = new Set(), existe = existePadrao } = {}) {
  const itens = faq.map((q) => ({ ...q, pergunta: preencher(q.pergunta, valores, faltas), resposta: preencher(q.resposta, valores, faltas) }))
    .filter((q) => q.pergunta && q.resposta);
  const grupos = [...new Set(itens.map((q) => q.grupo))];
  const blocos = grupos.map((g) => `<section class="secao faq">
<h2>${esc(g)}</h2>
${itens.filter((q) => q.grupo === g).map((q) => `<h3>${esc(q.pergunta)}</h3>
<p>${esc(q.resposta)}${q.link && existe(q.link) ? ` <a href="${esc(hrefDe(q.link))}">Veja: ${esc(nomeDestino(q.link, artigos))}</a>` : ''}</p>`).join('\n')}
</section>`).join('\n');
  const corpo = `<h1>Perguntas frequentes</h1>
<p>Respostas curtas sobre a Câmara, a Prefeitura e o dinheiro de Salto/SP. Cada resposta leva à página com os dados oficiais.</p>
${blocos}
${notaNumeros(d, chavesDe(JSON.stringify(faq)).length > 0)}
<p><a class="botao-secundario" href="entenda.html">Textos do Entenda</a></p>`;
  return layout({
    titulo: 'Perguntas frequentes: Câmara e Prefeitura de Salto',
    descricao: 'Respostas curtas sobre vereadores, a Câmara, a Prefeitura, impostos, gastos e obras de Salto/SP, com link para os dados oficiais.',
    caminho: 'perguntas-frequentes.html',
    trilha: [{ nome: 'Perguntas frequentes', caminho: 'perguntas-frequentes.html' }],
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: `${ENDERECO}perguntas-frequentes.html`,
      inLanguage: 'pt-BR',
      mainEntity: itens.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })),
    },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}
