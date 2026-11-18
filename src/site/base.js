import { AUTOR, CAMARA } from '../config.js';
import { esc } from '../util/texto.js';
import { iniciais, fotoSite } from './util.js';
import { scriptCloudflare, barraCookies } from './medicao.js';

export const ENDERECO = 'https://radarsaltense.com.br/';
export const DESCRICAO = 'O que fazem os vereadores e a Prefeitura de Salto/SP, quanto a cidade arrecada e onde gasta. Só dado oficial, com link para a fonte, atualizado todo dia.';

export const GRUPOS_PUBLICOS = ['melhoria', 'cobranca', 'homenagem', 'lei', 'outros'];
export const AVISO_NOMES = 'Nomes escritos de outro jeito no PDF, que não são nem o nome nem o apelido oficial, ficam de fora e podem mudar estes números.';

export const dataBR = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
export const reais = (v) => Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const reaisCentavos = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const numero = (v) => Number(v).toLocaleString('pt-BR');
export const quandoBR = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
export const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener">${texto}</a>`;
export const seloFonte = (url, texto = 'fonte oficial') =>
  `<a class="selo-fonte" href="${esc(url)}" target="_blank" rel="noopener">${esc(texto)} <span aria-hidden="true">↗</span></a>`;
export const aviso = (html) => `<p class="aviso"><span class="aviso-icone" aria-hidden="true">i</span><span>${html}</span></p>`;

// Receitas ou despesas do TCE-SP repetidas da última coleta boa (a fonte não respondeu): o site diz até quando vão.
export function avisoTce(d, fonte) {
  const datas = d.meta && d.meta.tceColetadoEm;
  if (!datas || !(fonte in datas) || datas[fonte] === d.meta.atualizadoEm) return '';
  const em = datas[fonte];
  if (!em) return aviso('A fonte do TCE-SP não respondeu na última atualização; o site mostra o último dado salvo.');
  const dia = new Date(em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return aviso(`Dados do TCE-SP até ${esc(dia)}; a fonte não respondeu na última atualização.`);
}

// Fileira de atalhos para as seções da página. Só entram as seções que existem em `html`; com menos de 2, nada.
export function sumario(html, itens) {
  const validos = itens.filter(([id]) => html.includes(`id="${id}"`));
  return validos.length > 1
    ? `<nav class="sumario" aria-label="Nesta página">${validos.map(([id, texto]) => `<a class="chip" href="#${id}">${esc(texto)}</a>`).join('')}</nav>`
    : '';
}

export const apelidoHtml =(v) => (v.apelido ? ` <span class="apelido">“${esc(v.apelido)}”</span>` : '');

// prioridade: foto do topo da página (sem lazy, baixada primeiro).
export function foto(v, prefixo, tamanho, prioridade = false) {
  return v.fotoLocal
    ? `<img class="foto" src="${prefixo}${esc(fotoSite(v.fotoLocal))}" alt="Foto de ${esc(v.nome)}" width="${tamanho}" height="${tamanho}" ${prioridade ? 'fetchpriority="high"' : 'loading="lazy"'}>`
    : `<span class="foto foto-iniciais" style="width:${tamanho}px;height:${tamanho}px" aria-hidden="true">${esc(iniciais(v.nome))}</span>`;
}

export function barraProporcao(segmentos, formato = numero) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  if (!total) return '';
  const pct = (v) => String(Math.round((v / total) * 1000) / 10).replace('.', ',');
  const fatias = segmentos.filter((x) => x.valor > 0)
    .map((x) => `<span class="fatia ${x.classe}" style="width:${((x.valor / total) * 100).toFixed(2)}%" title="${esc(x.rotulo)}: ${formato(x.valor)}"></span>`).join('');
  const legenda = segmentos
    .map((x) => `<li><span class="ponto ${x.classe}" aria-hidden="true"></span>${esc(x.rotulo)} <strong>${formato(x.valor)}</strong> <small>(${pct(x.valor)}%)</small></li>`).join('');
  const rotulo = segmentos.map((x) => `${x.rotulo}: ${formato(x.valor)}`).join('; ');
  return `<div class="proporcao" role="img" aria-label="${esc(rotulo)}">${fatias}</div><ul class="legenda">${legenda}</ul>`;
}

