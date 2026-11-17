import { MEDICAO } from '../config.js';
import { esc } from '../util/texto.js';

// Cloudflare Web Analytics: conta todo visitante, sem cookie (por isso não pede consentimento).
export const scriptCloudflare = () => (MEDICAO.cloudflare
  ? `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(MEDICAO.cloudflare)}"}'></script>`
  : '');

// Barra de consentimento do Google Analytics. Começa escondida: só o busca.js a mostra (sem JS, sem GA).
// O Google só é carregado depois do "Aceitar".
export const barraCookies = (prefixo) => (MEDICAO.ga4
  ? `<div id="barra-cookies" class="barra-cookies" role="region" aria-label="Cookies" data-ga="${esc(MEDICAO.ga4)}" hidden><div class="barra-cookies-dentro">
<p>Usamos o Google Analytics para saber quais páginas ajudam mais. Só com o seu ok. <a href="${prefixo}fontes.html#privacidade">Saiba mais</a>.</p>
<div class="botoes"><button type="button" class="aceitar" data-cookies="aceitar">Aceitar</button><button type="button" class="recusar" data-cookies="recusar">Agora não</button></div>
</div></div>`
  : '');

// "index.html" vira a raiz do site; o resto, endereço + caminho.
export function sitemapXml(paginas, endereco, data) {
  const urls = [...new Set(paginas)].map((p) => {
    const loc = p === 'index.html' ? endereco : `${endereco}${p}`;
    return `<url><loc>${esc(loc)}</loc>${data ? `<lastmod>${esc(data)}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robotsTxt = (endereco) => `User-agent: *\nAllow: /\n\nSitemap: ${endereco}sitemap.xml\n`;
