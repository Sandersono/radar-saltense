import { normalizar, limparNomeEmpresa } from '../util/texto.js';
import { valorBR } from './receitas.js';

export const ORGAOS = { prefeitura: 'Prefeitura', camara: 'Câmara', saae: 'SAAE (água e esgoto)' };
export const GRUPOS_GASTO = { empresas: 'Empresas e entidades', publicos: 'Órgãos públicos, impostos e folha', pessoas: 'Pessoas físicas' };

// Spec 3.2: quem recebe e é órgão público, imposto, previdência, banco da folha etc.
export const LISTA_PUBLICOS = [
  'MUNICIPIO', 'PREFEITURA', 'CAMARA MUNICIPAL', 'SERVICO AUTONOMO', 'FUNDO', 'FUNDEB',
  'INSTITUTO NACIONAL DO SEGURO SOCIAL', 'PREVIDENCIA', 'RECEITA FEDERAL', 'SECRETARIA', 'MINISTERIO',
  'TRIBUNAL', 'CAIXA ECONOMICA FEDERAL', 'BANCO DO BRASIL', 'BANCO SANTANDER', 'BANCO BRADESCO',
  'ITAU UNIBANCO', 'DESENVOLVE SP', 'PRODESP', 'CETESB', 'COMPANHIA DE PROCESSAMENTO DE DADOS',
];

// Nome com estes termos é sempre empresa ou entidade, mesmo com um termo da lista acima
// (ex.: 'ASSOCIACAO FUNDO DE INCENTIVO A PESQUISA', 'MONGERAL AEGON SEGUROS E PREVIDENCIA S/A').
export const LISTA_NAO_PUBLICOS = ['ASSOCIACAO', 'SEGUROS', 'LTDA', 'EIRELI'];

// Funções de governo (Portaria 42/1999), como aparecem no RREO Anexo 02.
export const FUNCOES = [
  'Legislativa', 'Judiciária', 'Essencial à Justiça', 'Administração', 'Defesa Nacional', 'Segurança Pública',
  'Relações Exteriores', 'Assistência Social', 'Previdência Social', 'Saúde', 'Trabalho', 'Educação', 'Cultura',
  'Direitos da Cidadania', 'Urbanismo', 'Habitação', 'Saneamento', 'Gestão Ambiental', 'Ciência e Tecnologia',
  'Agricultura', 'Organização Agrária', 'Indústria', 'Comércio e Serviços', 'Comunicações', 'Energia',
  'Transporte', 'Desporto e Lazer', 'Encargos Especiais',
];

export const NOVA_LIMITE = 1000000;

const maiusculo = (s) => normalizar(s).toUpperCase();
const centavos = (v) => Math.round(v * 100) / 100;
const RE_PUBLICOS = new RegExp(`\\b(${LISTA_PUBLICOS.join('|')})\\b`);
const RE_NAO_PUBLICOS = new RegExp(`\\b(${LISTA_NAO_PUBLICOS.join('|')})\\b`);

export function grupoFornecedor(linha) {
  if (/^PESSOA FISICA/.test(maiusculo(linha.id_fornecedor))) return 'pessoas';
  const nome = maiusculo(linha.nm_fornecedor);
  if (RE_PUBLICOS.test(nome) && !RE_NAO_PUBLICOS.test(nome)) return 'publicos';
  return 'empresas';
}

export const cnpjDe = (id) => (String(id ?? '').match(/CNPJ\D*(\d{14})\s*$/) || [])[1] || null;
export const formatarCnpj = (c) => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export function orgaoChave(orgao) {
  const o = maiusculo(orgao);
  if (/CAMARA/.test(o)) return 'camara';
  if (/SAAE|AGUA E ESGOTO/.test(o)) return 'saae';
  return 'prefeitura';
}

const soma = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

