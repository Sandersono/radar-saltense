// Gera data/referencia/emendas.json: emendas impositivas dos vereadores (2025 execução, 2026 planejado).
// Lê os PDFs da Câmara por posição de texto. Rodar à mão quando a Câmara publicar PDF novo: node src/ferramentas/emendas.js
// Sem CPF e sem pessoa física beneficiada: só entidade, secretaria, projeto e valores.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { CAMARA, UA, ESPERA_MS, OUTROS_NOMES } from '../config.js';
import { itensDoPdf } from '../pdf.js';
import { agruparLinhas, textoDe } from '../regras/linhas.js';
import { criarCasador } from '../regras/nomes.js';
import { casarIniciais, iniciaisDe } from '../regras/emendas.js';
import { esperar, limparNomeEmpresa, ocultarDocumentos, slug } from '../util/texto.js';

// Texto vindo do PDF: sem CPF solto (formatado ou não) e sem número de documento.
const limpar = (s) => ocultarDocumentos(limparNomeEmpresa(s));

const INDICE = `${CAMARA}/orcamento-publico/emendas-impositivas`;
const CATEGORIA = { 2025: `${INDICE}/category/569-2025`, 2026: `${INDICE}/category/568-2026` };
const SITUACOES = ['CONCLUÍDA', 'EM EXECUÇÃO', 'INICIADA', 'NÃO EXECUTADA', 'DEVOLVIDA'];
// Valor de cada bloco ("livre" e "Saúde") por vereador em 2026, em centavos. Se a Câmara mudar o orçamento
// das emendas (ou publicar PDF com outro total), a mudança precisa de edição manual aqui: a ferramenta para até alguém conferir.
const TOTAL_POR_VEREADOR_2026 = 27815330;

// Bloco cujo Total impresso no PDF consolidado de 31/08/2026 não é R$ 278.153,30 (conferido à mão: a soma das emendas bate com o impresso).
// Também só muda por edição manual: um PDF novo com outro total volta a parar a ferramenta.
const EXCECOES_TOTAL = { 'rogerio-dos-santos-filho|saude': 29315330 };

const problemas = [];
const erro = (m) => problemas.push(m);

async function baixar(url, tipo) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  const b = Buffer.from(await r.arrayBuffer());
  await esperar(ESPERA_MS);
  return tipo === 'texto' ? b.toString('utf8') : b;
}

