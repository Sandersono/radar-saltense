import { chaveBairro } from './bairros.js';

// Nome oficial dos bairros (cadastro da Prefeitura). Funções puras: o gerador lê os arquivos e chama.
// Fonte: data/referencia/bairros-oficiais.json (PGV, Lei 3.227/2013, e atos de loteamento posteriores).
// Conferência: data/referencia/bairros-apelidos.json, seções "oficial" (chave -> nomes oficiais; [] = não consta)
// e "oficial_ligados" (chave -> nomes oficiais ligados, quando o cadastro divide ou junta a área de outro jeito).

export const ROTULO_PGV = 'Planta Genérica de Valores, Lei 3.227/2013';
export const TEXTO_SEM_OFICIAL = 'Não consta no cadastro oficial de bairros e loteamentos (Lei 3.227/2013, atualizada até 2017, e decretos e leis de loteamento de 2015 a 2021).';

// Comparação de grafia: sem acento, sem caixa, "Jd."/"Vl." expandidos, pontuação vira espaço.
export const chaveOficial = (s) => chaveBairro(s).replace(/[^a-z0-9]+/g, ' ').trim();

// Índice nome oficial -> { nome, rotulo, url }. Arquivo inválido: índice vazio e erros (nunca lança).
export function indiceOficial(ref) {
  const erros = [];
  const indice = new Map();
  if (!ref || typeof ref !== 'object' || !Array.isArray(ref.bairros) || !ref.url) {
    return { indice, erros: ['arquivo sem "url" ou sem a lista "bairros".'] };
  }
  const por = (nome, entrada) => {
    if (typeof nome !== 'string' || !nome.trim()) { erros.push('item sem nome.'); return; }
    if (indice.has(nome)) { erros.push(`"${nome}" aparece duas vezes.`); return; }
    indice.set(nome, entrada);
  };
  for (const b of ref.bairros) por(b && b.nome, { nome: b && b.nome, rotulo: ROTULO_PGV, url: ref.url });
  const atos = (ref.loteamentos_posteriores && ref.loteamentos_posteriores.itens) || [];
  for (const l of atos) {
    if (!l || !l.ato || !/^https:\/\//.test(l.url || '')) { erros.push(`"${l && l.nome}": ato sem nome ou sem link.`); continue; }
    por(l.nome, { nome: l.nome, rotulo: l.ato, url: l.url });
  }
  return { indice, erros };
}

// Situação de um bairro com página frente ao cadastro:
//   igual    — o nome da página é o nome oficial;
//   grafia   — corresponde a um nome oficial escrito de outro jeito;
//   ligados  — nomes oficiais ligados à área (o cadastro divide de outro jeito);
//   sem      — conferido: o nome não consta no cadastro;
//   pendente — ainda não conferido (bairro novo): a página não mostra nada e a manutenção avisa.
// Nome oficial citado na conferência e ausente do índice é ignorado (vai para os erros).
export function situacaoOficial(bairro, conferencia, indice) {
  const { oficial = {}, oficial_ligados: ligados = {} } = conferencia || {};
  const resolver = (nomes) => {
    const achados = [];
    const faltam = [];
    for (const n of nomes) (indice.has(n) ? achados : faltam).push(indice.has(n) ? indice.get(n) : n);
    return { achados, faltam };
  };
  if (Array.isArray(ligados[bairro.chave]) && ligados[bairro.chave].length) {
    const { achados, faltam } = resolver(ligados[bairro.chave]);
    return { tipo: achados.length ? 'ligados' : 'pendente', oficiais: achados, faltam };
  }
  if (!Array.isArray(oficial[bairro.chave])) return { tipo: 'pendente', oficiais: [], faltam: [] };
  if (!oficial[bairro.chave].length) return { tipo: 'sem', oficiais: [], faltam: [] };
  const { achados, faltam } = resolver(oficial[bairro.chave]);
  if (!achados.length) return { tipo: 'pendente', oficiais: [], faltam };
  const igual = achados.length === 1 && chaveOficial(achados[0].nome) === chaveOficial(bairro.nome);
  return { tipo: igual ? 'igual' : 'grafia', oficiais: achados, faltam };
}

// Situação de todos os bairros com página, mais as páginas que dividem o mesmo nome oficial (linkam entre si).
export function situacoesOficiais(bairros, conferencia, indice) {
  const mapa = new Map(bairros.map((b) => [b.chave, situacaoOficial(b, conferencia, indice)]));
  for (const b of bairros) {
    const s = mapa.get(b.chave);
    const meus = new Set(s.oficiais.map((o) => o.nome));
    s.mesmoOficial = bairros.filter((o) => o.chave !== b.chave && mapa.get(o.chave).oficiais.some((x) => meus.has(x.nome)));
  }
  return mapa;
}

// Avisos de manutenção: bairro com página ainda não conferido, ou conferência com nome oficial que não existe.
export function avisosOficiais(bairros, situacoes) {
  const avisos = [];
  for (const b of bairros) {
    const s = situacoes.get(b.chave);
    if (!s) continue;
    if (s.faltam.length) avisos.push(`Bairro "${b.nome}": nome oficial não encontrado em data/referencia/bairros-oficiais.json: ${s.faltam.join(', ')}.`);
    if (s.tipo === 'pendente') avisos.push(`Bairro com página sem conferência no cadastro oficial: "${b.chave}" (${b.nome}). Procurar em data/referencia/bairros-oficiais.json e registrar em data/referencia/bairros-apelidos.json (oficial; [] se não consta).`);
  }
  return avisos;
}

// Agrupa os nomes oficiais pela fonte, na ordem em que aparecem: [{ rotulo, url, nomes: [...] }].
export function porFonte(oficiais) {
  const grupos = [];
  for (const o of oficiais) {
    let g = grupos.find((x) => x.url === o.url && x.rotulo === o.rotulo);
    if (!g) grupos.push(g = { rotulo: o.rotulo, url: o.url, nomes: [] });
    g.nomes.push(o.nome);
  }
  return grupos;
}

// "A", "A e B", "A, B e C".
export const juntarNomes = (lista) => (lista.length <= 1 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`);