// Número longo (ex.: "R$ 192.825.486") não cabe em meia tela de celular: o cartão ganha a classe "largo" e ocupa a linha inteira.
export const cartaoNumero = ({ valor, rotulo, href }) => {
  const classe = `cartao cartao-numero${String(valor).length > 9 ? ' largo' : ''}`;
  const miolo = `<span class="numero-grande">${esc(valor)}</span><span class="numero-rotulo">${esc(rotulo)}</span>`;
  return href ? `<a class="${classe}" href="${esc(href)}">${miolo}</a>` : `<div class="${classe}">${miolo}</div>`;
};

// Endereço absoluto de uma página do site; "index.html" vira a raiz.
export const enderecoDe = (caminho) => (caminho === 'index.html' ? ENDERECO : `${ENDERECO}${caminho}`);

// Link interno a partir do prefixo da página ('' na raiz, '../' numa pasta, '/' na 404).
// A página inicial é sempre a raiz canônica ("./", "../" ou "/"), nunca "index.html".
export const raiz = (prefixo) => prefixo || './';
export const hrefDe = (caminho, prefixo = '') => (caminho.startsWith('index.html') ? `${raiz(prefixo)}${caminho.slice('index.html'.length)}` : `${prefixo}${caminho}`);

// Dado estruturado (schema.org) para buscadores; "</" vira "<\/" para nunca fechar o <script> antes da hora.
export const jsonLd = (dado) => `<script type="application/ld+json">${JSON.stringify(dado).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--')}</script>`;

export const CAMARA_JSONLD = { '@type': 'GovernmentOrganization', name: 'Câmara Municipal de Salto', url: CAMARA, sameAs: CAMARA };

// O site como organização (Sobre, home e autor/editor dos textos). Sem cargo e sem gênero para pessoas.
export const ORG_ID = `${ENDERECO}#organizacao`;
const LOGO = { '@type': 'ImageObject', url: `${ENDERECO}marca/logo.png`, width: 280, height: 112 };
export const ORGANIZACAO = { '@type': 'Organization', '@id': ORG_ID, name: 'Radar Saltense', url: ENDERECO, logo: LOGO };
export const organizacaoJsonLd = () => ({
  '@context': 'https://schema.org',
  ...ORGANIZACAO,
  description: DESCRICAO,
  sameAs: [`https://instagram.com/${AUTOR.instagram}`],
  founder: { '@type': 'Person', name: AUTOR.nome },
});