// Links diretos de PDF da categoria (Phoca Download), já com URL-encode.
async function pdfsDaCategoria(url) {
  const html = await baixar(`${url}?limit=0`, 'texto');
  const nomes = [...html.matchAll(/href="(\/pdf\/[^"]+\.pdf)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  return [...new Set(nomes)].map((p) => ({ nome: decodeURIComponent(p), url: CAMARA + encodeURI(decodeURI(p)) }));
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
// "SECRETARIA DE SAÚDE" -> "Secretaria de Saúde"; "Secretária de X" (feminino digitado nos PDFs de 2026) -> "Secretaria de X".
function nomeSecretaria(s) {
  const t = String(s ?? '').trim().toLowerCase().split(/\s+/).map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
  return t.replace(/^Secretária\b/, 'Secretaria').replace(/^Saúde$/, 'Secretaria de Saúde');
}

const valorBR =(s) => (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : /^-$/.test(s) ? 0 : NaN);
const centavos = (n) => Math.round(n * 100);

// ---------- Layout 2025 (tabela horizontal) ----------
// Cada emenda tem uma linha-âncora (número em x<30). O texto do objeto pode quebrar em linhas acima e abaixo
// da âncora (célula centralizada); cada pedaço vai para a âncora mais próxima na altura.
function linhasDaTabela(paginas, [objIni, objFim], rotulo) {
  const registros = [];
  paginas.forEach((itens, p) => {
    const linhas = agruparLinhas(itens.filter((i) => !/^Página \d+ de \d+$/.test(i.str)));
    // Âncora: linha que começa com número em x<30 seguido de outras colunas (não depende do texto da secretaria).
    const ehNumerada = (l) => /^\d+$/.test(l.itens[0].str) && l.itens[0].x < 30;
    const ancoras = linhas
      .filter((l) => ehNumerada(l) && l.itens.length >= 4)
      .map((l) => ({ y: l.y, linha: l, partes: [], pagina: p }));
    for (const l of linhas) if (ehNumerada(l) && l.itens.length < 4) erro(`${rotulo}: linha numerada ${l.itens[0].str} com poucas colunas (leitura incompleta).`);
    if (!ancoras.length) return;
    for (const l of linhas) {
      for (const it of l.itens) {
        if (it.x < objIni || it.x >= objFim) continue;
        if (l.y > ancoras[0].y + 40) continue; // cabeçalho da tabela
        const a = ancoras.reduce((m, c) => (Math.abs(c.y - it.y) < Math.abs(m.y - it.y) ? c : m));
        a.partes.push(it);
      }
    }
    for (const a of ancoras) {
      a.partes.sort((x, y) => y.y - x.y || x.x - y.x);
      registros.push({ seq: Number(a.linha.itens[0].str), itens: a.linha.itens, objeto: textoDe(a.partes) });
    }
  });
  // Completude: números de 1 a N em ordem, sem buraco e sem repetição. Linha perdida ou lida duas vezes para tudo.
  registros.forEach((r, i) => { if (r.seq !== i + 1) erro(`${rotulo}: sequência quebrada na posição ${i + 1} (número lido: ${r.seq}).`); });
  return registros;
}

// "(4º Trimestre 2025)" no título da primeira página -> { trimestre: 4, ano: 2025, fim: '2025-12-31' }.
function periodoDoTrimestre(paginas, rotulo) {
  const t = textoDe(paginas[0] || []);
  const m = t.match(/(\d)\s*[º°o]\s*trimestre\s*(?:de\s*)?(\d{4})/i);
  if (!m) { erro(`${rotulo}: título sem trimestre e ano.`); return null; }
  const tri = Number(m[1]);
  const fim = ['03-31', '06-30', '09-30', '12-31'][tri - 1];
  if (!fim) { erro(`${rotulo}: trimestre ${tri} inválido.`); return null; }
  return { trimestre: tri, ano: Number(m[2]), fim: `${m[2]}-${fim}` };
}

const SUFIXO_INICIAIS = /\s*[-–]\s*([A-Z]{2,5})$/;
const SITUACAO_NO_FIM = new RegExp(`\\s+(${SITUACOES.join('|')})$`);

// 1º trimestre: nome completo do parlamentar (x 115-200) e iniciais no fim do objeto.
export function lerNomesDoTrimestre1(paginas) {
  const mapa = new Map(); // iniciais -> Set(nomes)
  const registros = linhasDaTabela(paginas, [400, 600], '1T');
  for (const r of registros) {
    const nome = textoDe(r.itens.filter((i) => i.x >= 115 && i.x < 200));
    const m = r.objeto.match(SUFIXO_INICIAIS);
    if (!nome || !m) { erro(`1T, linha ${r.seq}: sem nome ou sem iniciais ("${r.objeto}").`); continue; }
    if (!mapa.has(m[1])) mapa.set(m[1], new Set());
    mapa.get(m[1]).add(nome);
  }
  return { mapa, linhas: registros.length };
}

// 4º trimestre: colunas por posição horizontal.
const COLUNAS_4T = { valor: [160, 195], empenhado: [195, 240], liquidado: [240, 277], pago: [277, 305], saldo: [305, 345] };
const naFaixa = (x, [a, b]) => x >= a && x < b;

export function lerTrimestre4(paginas) {
  return linhasDaTabela(paginas, [340, 538], '4T').map((r) => {
    const col = (c) => r.itens.filter((i) => naFaixa(i.x, COLUNAS_4T[c]));
    const num = (c) => {
      const t = textoDe(col(c));
      const v = valorBR(t);
      if (Number.isNaN(v)) erro(`4T, linha ${r.seq}: valor "${t}" ilegível na coluna ${c}.`);
      return v;
    };
    let situacao = textoDe(r.itens.filter((i) => i.x >= 538 && i.x < 618));
    let objeto = r.objeto;
    // Às vezes o PDF cola a situação ao fim do texto do objeto.
    const colada = objeto.match(SITUACAO_NO_FIM);
    if (colada) { objeto = objeto.slice(0, colada.index); if (!situacao) situacao = colada[1]; }
    if (!SITUACOES.includes(situacao)) erro(`4T, linha ${r.seq}: situação "${situacao}" desconhecida.`);
    const secretaria = nomeSecretaria(textoDe(r.itens.filter((i) => i.x >= 30 && i.x < 128)));
    const m = objeto.match(SUFIXO_INICIAIS);
    if (!m) erro(`4T, linha ${r.seq}: sem iniciais no fim do objeto ("${objeto}").`);
    const resto = m ? objeto.slice(0, m.index).trim() : objeto;
    const corte = resto.indexOf(' - ');
    let valor = num('valor');
    const pago = num('pago');
    // O PDF imprime "-" no valor das emendas NÃO EXECUTADAS (anuladas/refeitas): valor null, fora dos totais.
    // Em qualquer outro caso, valor <= 0 ou pago > valor indica coluna deslocada e para a ferramenta.
    if (valor === 0 && situacao === 'NÃO EXECUTADA' && pago === 0) valor = null;
    else if (!(valor > 0)) erro(`4T, linha ${r.seq}: valor ${valor} inválido (situação ${situacao}).`);
    else if (pago > valor) erro(`4T, linha ${r.seq}: pago ${pago} maior que o valor ${valor} (coluna deslocada?).`);
    return {
      seq: r.seq,
      iniciais: m ? m[1] : null,
      secretaria,
      objeto: limpar(corte < 0 ? resto : resto.slice(0, corte)),
      entidade: limpar(corte < 0 ? '' : resto.slice(corte + 3)),
      valor,
      pago,
      situacao,
    };
  });
}

// ---------- Layout 2026 (formulário em blocos) ----------
const ROTULOS = [
  ['secretaria', /^Secretaria Respons/i],
  ['entidade', /^Entidade/i],
  ['projeto', /^Nome do Projeto/i],
  ['unidade', /^Unidade/i],
  ['detalhe', /^Detalhamento/i],
  ['valor', /^Valor da Despesa/i],
  ['codigo', /^C[óo]digo da Dota/i],
];

export function lerPlanejado2026(paginas) {
  const blocos = []; // { nome, tipo, total, emendas: [] }
  let bloco = null;
  let emenda = null;
  for (const itens of paginas) {
    const linhas = agruparLinhas(itens);
    const rotulos = []; // { campo, y }
    for (const l of linhas) {
      const esq = l.itens.filter((i) => i.x < 175);
      const t = textoDe(esq);
      const campo = ROTULOS.find(([, re]) => re.test(t));
      if (campo) rotulos.push({ campo: campo[0], y: l.y, linha: l });
    }
    // Cabeçalhos e totais, em ordem de leitura, junto com os rótulos.
    const ehTotal = (l) => l.itens.some((i) => /^Total/.test(i.str) && i.x >= 400);
    const eventos = [];
    for (const l of linhas) {
      const t = textoDe(l.itens);
      if (/^Vereador:/i.test(t)) eventos.push({ y: l.y, tipo: 'vereador', t });
      else if (ehTotal(l)) eventos.push({ y: l.y, tipo: 'total', t });
    }
    const valoresSoltos = [];
    for (const l of linhas) {
      const t = textoDe(l.itens);
      if (/^Vereador:/i.test(t) || ehTotal(l)) continue;
      if (/^Emendas impositivas 2026/i.test(t) || /^\d+ de \d+$/.test(t)) continue;
      const vals = l.itens.filter((i) => i.x >= 175 && i.x < 455);
      if (vals.length) valoresSoltos.push({ y: l.y, texto: textoDe(vals) });
    }
    // Cada texto de valor vai para o rótulo mais próximo da mesma página.
    const porRotulo = new Map();
    for (const v of valoresSoltos) {
      if (!rotulos.length) continue;
      const r = rotulos.reduce((m, c) => (Math.abs(c.y - v.y) < Math.abs(m.y - v.y) ? c : m));
      if (!porRotulo.has(r)) porRotulo.set(r, []);
      porRotulo.get(r).push(v);
    }
    // O valor em reais às vezes sai uma linha acima ou abaixo do rótulo "Valor da Despesa": vai para o rótulo "valor" mais próximo.
    const valoresDeRotulo = new Map();
    const rotulosValor = rotulos.filter((r) => r.campo === 'valor');
    for (const l of linhas) {
      if (/^Vereador:/i.test(textoDe(l.itens)) || ehTotal(l) || !rotulosValor.length) continue;
      const t = textoDe(l.itens.filter((i) => i.x >= 455));
      if (!/^(R\$\s*)?\d{1,3}(\.\d{3})*(,\d{2})?$/.test(t)) continue;
      const r = rotulosValor.reduce((m, c) => (Math.abs(c.y - l.y) < Math.abs(m.y - l.y) ? c : m));
      valoresDeRotulo.set(r, t);
    }
    const sequencia = [...eventos.map((e) => ({ ...e })), ...rotulos.map((r) => ({ y: r.y, tipo: 'rotulo', r }))].sort((a, b) => b.y - a.y);
    for (const ev of sequencia) {
      if (ev.tipo === 'vereador') {
        const m = ev.t.replace(/^Vereador:\s*/i, '').match(/^(.*?)\s*-\s*([A-Z]{2,6})\s*-\s*(livre|sa[uú]de)/i);
        if (!m) { erro(`2026: cabeçalho de vereador ilegível: "${ev.t}".`); continue; }
        bloco = { nome: m[1].trim(), sigla: m[2], tipo: m[3].toLowerCase(), total: null, emendas: [] };
        blocos.push(bloco);
        emenda = null;
      } else if (ev.tipo === 'total') {
        const v = valorBR(ev.t.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/)?.[1] ?? '');
        if (bloco) bloco.total = v;
        emenda = null;
      } else {
        const { campo } = ev.r;
        // Uma emenda nova começa no rótulo de secretaria; se esse rótulo faltar no PDF, começa em entidade/projeto
        // quando a anterior já tem valor.
        const comecaSemSecretaria = (campo === 'entidade' || campo === 'projeto') && emenda && !Number.isNaN(emenda.valor);
        if (campo === 'secretaria' || comecaSemSecretaria) {
          if (!bloco) { erro('2026: emenda antes de um cabeçalho de vereador.'); continue; }
          emenda = { secretaria: '', entidade: '', projeto: '', valor: NaN };
          bloco.emendas.push(emenda);
        }
        if (!emenda) continue; // "Código da Dotação" no topo da página pertence à emenda anterior
        const texto = (porRotulo.get(ev.r) || []).sort((a, b) => b.y - a.y).map((v) => v.texto).join(' ');
        if (campo === 'valor') {
          // Em alguns blocos o texto do PDF vem sem os centavos ("R$ 10.153"): guarda o inteiro e marca.
          const m = (valoresDeRotulo.get(ev.r) || '').match(/(\d{1,3}(?:\.\d{3})*)(,\d{2})?\s*$/);
          if (m) { emenda.valor = valorBR(m[2] ? m[1] + m[2] : `${m[1]},00`); emenda.semCentavos = !m[2]; } else emenda.valor = NaN;
        } else if (['secretaria', 'entidade', 'projeto'].includes(campo)) {
          emenda[campo] = [emenda[campo], texto].filter(Boolean).join(' ');
        }
      }
    }
  }
  return blocos;
}

