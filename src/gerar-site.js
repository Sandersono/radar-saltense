import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { AUTOR, SALARIO, ANO_INICIO, POPULACAO, fichaOficial } from './config.js';
import { GRUPOS } from './regras/classificar.js';
import { TIPOS_NOME } from './regras/local.js';
import { esc } from './util/texto.js';
import { GRUPOS_RECEITA, TIPOS_IMPOSTO, valorContador } from './regras/receitas.js';

const GRUPOS_PUBLICOS = ['melhoria', 'cobranca', 'homenagem', 'lei', 'outros'];
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
const AVISO_NOMES = 'Nomes escritos de outro jeito no PDF (ex.: apelidos) ficam de fora e podem mudar estes números.';
const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener">${texto}</a>`;

const reais = (v) => Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Contador: o HTML traz o valor OFICIAL (sem JavaScript, nada é estimado); busca.js troca pelo valor correndo.
function blocoContador(r, prefixo, grande) {
  const agora = r.oficialAno;
  const ritmo = `estimativa pelo ritmo dos últimos ${r.mesesRitmo} meses publicados`;
  const oficialAte = r.temOficialAno
    ? `Oficial até ${dataBR(r.fimOficial)}: ${reais(r.oficialAno)} · daqui em diante é ${ritmo}.`
    : `Ainda não há mês oficial de ${r.anoAtual}: todo o valor é ${ritmo}.`;
  return `<div class="contador-impostos${grande ? ' grande' : ''}" data-oficial="${r.oficialAno}" data-ritmo="${r.ritmoDiario}" data-inicio="${instanteBR(r.inicioEstimativa)}" data-fim="${instanteBR(`${r.anoAtual + 1}-01-01`)}" data-populacao="${POPULACAO.valor}">
<p class="rotulo">Impostos e taxas pagos à cidade em ${r.anoAtual}</p>
<p class="valor" aria-live="off">${reais(agora)}</p>
<p class="nota">(parte oficial + estimativa)</p>
<p class="por-morador">Dividido pelos ${POPULACAO.valor.toLocaleString('pt-BR')} moradores: <strong>${reais(agora / POPULACAO.valor)}</strong> por pessoa</p>
<p class="nota">${esc(oficialAte)}</p>
${grande ? '' : `<p><a class="botao" href="${prefixo}impostometro.html">De onde vem o dinheiro de Salto →</a></p>`}
</div>`;
}

const barras = (pares, total) => `<ul class="barras">${pares.map(([rotulo, v]) => `<li><span class="rotulo">${esc(rotulo)}</span><span class="trilho"><span class="barra" style="width:${total > 0 ? Math.max(0, (v / total) * 100).toFixed(1) : 0}%"></span></span><span class="num">${reais(v)}${total > 0 ? ` <small>(${((v / total) * 100).toFixed(1).replace('.', ',')}%)</small>` : ''}</span></li>`).join('')}</ul>`;

