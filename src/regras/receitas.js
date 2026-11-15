export const GRUPOS_RECEITA = {
  impostos: 'Impostos da cidade',
  estado: 'Repasses do Estado',
  uniao: 'Repasses da União',
  fundeb: 'FUNDEB (educação)',
  saae: 'Água e esgoto (SAAE)',
  emprestimos: 'Empréstimos',
  outras: 'Outras receitas',
};

export const TIPOS_IMPOSTO = {
  iptu: 'IPTU',
  iss: 'ISS',
  ir: 'Imposto de Renda retido',
  itbi: 'ITBI',
  taxas: 'Taxas',
  outros: 'Outros impostos',
};

export function valorBR(s) {
  const t = String(s ?? '').trim();
  if (!/^-?[\d.]*\d(,\d+)?$/.test(t)) throw new Error(`Valor de receita inválido: "${s}"`);
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

const codigo = (linha) => (String(linha.ds_alinea ?? '').match(/^\s*(\d{8})/) || [])[1] || '';

// Tabela 3.1 da spec. A ordem importa.
export function grupoReceita(linha) {
  const c = codigo(linha);
  if (/^[78]/.test(c)) return 'fora'; // intraorçamentária: contaria o mesmo dinheiro duas vezes
  if (/SAAE/i.test(String(linha.orgao ?? ''))) return 'saae';
  if (/^11[12]/.test(c)) return 'impostos';
  if (/^(172|242)/.test(c)) return 'estado';
  if (/^(171|241)/.test(c)) return 'uniao';
  if (/^175/.test(c)) return 'fundeb';
  if (/^21/.test(c)) return 'emprestimos';
  return 'outras';
}

// Tabela 3.2 da spec (só faz sentido dentro do grupo "impostos").
export function tipoImposto(linha) {
  const c = codigo(linha);
  const d = String(linha.ds_alinea ?? '');
  if (c.startsWith('1112') && /Predial e Territorial/i.test(d)) return 'iptu';
  if (c.startsWith('1112') && /Transmiss/i.test(d)) return 'itbi';
  if (c.startsWith('1113')) return 'ir';
  if (c.startsWith('1114')) return 'iss';
  if (c.startsWith('112')) return 'taxas';
  return 'outros';
}

const somarEm = (alvo, chave, v) => { alvo[chave] = (alvo[chave] || 0) + v; };

export function resumirReceitas(linhasPorMes) {
  const meses = {};
  for (const mes of Object.keys(linhasPorMes).sort()) {
    const linhas = linhasPorMes[mes];
    if (!linhas || !linhas.length) continue; // mês sem linhas = ainda não publicado
    const m = { grupos: {}, tipos: {}, impostos: 0, fora: 0 };
    for (const l of linhas) {
      const v = valorBR(l.vl_arrecadacao);
      const g = grupoReceita(l);
      if (g === 'fora') { m.fora += v; continue; }
      somarEm(m.grupos, g, v);
      if (g === 'impostos') {
        somarEm(m.tipos, tipoImposto(l), v);
        m.impostos += v;
      }
    }
    meses[mes] = m;
  }
  return { meses };
}

const doisDigitos = (n) => String(n).padStart(2, '0');
const diasNoMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};
const instanteBR = (dia) => Date.parse(`${dia}T00:00:00-03:00`);
const somarObjetos = (lista) => {
  const acc = {};
  for (const o of lista) for (const [k, v] of Object.entries(o)) somarEm(acc, k, v);
  return acc;
};

export function montarImpostometro(resumo, anoAtual) {
  const publicados = Object.keys(resumo.meses).sort();
  const ultimo = publicados.length ? publicados[publicados.length - 1] : null;
  const ultimos12 = publicados.slice(-12);
  const dias = ultimos12.reduce((s, m) => s + diasNoMes(m), 0);
  const ritmoDiario = dias ? ultimos12.reduce((s, m) => s + resumo.meses[m].impostos, 0) / dias : 0;
  const doAno = (ano) => publicados.filter((m) => m.startsWith(`${ano}-`));
  const atuais = doAno(anoAtual);
  const anteriores = doAno(anoAtual - 1);
  const temOficialAno = atuais.length > 0;
  const anoPainel = temOficialAno ? anoAtual : anoAtual - 1;
  const doPainel = temOficialAno ? atuais : anteriores;

  let fimOficial = null;
  let inicioEstimativa = `${anoAtual}-01-01`;
  if (ultimo) {
    const [a, m] = ultimo.split('-').map(Number);
    fimOficial = `${ultimo}-${doisDigitos(diasNoMes(ultimo))}`;
    if (a === anoAtual) inicioEstimativa = m === 12 ? `${anoAtual + 1}-01-01` : `${a}-${doisDigitos(m + 1)}-01`;
  }
  const serie = (ano) => Array.from({ length: 12 }, (_, i) => {
    const k = `${ano}-${doisDigitos(i + 1)}`;
    return resumo.meses[k] ? resumo.meses[k].impostos : null;
  });

  return {
    anoAtual,
    ultimoMesOficial: ultimo,
    fimOficial,
    oficialAno: atuais.reduce((s, m) => s + resumo.meses[m].impostos, 0),
    ritmoDiario,
    mesesRitmo: ultimos12.length,
    temOficialAno,
    anoPainel,
    tiposPainel: somarObjetos(doPainel.map((m) => resumo.meses[m].tipos)),
    gruposPainel: somarObjetos(doPainel.map((m) => resumo.meses[m].grupos)),
    foraPainel: doPainel.reduce((s, m) => s + resumo.meses[m].fora, 0),
    inicioEstimativa,
    gruposAno: somarObjetos(atuais.map((m) => resumo.meses[m].grupos)),
    tiposAno: somarObjetos(atuais.map((m) => resumo.meses[m].tipos)),
    foraAno: atuais.reduce((s, m) => s + resumo.meses[m].fora, 0),
    serie: { [anoAtual - 1]: serie(anoAtual - 1), [anoAtual]: serie(anoAtual) },
    anoAnterior: {
      ano: anoAtual - 1,
      mesesPublicados: anteriores.length,
      total: anteriores.reduce((s, m) => s + resumo.meses[m].impostos, 0),
      fechado: anteriores.length === 12,
    },
  };
}

// Oficial do ano + ritmo diário × dias desde o início da estimativa; para em 31/12 do ano do contador.
export function valorContador(imp, instanteMs) {
  const inicio = instanteBR(imp.inicioEstimativa);
  const fimAno = instanteBR(`${imp.anoAtual + 1}-01-01`);
  const dias = Math.max(0, (Math.min(instanteMs, fimAno) - inicio) / 86400000);
  return imp.oficialAno + imp.ritmoDiario * dias;
}
