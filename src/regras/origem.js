import { FUNCOES } from './despesas.js';

// De onde vem e para onde vai o dinheiro (spec 2026-11-17-origem-dinheiro-design.md).
// Base: MSC orçamentária do SICONFI (Tesouro Nacional), classe 6, saldo final (acumulado do ano).

export const CONTA_RECEITA = '621200000'; // 6.2.1.2 Receita realizada
export const CONTA_DEDUCAO_FUNDEB = '621310100'; // 6.2.1.3.1.01 (-) dedução para formação do FUNDEB
const EMPENHADA = new Set(['622130100', '622130200', '622130300', '622130400', '622130500', '622130600', '622130700']);
const LIQUIDADA = new Set(['622130300', '622130400', '622130700']);
const PAGA = '622130400';
export const PO_CAMARA = '20231';
export const LIMITE_CONFERENCIA = 0.03;

export const GRUPOS_ORIGEM = {
  impostos: 'Impostos e taxas da cidade',
  uniao: 'Repasses da União',
  estado: 'Repasses do Estado',
  fundeb: 'Fundeb',
  convenios: 'Convênios e emendas parlamentares',
  financiamentos: 'Financiamentos',
  outros: 'Outros',
};
export const GRUPOS_DESTINO = {
  livre: 'Livre',
  educacao: 'Educação',
  saude: 'Saúde',
  assistencia: 'Assistência social',
  convenios: 'Convênios e emendas',
  financiamentos: 'Financiamentos',
  outras: 'Outras vinculadas',
};
export const TIPOS_EMENDA = {
  'uniao-especial': 'União: transferência especial ("emenda Pix")',
  'uniao-individual': 'União: emendas individuais',
  'uniao-bancada': 'União: emendas de bancada',
  'uniao-comissao': 'União: emendas de comissão',
  'uniao-relator': 'União: emendas de relator',
  'estado-especial': 'Estado: transferência especial',
  'estado-individual': 'Estado: emendas individuais',
  'estado-bancada': 'Estado: emendas de bancada',
  'estado-comissao': 'Estado: emendas de comissão',
  'estado-relator': 'Estado: emendas de relator',
};

const centavos = (v) => Math.round(v * 100) / 100;
const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
// Valor sempre positivo na MSC; o sentido vem da natureza (C crédito, D débito).
export const sinal = (i) => (i.natureza_conta === 'D' ? -Number(i.valor) : Number(i.valor));
const fonte3 = (i) => String(i.fonte_recursos || '').slice(1);

// CO de emenda: 3110 a 3149 (União) e 3210 a 3249 (Estado); fontes 706 e 710 são as transferências especiais.
// A transferência especial da União tem natureza própria (1.7.1.9.57 e 2.4.1.9.51); a fonte 706 com outra natureza de
// transferência (ex.: SUS) segue o CO. Rendimento de aplicação na fonte 706 é da transferência especial.
export function tipoEmenda(co, fr3, nr = '') {
  if (/^(171957|241951)/.test(nr)) return 'uniao-especial';
  if (fr3 === '710') return 'estado-especial';
  if (fr3 === '706' && !/^(17|24)/.test(nr)) return 'uniao-especial';
  const m = String(co || '').match(/^3([12])([1-4])\d$/);
  if (m) return `${m[1] === '1' ? 'uniao' : 'estado'}-${['individual', 'bancada', 'comissao', 'relator'][Number(m[2]) - 1]}`;
  return fr3 === '706' ? 'uniao-especial' : null;
}

// Origem pela natureza da receita (8 dígitos). A emenda (CO, fontes 706/710) vem antes de tudo.
export function origemReceita(i) {
  const nr = String(i.natureza_receita || '');
  if (/^[78]/.test(nr)) return 'intra';
  if (tipoEmenda(i.complemento_fonte, fonte3(i), nr)) return 'convenios';
  if (/^(1717|1724|2417|2422)/.test(nr)) return 'convenios';
  if (/^1[12]/.test(nr)) return 'impostos';
  if (/^(1751|2451)/.test(nr)) return 'fundeb';
  if (/^(171|241)/.test(nr)) return 'uniao';
  if (/^(172|242)/.test(nr)) return 'estado';
  if (/^21/.test(nr)) return 'financiamentos';
  return 'outros';
}

