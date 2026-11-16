import { AUTOR } from '../config.js';
import { esc } from '../util/texto.js';
import { iniciais, fotoSite } from './util.js';

const ENDERECO = 'https://sandersono.github.io/radar-saltense/';
const DESCRICAO = 'O que fazem os vereadores e a Prefeitura de Salto/SP, quanto a cidade arrecada e onde gasta. Só dado oficial, com link para a fonte, atualizado todo dia.';

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

export const apelidoHtml = (v) => (v.apelido ? ` <span class="apelido">“${esc(v.apelido)}”</span>` : '');

export function foto(v, prefixo, tamanho) {
  return v.fotoLocal
    ? `<img class="foto" src="${prefixo}${esc(fotoSite(v.fotoLocal))}" alt="Foto de ${esc(v.nome)}" width="${tamanho}" height="${tamanho}" loading="lazy">`
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

export const cartaoNumero = ({ valor, rotulo, href }) => href
  ? `<a class="cartao cartao-numero" href="${esc(href)}"><span class="numero-grande">${esc(valor)}</span><span class="numero-rotulo">${esc(rotulo)}</span></a>`
  : `<div class="cartao cartao-numero"><span class="numero-grande">${esc(valor)}</span><span class="numero-rotulo">${esc(rotulo)}</span></div>`;

export function layout({ titulo, corpo, prefixo = '', atualizadoEm, heroi = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${DESCRICAO}">
<meta name="theme-color" content="#0B2545">
<link rel="icon" type="image/png" sizes="32x32" href="${prefixo}marca/icone-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="${prefixo}marca/icone-192.png">
<link rel="apple-touch-icon" href="${prefixo}marca/icone-180.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Radar Saltense">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${DESCRICAO}">
<meta property="og:image" content="${ENDERECO}marca/previa.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logo do Radar Saltense">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${prefixo}estilo.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
<div class="topo-faixa"><div class="topo-barra">
<a class="marca" href="${prefixo}index.html"><img src="${prefixo}marca/logo.png" alt="Radar Saltense, página inicial" width="140" height="56"></a>
<button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu-principal">Menu</button>
<nav id="menu-principal" class="menu" aria-label="Principal"><a href="${prefixo}index.html#bairro">Seu bairro</a><a href="${prefixo}camara.html">Câmara</a><a href="${prefixo}prefeitura.html">Prefeitura</a><a href="${prefixo}impostometro.html">Impostos</a><a href="${prefixo}fontes.html">Fontes</a></nav>
</div></div>
${heroi ? `<div class="heroi">${heroi}</div>` : ''}
<svg class="onda" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 30C240 60 480 0 720 22S1200 50 1440 18V60H0Z"/></svg>
</header>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape"><div class="rodape-dentro">
<p class="rodape-marca">Radar Saltense</p>
<p>Atualizado em ${esc(quandoBR(atualizadoEm))}. Tudo sai de fontes oficiais: Câmara Municipal de Salto, Tribunal de Contas do Estado (TCE-SP), Tesouro Nacional, IBGE e Tribunal Superior Eleitoral (TSE). <a href="${prefixo}fontes.html">Veja de onde vêm os números</a>.</p>
<p>Radar Saltense é um projeto independente de ${esc(AUTOR.nome)}, morador de Salto, sem ligação com a Câmara, a Prefeitura ou partidos.</p>
<p>Achou um erro? Me chama no Instagram: <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>.</p>
</div></footer>
<script src="${prefixo}busca.js" defer></script>
</body>
</html>
`;
}
