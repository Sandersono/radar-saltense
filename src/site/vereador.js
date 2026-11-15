import { ANO_INICIO, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { esc } from '../util/texto.js';
import { layout, dataBR, link, aviso, foto, seloFonte, barraProporcao, cartaoNumero, GRUPOS_PUBLICOS, AVISO_NOMES } from './base.js';
import { percentual } from './util.js';

const ROTULO_MARCA = { P: 'presente', A: 'falta', AJ: 'falta justificada', vazio: 'sem registro' };

const itemProposta = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

export function paginaVereador(v, d) {
  const props = d.proposituras.filter((p) => p.vereadores.includes(v.id));
  const pres = d.presenca[v.id];
  const sessoes = [...pres.sessoes].reverse().map((s) =>
    `<tr><td>${dataBR(s.data)}</td><td class="m-${s.marca || 'vazio'}">${s.marca || '—'}</td><td>${link(s.url, 'PDF')}</td></tr>`).join('');
  const bolinhas = pres.sessoes.map((s) => {
    const marca = s.marca || 'vazio';
    const texto = `${dataBR(s.data)}: ${ROTULO_MARCA[marca]}`;
    return `<li class="bolinha b-${marca}" title="${texto}"><span class="sr-only">${texto}</span></li>`;
  }).join('');
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, props.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) => {
    const lista = props.filter((p) => p.grupo === g);
    return `<details><summary>${esc(GRUPOS[g])} <span class="num">${lista.length}</span></summary><ul class="lista">${lista.map(itemProposta).join('')}</ul></details>`;
  }).join('\n');
  const votos = (campo) =>
    d.votacoes.flatMap((pj) => pj.eventos.filter((e) => e[campo].includes(v.id)).map((e) =>
      `<li><span class="data">${dataBR(e.data)}</span> ${esc(pj.rotulo)}${e.turno ? ` (${esc(e.turno)})` : ''}: ${esc(e.resultado)} ${link(e.url, 'PDF')}</li>`)).join('') || '<li>Nenhum registro.</li>';
  const veja = d.avisos && d.avisos.length ? ' Veja os <a href="../fontes.html#avisos">avisos sobre os dados oficiais</a>.' : '';

  const corpo = `<section class="perfil cartao">
${foto(v, '../', 120)}
<div>
<h1>${esc(v.nome)}</h1>
<p class="partido">${esc(v.partido)}</p>
<p>${seloFonte(v.url, 'página oficial na Câmara')}</p>
${v.fotoLocal ? '<p class="credito">Foto: Câmara Municipal de Salto</p>' : ''}
</div>
</section>
<section class="secao">
<div class="grade-numeros">
${cartaoNumero({ valor: `${percentual(pres.P, pres.sessoes.length)}%`, rotulo: `de presença (${pres.P} de ${pres.sessoes.length} sessões)` })}
${cartaoNumero({ valor: String(props.length), rotulo: `propostas desde ${ANO_INICIO}` })}
${cartaoNumero({ valor: String(v.votosContra), rotulo: 'vezes votou contra' })}
</div>
</section>
<section class="secao cartao">
<h2>Presença</h2>
<ul class="bolinhas" aria-label="Presença sessão por sessão, da mais antiga para a mais nova">${bolinhas}</ul>
<ul class="legenda"><li><span class="ponto b-P" aria-hidden="true"></span>presente</li><li><span class="ponto b-A" aria-hidden="true"></span>falta</li><li><span class="ponto b-AJ" aria-hidden="true"></span>falta justificada</li><li><span class="ponto b-vazio" aria-hidden="true"></span>sem registro</li></ul>
<p><strong>${pres.P}</strong> presenças, <strong>${pres.A}</strong> faltas e <strong>${pres.AJ}</strong> ausências justificadas, em ${pres.sessoes.length} sessões registradas.</p>
${aviso(`As sessões extraordinárias aparecem junto com as ordinárias. Célula vazia no PDF não conta como falta.${veja}`)}
<details><summary>Sessão por sessão</summary><table><thead><tr><th>Data</th><th>Registro</th><th>Fonte</th></tr></thead><tbody>${sessoes}</tbody></table></details>
</section>
<section class="secao cartao">
<h2>Propostas</h2>
<p>${props.length} propostas desde ${ANO_INICIO}. Proposta com mais de um autor conta para cada um.</p>
${barraProporcao(GRUPOS_PUBLICOS.map((g) => ({ rotulo: GRUPOS[g], valor: contagem[g], classe: `g-${g}` })))}
${grupos}
</section>
<section class="secao cartao">
<h2>Votações</h2>
${aviso(`Leitura do documento oficial de votações. Ele só cita quem votou contra ou faltou, e o site não deduz votos a favor. ${AVISO_NOMES}`)}
<h3>Votou contra</h3><ul class="lista">${votos('contra')}</ul>
<h3>Ausente na votação</h3><ul class="lista">${votos('ausentes')}</ul>
</section>`;
  return layout({ titulo: `${v.nome}: Radar Saltense`, corpo, prefixo: '../', atualizadoEm: d.meta.atualizadoEm });
}