// Destino pela faixa da fonte (3 dígitos). O CO prevalece: emenda, 1001 (mínimo da educação), 1002 (mínimo da saúde).
// A emenda é reconhecida como na origem (mesma regra, com a natureza da receita quando houver).
export function destinoFonte(fr3, co, nr = '') {
  if (tipoEmenda(co, fr3, nr)) return 'convenios';
  const n = Number(fr3);
  const c = String(co || '');
  if ([574, 634, 754].includes(n)) return 'financiamentos';
  if (n >= 500 && n <= 503) return c === '1001' ? 'educacao' : c === '1002' ? 'saude' : 'livre';
  if (n >= 540 && n <= 599) return 'educacao';
  if (n >= 600 && n <= 659) return 'saude';
  if (n >= 660 && n <= 669) return 'assistencia';
  if ([700, 701, 702, 703].includes(n)) return 'convenios';
  return 'outras';
}

const arredondar = (x) => {
  if (typeof x === 'number') return centavos(x);
  if (Array.isArray(x)) return x.map(arredondar);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, arredondar(v)]));
  return x;
};

// Linhas da MSC (classe 6, ending_balance) -> resumo do ano até o mês.
export function resumirMsc(itens) {
  const receita = { bruta: 0, deducaoFundeb: 0, outrasDeducoes: 0, intra: 0 };
  const origem = {};
  let tarifas = 0;
  const destino = {};
  const dest = (g) => (destino[g] ??= { entrou: 0, liquidado: 0, pago: 0, funcoes: {}, fontes: {} });
  const despesa = { empenhada: 0, liquidada: 0, paga: 0, camaraPaga: 0 };
  const emendas = { receita: {}, liquidado: 0, funcoes: {} };
  // Impostos marcados com o mínimo da educação (CO 1001) e da saúde (CO 1002): receita e gasto com a marca.
  const minimos = { 1001: { entrou: 0, liquidado: 0 }, 1002: { entrou: 0, liquidado: 0 } };
  const fontes = new Set();
  const cos = new Set();
  for (const i of itens) {
    if (!i || typeof i !== 'object' || !Number.isFinite(Number(i.valor))) continue; // linha estragada fica de fora
    const c = String(i.conta_contabil);
    const fr3 = fonte3(i);
    const co = i.complemento_fonte ? String(i.complemento_fonte) : '';
    const nr = String(i.natureza_receita || '');
    const ehReceita = c === CONTA_RECEITA;
    const ehDeducao = c.startsWith('6213');
    if (ehReceita || ehDeducao) {
      if (fr3) fontes.add(fr3);
      if (co) cos.add(co);
      // Receita soma; dedução (natureza devedora) subtrai do mesmo grupo.
      const v = sinal(i);
      if (ehReceita) receita.bruta += v;
      else if (c === CONTA_DEDUCAO_FUNDEB) receita.deducaoFundeb -= v;
      else receita.outrasDeducoes -= v;
      const g = origemReceita(i);
      if (g === 'intra') { receita.intra += v; continue; }
      add(origem, g, v);
      if (/^16/.test(nr)) tarifas += v;
      const d = dest(destinoFonte(fr3, co, nr));
      d.entrou += v;
      add(d.fontes, fr3, v);
      if (minimos[co]) minimos[co].entrou += v;
      const t = tipoEmenda(co, fr3, nr);
      if (t) add(emendas.receita, t, v);
      continue;
    }
    if (!EMPENHADA.has(c)) continue;
    if (fr3) fontes.add(fr3);
    if (co) cos.add(co);
    const v = sinal(i);
    despesa.empenhada += v;
    if (!LIQUIDADA.has(c)) continue;
    despesa.liquidada += v;
    const d = dest(destinoFonte(fr3, co));
    const f = String(i.funcao || '');
    d.liquidado += v;
    add(d.funcoes, f, v);
    if (minimos[co]) minimos[co].liquidado += v;
    if (tipoEmenda(co, fr3)) { emendas.liquidado += v; add(emendas.funcoes, f, v); }
    if (c === PAGA) {
      despesa.paga += v;
      d.pago += v;
      if (String(i.poder_orgao) === PO_CAMARA) despesa.camaraPaga += v;
    }
  }
  receita.liquida = receita.bruta - receita.deducaoFundeb - receita.outrasDeducoes;
  receita.total = receita.liquida - receita.intra; // sem o que passou de um órgão da cidade para outro
  return arredondar({ receita, origem, tarifas, destino, despesa, emendas, minimos, fontesUsadas: [...fontes].sort(), cosUsados: [...cos].sort() });
}

