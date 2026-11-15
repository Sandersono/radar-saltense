import { SALARIO, ANO_INICIO, AUTOR, fichaOficial } from '../config.js';
import { GRUPOS } from '../regras/classificar.js';
import { TIPOS_NOME } from '../regras/local.js';
import { esc } from '../util/texto.js';
import { layout, dataBR, link, numero, aviso, foto, barraProporcao, cartaoNumero, quandoBR, GRUPOS_PUBLICOS, AVISO_NOMES, apelidoHtml } from './base.js';
import { percentual, sugestoesBairros } from './util.js';
import { blocoContador } from './impostometro.js';

const ORDENS = [
  ['nome', 'Nome (A–Z)'],
  ['faltas', 'Quem mais faltou'],
  ['lei', 'Mais propostas de lei'],
  ['homenagem', 'Mais homenagens'],
  ['melhoria', 'Mais pedidos para os bairros'],
  ['contra', 'Quem mais votou contra'],
];

function cartaoVereador(v) {
  const pr = v.presenca;
  return `<li class="cartao cartao-vereador" data-nome="${esc(v.nome)}" data-apelido="${esc(v.apelido || '')}" data-partido="${esc(v.partido)}" data-faltas="${pr.A}" data-lei="${v.porGrupo.lei}" data-homenagem="${v.porGrupo.homenagem}" data-melhoria="${v.porGrupo.melhoria}" data-contra="${v.votosContra}">
<a class="cartao-vereador-topo" href="vereador/${esc(v.id)}.html">${foto(v, '', 64)}<span><strong>${esc(v.nome)}${apelidoHtml(v)}</strong><span class="partido">${esc(v.partido)}</span></span></a>
<div class="presenca-resumo"><span>Presença: <strong>${pr.P} de ${pr.total}</strong> sessões</span><span class="presenca-barra" aria-hidden="true"><span class="presenca-preenchida" style="width:${percentual(pr.P, pr.total)}%"></span></span></div>
<dl class="cartao-dados"><dt>Faltas</dt><dd>${pr.A}</dd><dt>Pedidos para os bairros</dt><dd>${v.porGrupo.melhoria}</dd><dt>Perguntas e cobranças</dt><dd>${v.porGrupo.cobranca}</dd><dt>Propostas de lei</dt><dd>${v.porGrupo.lei}</dd><dt>Homenagens</dt><dd>${v.porGrupo.homenagem}</dd><dt>Votou contra</dt><dd>${v.votosContra}</dd></dl>
</li>`;
}

