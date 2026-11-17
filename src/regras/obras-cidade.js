// Obras em Salto (spec 2026-11-17-obras-design.md): junta PNCP, Obrasgov.br, Painel de Obras do TCE-SP
// e a página "Consulta de Obras Paralisadas" da Prefeitura. Só funções puras.
import { limparNomeEmpresa, ocultarDocumentos, normalizar, slug, limparHtml } from '../util/texto.js';
import { frase } from './obras.js';

export const INICIO_OBRAS = '2025-01-01';
// Órgãos que publicam obras no PNCP (CNPJ -> nome curto no site).
export const ORGAOS = { '46634507000106': 'Prefeitura', '11065186000183': 'SAAE', '07078236000190': 'Consórcio do Ribeirão Piraí' };
const SIGLA = { Prefeitura: 'prefeitura', SAAE: 'saae', 'Consórcio do Ribeirão Piraí': 'consorcio-pirai' };
// Executores municipais no Obrasgov.br (obras de outros entes, como FDE, IFSP e TJSP, ficam de fora).
export const EXECUTORES_MUNICIPAIS = { '46634507000106': 'Prefeitura', '11297631000130': 'Prefeitura (Fundo Municipal de Saúde)', '11065186000183': 'SAAE' };
export const GRUPOS_OBRA = ['paralisada', 'execucao', 'licitacao', 'federal', 'encerrada'];

// "O que conta como obra" (pesquisa, seção c): critério de modalidade, categoria ou emergência, E palavras no objeto, MENOS exclusões.
// "mão de obra" não conta como palavra de obra; ETA/ETE/EEE só em maiúsculas e palavra inteira ("secretaria" não casa).
const PALAVRAS = /\bobras?\b|engenharia|constru|reforma|amplia|pavimenta|drenagem|duplica|recapea|adutora|elevatoria|\brede (de|coletora)\b|implanta/;
const SIGLAS_OBRA = /\b(ETA|ETE|EEE)\b/;
// Além das exclusões da pesquisa: estudos e serviços de apoio à obra (acompanhamento, fiscalização, topografia) não são a obra.
const EXCLUSAO = /consultoria|elaboracao d[oe]s? (projeto|plano)|plano municipal|manutencao mecanica|operacao, manutencao|estudos? de concepcao|acompanhamento tecnico|apoio a fiscalizacao|servicos? de topografia/;
// Contratação integrada (projeto + obra) não é "só projeto": continua sendo obra.
const EXECUCAO_DE_OBRA = /execucao d[aeo]s? obras?/;

export function temPalavraObra(objeto) {
  const t = normalizar(objeto).replace(/mao[\s-]+de[\s-]+obra/g, ' ');
  if (!PALAVRAS.test(t) && !SIGLAS_OBRA.test(String(objeto ?? ''))) return false;
  return !(EXCLUSAO.test(t) && !EXECUCAO_DE_OBRA.test(t));
}

// Dispensa por emergência: Lei 14.133, art. 75, VIII (código 38 no PNCP).
export const amparoEmergencial = (a) => Boolean(a) && (Number(a.codigo) === 38 || /art\.?\s*75,?\s*(inciso\s*)?VIII\b/i.test(String(a.nome ?? a)));

export function ehObra(objeto, modalidade, categoria, amparo) {
  const m = Number(modalidade);
  const c = Number(categoria);
  const criterio = m === 4 || m === 5 || c === 7 || c === 9 || (m === 8 && amparoEmergencial(amparo));
  return criterio && temPalavraObra(objeto);
}