// O que fica salvo em data/processado/origem.json: só as contas usadas, somadas pelos campos que as regras leem
// (sem subfunção e natureza da despesa). Assim, mudar uma regra refaz os anos fechados sem consultar de novo.
const CAMPOS = ['conta_contabil', 'fonte_recursos', 'complemento_fonte', 'natureza_receita', 'funcao', 'poder_orgao', 'natureza_conta'];
export function compactarMsc(itens) {
  const linhas = new Map();
  for (const i of itens) {
    const c = String(i.conta_contabil);
    if (!(c === CONTA_RECEITA || c.startsWith('6213') || EMPENHADA.has(c))) continue;
    const campos = CAMPOS.map((k) => (i[k] === null || i[k] === undefined ? '' : String(i[k])));
    const chave = campos.join('|');
    const atual = linhas.get(chave);
    if (atual) atual[CAMPOS.length] += Number(i.valor);
    else linhas.set(chave, [...campos, Number(i.valor)]);
  }
  return [...linhas.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, l]) => { l[CAMPOS.length] = centavos(l[CAMPOS.length]); return l; });
}
export const expandirMsc = (linhas) => (Array.isArray(linhas) ? linhas : []).filter((l) => Array.isArray(l) && l.length > CAMPOS.length).map((l) => ({ ...Object.fromEntries(CAMPOS.map((k, j) => [k, l[j]])), valor: l[CAMPOS.length] }));

// Primeiro mês da lista com linhas na MSC (o mês ainda não publicado vem vazio e cai para o anterior).
export async function primeiroComDados(meses, buscar) {
  for (const mes of meses) {
    const itens = await buscar(mes);
    if (itens && itens.length) return { mes, itens };
  }
  return null;
}

const diaSP = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
export const consultadoHoje = (consultadoEm, agoraIso) => Boolean(consultadoEm) && diaSP(consultadoEm) === diaSP(agoraIso);

// Ano a ano, fica a matriz mais completa: a de encerramento (MSCE) vence a mensal; depois, o mês mais novo; empate, a de `novo`.
const peso = (a) => (a ? (a.tipo === 'MSCE' ? 100 : 0) + Number(a.mes || 0) : -1);
export function mesclarOrigem(base, novo) {
  const anos = { ...((base && base.anos) || {}) };
  for (const [ano, a] of Object.entries((novo && novo.anos) || {})) {
    if (a && Array.isArray(a.linhas) && a.linhas.length && peso(a) >= peso(anos[ano])) anos[ano] = a;
  }
  return { anos };
}

// Conferência com o TCE-SP, no mesmo período (janeiro até o mês da MSC).
// receitasMeses: resumo do impostômetro por mês ({ grupos, fora }); despesasMensais: pago por mês ('AAAA-MM' -> R$).
export function totaisTce(receitasMeses, despesasMensais, ano, mes) {
  const chaves = Array.from({ length: mes }, (_, k) => `${ano}-${String(k + 1).padStart(2, '0')}`);
  const rm = receitasMeses || {};
  const dm = despesasMensais || {};
  const temReceita = chaves.every((k) => rm[k]);
  const temPago = chaves.every((k) => k in dm);
  const semIntra = temReceita ? chaves.reduce((s, k) => s + Object.values(rm[k].grupos || {}).reduce((a, v) => a + v, 0), 0) : null;
  const intra = temReceita ? chaves.reduce((s, k) => s + (rm[k].fora || 0), 0) : null;
  return {
    receitaSemIntra: semIntra === null ? null : centavos(semIntra),
    receitaIntra: intra === null ? null : centavos(intra),
    receita: semIntra === null ? null : centavos(semIntra + intra),
    pago: temPago ? centavos(chaves.reduce((s, k) => s + dm[k], 0)) : null,
  };
}