// Instante em ISO com o fuso de São Paulo (sem horário de verão desde 2019): "2026-11-17T21:43:00-03:00".
export const isoSP = (instante) => `${new Date(new Date(instante).getTime() - 3 * 3600e3).toISOString().slice(0, 19)}-03:00`;
export const diaSP = (instante) => new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// Títulos: sufixo uniforme e até 70 caracteres. Título longo é encurtado antes do sufixo
// (primeiro na parte antes de ":" ou "(", depois numa palavra, com reticências).
export const SUFIXO = ' | Radar Saltense';
export const MAX_TITULO = 70;
export function encurtar(texto, max) {
  const t = String(texto).trim();
  if (t.length <= max) return t;
  for (const sep of [':', ' (', ' —', ',']) {
    const i = t.indexOf(sep);
    if (i > 0 && i <= max) return t.slice(0, i).trim();
  }
  // Sem separador: corta antes de um conectivo (" e ", " pela "…), se sobrar uma frase com sentido.
  for (const con of [' pela ', ' pelo ', ' para ', ' com ', ' e ']) {
    const i = t.lastIndexOf(con, max);
    if (i >= 20) return t.slice(0, i).trim();
  }
  const corte = t.slice(0, max - 1);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), 1)).replace(/[\s,;:.\-–]+$/, '')}…`;
}
export const tituloCompleto = (titulo) => `${encurtar(titulo, MAX_TITULO - SUFIXO.length)}${SUFIXO}`;

// Trilha de navegação: "Início" e os níveis acima da página; o último item é a própria página.
const comInicio = (trilha) => [{ nome: 'Início', caminho: 'index.html' }, ...trilha];
export function trilhaHtml(trilha, prefixo = '') {
  const itens = comInicio(trilha);
  return `<nav class="trilha" aria-label="Você está em"><ol>${itens.map((x, i) => (i === itens.length - 1
    ? `<li><span aria-current="page">${esc(x.nome)}</span></li>`
    : `<li><a href="${esc(hrefDe(x.caminho, prefixo))}">${esc(x.nome)}</a></li>`)).join('')}</ol></nav>`;
}
export const trilhaJsonLd = (trilha) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: comInicio(trilha).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.nome, item: enderecoDe(x.caminho) })),
});

// Rodapé com todas as seções. Página que não foi gerada nesta rodada (sem dado) sai da lista.
const SECOES = [
  ['index.html#vereadores', 'Vereadores'], ['camara.html', 'Câmara'], ['prefeitura.html', 'Prefeitura'], ['obras.html', 'Obras'],
  ['gastos.html', 'Gastos'], ['origem.html', 'De onde vem o dinheiro'], ['impostometro.html', 'Impostos'], ['promessas.html', 'Promessas'],
  ['votacoes.html', 'Votações'], ['bairros.html', 'Bairros'], ['semana.html', 'Resumo da semana'],
];
const SITE = [['entenda.html', 'Entenda'], ['perguntas-frequentes.html', 'Perguntas frequentes'], ['sobre.html', 'Sobre'], ['fontes.html', 'Fontes']];
let ausentes = new Set();
export const definirPaginasAusentes = (lista = []) => { ausentes = new Set(lista); };
export const paginaAusente = (caminho) => ausentes.has(caminho.split('#')[0]);
function rodapeNav(prefixo) {
  const lista = (itens) => `<ul>${itens.filter(([c]) => !paginaAusente(c)).map(([c, nome]) => `<li><a href="${esc(hrefDe(c, prefixo))}">${esc(nome)}</a></li>`).join('')}</ul>`;
  return `<nav class="rodape-nav" aria-label="Todas as seções">