// ---------- Execução ----------
const dados = JSON.parse(await readFile(new URL('../../data/processado/dados.json', import.meta.url), 'utf8'));
const vereadores = dados.vereadores.map((v) => ({ id: v.id, nome: v.nome, apelido: v.apelido }));
const casar = criarCasador(vereadores, OUTROS_NOMES);

const pdfs2025 = await pdfsDaCategoria(CATEGORIA[2025]);
const pdfs2026 = await pdfsDaCategoria(CATEGORIA[2026]);
// Escolha determinística: a data dd.mm.aaaa do nome (a mais recente) e, em empate, o sufixo de versão "-N" (o maior).
// Se mais de um link casar, imprime qual foi usado.
function escolher(lista, re, ano, { exigeData = false } = {}) {
  const r = lista.filter((p) => re.test(p.nome)).map((p) => {
    const d = p.nome.match(/(\d{2})\.(\d{2})\.(\d{4})\.pdf$/);
    const v = p.nome.match(/-(\d+)\.pdf$/);
    return { ...p, data: d ? `${d[3]}-${d[2]}-${d[1]}` : '', versao: v ? Number(v[1]) : 0 };
  });
  if (!r.length) throw new Error(`PDF não encontrado na categoria ${ano} (${re}). Arquivos: ${lista.map((p) => p.nome).join(' | ')}`);
  if (exigeData && r.some((p) => !p.data)) throw new Error(`Nome de PDF sem data (dd.mm.aaaa) na categoria ${ano}: ${r.filter((p) => !p.data).map((p) => p.nome).join(' | ')}`);
  r.sort((a, b) => b.data.localeCompare(a.data) || b.versao - a.versao || b.nome.localeCompare(a.nome));
  if (r.length > 1) console.warn(`Mais de um PDF casa ${re} em ${ano}; usando "${r[0].nome}". Outros: ${r.slice(1).map((p) => p.nome).join(' | ')}`);
  return r[0];
}
const pdf4t = escolher(pdfs2025, /4o_trimestre|4[ºo°]?\s*trimestre/i, 2025);
const pdf1t = escolher(pdfs2025, /1T2025|1[ºo°]?\s*trimestre/i, 2025);
const pdf26 = escolher(pdfs2026, /Emenda impositiva - tabela/i, 2026, { exigeData: true });
console.log(`PDFs: 1T ${pdf1t.nome} | 4T ${pdf4t.nome} | 2026 ${pdf26.nome}`);