// Republicações da mesma licitação (mesmo órgão e processo) viram um grupo; vale a publicação mais recente.
export function agruparPorProcesso(contratacoes) {
  const grupos = new Map();
  for (const c of contratacoes) {
    const chave = `${c.cnpj}|${normalizar(c.processo) || c.id}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }
  const seq = (id) => Number((/-0*(\d+)\/\d{4}$/.exec(id) || [])[1]) || 0;
  const ano = (id) => Number((/\/(\d{4})$/.exec(id) || [])[1]) || 0;
  return [...grupos].map(([chave, lista]) => {
    const ordem = [...lista].sort((a, b) => String(b.publicacao || '').localeCompare(String(a.publicacao || '')) || ano(b.id) - ano(a.id) || seq(b.id) - seq(a.id));
    return { chave, atual: ordem[0], ids: ordem.map((c) => c.id) };
  });
}

// Grupo da obra na página. A palavra "paralisada" é sempre da fonte (Prefeitura, TCE-SP ou Obrasgov.br).
export function situacaoObra({ contrato, licitacao, obrasgov, tce, prefeitura }, hoje) {
  const og = (obrasgov && obrasgov.situacao) || '';
  const ogDentro = obrasgov && (obrasgov.fimPrevisto || '9999') >= INICIO_OBRAS;
  if ((prefeitura && prefeitura.paralisada) || (tce && tce.paralisada)) return 'paralisada';
  if ((og === 'Paralisada' || og === 'Inacabada') && (contrato || licitacao || tce || ogDentro)) return 'paralisada';
  if (contrato) {
    const vigente = !contrato.fimVigencia || contrato.fimVigencia >= hoje;
    return vigente || (tce && /execu/i.test(tce.situacao || '')) || og === 'Em execução' ? 'execucao' : 'encerrada';
  }
  if (licitacao) return /revogad|anulad|desert|fracassad/i.test(licitacao.situacao || '') ? null : 'licitacao';
  if (tce) return /conclu/i.test(tce.situacao || '') ? 'encerrada' : 'execucao';
  if (prefeitura) return 'execucao';
  if (og === 'Em execução') return 'execucao';
  if (og === 'Concluída') {
    const fim = obrasgov.fimEfetivo || obrasgov.fimPrevisto;
    return fim && fim >= INICIO_OBRAS && fim <= hoje ? 'encerrada' : null;
  }
  if (og === 'Cadastrada') return obrasgov.cadastro >= INICIO_OBRAS && ogDentro ? 'federal' : null;
  return null;
}

// Painel do TCE: mesmo CNPJ do contratado e mesmo ano do contrato, com valor parecido.
export function juntarTce(obras, tce) {
  const saida = obras.map((o) => ({ ...o }));
  const sobra = [];
  for (const t of tce || []) {
    const cands = t.cnpj && t.ano ? saida.filter((o) => !o.tce && o.fornecedorCnpj === t.cnpj && o.anoContrato === t.ano) : [];
    // Valor igual (1%); candidato único vale até 25% de diferença (limite legal de aditivo). Fora disso, é outro contrato.
    const perto = (o, f) => Math.abs(o.valor - t.valor) <= Math.max(1, t.valor * f);
    const alvo = cands.find((o) => perto(o, 0.01)) || (cands.length === 1 && perto(cands[0], 0.25) ? cands[0] : null);
    if (alvo) alvo.tce = { situacao: t.situacao, paralisada: Boolean(t.paralisada) };
    else sobra.push(t);
  }
  return { obras: saida, sobra };
}

const dataIso = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const reaisTexto = (s) => { const n = Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Tabela HTML da página "Consulta de Obras Paralisadas" (WordPress). Sem tabela = a página mudou: erro (fica o último dado salvo).
export function lerTabelaParalisadas(html) {
  const tabela = /<table[\s\S]*?<\/table>/i.exec(String(html ?? ''));
  if (!tabela) throw new Error('a página não tem mais a tabela de obras');
  const linhas = [...tabela[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  const cab = linhas.find((l) => /<th/i.test(l));
  const nomes = cab ? [...cab.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => normalizar(limparHtml(m[1]))) : [];
  const col = (re, padrao) => { const i = nomes.findIndex((n) => re.test(n)); return i >= 0 ? i : padrao; };
  const c = { obra: col(/^obra/, 0), inicio: col(/inicio/, 1), termino: col(/termino/, 2), valor: col(/valor/, 3), pct: col(/percentual|executad/, 4), status: col(/status|situacao/, 5) };
  const saida = [];
  for (const tr of linhas) {
    if (/<th/i.test(tr)) continue;
    const cel = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!cel.length) continue;
    const texto = (k) => limparHtml(cel[c[k]] ?? '');
    const link = (/href="(https:\/\/[^"]+)"/i.exec(cel[c.obra] ?? '') || [])[1] || null;
    const pct = /(\d+(?:,\d+)?)\s*%/.exec(texto('pct'));
    const status = texto('status');
    saida.push({
      nome: ocultarDocumentos(texto('obra')), link, inicio: dataIso(texto('inicio')), termino: dataIso(texto('termino')),
      valor: reaisTexto(texto('valor')), pct: pct ? Number(pct[1].replace(',', '.')) : null, status, paralisada: /paralisad/i.test(status),
    });
  }
  return saida;
}

// Objeto curto para o título da obra: tira o "Contratação de empresa especializada para..." e o fim burocrático.
const ACAO = /\b(execu[cç][aã]o|constru[cç][aã]o|reforma|amplia[cç][aã]o|implanta[cç][aã]o|pavimenta[cç][aã]o|elabora[cç][aã]o|fornecimento|substitui[cç][aã]o|servi[cç]os?|obras?|recapeamento|duplica[cç][aã]o|recupera[cç][aã]o|revitaliza[cç][aã]o|instala[cç][aã]o|troca|manuten[cç][aã]o)\b/i;
const CAUDA = /[,;.]?\s+(?:com\s+(?:o\s+)?fornecimento\s+d[eo]s?\s|conforme\s|de\s+acordo\s+com\s|a\s+cargo\s+d[ae]\s|observad[ao]s?\s|nos\s+termos\s|mediante\s)/i;
export function resumirObjeto(txt, max = 160) {
  const completo = ocultarDocumentos(String(txt ?? '').replace(/\s+/g, ' ').trim().replace(/^[-–•.\s]+/, ''));
  let t = completo;
  if (/^contrat/i.test(t)) {
    const m = ACAO.exec(t);
    if (m && m.index < 140) t = t.slice(m.index);
  }
  t = t.replace(/^(execu[cç][aã]o|presta[cç][aã]o)\s+d[aeo]s?\s+(?=\S)/i, '')
    .replace(/,?\s*(?:de forma indireta(?:,?\s+(?:semi-integrada|integrada|integral))?|por empreitada (?:global|por pre[cç]o unit[aá]rio)),?\s*/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const cauda = CAUDA.exec(t);
  if (cauda && cauda.index >= 25) t = t.slice(0, cauda.index);
  t = t.replace(/[\s,;.:\-–]+$/, '');
  if (!/\p{Ll}/u.test(t)) t = frase(t);
  t = t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
  if (t.length > max) t = `${t.slice(0, Math.max(t.lastIndexOf(' ', max), 1)).replace(/[\s,;.:\-–]+$/, '')}…`;
  return { titulo: t, completo };
}

export const urlPncp = (id) => {
  const m = /^(\d{14})-([12])-0*(\d+)\/(\d{4})$/.exec(String(id ?? ''));
  return m ? `https://pncp.gov.br/app/${m[2] === '1' ? 'editais' : 'contratos'}/${m[1]}/${m[4]}/${m[3]}` : null;
};
export const urlObrasgov = (id) => `https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento?id_projeto_investimento=${encodeURIComponent(id)}`;

// --- Formato salvo (data/processado/obras-fontes.json): só o necessário, nunca nome ou CPF de pessoa física. ---
const dia = (s) => (s ? String(s).slice(0, 10) : null);
export function enxugarContratacao(c) {
  return {
    id: c.numeroControlePNCP, cnpj: (c.orgaoEntidade && c.orgaoEntidade.cnpj) || '', processo: String(c.processo ?? '').trim(),
    objeto: ocultarDocumentos(String(c.objetoCompra ?? '').replace(/\s+/g, ' ').trim()), modalidadeId: Number(c.modalidadeId) || null,
    situacao: c.situacaoCompraNome || '', homologado: Number(c.valorTotalHomologado) || 0, estimado: Number(c.valorTotalEstimado) || 0,
    encerramento: dia(c.dataEncerramentoProposta), publicacao: dia(c.dataPublicacaoPncp || c.dataInclusao),
    amparo: c.amparoLegal ? { codigo: c.amparoLegal.codigo ?? null, nome: c.amparoLegal.nome || '' } : null,
  };
}

export function enxugarContrato(c) {
  const doc = String(c.niFornecedor ?? '').replace(/\D/g, '');
  const pj = doc.length === 14;
  return {
    id: c.numeroControlePNCP, cnpj: (c.orgaoEntidade && c.orgaoEntidade.cnpj) || '', compra: c.numeroControlePncpCompra || null,
    objeto: ocultarDocumentos(String(c.objetoContrato ?? '').replace(/\s+/g, ' ').trim()), categoriaId: Number(c.categoriaProcesso && c.categoriaProcesso.id) || null,
    tipo: (c.tipoContrato && c.tipoContrato.nome) || '', numero: c.numeroContratoEmpenho || null, ano: Number(c.anoContrato) || null,
    // Contratado pessoa física: sem nome e sem documento.
    fornecedorCnpj: pj ? doc : null, empresa: pj ? limparNomeEmpresa(ocultarDocumentos(c.nomeRazaoSocialFornecedor)) : doc ? 'pessoa física' : null,
    valor: Number(c.valorGlobal) || 0, assinatura: dia(c.dataAssinatura), fimVigencia: dia(c.dataVigenciaFim),
  };
}

// Guarda só contratos que podem ser obra (o resto da Prefeitura passa de 2 mil por ano).
export function candidatoContrato(ct, idsContratacoes, manter) {
  if (ct.tipo === 'Empenho') return false;
  return manter.has(ct.id) || (ct.compra && (manter.has(ct.compra) || idsContratacoes.has(ct.compra))) || ct.categoriaId === 7 || ct.categoriaId === 9 || temPalavraObra(ct.objeto);
}

// Modalidade e amparo de contratação fora da lista de concorrências (ex.: dispensa emergencial): consulta uma vez e guarda.
export const precisaConsultarCompra = (ct, contratacoes, compras) =>
  Boolean(ct.compra) && !contratacoes[ct.compra] && !(ct.compra in compras) && ct.categoriaId !== 7 && ct.categoriaId !== 9 && temPalavraObra(ct.objeto);

export function enxugarProjeto(p, conferidoEm) {
  const previsto = (p.investimentos_previstos || []).reduce((s, i) => s + (Number(i.vl_investimento_previsto) || 0), 0);
  return {
    id: p.id_projeto_investimento, nome: String(p.desc_nome ?? '').replace(/\s+/g, ' ').trim(), situacao: p.situacao || '',
    cadastro: dia(p.dt_cadastro), fimPrevisto: dia(p.dt_final_prevista), fimEfetivo: dia(p.dt_final_efetiva),
    executores: (p.executores || []).map((e) => String(e.cnpj_executor ?? '').replace(/\D/g, '')).filter(Boolean),
    repassador: ((p.repassadores || [])[0] || {}).organizacao_repassador || null,
    fontes: [...new Set((p.investimentos_previstos || []).map((i) => i.desc_nome_fonte_recurso).filter(Boolean))],
    previsto: Math.round(previsto * 100) / 100, sistema: p.sistema_resp || null, conferidoEm,
  };
}

export function ultimaExecucao(lista) {
  const e = [...(lista || [])].filter((x) => x && x.percentual_execucao_fisica != null)
    .sort((a, b) => String(b.dt_atualizacao_execucao || '').localeCompare(String(a.dt_atualizacao_execucao || '')))[0];
  return e ? { pct: Number(e.percentual_execucao_fisica), em: dia(e.dt_atualizacao_execucao) } : null;
}

// Obrasgov.br não tem lista por cidade com a situação: cada projeto é reconferido 1 vez por semana (e o novo, na hora).
export const precisaReconsultar = (ant, agora) => !ant || !ant.conferidoEm || agora - Date.parse(ant.conferidoEm) >= 7 * 86400000;
// % executado: quando a situação muda, ou a cada reconferência de obra em andamento.
export const precisaExecucao = (ant, novo) =>
  ['Em execução', 'Paralisada', 'Inacabada', 'Concluída'].includes(novo.situacao) && (!ant || ant.situacao !== novo.situacao || !ant.execucao || novo.situacao === 'Em execução');

// Janelas de datas (AAAAMMDD) de `meses` meses, sem cruzar o ano, de `inicio` até `hoje`.
export function janelas(inicio, hoje, meses) {
  const p2 = (n) => String(n).padStart(2, '0');
  const h = hoje.replaceAll('-', '');
  const out = [];
  let [a, m] = inicio.split('-').map(Number);
  for (;;) {
    const ini = `${a}${p2(m)}01`;
    const m2 = Math.min(12, m + meses - 1);
    const fim = `${a}${p2(m2)}${p2(new Date(Date.UTC(a, m2, 0)).getUTCDate())}`;
    if (fim >= h) { out.push([ini, h]); return out; }
    out.push([ini, fim]);
    m = m2 + 1;
    if (m > 12) { m = 1; a++; }
  }
}

// Cada fonte fica com a coleta mais recente (coletadoEm). Em empate, vale o segundo argumento.
export function mesclarFontesObras(a, b) {
  const out = {};
  for (const k of ['pncp', 'obrasgov', 'paralisadas']) {
    const x = a && a[k];
    const y = b && b[k];
    out[k] = !x ? y || null : !y ? x : String(y.coletadoEm || '') >= String(x.coletadoEm || '') ? y : x;
  }
  return out;
}

// --- Ligações curadas à mão (data/referencia/obras-ligacoes.json) ---
const RE_PNCP = /^\d{14}-[12]-\d{6}\/\d{4}$/;
const RE_OBRASGOV = /^\d+\.\d{2}-\d{2}$/;
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const numerosDePromessas = (ref) => new Set(((ref && Array.isArray(ref.areas)) ? ref.areas : [])
  .flatMap((a) => (a && Array.isArray(a.itens) ? a.itens : [])).filter((it) => it && typeof it === 'object').map((it) => String(it.numero)));

export function validarLigacoes(ref, numerosPromessa) {
  if (!ref || !Array.isArray(ref.ligacoes)) return ['o arquivo não tem a lista "ligacoes"'];
  const problemas = [];
  const ids = new Set();
  const fontes = new Set();
  ref.ligacoes.forEach((l, i) => {
    const nome = (l && l.id) || `item ${i + 1}`;
    if (!l || typeof l !== 'object') { problemas.push(`${nome}: item vazio`); return; }
    if (!RE_ID.test(l.id || '')) problemas.push(`${nome}: id inválido (só letras minúsculas, números e hífen)`);
    else if (ids.has(l.id)) problemas.push(`${nome}: id repetido`);
    ids.add(l.id);
    for (const [campo, re] of [['pncp', RE_PNCP], ['obrasgov', RE_OBRASGOV]]) {
      if (l[campo] === undefined) continue;
      if (!Array.isArray(l[campo])) { problemas.push(`${nome}: "${campo}" precisa ser uma lista`); continue; }
      for (const x of l[campo]) {
        if (!re.test(String(x))) problemas.push(`${nome}: ${campo} "${x}" fora do formato`);
        else if (fontes.has(x)) problemas.push(`${nome}: ${x} aparece em mais de uma ligação`);
        fontes.add(x);
      }
    }
    if (!Array.isArray(l.promessas)) problemas.push(`${nome}: "promessas" precisa ser uma lista`);
    else for (const n of l.promessas) if (!numerosPromessa.has(String(n))) problemas.push(`${nome}: a promessa ${n} não existe em promessas.json`);
    const temFonte = (Array.isArray(l.pncp) && l.pncp.length) || (Array.isArray(l.obrasgov) && l.obrasgov.length);
    if (!temFonte && !(typeof l.pendente === 'string' && l.pendente.trim())) problemas.push(`${nome}: sem PNCP, sem Obrasgov e sem "pendente"`);
  });
  return problemas;
}

// --- Montagem da lista ---
const seqDe = (id) => (/-0*(\d+)\/(\d{4})$/.exec(id) || []).slice(1).reverse().join('-');
const licitacaoDe = (g) => ({ id: g.atual.id, url: urlPncp(g.atual.id), situacao: g.atual.situacao, encerramento: g.atual.encerramento, homologado: g.atual.homologado, estimado: g.atual.estimado });
const projetoAnexo = (p) => ({
  id: p.id, url: urlObrasgov(p.id), situacao: p.situacao, cadastro: p.cadastro, fimPrevisto: p.fimPrevisto, fimEfetivo: p.fimEfetivo,
  pct: p.execucao ? p.execucao.pct : null, pctEm: p.execucao ? p.execucao.em : null, repassador: p.repassador, fontes: p.fontes, previsto: p.previsto,
});
const orgaoDoTce = (s) => (/SAAE|AGUA E ESGOTO/i.test(s) ? 'SAAE' : /PIRAI/i.test(s) ? 'Consórcio do Ribeirão Piraí' : /PREFEITURA|MUNICIPIO/i.test(s) ? 'Prefeitura' : frase(s));

function nova(extra) {
  return {
    id: null, idBase: null, ligacao: null, promessas: [], orgao: null, titulo: '', objeto: '', empresa: null, fornecedorCnpj: null, anoContrato: null,
    valor: 0, tipoValor: null, assinatura: null, fimVigencia: null, contrato: null, licitacao: null, obrasgov: [], tce: null, prefeitura: null, ...extra,
  };
}
const comObjeto = (txt) => { const r = resumirObjeto(txt); return { titulo: r.titulo, objeto: r.completo }; };

export function montarObras({ pncp, obrasgov, paralisadas, tce, tceDataBase, ligacoes, numerosPromessa, hoje }) {
  const manutencao = [];
  const ligs = ligacoes && Array.isArray(ligacoes.ligacoes) ? ligacoes.ligacoes.filter((l) => l && typeof l === 'object' && l.id) : [];
  const porFonte = new Map();
  for (const l of ligs) for (const x of [...(Array.isArray(l.pncp) ? l.pncp : []), ...(Array.isArray(l.obrasgov) ? l.obrasgov : [])]) if (!porFonte.has(x)) porFonte.set(x, l);
  const ligDe = (ids) => ids.map((x) => porFonte.get(x)).find(Boolean) || null;

  const contratacoes = Object.values((pncp && pncp.contratacoes) || {}).filter((c) => ORGAOS[c.cnpj]);
  const contratos = Object.values((pncp && pncp.contratos) || {}).filter((c) => ORGAOS[c.cnpj] && c.tipo !== 'Empenho');
  const compras = (pncp && pncp.compras) || {};
  const grupos = agruparPorProcesso(contratacoes);
  const grupoDe = new Map();
  for (const g of grupos) for (const id of g.ids) grupoDe.set(id, g);
  // Contrato ligado no PNCP à licitação errada (ex.: as duas clínicas de 2025 apontam para a mesma): se o valor do contrato
  // não bate com o homologado dela, mas bate com o de outra licitação do mesmo órgão, vale a outra.
  const grupoDoContrato = (ct) => {
    const g = ct.compra ? grupoDe.get(ct.compra) : null;
    if (!g || !g.atual.homologado || Math.abs(g.atual.homologado - ct.valor) < 1) return g;
    return grupos.find((x) => x.atual.cnpj === ct.cnpj && x.atual.homologado && Math.abs(x.atual.homologado - ct.valor) < 1) || g;
  };
  const comContrato = new Set(contratos.map(grupoDoContrato).filter(Boolean).map((g) => g.chave));

  let obras = [];
  for (const ct of contratos) {
    const g = grupoDoContrato(ct);
    const l = ligDe([ct.id, ...(g ? g.ids : ct.compra ? [ct.compra] : [])]);
    const modalidade = g ? g.atual.modalidadeId : compras[ct.compra] && compras[ct.compra].modalidadeId;
    const amparo = g ? g.atual.amparo : compras[ct.compra] && compras[ct.compra].amparo;
    if (!l && !ehObra(ct.objeto, modalidade, ct.categoriaId, amparo)) continue;
    const orgao = ORGAOS[ct.cnpj];
    obras.push(nova({
      ...comObjeto(ct.objeto), orgao, empresa: ct.empresa, fornecedorCnpj: ct.fornecedorCnpj, anoContrato: Number(String(ct.assinatura || '').slice(0, 4)) || ct.ano,
      valor: ct.valor, tipoValor: 'contrato', assinatura: ct.assinatura, fimVigencia: ct.fimVigencia,
      contrato: { id: ct.id, url: urlPncp(ct.id), numero: ct.numero },
      licitacao: g ? licitacaoDe(g) : ct.compra ? { id: ct.compra, url: urlPncp(ct.compra) } : null,
      ligacao: l, idBase: g ? `${SIGLA[orgao]}-${slug(g.atual.processo || g.atual.id)}` : `${SIGLA[orgao]}-contrato-${seqDe(ct.id)}`,
    }));
  }
  for (const g of grupos) {
    if (comContrato.has(g.chave)) continue;
    const a = g.atual;
    const l = ligDe(g.ids);
    if (!l && !ehObra(a.objeto, a.modalidadeId, null, a.amparo)) continue;
    const orgao = ORGAOS[a.cnpj];
    obras.push(nova({
      ...comObjeto(a.objeto), orgao, valor: a.homologado || a.estimado, tipoValor: a.homologado ? 'homologado' : a.estimado ? 'estimado' : null,
      licitacao: licitacaoDe(g), ligacao: l, idBase: `${SIGLA[orgao]}-${slug(a.processo || a.id)}`,
    }));
  }

  // Obrasgov.br: ligado à mão -> anexa à obra da mesma ligação; senão, só obras de executor municipal.
  const projetos = Object.values((obrasgov && obrasgov.projetos) || {}).filter((p) => p && p.id);
  const soltas = [];
  for (const p of projetos) {
    const l = porFonte.get(p.id);
    const dona = l && obras.find((o) => o.ligacao === l);
    if (dona) { dona.obrasgov.push(projetoAnexo(p)); continue; }
    const executor = p.executores.map((c) => EXECUTORES_MUNICIPAIS[c]).find(Boolean);
    if (!l && !executor) continue;
    // Registro repetido ("Cadastrada" com o mesmo nome e valor) vira uma obra só.
    const chave = p.situacao === 'Cadastrada' ? `${normalizar(p.nome)}|${p.previsto}` : null;
    const igual = soltas.find((o) => (l && o.ligacao === l) || (chave && o.chaveOg === chave));
    if (igual) { igual.obrasgov.push(projetoAnexo(p)); continue; }
    soltas.push(nova({
      ...comObjeto(p.nome), orgao: executor || 'Prefeitura', valor: p.previsto, tipoValor: p.previsto ? 'previsto' : null,
      obrasgov: [projetoAnexo(p)], ligacao: l, idBase: `obrasgov-${slug(p.id)}`, chaveOg: chave,
    }));
  }
  obras.push(...soltas.map(({ chaveOg, ...o }) => o));

  // Painel do TCE: anota a situação; obra do painel sem par no PNCP (contrato antes de 2025) entra sozinha.
  const tceLista = tce || [];
  const junta = juntarTce(obras, tceLista);
  obras = junta.obras;
  for (const t of junta.sobra) {
    obras.push(nova({
      ...comObjeto(t.objeto), orgao: orgaoDoTce(t.contratante || ''), empresa: /f[ií]sica/i.test(t.contratado || '') ? 'pessoa física' : t.cnpj ? t.contratado : null,
      fornecedorCnpj: t.cnpj || null, anoContrato: t.ano, valor: t.valor, tipoValor: 'contrato',
      tce: { situacao: t.situacao, paralisada: Boolean(t.paralisada) }, idBase: `tce-${t.cnpj || 'sem-cnpj'}-${t.ano || 'sem-ano'}`,
    }));
  }

  // Paralisadas declaradas pela Prefeitura: mesma obra = mesmo valor; com mais de uma, a que tem mais palavras do nome no objeto.
  for (const linha of ((paralisadas && paralisadas.obras) || []).filter((x) => x.paralisada)) {
    const palavras = normalizar(linha.nome).split(/\W+/).filter((w) => w.length >= 4);
    const nota = (o) => palavras.filter((w) => normalizar(o.objeto).includes(w)).length;
    const cands = obras.filter((o) => o.orgao === 'Prefeitura' && !o.prefeitura && linha.valor > 0 && Math.abs(o.valor - linha.valor) < 1).sort((a, b) => nota(b) - nota(a));
    const anexo = { nome: linha.nome, paralisada: true, pct: linha.pct, inicio: linha.inicio, termino: linha.termino, link: linha.link, status: linha.status };
    if (cands.length) cands[0].prefeitura = anexo;
    else obras.push(nova({ ...comObjeto(linha.nome), orgao: 'Prefeitura', valor: linha.valor, tipoValor: linha.valor ? 'contrato' : null, prefeitura: anexo, idBase: `prefeitura-${slug(linha.nome)}` }));
  }

  // Grupo, ids únicos e promessas.
  const vistos = new Set();
  const lista = [];
  for (const o of obras) {
    const grupo = situacaoObra({ contrato: o.contrato ? { fimVigencia: o.fimVigencia } : null, licitacao: o.contrato ? null : o.licitacao, obrasgov: o.obrasgov[0] || null, tce: o.tce, prefeitura: o.prefeitura }, hoje);
    if (!grupo) continue;
    let id = (o.ligacao && o.ligacao.id) || o.idBase;
    for (let n = 2; vistos.has(id); n++) id = `${(o.ligacao && o.ligacao.id) || o.idBase}-${n}`;
    vistos.add(id);
    const promessas = o.ligacao && Array.isArray(o.ligacao.promessas) ? o.ligacao.promessas.map(String).filter((n) => numerosPromessa.has(n)) : [];
    const { idBase, ligacao, ...resto } = o;
    lista.push({
      ...resto, id, grupo, ligacao: ligacao ? ligacao.id : null, promessas,
      vigente: Boolean(o.contrato) && (!o.fimVigencia || o.fimVigencia >= hoje),
      propostasAbertas: Boolean(o.licitacao && o.licitacao.encerramento && o.licitacao.encerramento >= hoje),
    });
  }
  lista.sort((a, b) => GRUPOS_OBRA.indexOf(a.grupo) - GRUPOS_OBRA.indexOf(b.grupo) || b.valor - a.valor || a.id.localeCompare(b.id));

  // Ligação cujo número não apareceu na coleta: aviso de manutenção (o número mudou ou o contrato saiu do ar).
  const conhecidos = new Set([...Object.keys((pncp && pncp.contratacoes) || {}), ...Object.keys((pncp && pncp.contratos) || {})]);
  const conhecidosOg = new Set(projetos.map((p) => p.id));
  for (const l of ligs) {
    const faltam = [
      ...(pncp ? (Array.isArray(l.pncp) ? l.pncp : []).filter((x) => !conhecidos.has(x)) : []),
      ...(obrasgov ? (Array.isArray(l.obrasgov) ? l.obrasgov : []).filter((x) => !conhecidosOg.has(x)) : []),
    ];
    if (faltam.length) manutencao.push(`Obras: a ligação "${l.id}" cita ${faltam.join(', ')}, que não ${faltam.length === 1 ? 'apareceu' : 'apareceram'} na coleta; confira data/referencia/obras-ligacoes.json.`);
  }

  const porGrupo = Object.fromEntries(GRUPOS_OBRA.map((g) => [g, lista.filter((o) => o.grupo === g).length]));
  const valorContratado = lista.filter((o) => o.tipoValor === 'contrato' && (o.grupo === 'paralisada' || o.grupo === 'execucao')).reduce((s, o) => s + o.valor, 0);
  return {
    lista,
    resumo: { total: lista.length - porGrupo.encerrada, porGrupo, paralisadas: porGrupo.paralisada, valorContratado: Math.round(valorContratado * 100) / 100 },
    fontes: {
      pncp: (pncp && pncp.coletadoEm) || null,
      pncpIncompleto: Boolean(pncp && pncp.incompleto),
      obrasgov: (obrasgov && obrasgov.coletadoEm) || null,
      obrasgovBase: (obrasgov && obrasgov.dataAtualizacao) || null,
      paralisadas: (paralisadas && paralisadas.coletadoEm) || null,
      paralisadasModificado: (paralisadas && paralisadas.modificado) || null,
      paralisadasLink: (paralisadas && paralisadas.link) || null,
      tceDataBase: tceDataBase || null,
    },
    pendentes: ligs.filter((l) => typeof l.pendente === 'string' && l.pendente.trim()).map((l) => ({ id: l.id, nome: l.nome || l.id, pendente: l.pendente, promessas: l.promessas || [] })),
    manutencao,
  };
}