<p class="rodape-titulo">Seções</p>
${lista(SECOES)}
<p class="rodape-titulo">Sobre o site</p>
${lista(SITE)}
</nav>`;
}

const atualizadoHtml = (instante) => {
  const dia = diaSP(instante);
  return `<p class="atualizado">Atualizado em <time datetime="${esc(dia)}">${esc(dataBR(dia))}</time></p>`;
};

// descricao: frase curta (até ~155 caracteres) para o Google e as prévias de link; caminho: ex. "vereador/x.html" ou "index.html".
// trilha: [{ nome, caminho }] sem "Início" (entra sozinho); robots: ex. "noindex"; imagem: { url, alt } da prévia;
// artigo: { publicado, modificado, secao } (og:type article); mostrarAtualizado: "Atualizado em" logo abaixo do h1.
export function layout({ titulo, corpo, prefixo = '', atualizadoEm, heroi = '', descricao = DESCRICAO, caminho = '', jsonld = null, trilha = null, robots = null, imagem = null, artigo = null, mostrarAtualizado = false }) {
  const canonico = caminho ? enderecoDe(caminho) : '';
  const completo = tituloCompleto(titulo);
  const curto = encurtar(titulo, MAX_TITULO);
  const img = imagem || { url: `${ENDERECO}marca/previa.png`, alt: 'Logo do Radar Saltense' };
  const dados = [...(Array.isArray(jsonld) ? jsonld : jsonld ? [jsonld] : []), ...(trilha ? [trilhaJsonLd(trilha)] : [])];
  const miolo = mostrarAtualizado && atualizadoEm ? corpo.replace(/<\/h1>/, `</h1>\n${atualizadoHtml(atualizadoEm)}`) : corpo;
  const artigoMeta = artigo
    ? [artigo.publicado && `<meta property="article:published_time" content="${esc(artigo.publicado)}">`,
      artigo.modificado && `<meta property="article:modified_time" content="${esc(artigo.modificado)}">`,
      artigo.secao && `<meta property="article:section" content="${esc(artigo.secao)}">`].filter(Boolean).map((x) => `${x}\n`).join('')
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(completo)}</title>
<meta name="description" content="${esc(descricao)}">
${robots ? `<meta name="robots" content="${esc(robots)}">\n` : ''}${canonico ? `<link rel="canonical" href="${esc(canonico)}">\n` : ''}<meta name="theme-color" content="#0B2545">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="192x192" href="${prefixo}marca/icone-192.png">
<link rel="apple-touch-icon" href="${prefixo}marca/icone-180.png">
<link rel="preload" href="${prefixo}fontes/inter-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${prefixo}fontes/nunito-800.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:type" content="${artigo ? 'article' : 'website'}">
<meta property="og:site_name" content="Radar Saltense">
<meta property="og:title" content="${esc(curto)}">
<meta property="og:description" content="${esc(descricao)}">
${canonico ? `<meta property="og:url" content="${esc(canonico)}">\n` : ''}<meta property="og:locale" content="pt_BR">
<meta property="og:image" content="${esc(img.url)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(img.alt)}">
${artigoMeta}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(curto)}">
<meta name="twitter:description" content="${esc(descricao)}">
<meta name="twitter:image" content="${esc(img.url)}">
<link rel="alternate" type="application/rss+xml" title="Radar Saltense: resumo da semana" href="${prefixo}feed.xml">
<link rel="stylesheet" href="${prefixo}estilo.css">
<script>document.documentElement.classList.add('js')</script>
${dados.map((x) => `${jsonLd(x)}\n`).join('')}
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
<div class="topo-faixa"><div class="topo-barra">
<a class="marca" href="${raiz(prefixo)}"><img src="${prefixo}marca/logo.png" alt="Radar Saltense, página inicial" width="140" height="56"></a>
<button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu-principal">Menu</button>
<nav id="menu-principal" class="menu" aria-label="Principal"><a href="${raiz(prefixo)}#bairro">Seu bairro</a><a href="${prefixo}camara.html">Câmara</a><a href="${prefixo}prefeitura.html">Prefeitura</a><a href="${prefixo}impostometro.html">Impostos</a><a href="${prefixo}semana.html">Resumo da semana</a><a href="${prefixo}fontes.html">Fontes</a></nav>
</div></div>
${heroi ? `<div class="heroi">${heroi}</div>` : ''}
<svg class="onda" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 30C240 60 480 0 720 22S1200 50 1440 18V60H0Z"/></svg>
</header>
<main id="conteudo">
${trilha ? `${trilhaHtml(trilha, prefixo)}\n` : ''}${miolo}
</main>
<footer class="rodape"><div class="rodape-dentro">
<p class="rodape-marca">Radar Saltense</p>
${rodapeNav(prefixo)}
<p>Atualizado em ${esc(quandoBR(atualizadoEm))}. Tudo sai de fontes oficiais: Câmara Municipal de Salto, Tribunal de Contas do Estado (TCE-SP), Tesouro Nacional, IBGE e Tribunal Superior Eleitoral (TSE). <a href="${prefixo}fontes.html">Veja de onde vêm os números</a>.</p>
<p>Radar Saltense é um projeto independente de ${esc(AUTOR.nome)}, morador de Salto, sem ligação com a Câmara, a Prefeitura ou partidos.</p>
<p>Achou um erro? Me chama no Instagram: <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>.</p>
<p><a href="${prefixo}fontes.html#privacidade">Privacidade e audiência</a><span id="abrir-cookies-caixa" hidden> · <button type="button" id="abrir-cookies" class="botao-link">Cookies</button></span></p>
</div></footer>
${barraCookies(prefixo)}
<script src="${prefixo}busca.js" defer></script>
${scriptCloudflare()}
</body>
</html>
`;
}