const itens1t = await itensDoPdf(await baixar(pdf1t.url));
const itens4t = await itensDoPdf(await baixar(pdf4t.url));
const itens26 = await itensDoPdf(await baixar(pdf26.url));
const periodo4t = periodoDoTrimestre(itens4t, '4T');
if (periodo4t && periodo4t.trimestre !== 4) erro(`4T: o PDF escolhido é do ${periodo4t.trimestre}º trimestre.`);

// Iniciais de 2025: conferidas contra os nomes completos do 1º trimestre.
const { mapa: nomes1t, linhas: linhas1t } = lerNomesDoTrimestre1(itens1t);
const confirmadas = {};
const anteriores = {};
for (const [ini, set] of nomes1t) {
  if (set.size !== 1) { erro(`Iniciais ${ini} ligadas a mais de um nome no 1º trimestre: ${[...set].join(' / ')}.`); continue; }
  const [nome] = set;
  if (iniciaisDe(nome) !== ini) erro(`Iniciais ${ini} não batem com o nome "${nome}" no 1º trimestre.`);
  // Casou com vereador atual só se as iniciais do nome atual também forem as do 1T; senão é outra pessoa.
  // Quem já não é vereador (legislatura anterior) ganha um id próprio.
  const achado = casar(nome);
  const atual = vereadores.find((v) => v.id === achado && iniciaisDe(v.nome) === ini);
  const id = atual ? atual.id : slug(nome);
  if (!atual) anteriores[id] = nome;
  confirmadas[ini] = id;
}

