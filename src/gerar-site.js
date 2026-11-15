import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { SALARIO, ANO_INICIO, fichaOficial } from './config.js';
import { GRUPOS } from './regras/classificar.js';
import { TIPOS_NOME } from './regras/local.js';
import { esc } from './util/texto.js';
import { layout, dataBR, link, GRUPOS_PUBLICOS, AVISO_NOMES } from './site/base.js';
import { blocoContador, paginaImpostometro } from './site/impostometro.js';
import { paginaVotacoes } from './site/votacoes.js';
import { paginaFontes } from './site/fontes.js';

const itemProposta = (p) =>
  `<li><span class="data">${dataBR(p.data)}</span> <span class="tag">${esc(p.categoria)} ${esc(p.numero)}</span> ${esc(p.ementa)} ${link(fichaOficial(p.id), 'ficha oficial')}</li>`;

function paginaInicial(d) {
  const n = d.vereadores.length;
  const salario = SALARIO
    ? `<p class="destaque">Salário pago aos ${n} vereadores desde a posse: <strong id="contador-salario" data-mensal="${SALARIO.valorMensal * n}" data-inicio="${ANO_INICIO}-01-01">—</strong><br><small>Estimativa: ${n} salários de R$ ${SALARIO.valorMensal.toLocaleString('pt-BR')} por mês desde 1º de janeiro de ${ANO_INICIO}. ${link(SALARIO.fonte, 'fonte oficial')}</small></p>`
    : '';
  const repetidos = d.repetidos.slice(0, 30).map((r) =>
    `<li><strong>${esc(r.rua)}</strong>: ${esc(TIPOS_NOME[r.tipo] || r.tipo)}, pedido ${r.pedidos.length} vezes
<details><summary>ver datas e autores</summary><ul class="lista">${r.pedidos.map((p) => `<li><span class="data">${dataBR(p.data)}</span> ${esc(p.autores)} ${link(fichaOficial(p.id), 'ficha')}</li>`).join('')}</ul></details></li>`).join('\n');
  const contagem = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, d.proposituras.filter((p) => p.grupo === g).length]));
  const grupos = GRUPOS_PUBLICOS.map((g) =>
    `<details class="grupo" data-grupo="${g}"><summary>${esc(GRUPOS[g])} <span class="num">${contagem[g]}</span></summary><ul class="lista"></ul></details>`).join('\n');
  const partidos = [...new Set(d.vereadores.map((v) => v.partido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cartoes = d.vereadores.map((v) => `<li class="cartao" data-nome="${esc(v.nome)}" data-partido="${esc(v.partido)}" data-faltas="${v.presenca.A}" data-lei="${v.porGrupo.lei}" data-homenagem="${v.porGrupo.homenagem}" data-melhoria="${v.porGrupo.melhoria}" data-contra="${v.votosContra}">
  <a href="vereador/${esc(v.id)}.html"><strong>${esc(v.nome)}</strong> <span class="partido">${esc(v.partido)}</span></a>
  <dl><dt>Faltas</dt><dd>${v.presenca.A} de ${v.presenca.total} sessões</dd><dt>Pedidos para os bairros</dt><dd>${v.porGrupo.melhoria}</dd><dt>Perguntas e cobranças</dt><dd>${v.porGrupo.cobranca}</dd><dt>Propostas de lei</dt><dd>${v.porGrupo.lei}</dd><dt>Homenagens</dt><dd>${v.porGrupo.homenagem}</dd><dt>Votou contra</dt><dd>${v.votosContra}</dd></dl>
</li>`).join('\n');

  const corpo = `<section class="hero">
<h1>Radar Saltense</h1>
<p>O que cada vereador de Salto fez desde a posse, atualizado todo dia. Só dado oficial, com link para a fonte.</p>
${salario}
${d.receitas ? blocoContador(d.receitas, '', false) : ''}
</section>
<section id="bairro">
<h2>O que pediram pro seu bairro?</h2>
<label for="busca-bairro">Digite o nome do bairro ou da rua</label>
<input id="busca-bairro" type="search" placeholder="Ex.: Jardim Saltense ou Rua Nove de Julho" autocomplete="off">
<div id="resultado-busca" aria-live="polite"></div>
</section>
<section id="repetidos">
<h2>O problema que não some</h2>
<p>Pedidos do mesmo tipo que voltaram mais de uma vez para a mesma rua. No site da Câmara, cada pedido aparece sozinho. Aqui eles são cruzados.</p>
<p class="aviso">Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.</p>
<ol class="lista">${repetidos}</ol>
</section>
<section id="trabalho">
<h2>Homenagem ou trabalho?</h2>
<p>Todas as propostas desde ${ANO_INICIO}, separadas pela mesma regra para todos os vereadores. <a href="fontes.html#regras">Veja a regra</a>.</p>
${grupos}
</section>
<section id="vereadores">
<h2>Os ${n} vereadores</h2>
<p class="aviso">${AVISO_NOMES}</p>
<div class="filtros">
<input id="filtro-nome" type="search" placeholder="Buscar por nome" aria-label="Buscar vereador por nome">
<select id="filtro-partido" aria-label="Filtrar por partido"><option value="">Todos os partidos</option>${partidos.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
<select id="ordem" aria-label="Ordenar"><option value="nome">Nome (A–Z)</option><option value="faltas">Quem mais faltou</option><option value="lei">Mais propostas de lei</option><option value="homenagem">Mais homenagens</option><option value="melhoria">Mais pedidos para os bairros</option><option value="contra">Quem mais votou contra</option></select>
</div>
<ul id="lista-vereadores" class="cartoes">
${cartoes}
</ul>
</section>`;
  return layout({ titulo: 'Radar Saltense: o que cada vereador de Salto fez', corpo, atualizadoEm: d.meta.atualizadoEm });
}

function paginaVereador(v, d) {
  const props = d.proposituras.filter((p) => p.vereadores.includes(v.id));
  const pres = d.presenca[v.id];
  const sessoes = [...pres.sessoes].reverse().map((s) =>
    `<tr><td>${dataBR(s.data)}</td><td class="m-${s.marca || 'vazio'}">${s.marca || '—'}</td><td>${link(s.url, 'PDF')}</td></tr>`).join('');
  const grupos = GRUPOS_PUBLICOS.map((g) => {
    const lista = props.filter((p) => p.grupo === g);
    return `<details><summary>${esc(GRUPOS[g])} <span class="num">${lista.length}</span></summary><ul class="lista">${lista.map(itemProposta).join('')}</ul></details>`;
  }).join('\n');
  const votos = (campo) =>
    d.votacoes.flatMap((pj) => pj.eventos.filter((e) => e[campo].includes(v.id)).map((e) =>
      `<li><span class="data">${dataBR(e.data)}</span> ${esc(pj.rotulo)}${e.turno ? ` (${esc(e.turno)})` : ''}: ${esc(e.resultado)} ${link(e.url, 'PDF')}</li>`)).join('') || '<li>Nenhum registro.</li>';
  const veja = d.avisos && d.avisos.length ? ' Veja os <a href="../fontes.html#avisos">avisos sobre os dados oficiais</a>.' : '';

  const corpo = `<section class="perfil">
<h1>${esc(v.nome)}</h1>
<p class="partido">${esc(v.partido)}</p>
<p>${link(v.url, 'Página oficial na Câmara')}</p>
</section>
<section>
<h2>Presença</h2>
<p><strong>${pres.P}</strong> presenças, <strong>${pres.A}</strong> faltas e <strong>${pres.AJ}</strong> ausências justificadas, em ${pres.sessoes.length} sessões registradas.</p>
<p class="aviso">As sessões extraordinárias aparecem junto com as ordinárias. Célula vazia no PDF não conta como falta.${veja}</p>
<details><summary>Sessão por sessão</summary><table><thead><tr><th>Data</th><th>Registro</th><th>Fonte</th></tr></thead><tbody>${sessoes}</tbody></table></details>
</section>
<section>
<h2>Propostas</h2>
<p>${props.length} propostas desde ${ANO_INICIO}. Proposta com mais de um autor conta para cada um.</p>
${grupos}
</section>
<section>
<h2>Votações</h2>
<p class="aviso">Leitura do documento oficial de votações. Ele só cita quem votou contra ou faltou, e o site não deduz votos a favor. ${AVISO_NOMES}</p>
<h3>Votou contra</h3><ul class="lista">${votos('contra')}</ul>
<h3>Ausente na votação</h3><ul class="lista">${votos('ausentes')}</ul>
</section>`;
  return layout({ titulo: `${v.nome}: Radar Saltense`, corpo, prefixo: '../', atualizadoEm: d.meta.atualizadoEm });
}

const FONTES = [
  ['node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2', 'nunito-800.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
];

export async function gerarSite(d, destino) {
  for (const pasta of ['vereador', 'dados', 'fontes', 'fotos']) await mkdir(`${destino}/${pasta}`, { recursive: true });
  await writeFile(`${destino}/index.html`, paginaInicial(d));
  for (const v of d.vereadores) await writeFile(`${destino}/vereador/${v.id}.html`, paginaVereador(v, d));
  await writeFile(`${destino}/votacoes.html`, paginaVotacoes(d));
  await writeFile(`${destino}/fontes.html`, paginaFontes(d));
  if (d.receitas) await writeFile(`${destino}/impostometro.html`, paginaImpostometro(d));
  const busca = {
    p: d.proposituras.map((p) => [p.id, p.data, p.grupo, p.autoresTexto, p.ementa, `${p.categoria} ${p.numero}`]),
    l: d.locais.map((l) => [l.nome, l.idx]),
  };
  await writeFile(`${destino}/dados/busca.json`, JSON.stringify(busca));
  await copyFile('site/estilo.css', `${destino}/estilo.css`);
  await copyFile('site/busca.js', `${destino}/busca.js`);
  for (const [origem, nome] of FONTES) await copyFile(origem, `${destino}/fontes/${nome}`);
  for (const v of d.vereadores) if (v.fotoLocal) await copyFile(`data/bruto/${v.fotoLocal}`, `${destino}/${v.fotoLocal}`);
  await writeFile(`${destino}/.nojekyll`, '');
}