// porMes: { 'AAAA-MM': linhas da API }; cnpjs2024: CNPJs que receberam em 2024 (base das "novas").
export function resumirDespesas(porMes, cnpjs2024 = []) {
  const base2024 = new Set(cnpjs2024);
  const nomes = new Map();
  const acc = {};
  const empresas = new Map(); // cnpj -> { cnpj, nome, grupo, porMes, porOrgao }
  const mensal = {};
  for (const chave of Object.keys(porMes).sort()) {
    for (const l of porMes[chave]) {
      const cnpj = cnpjDe(l.id_fornecedor);
      const nome = limparNomeEmpresa(l.nm_fornecedor);
      if (cnpj && nome) nomes.set(cnpj, nome);
    }
  }
  for (const chave of Object.keys(porMes).sort()) {
    const ano = chave.slice(0, 4);
    const a = acc[ano] ??= {
      meses: new Set(), total: 0, anulado: 0,
      porOrgao: { prefeitura: 0, camara: 0, saae: 0 },
      porGrupo: { empresas: 0, publicos: 0, pessoas: 0 },
      pessoas: new Set(), pagoEmp: new Map(), anuladoEmp: new Map(),
    };
    mensal[chave] = 0;
    for (const l of porMes[chave]) {
      const v = valorBR(l.vl_despesa);
      const cnpj = cnpjDe(l.id_fornecedor);
      const grupo = cnpj
        ? grupoFornecedor({ id_fornecedor: l.id_fornecedor, nm_fornecedor: nomes.get(cnpj) })
        : grupoFornecedor(l);
      if (l.evento === 'Anulação') {
        a.anulado += v;
        if (grupo === 'empresas' && cnpj) soma(a.anuladoEmp, cnpj, v);
        continue;
      }
      if (l.evento !== 'Valor Pago') continue;
      const orgao = orgaoChave(l.orgao);
      a.meses.add(chave);
      a.total += v;
      mensal[chave] += v;
      a.porOrgao[orgao] += v;
      a.porGrupo[grupo] += v;
      if (grupo === 'pessoas') { a.pessoas.add(String(l.id_fornecedor)); continue; }
      if (!cnpj) continue;
      if (grupo === 'empresas') soma(a.pagoEmp, cnpj, v);
      const e = empresas.get(cnpj) ?? { cnpj, nome: '', grupo, porMes: {}, porOrgao: {} };
      e.porMes[chave] = (e.porMes[chave] || 0) + v;
      e.porOrgao[orgao] = (e.porOrgao[orgao] || 0) + v;
      empresas.set(cnpj, e);
    }
  }
  const ranking = (mapa, n) => [...mapa].sort((x, y) => y[1] - x[1]).slice(0, n)
    .map(([cnpj, total]) => ({ cnpj, nome: nomes.get(cnpj) || '', total: centavos(total) }));
  const arred = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, centavos(v)]));
  const anos = {};
  for (const [ano, a] of Object.entries(acc)) {
    const valores = [...a.pagoEmp.values()].sort((x, y) => y - x);
    const totalEmp = a.porGrupo.empresas;
    const top10 = valores.slice(0, 10).reduce((s, v) => s + v, 0);
    const meses = [...a.meses].sort();
    anos[ano] = {
      ultimoMes: meses.at(-1) || null,
      mesesPublicados: meses.length,
      total: centavos(a.total),
      porOrgao: arred(a.porOrgao),
      porGrupo: arred(a.porGrupo),
      pessoasFisicas: { total: centavos(a.porGrupo.pessoas), quantidade: a.pessoas.size },
      topEmpresas: ranking(a.pagoEmp, 20),
      concentracao: { top10: centavos(top10), totalEmpresas: centavos(totalEmp), percentual: totalEmp > 0 ? Math.round((top10 / totalEmp) * 100) : 0 },
      anulado: { total: centavos(a.anulado), top: ranking(a.anuladoEmp, 5) },
    };
  }
  const totalDe = (e) => Object.values(e.porMes).reduce((s, v) => s + v, 0);
  const lista = [...empresas.values()].map((e) => ({ ...e, nome: nomes.get(e.cnpj) || '', total: totalDe(e) }))
    .filter((e) => e.total > 0).sort((x, y) => y.total - x.total);
  const novas = lista
    .filter((e) => e.grupo === 'empresas' && !base2024.has(e.cnpj) && e.total > NOVA_LIMITE)
    .map((e) => ({ cnpj: e.cnpj, nome: e.nome, total: centavos(e.total), primeiroMes: Object.keys(e.porMes).sort()[0] }));
  return {
    anos,
    novas,
    empresas: lista.map((e) => ({ cnpj: e.cnpj, nome: e.nome, porMes: arred(e.porMes), porOrgao: arred(e.porOrgao) })),
    mensal: arred(mensal),
  };
}

const COLUNA_SICONFI = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
const ROTULO_SICONFI = 'Total das Despesas Exceto Intra-Orçamentárias';

// Itens do RREO Anexo 02 -> total, soma das funções (para a barreira) e áreas com valor.
export function areasSiconfi(itens) {
  const linhas = itens.filter((i) => i.coluna === COLUNA_SICONFI && i.rotulo === ROTULO_SICONFI);
  const totalLinha = linhas.find((i) => /^DESPESAS \(EXCETO INTRA/.test(i.conta));
  const funcoes = linhas.filter((i) => FUNCOES.includes(i.conta));
  return {
    total: totalLinha ? centavos(Number(totalLinha.valor)) : null,
    somaAreas: centavos(funcoes.reduce((s, i) => s + Number(i.valor), 0)),
    lista: funcoes.filter((i) => Number(i.valor) > 0)
      .map((i) => ({ area: i.conta, valor: centavos(Number(i.valor)) }))
      .sort((x, y) => y.valor - x.valor),
  };
}