const linhas4t = lerTrimestre4(itens4t);
// O PDF não imprime total nem contagem. Completude = números 1..N sem buraco (conferido em linhasDaTabela) e
// N do 4T não menor que o do 1T (emendas só são acrescentadas ao longo do ano).
if (linhas4t.length < linhas1t) erro(`Contagem: 1T tem ${linhas1t} linhas e 4T só ${linhas4t.length}.`);
const emendas2025 = [];
for (const l of linhas4t) {
  const id = l.iniciais ? casarIniciais(l.iniciais, vereadores, confirmadas) : null;
  if (!id) { erro(`4T, linha ${l.seq}: iniciais "${l.iniciais}" ambíguas ou não casadas. Conferir no 1º trimestre e registrar em iniciaisConferidas.`); continue; }
  emendas2025.push({ vereador: id, entidade: l.entidade, objeto: l.objeto, secretaria: l.secretaria, valor: l.valor, pago: l.pago, situacao: l.situacao });
}

// Cada vereador tem dois blocos no PDF ("livre" e "Saúde"), e cada bloco soma R$ 278.153,30 (o Total impresso).
const blocos = lerPlanejado2026(itens26);
const emendas2026 = [];
const blocosPorId = {};
const ajustes = [];
for (const b of blocos) {
  const id = casar(b.nome);
  if (!id) { erro(`2026: vereador "${b.nome}" não casa com a lista de vereadores.`); continue; }
  const rotulo = `${id} (${b.tipo})`;
  const ruins = b.emendas.filter((e) => Number.isNaN(e.valor));
  if (ruins.length) { erro(`2026: ${rotulo}: ${ruins.length} emenda(s) sem valor legível (${ruins.map((e) => e.projeto).join(' | ')}).`); continue; }
  let soma = b.emendas.reduce((s, e) => s + centavos(e.valor), 0);
  // Alguns valores saem do PDF sem os centavos. Se falta menos de R$ 1 para o Total impresso, os centavos
  // são da única emenda sem centavos cujo valor termina em 153 (resto de 278.153,30); senão, parar.
  const falta = centavos(b.total) - soma;
  if (falta !== 0) {
    const cand = b.emendas.filter((e) => e.semCentavos && Math.round(e.valor) % 1000 === 153);
    if (falta > 0 && falta < 100 && cand.length === 1) {
      const de = cand[0].valor;
      cand[0].valor = (centavos(de) + falta) / 100;
      soma += falta;
      ajustes.push({ vereador: id, bloco: b.tipo, de, para: cand[0].valor });
      console.warn(`Aviso: centavos completados pelo Total impresso (${rotulo}): ${de} -> ${cand[0].valor}.`);
    }
  }
  const esperado = EXCECOES_TOTAL[`${id}|${b.tipo.replace('ú', 'u')}`] ?? TOTAL_POR_VEREADOR_2026;
  if (soma !== centavos(b.total) || soma !== esperado) {
    erro(`2026: ${rotulo} soma R$ ${(soma / 100).toFixed(2)}; Total impresso R$ ${b.total}; esperado R$ ${(esperado / 100).toFixed(2)}.`);
    continue;
  }
  (blocosPorId[id] ||= []).push(b.tipo);
  for (const e of b.emendas) {
    // Se o rótulo da secretaria faltar, o PDF põe a secretaria na linha da entidade.
    if (!e.secretaria && /^Secret[aá]ri[ao]/i.test(e.entidade)) { e.secretaria = e.entidade; e.entidade = ''; }
    // Texto longo (lista de itens) preso na coluna da entidade é descrição do projeto.
    if (e.entidade.length > 80 || e.entidade.includes('•')) { e.projeto = [e.entidade, e.projeto].filter(Boolean).join(' '); e.entidade = ''; }
    emendas2026.push({ vereador: id, tipo: b.tipo === 'livre' ? 'livre' : 'saude', entidade: limpar(e.entidade), projeto: limpar(e.projeto), secretaria: nomeSecretaria(e.secretaria), valor: e.valor });
  }
}
for (const v of vereadores) {
  const t = (blocosPorId[v.id] || []).sort().join('+');
  if (t !== 'livre+saúde' && t !== 'livre+saude') erro(`2026: ${v.id} com blocos "${t}", esperado livre+saúde.`);
}

if (problemas.length) {
  console.error(`Emendas NÃO gravadas. ${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}

const usadas = new Set(emendas2025.map((e) => e.vereador));
const saida = {
  2025: { fonte: pdf4t.url, pagina: CATEGORIA[2025], atualizadoEm: periodo4t.fim, emendas: emendas2025 },
  2026: { fonte: pdf26.url, pagina: CATEGORIA[2026], atualizadoEm: pdf26.data, ajustes, emendas: emendas2026 },
  iniciaisConferidas: Object.fromEntries(Object.entries(confirmadas).filter(([, id]) => usadas.has(id)).sort()),
  vereadoresAnteriores: Object.fromEntries(Object.entries(anteriores).filter(([id]) => usadas.has(id)).sort()),
};
await mkdir(new URL('../../data/referencia/', import.meta.url), { recursive: true });
await writeFile(new URL('../../data/referencia/emendas.json', import.meta.url), JSON.stringify(saida, null, 2) + '\n');
console.log(`2025: ${emendas2025.length} emendas (${pdf4t.url}); 2026: ${emendas2026.length} emendas (${pdf26.url}).`);
