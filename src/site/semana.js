import { esc } from '../util/texto.js';
import { layout, dataBR, numero, seloFonte, ENDERECO } from './base.js';
import { URL_PROPOSITURAS } from './camara.js';
import { hojeSP, resumoSemana, textoWhatsApp, tituloSemana } from '../regras/semana.js';

export const URL_VOTACOES = 'https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos';

// Usa o resumo já calculado (d.semana) ou calcula com a data da última atualização.
export const semanaDe = (d) => d.semana ?? resumoSemana(d, hojeSP(d.meta.atualizadoEm), d.meta.marcosAnteriores ?? null);

const lista = (itens) => `<ul class="lista">${itens.map((i) => `<li>${i}</li>`).join('')}</ul>`;

// Página do site onde cada tipo de novidade aparece.
export function paginaDaNovidade(texto) {
  if (/receitas/i.test(texto)) return 'impostometro.html';
  if (/gastos/i.test(texto)) return 'gastos.html';
  if (/folha/i.test(texto)) return 'camara.html#custo';
  if (/IEGM/.test(texto)) return 'prefeitura.html#nota';
  if (/obra/i.test(texto)) return 'prefeitura.html#obras';
  return null;
}

// url: endereço do site com barra final; o link do WhatsApp aponta para a página da semana.
export function paginaSemana(d, url = ENDERECO) {
  const r = semanaDe(d);
  const atuais = new Set((d.vereadores ?? []).map((v) => v.id));
  const verLista = (xs) => xs.map((x) => `${atuais.has(x.id) ? `<a href="vereador/${esc(x.id)}.html">${esc(x.nome)}</a>` : esc(x.nome)}: ${numero(x.total)}`);
  const s = [];
  if (r.proposituras.total) {
    s.push(`<section class="secao cartao">
<h2>Propostas novas</h2>
<p><strong>${numero(r.proposituras.total)}</strong> ${r.proposituras.total === 1 ? 'proposta nova' : 'propostas novas'} na Câmara.</p>
${lista(verLista(r.proposituras.porVereador))}
${r.proposituras.bairros.length ? `<p>Bairros mais citados: ${r.proposituras.bairros.map((b) => `${esc(b.nome)} (${numero(b.total)})`).join(', ')}.</p>` : ''}
<p>${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}</p>
</section>`);
  }
  if (r.votacoes.length) {
    s.push(`<section class="secao cartao">
<h2>Votações da semana</h2>
${lista(r.votacoes.map((v) => `<strong>${esc(v.rotulo)}</strong>, ${dataBR(v.data)}: ${esc(v.resultado)}${v.contra.length ? `. Votaram contra: ${v.contra.map(esc).join(', ')}` : ''}`))}
<p><a href="votacoes.html">Todas as votações</a> ${seloFonte(URL_VOTACOES, 'resultado das votações (PDF da Câmara)')}</p>
</section>`);
  }
  if (r.respondidos.total) {
    s.push(`<section class="secao cartao">
<h2>Requerimentos respondidos</h2>
<p><strong>${numero(r.respondidos.total)}</strong> ${r.respondidos.total === 1 ? 'requerimento recebeu resposta' : 'requerimentos receberam resposta'} da Prefeitura.</p>
${lista(verLista(r.respondidos.porVereador))}
<p><a href="camara.html#respostas">Como contamos as respostas</a> ${seloFonte(URL_PROPOSITURAS, 'portal de proposituras da Câmara')}</p>
</section>`);
  }
  if (r.novidades.length) {
    s.push(`<section class="secao cartao">
<h2>Dados oficiais novos</h2>
${lista(r.novidades.map((t) => { const p = paginaDaNovidade(t); return p ? `<a href="${p}">${esc(t)}</a>` : esc(t); }))}
</section>`);
  }
  const zap = `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(r, `${url}semana.html`))}`;
  const corpo = `<h1>Resumo da semana</h1>
<p>${esc(tituloSemana(r).replace('Resumo da semana de', 'De'))}. Só entra aqui o que mudou.</p>
${s.length ? s.join('\n') : '<section class="secao cartao"><p>Nada de novo nos dados oficiais desta semana.</p></section>'}
<p><a class="botao" href="${esc(zap)}">Compartilhar no WhatsApp</a></p>
<p class="nota">O resumo é refeito todo dia com os dados oficiais da Câmara, da Prefeitura e do TCE-SP, sempre dos últimos 7 dias. <a href="feed.xml">Assinar por RSS</a> (um item por semana).</p>`;
  return layout({ titulo: 'Resumo da semana: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