export function paginaInicial(d) {
  const n = d.vereadores.length;
  const salario = SALARIO
    ? `<p class="destaque">Salário pago aos ${n} vereadores desde a posse: <strong id="contador-salario" data-mensal="${SALARIO.valorMensal * n}" data-inicio="${ANO_INICIO}-01-01">—</strong><br><small>Estimativa: ${n} salários de R$ ${SALARIO.valorMensal.toLocaleString('pt-BR')} por mês desde 1º de janeiro de ${ANO_INICIO}. ${link(SALARIO.fonte, 'fonte oficial')}</small></p>`
    : '';
  const repetidos = d.repetidos.slice(0, 30).map((r, i) =>
    `<li${i >= 10 ? ' data-extra' : ''}><strong>${esc(r.rua)}</strong>: ${esc(TIPOS_NOME[r.tipo] || r.tipo)}, pedido ${r.pedidos.length} vezes
<details><summary>ver datas e autores</summary><ul class="lista">${r.pedidos.map((p) => `<li><span class="data">${dataBR(p.data)}</span> ${esc(p.autores)} ${link(fichaOficial(p.id), 'ficha')}</li>`).join('')}</ul></details></li>`).join('\n');
  const extras = Math.max(0, Math.min(30, d.repetidos.length) - 10);
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, d.proposituras.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) =>
    `<details class="grupo" data-grupo="${g}"><summary>${esc(GRUPOS[g])} <span class="num">${contagem[g]}</span></summary><ul class="lista"></ul></details>`).join('\n');
  const proporcao = barraProporcao(GRUPOS_PUBLICOS.map((g) => ({ rotulo: GRUPOS[g], valor: contagem[g], classe: `g-${g}` })));
  const partidos = [...new Set(d.vereadores.map((v) => v.partido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sessoes = Math.max(0, ...d.vereadores.map((v) => v.presenca.total));
  const totalVotacoes = d.votacoes.reduce((s, p) => s + p.eventos.length, 0);
  const sugestoes = sugestoesBairros(d.locais);

  const heroi = `<p class="heroi-sobre">Salto · SP</p>
<h1>Salto de olho na Câmara</h1>
<p>O que cada vereador fez desde a posse, atualizado todo dia. Só dado oficial, com link para a fonte.</p>
<p class="atualizado">Atualizado em ${esc(quandoBR(d.meta.atualizadoEm))}</p>`;

  const corpo = `${salario}
${d.receitas ? blocoContador(d.receitas, '', false) : ''}
<section id="bairro" class="secao">
<h2>O que pediram pro seu bairro?</h2>
<p>Veja tudo o que os vereadores pediram para a sua rua ou o seu bairro, com link para o documento oficial.</p>
<label class="sr-only" for="busca-bairro">Nome do bairro ou da rua</label>
<input id="busca-bairro" class="busca" type="search" placeholder="Digite o bairro ou a rua" autocomplete="off">
${sugestoes.length ? `<div class="sugestoes" role="group" aria-label="Bairros com mais pedidos">${sugestoes.map((s) => `<button type="button" class="chip" data-busca="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
<div id="resultado-busca" aria-live="polite"></div>
</section>
<section class="secao" aria-labelledby="t-numeros">
<h2 id="t-numeros">A Câmara em números</h2>
<div class="grade-numeros">
${cartaoNumero({ valor: numero(d.proposituras.length), rotulo: `propostas desde ${ANO_INICIO}`, href: '#trabalho' })}
${cartaoNumero({ valor: numero(new Set(d.repetidos.map((r) => r.rua)).size), rotulo: 'ruas com pedido repetido', href: '#repetidos' })}
${cartaoNumero({ valor: numero(sessoes), rotulo: 'sessões com presença registrada', href: '#vereadores' })}
${cartaoNumero({ valor: numero(totalVotacoes), rotulo: 'votações registradas', href: 'votacoes.html' })}
</div>
</section>
<section id="vereadores" class="secao">
<h2>Os ${n} vereadores</h2>
${aviso(AVISO_NOMES)}
<div class="filtros">
<input id="filtro-nome" class="busca busca-pequena" type="search" placeholder="Buscar por nome" aria-label="Buscar vereador por nome">
<select id="filtro-partido" aria-label="Filtrar por partido"><option value="">Todos os partidos</option>${partidos.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
</div>
<div class="ordens" role="group" aria-label="Ordenar vereadores">${ORDENS.map(([k, r], i) => `<button type="button" class="chip" data-ordem="${k}" aria-pressed="${i === 0}">${r}</button>`).join('')}</div>
<ul id="lista-vereadores" class="cartoes">
${d.vereadores.map(cartaoVereador).join('\n')}
</ul>
</section>
<section id="repetidos" class="secao">
<h2>O problema que não some</h2>
<p>Pedidos do mesmo tipo que voltaram mais de uma vez para a mesma rua. No site da Câmara, cada pedido aparece sozinho. Aqui eles são cruzados.</p>
${aviso('Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.')}
<ol class="lista cartao">${repetidos}</ol>
${extras ? `<p><button type="button" class="botao-secundario" id="ver-mais-repetidos" hidden>Ver mais ${extras} casos</button></p>` : ''}
</section>
<section id="trabalho" class="secao">
<h2>Homenagem ou trabalho?</h2>
<p>Todas as propostas desde ${ANO_INICIO}, separadas pela mesma regra para todos os vereadores. <a href="fontes.html#regras">Veja a regra</a>.</p>
${proporcao}
${grupos}
</section>
<section class="secao chamadas">
<a class="cartao chamada" href="fontes.html"><strong>De onde vêm os números</strong><span>Todas as fontes oficiais e as regras usadas, para você conferir.</span></a>
<a class="cartao chamada" href="https://instagram.com/${AUTOR.instagram}"><strong>Achou um erro?</strong><span>Me chama no Instagram @${AUTOR.instagram}.</span></a>
</section>`;
  return layout({ titulo: 'Radar Saltense: o que cada vereador de Salto fez', corpo, atualizadoEm: d.meta.atualizadoEm, heroi });
}
