import { esc } from '../util/texto.js';
import { ORIGENS_CAMPANHA } from '../regras/campanha.js';
import { reais, numero, seloFonte, barraProporcao } from './base.js';

// Cartão da campanha de 2024 de um candidato (vereador ou prefeito). `c` vem de campanha.candidatos.
export function cartaoCampanha(c, { titulo = 'Campanha de 2024', sujeito = 'Recebeu' } = {}) {
  if (!c) return '';
  const partes = Object.entries(ORIGENS_CAMPANHA).map(([k, rotulo]) => ({ rotulo, valor: c.origens[k] || 0, classe: `o-${k}` })).filter((x) => x.valor > 0);
  return `<section class="secao cartao">
<h2>${esc(titulo)}</h2>
<p>${esc(sujeito)} <strong>${reais(c.total)}</strong>${c.doadoresPessoas > 0 ? `. ${numero(c.doadoresPessoas)} ${c.doadoresPessoas === 1 ? 'pessoa doou' : 'pessoas doaram'}` : ''}.</p>
${barraProporcao(partes, reais)}
<p>${seloFonte(c.link, 'ver doadores no TSE')}</p>
</section>`;
}