function layout({ titulo, corpo, prefixo = '', atualizadoEm }) {
  const quando = new Date(atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="O que cada vereador de Salto/SP fez desde a posse e quanto a cidade arrecada em impostos, só com dados oficiais.">
<link rel="stylesheet" href="${prefixo}estilo.css">
</head>
<body>
<header class="topo">
  <a class="marca" href="${prefixo}index.html">Radar Saltense</a>
  <nav aria-label="Principal"><a href="${prefixo}index.html#bairro">Seu bairro</a><a href="${prefixo}index.html#vereadores">Vereadores</a><a href="${prefixo}votacoes.html">Votações</a><a href="${prefixo}impostometro.html">Impostômetro</a><a href="${prefixo}fontes.html">De onde vêm os números</a></nav>
</header>
<main>
${corpo}
</main>
<footer>
  <p>Atualizado em ${esc(quando)}. Tudo sai de fontes oficiais: Câmara Municipal de Salto, Tribunal de Contas do Estado (TCE-SP) e IBGE.</p>
  <p>Radar Saltense é um projeto independente de ${esc(AUTOR.nome)}, feito por morador, sem vínculo com a Câmara, com a Prefeitura ou com partido.</p>
  <p>Achou um erro? Me chama no Instagram: <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>.</p>
</footer>
<script src="${prefixo}busca.js" defer></script>
</body>
</html>
`;
}

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

function paginaVotacoes(d) {
  const nome = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const nomes = (ids) => ids.map((id) => esc(nome[id])).join(', ');
  const artigos = d.votacoes.map((pj) => `<article class="votacao">
<h3>${esc(pj.rotulo)}</h3>
<p>${esc(pj.ementa)}</p>
<p class="partido">Autor: ${esc(pj.autor)}</p>
<ul class="lista">${pj.eventos.map((e) => `<li><span class="data">${dataBR(e.data)}</span> ${e.turno ? `${esc(e.turno)}: ` : ''}${esc(e.resultado)}${e.contra.length ? `<br>Contra: ${nomes(e.contra)}` : ''}${e.ausentes.length ? `<br>Ausentes: ${nomes(e.ausentes)}` : ''} ${link(e.url, 'PDF')}</li>`).join('')}</ul>
</article>`).join('\n');
  const corpo = `<h1>Votações</h1>
<p class="aviso">Leitura do documento oficial "Resultado das votações", publicado pela Câmara. Ele só cita quem votou contra ou faltou, às vezes só pelo primeiro nome. Nome que não deu para identificar com certeza fica de fora.</p>
${artigos}`;
  return layout({ titulo: 'Votações: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}

function paginaImpostometro(d) {
  const r = d.receitas;
  const tipos = Object.entries(r.tiposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_IMPOSTO[k] || k, v]);
  const totalTipos = tipos.reduce((s, [, v]) => s + v, 0);
  const grupos = Object.entries(r.gruposPainel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [GRUPOS_RECEITA[k] || k, v]);
  const totalGrupos = grupos.reduce((s, [, v]) => s + v, 0);
  const anoAnt = r.anoAnterior;
  const serieAtual = r.serie[r.anoAtual];
  const serieAnt = r.serie[anoAnt.ano];
  const maiorMes = Math.max(1, ...serieAtual.filter((v) => v !== null), ...serieAnt.filter((v) => v !== null));
  const linhaMes = (ano, v) => v === null
    ? `<span class="trilho"><span class="vazio">ainda não publicado</span></span>`
    : `<span class="trilho"><span class="barra${ano === r.anoAtual ? '' : ' anterior'}" style="width:${((v / maiorMes) * 100).toFixed(1)}%"></span></span><span class="num">${reais(v)}</span>`;
  const meses = MESES.map((nome, i) => `<li><span class="rotulo">${nome}</span><div class="par"><div>${anoAnt.ano}: ${linhaMes(anoAnt.ano, serieAnt[i])}</div><div>${r.anoAtual}: ${linhaMes(r.anoAtual, serieAtual[i])}</div></div></li>`).join('');
  const ultimoIdx = serieAnt.reduce((acc, v, i) => (v === null ? acc : i), -1);
  const fechamento = anoAnt.fechado
    ? `${anoAnt.ano} fechado em ${reais(anoAnt.total)} (oficial).`
    : ultimoIdx < 0
      ? `${anoAnt.ano}: nenhum mês publicado.`
      : `${anoAnt.ano}: ${reais(anoAnt.total)} oficial até ${NOMES_MES[ultimoIdx]}.`;
  const avisoPainel = r.anoPainel !== r.anoAtual
    ? `<p class="aviso">Ainda não há mês oficial de ${r.anoAtual}; os quadros abaixo mostram ${r.anoPainel}.</p>`
    : '';

  const corpo = `<h1>Impostômetro de Salto</h1>
${blocoContador(r, '', true)}
<p>A parte oficial é o que a Prefeitura registrou no Tribunal de Contas do Estado (TCE-SP), que publica os números com cerca de um mês e meio de atraso. Depois do último mês oficial, o contador sobe no ritmo médio dos últimos ${r.mesesRitmo} meses publicados: é uma estimativa e se corrige sozinha quando sai um mês novo.</p>
<p class="aviso">${esc(fechamento)}</p>
${avisoPainel}
<section>
<h2>Os impostos da cidade em ${r.anoPainel}</h2>
<p>Impostos e taxas que o morador e as empresas pagam direto à Prefeitura. O Imposto de Renda retido é o que a Prefeitura desconta dos salários e de outros pagamentos que faz e, por lei, fica com a cidade.</p>
${barras(tipos, totalTipos)}
</section>
<section>
<h2>Mês a mês</h2>
<ul class="meses">${meses}</ul>
</section>
<section>
<h2>De onde vem o dinheiro de Salto</h2>
<p>Toda a arrecadação oficial de ${r.anoPainel}, até o último mês publicado. Os repasses do Estado e da União vêm, em boa parte, de impostos que eles arrecadam (como ICMS, IPVA e Imposto de Renda) e dividem com as cidades por regras da lei.</p>
${barras(grupos, totalGrupos)}
<p class="nota">Ficaram fora do total ${reais(r.foraPainel)} que só passaram de um órgão público da cidade para outro (receitas intraorçamentárias), para não contar o mesmo dinheiro duas vezes.</p>
</section>
<section id="fontes-impostometro">
<h2>De onde vêm os números</h2>
<ul>
<li><a href="https://transparencia.tce.sp.gov.br/">Portal da Transparência Municipal do TCE-SP</a>, receitas de Salto mês a mês. Os dados vêm da API pública https://transparencia.tce.sp.gov.br/api/json/receitas/salto/&lt;ano&gt;/&lt;mês&gt;. Último mês oficial: ${r.ultimoMesOficial ? esc(r.ultimoMesOficial.split('-').reverse().join('/')) : 'nenhum'}.</li>
<li>População: ${POPULACAO.valor.toLocaleString('pt-BR')} habitantes. Fonte: ${esc(POPULACAO.fonte)}.</li>
<li>Tipos de imposto: IPTU e ITBI (códigos 1112), Imposto de Renda retido (1113), ISS (1114) e Taxas (112).</li>
<li>Grupos: impostos da cidade (códigos 111 e 112), repasses do Estado (172 e 242), repasses da União (171 e 241), FUNDEB (175), empréstimos (21), água e esgoto (tudo o que entra no SAAE) e outras receitas (o resto).</li>
</ul>
</section>`;
  return layout({ titulo: 'Impostômetro de Salto: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}

function paginaFontes(d) {
  const avisos = d.avisos && d.avisos.length
    ? `<ul>${d.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '<p>Nenhum aviso.</p>';
  const contagemNomes = new Map();
  for (const x of d.naoAtribuidos || []) if (x.fonte.startsWith('votação')) contagemNomes.set(x.nome, (contagemNomes.get(x.nome) || 0) + 1);
  const nomesSoltos = [...contagemNomes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const nomesHtml = nomesSoltos.length
    ? `<ul>${nomesSoltos.map(([nome, c]) => `<li>"${esc(nome)}": ${c} ${c === 1 ? 'registro' : 'registros'}</li>`).join('')}</ul>`
    : '<p>Nenhum.</p>';
  const corpo = `<h1>De onde vêm os números</h1>
<p>Tudo sai de fontes oficiais. Nada é digitado à mão, exceto a população do IBGE, que fica registrada no código com a fonte. O site é refeito todo dia de madrugada.</p>
<h2>Fontes</h2>
<ul>
<li><strong>Propostas:</strong> <a href="https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92">portal de proposituras da Câmara</a>. Cada proposta tem link para a ficha oficial.</li>
<li><strong>Presença:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/presenca-dos-vereadores">PDFs mensais de presença</a>. P = presença, A = ausência, AJ = ausência justificada.</li>
<li><strong>Votações:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos">PDF anual "Resultado das votações"</a>.</li>
<li><strong>Impostos e receitas:</strong> <a href="impostometro.html#fontes-impostometro">API de receitas do TCE-SP</a>, usada no impostômetro.</li>
<li><strong>Vereadores e partidos:</strong> <a href="https://www.camarasalto.sp.gov.br/">página inicial da Câmara</a>.</li>
</ul>
<h2 id="regras">Homenagem ou trabalho: a regra</h2>
<table><thead><tr><th>Tipo de documento</th><th>Grupo</th></tr></thead><tbody>
<tr><td>Indicação</td><td>Pedidos de melhoria nos bairros</td></tr>
<tr><td>Requerimento</td><td>Perguntas e cobranças</td></tr>
<tr><td>Moção de aplauso, congratulação, parabéns, pesar, homenagem ou reconhecimento</td><td>Homenagens</td></tr>
<tr><td>Moção de apelo, repúdio ou apoio</td><td>Outros</td></tr>
<tr><td>Decreto Legislativo de título de cidadão, honra ao mérito, honraria, medalha, comenda ou diploma</td><td>Homenagens</td></tr>
<tr><td>Lei ou resolução que dá nome a rua ou prédio, ou cria dia, semana ou data comemorativa</td><td>Homenagens</td></tr>
<tr><td>Demais leis, resoluções, decretos legislativos, emendas à Lei Orgânica e iniciativa popular</td><td>Propostas de lei</td></tr>
<tr><td>Ato da Presidência, Atos da Mesa e Portaria</td><td>Não contam para nenhum vereador</td></tr>
</tbody></table>
<p>Proposta com mais de um autor conta para cada autor. Propostas de comissões, da Mesa, de frentes parlamentares e da Prefeitura não contam para nenhum vereador.</p>
<h2>Ruas e bairros</h2>
<p>O nome da rua e do bairro é lido do próprio texto do pedido. Quando o texto não deixa claro o lugar, o pedido continua no site, mas fica fora da busca por bairro. "O problema que não some" junta pedidos do mesmo tipo (buraco, asfalto, iluminação, limpeza, bueiro, sinalização, poda, lixo) para a mesma rua, a partir de 2 pedidos.</p>
<p class="aviso">Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.</p>
<h2>Presença</h2>
<p>Contamos as marcas P, A e AJ dos PDFs oficiais. "Quem mais faltou" conta só as ausências sem justificativa (A). Dado ausente não é falta: célula vazia não conta. As sessões extraordinárias aparecem junto com as ordinárias.</p>
<h2>Votações</h2>
<p>O PDF oficial informa o resultado e cita, às vezes só pelo primeiro nome, quem votou contra ou faltou. O primeiro nome é ligado ao vereador. Se um nome não bater com exatamente um vereador, ele fica de fora. Um voto só é ligado ao vereador se ele aparece na tabela de presença daquele mês (quando ela existe). O site não deduz votos a favor.</p>
<h2 id="avisos">Avisos sobre os dados oficiais</h2>
<p>Quando um documento oficial traz algo fora do padrão, o site avisa aqui em vez de esconder.</p>
${avisos}
<h3>Nomes nas votações que não deu para ligar a um vereador</h3>
<p>Estes nomes aparecem nos PDFs de votação, mas não bateram com exatamente um vereador (apelidos, grafias diferentes ou vereador fora da tabela de presença do mês). O site não atribui esses votos a ninguém.</p>
${nomesHtml}
${SALARIO ? `<h2>Salário</h2><p>O contador multiplica o salário mensal oficial pelo número de vereadores, desde 1º de janeiro de ${ANO_INICIO}. É uma estimativa. ${link(SALARIO.fonte, 'Fonte oficial do valor')}.</p>` : ''}
<h2>Achou um erro?</h2>
<p>Me chama no Instagram <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>. Se a Câmara corrigir o dado na fonte, o site se corrige sozinho na próxima atualização.</p>`;
  return layout({ titulo: 'De onde vêm os números: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}

export async function gerarSite(d, destino) {
  await mkdir(`${destino}/vereador`, { recursive: true });
  await mkdir(`${destino}/dados`, { recursive: true });
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
  await writeFile(`${destino}/.nojekyll`, '');
}
