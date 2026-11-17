import { esc } from '../util/texto.js';
import { layout, dataBR, numero } from './base.js';
import { hojeSP, resumoSemana, textoWhatsApp, tituloSemana } from '../regras/semana.js';

export const URL_SEMANA = 'https://radarsaltense.com.br/semana.html';

// Usa o resumo já calculado (d.semana) ou calcula com a data da última atualização.
export const semanaDe = (d) => d.semana ?? resumoSemana(d, hojeSP(d.meta.atualizadoEm), d.meta.marcosAnteriores ?? null);

const lista = (itens) => `<ul class="lista">${itens.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const verLista = (xs) => xs.map((x) => `${esc(x.nome)}: ${numero(x.total)}`);

export function paginaSemana(d) {
  const r = semanaDe(d);
  const s = [];
  if (r.proposituras.total) {
    s.push(`<section class="secao cartao">
<h2>Propostas novas</h2>
<p><strong>${numero(r.proposituras.total)}</strong> ${r.proposituras.total === 1 ? 'proposta nova' : 'propostas novas'} na Câmara.</p>
${lista(verLista(r.proposituras.porVereador))}
${r.proposituras.bairros.length ? `<p>Bairros mais citados: ${r.proposituras.bairros.map((b) => `${esc(b.nome)} (${numero(b.total)})`).join(', ')}.</p>` : ''}
</section>`);
  }
  if (r.votacoes.length) {
    s.push(`<section class="secao cartao">
<h2>Votações da semana</h2>
${lista(r.votacoes.map((v) => `<strong>${esc(v.rotulo)}</strong>, ${dataBR(v.data)}: ${esc(v.resultado)}${v.contra.length ? `. Votaram contra: ${v.contra.map(esc).join(', ')}` : ''}`))}
</section>`);
  }
  if (r.respondidos.total) {
    s.push(`<section class="secao cartao">
<h2>Requerimentos respondidos</h2>
<p><strong>${numero(r.respondidos.total)}</strong> ${r.respondidos.total === 1 ? 'requerimento recebeu resposta' : 'requerimentos receberam resposta'} da Prefeitura.</p>
${lista(verLista(r.respondidos.porVereador))}
</section>`);
  }
  if (r.novidades.length) {
    s.push(`<section class="secao cartao">
<h2>Dados oficiais novos</h2>
${lista(r.novidades.map(esc))}
</section>`);
  }
  const zap = `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(r, URL_SEMANA))}`;
  const corpo = `<h1>Resumo da semana</h1>
<p>${esc(tituloSemana(r).replace('Resumo da semana de', 'De'))}. Só entra aqui o que mudou.</p>
${s.length ? s.join('\n') : '<section class="secao cartao"><p>Nada de novo nos dados oficiais desta semana.</p></section>'}
<p><a class="botao" href="${esc(zap)}">Compartilhar no WhatsApp</a></p>
<p class="nota">O resumo é refeito todo dia com os dados oficiais da Câmara, da Prefeitura e do TCE-SP. <a href="feed.xml">Assinar por RSS</a>.</p>`;
  return layout({ titulo: 'Resumo da semana: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