const comparar = (msc, tce) => (tce === null || tce === undefined || !(tce > 0)
  ? null
  : { msc, tce, diferenca: centavos(msc - tce), percentual: Math.abs(msc - tce) / tce });

export function conferir(resumo, tce) {
  const receita = comparar(resumo.receita.liquida, tce.receita);
  const pago = comparar(resumo.despesa.paga, tce.pago);
  const acimaDoLimite = [receita, pago].some((x) => x && x.percentual > LIMITE_CONFERENCIA);
  return { receita, pago, receitaSemIntraTce: tce.receitaSemIntra, receitaIntraTce: tce.receitaIntra, acimaDoLimite };
}

// Código de fonte (3 dígitos) ou de CO usado nos dados sem nome na tabela oficial.
export function codigosSemNome(resumo, ref) {
  const nomesFr = new Set(((ref && ref.fontes) || []).map((f) => String(f.codigo)));
  const nomesCo = new Set(((ref && ref.complementos) || []).map((c) => String(c.codigo)));
  return [
    ...(resumo.fontesUsadas || []).filter((c) => !nomesFr.has(c)).map((c) => `fonte ${c}`),
    ...(resumo.cosUsados || []).filter((c) => !nomesCo.has(c)).map((c) => `CO ${c}`),
  ];
}

export const nomeFuncao = (cod) => (String(cod) === '99' ? 'Reserva de contingência' : FUNCOES[Number(cod) - 1] || 'Sem função informada');

// Barras de área: as `n` maiores e "Outras áreas".
export function maioresAreas(funcoes, n = 6) {
  const lista = Object.entries(funcoes || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = lista.slice(0, n).map(([f, v]) => ({ area: nomeFuncao(f), valor: v }));
  const resto = lista.slice(n).reduce((s, [, v]) => s + v, 0);
  if (resto > 0) top.push({ area: 'Outras áreas', valor: centavos(resto) });
  return top;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const periodoOrigem = (a) => (a.tipo === 'MSCE' ? 'ano fechado' : `até ${MESES[a.mes - 1]}`);

// Estado salvo (data/processado/origem.json) + tabela de fontes + TCE -> dados da página origem.html.
// Nunca derruba o robô: ano com dado estragado fica de fora; erro inesperado vira linha de manutenção e a página não sai.
function montarAno(ano, s, nomesFr, ref, receitasMeses, despesasMensais, avisos, manutencao) {
  const r = resumirMsc(expandirMsc(s.linhas));
  const semNome = codigosSemNome(r, ref);
  if (semNome.length) manutencao.push(`Origem do dinheiro (${ano}): código sem nome em data/referencia/fontes-recursos.json (${semNome.join(', ')}); conferir a planilha do Tesouro.`);
  const origemLista = Object.keys(GRUPOS_ORIGEM)
    .map((g) => ({ grupo: g, rotulo: GRUPOS_ORIGEM[g], valor: r.origem[g] || 0 }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const minimoDe = { educacao: r.minimos['1001'], saude: r.minimos['1002'] };
  const destino = Object.keys(GRUPOS_DESTINO)
    .filter((g) => r.destino[g] && (r.destino[g].entrou > 0 || r.destino[g].liquidado > 0))
    .map((g) => {
      const x = r.destino[g];
      const principais = Object.entries(x.fontes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([codigo, valor]) => ({ codigo, nome: nomesFr[codigo] || `Fonte ${codigo}`, valor }));
      return { grupo: g, rotulo: GRUPOS_DESTINO[g], entrou: x.entrou, liquidado: x.liquidado, pago: x.pago, areas: maioresAreas(x.funcoes), principais, minimo: minimoDe[g] || null };
    })
    .sort((a, b) => b.liquidado - a.liquidado || b.entrou - a.entrou);
  // Livre + carimbado = total arrecadado (sem intra), mesmo que um grupo fique negativo depois das deduções.
  const livre = (r.destino.livre && r.destino.livre.entrou) || 0;
  const carimbado = r.receita.total - livre;
  const emendasReceita = Object.keys(TIPOS_EMENDA)
    .filter((t) => r.emendas.receita[t] > 0)
    .map((t) => ({ tipo: t, rotulo: TIPOS_EMENDA[t], valor: r.emendas.receita[t] }));
  const tce = totaisTce(receitasMeses, despesasMensais, ano, s.mes);
  const conferencia = conferir(r, tce);
  if (conferencia.acimaDoLimite) {
    const partes = [['arrecadado', conferencia.receita], ['pago', conferencia.pago]].filter(([, x]) => x && x.percentual > LIMITE_CONFERENCIA)
      .map(([nome, x]) => `${nome} ${(x.percentual * 100).toFixed(1).replace('.', ',')}%`);
    avisos.push(`Origem do dinheiro (${ano}): os números do Tesouro Nacional e do TCE-SP diferem mais de 3% (${partes.join('; ')}). Os dois aparecem na página, sem ajuste.`);
    manutencao.push(`Origem do dinheiro (${ano}): MSC × TCE-SP acima de 3% (${partes.join('; ')}); conferir a MSC (${s.tipo}, mês ${s.mes}).`);
  }
  return {
    tipo: s.tipo,
    mes: s.mes,
    url: s.url,
    consultadoEm: s.consultadoEm,
    receita: r.receita,
    origem: origemLista,
    tarifas: r.tarifas,
    livre: centavos(livre),
    carimbado: centavos(carimbado),
    destino,
    despesa: r.despesa,
    emendas: { receita: emendasReceita, total: centavos(emendasReceita.reduce((sm, x) => sm + x.valor, 0)), liquidado: r.emendas.liquidado, areas: maioresAreas(r.emendas.funcoes) },
    conferencia,
  };
}

const anoValido = (ano, s) => /^\d{4}$/.test(ano) && s && typeof s === 'object' && (s.tipo === 'MSCE' || s.tipo === 'MSCC')
  && Number.isInteger(s.mes) && s.mes >= 1 && s.mes <= 12 && Array.isArray(s.linhas) && s.linhas.length > 0;

export function montarOrigem({ origem, ref, receitasMeses, despesasMensais }) {
  const avisos = [];
  const manutencao = [];
  try {
    const anosSalvos = (origem && origem.anos && typeof origem.anos === 'object') ? origem.anos : {};
    const nomesFr = Object.fromEntries(((ref && Array.isArray(ref.fontes)) ? ref.fontes : []).map((f) => [String(f.codigo), f.nome]));
    const anos = {};
    for (const ano of Object.keys(anosSalvos).sort()) {
      const s = anosSalvos[ano];
      if (!anoValido(ano, s)) { manutencao.push(`Origem do dinheiro (${ano}): registro inválido em data/processado/origem.json; o ano ficou de fora da página.`); continue; }
      try {
        anos[ano] = montarAno(ano, s, nomesFr, ref, receitasMeses, despesasMensais, avisos, manutencao);
      } catch (e) {
        manutencao.push(`Origem do dinheiro (${ano}): erro ao montar o ano (${String(e && e.message).split('\n')[0]}); o ano ficou de fora da página.`);
      }
    }
    const urls = (ref && ref.urls) || {};
    const dados = Object.keys(anos).length ? { anos, planilha: urls.tabela2026 || null, paginaFontes: urls.pagina || null } : null;
    return { dados, avisos, manutencao };
  } catch (e) {
    return { dados: null, avisos: [], manutencao: [...manutencao, `Origem do dinheiro: erro ao montar a página (${String(e && e.message).split('\n')[0]}); a página não foi gerada desta vez.`] };
  }
}
