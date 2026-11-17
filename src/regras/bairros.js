import { normalizar, slug } from '../util/texto.js';
import { tiposPedido } from './local.js';

// Páginas por bairro (spec 2026-11-17). Funções puras: o gerador do site chama com os dados prontos.

// Bairro com menos propostas que isto fica só na busca da página inicial.
export const CORTE_BAIRRO = 10;

// Nomes que aparecem em descrição de obra sem ser o bairro ("centro cirúrgico", "estação elevatória").
// Além desta lista, nome de uma palavra só com até 6 letras também não casa (ex.: "Rondon", "CECAP").
export const GENERICOS_OBRA = ['centro', 'vila nova', 'estacao'];

// " - Salto/SP", " - Salto", " (Salto/SP)", ", Salto - SP" no fim do nome.
const SUFIXO_CIDADE = /\s*(?:[-–—,/(]\s*salto(?:\s*[-/]\s*sp)?|\s+salto\s*[-/]\s*sp)\s*\)?\s*$/;

// Chave de comparação: sem sufixo de cidade, minúsculas e sem acento, "jd." = "jardim", "vl." = "vila".
export function chaveBairro(nome) {
  return normalizar(nome)
    .replace(SUFIXO_CIDADE, '')
    .replace(/\bjd\b\.?\s*/g, 'jardim ')
    .replace(/\bvl\b\.?\s*/g, 'vila ')
    .replace(/[\s.,;:–—-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Agrupa os bairros citados nas propostas. apelidos: { "chave da variação": "Nome visto nos dados" };
// nomes: { "chave do grupo": "Nome da página" }, fixa o nome (e o endereço) mesmo se a grafia mais comum mudar,
// e corrige nome cortado pela leitura ("São Pedro" de "São Pedro e São Paulo").
// Cada proposta conta uma vez por bairro. Devolve do bairro mais citado para o menos citado.
export function montarBairros(proposituras, apelidos = {}, nomes = {}) {
  const destinos = new Map(Object.values(apelidos).map((n) => [chaveBairro(n), n]));
  const grupos = new Map();
  proposituras.forEach((p, i) => {
    for (const l of p.locais || []) {
      if (l.tipo !== 'bairro') continue;
      const propria = chaveBairro(l.nome);
      if (!propria) continue;
      const chave = apelidos[propria] ? chaveBairro(apelidos[propria]) : propria;
      if (!grupos.has(chave)) grupos.set(chave, { chave, idx: new Set(), grafias: new Map() });
      const g = grupos.get(chave);
      g.idx.add(i);
      g.grafias.set(l.nome, (g.grafias.get(l.nome) || 0) + 1);
    }
  });
  const lista = [...grupos.values()].map((g) => {
    const grafias = [...g.grafias].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).map(([n]) => n);
    return { nome: nomes[g.chave] || destinos.get(g.chave) || grafias[0], fixo: g.chave in nomes, chave: g.chave, idx: [...g.idx].sort((a, b) => a - b), total: g.idx.size, grafias };
  });
  lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  return atribuirSlugs(lista);
}

// Slug estável a partir do nome; se dois nomes dão o mesmo slug, o segundo (em ordem de chave) ganha "-2".
export function atribuirSlugs(lista) {
  const usados = new Set();
  for (const b of [...lista].sort((a, c) => a.chave.localeCompare(c.chave))) {
    const base = slug(b.nome) || 'bairro';
    let s = base;
    for (let n = 2; usados.has(s); n++) s = `${base}-${n}`;
    usados.add(s);
    b.slug = s;
  }
  return lista;
}

export const bairrosComPagina = (lista, corte = CORTE_BAIRRO) => lista.filter((b) => b.total >= corte);

// Problemas na lista de apelidos: chave fora do padrão, destino que nunca aparece nos dados, destino que é apelido de outro.
export function validarApelidos(apelidos, nomesVistos) {
  const vistos = new Set(nomesVistos.map(chaveBairro));
  const erros = [];
  for (const [chave, destino] of Object.entries(apelidos)) {
    if (chave !== chaveBairro(chave)) erros.push(`"${chave}": a chave precisa estar normalizada ("${chaveBairro(chave)}").`);
    if (!vistos.has(chaveBairro(destino))) erros.push(`"${chave}": o destino "${destino}" não aparece nos dados.`);
    if (chaveBairro(destino) in apelidos) erros.push(`"${chave}": o destino "${destino}" é ele mesmo um apelido.`);
    if (chaveBairro(destino) === chave) erros.push(`"${chave}": aponta para si mesmo.`);
  }
  return erros;
}

// Problemas na lista de nomes fixos: chave que não é bairro nenhum, ou dois bairros com o mesmo nome.
export function validarNomes(nomes, lista) {
  const chaves = new Set(lista.map((b) => b.chave));
  const erros = Object.keys(nomes).filter((k) => !chaves.has(k)).map((k) => `"${k}": não é chave de nenhum bairro dos dados.`);
  const vistos = new Map();
  for (const [k, n] of Object.entries(nomes)) {
    const s = slug(n);
    if (vistos.has(s)) erros.push(`"${k}" e "${vistos.get(s)}": mesmo nome de página.`);
    vistos.set(s, k);
  }
  return erros;
}

// Nome serve para procurar o bairro nas obras? Genéricos e nomes curtos de uma palavra, não.
export function nomeBomParaObra(nome) {
  const k = normalizar(nome);
  if (!k || GENERICOS_OBRA.includes(k)) return false;
  const palavras = k.split(' ');
  return !(palavras.length === 1 && palavras[0].length <= 6);
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const palavraInteira = (k) => `(?<![a-z0-9])${escRe(k)}(?![a-z0-9])`;

// O texto da obra cita o bairro? Nome inteiro, com fronteira de palavra; "Jardim X" não casa em "Jardim X II".
// maiores: nomes de OUTROS bairros que contêm este ("Residencial Barnabé" para "Barnabé"); esses trechos não contam.
export function obraCitaBairro(texto, nome, maiores = []) {
  if (!nomeBomParaObra(nome)) return false;
  let t = normalizar(texto);
  for (const m of maiores) t = t.replace(new RegExp(palavraInteira(normalizar(m)), 'g'), ' ');
  return new RegExp(`${palavraInteira(normalizar(nome))}(?!\\s+(?:i{1,3}|iv|vi{0,3}|ix|x|\\d+)(?![a-z0-9]))`).test(t);
}

// Grafias dos outros bairros que contêm `nome` como palavras inteiras (ex.: "Residencial Barnabé" para "Barnabé").
// Aceita o bairro inteiro (usa o nome dele) ou um nome solto.
export function nomesMaiores(bairro, todos, nome = bairro.nome) {
  const k = normalizar(nome);
  const re = new RegExp(palavraInteira(k));
  return [...new Set(todos.filter((o) => o.chave !== bairro.chave).flatMap((o) => [o.nome, ...(o.grafias || [])]).map(normalizar))]
    .filter((n) => n !== k && re.test(n));
}

// Nomes usados para achar o bairro nas obras: o da página e as outras grafias que já começam por
// Jardim, Vila, Parque etc. Grafia solta ("Santa Cruz", "São Pedro") fica de fora: é também nome de rua e de outros lugares.
const PREFIXO_LUGAR = /^(?:jardim|vila|parque|residencial|loteamento|condominio|chacaras?|bairro)\s/;
export const nomesParaObra = (bairro) =>
  [...new Set([bairro.nome, ...(bairro.grafias || []).filter((g) => PREFIXO_LUGAR.test(chaveBairro(g)))])].filter(nomeBomParaObra);

const TIPO_RUA = /^(?:rua|avenida|av\.?|travessa|estrada|alameda|praça|praca|rodovia|viela)$/i;
const CONECTOR = /^(?:e|ao|à|a|o|os|as|do|da|dos|das|de|no|na|nos|nas|para|pelo|pela|entre|em|com)$/;

// Rua lida do texto às vezes vem com sobra ("Rua Japão e o", "Rua Botucatu com a Rua Campinas", "Rua Japão que interliga o"):
// fica só a primeira rua. Letra ou número final que faz parte do nome ("Rua 5 A", "Praça XV") fica.
// Sobrou só o tipo ("Praça do", "Avenida entre o", "Rua que liga os Bairros")? Devolve ''.
export function limparRua(nome) {
  const cortado = String(nome ?? '')
    .replace(/\s+(?:com|e|esquina)\s+(?:(?:a|o|com)\s+)*(?:rua|avenida|av\.?|travessa|estrada|alameda)\b.*$/i, '')
    .replace(/\s+(?:que|para|sentido|e\s+(?:as|os|a|o|demais)|na\s+região)(?=\s|$).*$/, '')
    .trim();
  const partes = cortado.split(/\s+/);
  while (partes.length > 1 && CONECTOR.test(partes[partes.length - 1])) {
    const ultima = partes[partes.length - 1];
    if (ultima.length === 1 && /\d/.test(partes[partes.length - 2])) break; // "Rua 5 a"
    partes.pop();
  }
  return partes.length <= 1 && TIPO_RUA.test(partes[0] || '') ? '' : partes.join(' ');
}

// Contagem por chave, do maior para o menor (empate: ordem alfabética do rótulo).
const ranking = (mapa, n) => [...mapa.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR')).slice(0, n);

// Tudo o que a página de um bairro mostra, a partir das propostas dele. Sem HTML.
// todos: a lista completa de montarBairros (para não confundir "Barnabé" com "Residencial Barnabé" nas obras).
export function resumoBairro(bairro, d, todos = []) {
  const procura = nomesParaObra(bairro).map((nome) => [nome, nomesMaiores(bairro, todos, nome)]);
  const props = bairro.idx.map((i) => d.proposituras[i]);
  const porGrupo = {};
  const vereadores = new Map();
  const tipos = new Map();
  const ruas = new Map();
  for (const p of props) {
    porGrupo[p.grupo] = (porGrupo[p.grupo] || 0) + 1;
    for (const id of new Set(p.vereadores || [])) {
      if (!vereadores.has(id)) vereadores.set(id, { id, rotulo: id, n: 0 });
      vereadores.get(id).n++;
    }
    for (const t of p.tipos || tiposPedido(p.ementa)) {
      if (!tipos.has(t)) tipos.set(t, { tipo: t, rotulo: t, n: 0 });
      tipos.get(t).n++;
    }
    const vistas = new Set();
    for (const l of p.locais || []) {
      if (l.tipo !== 'rua') continue;
      const nome = limparRua(l.nome);
      const k = normalizar(nome);
      if (!k || vistas.has(k)) continue;
      vistas.add(k);
      if (!ruas.has(k)) ruas.set(k, { chave: k, rotulo: nome, n: 0, grafias: new Map() });
      const r = ruas.get(k);
      r.n++;
      r.grafias.set(nome, (r.grafias.get(nome) || 0) + 1);
    }
  }
  for (const r of ruas.values()) r.rotulo = [...r.grafias].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0];
  // Repetido só de rua que aparece junto com o bairro em 2 propostas ou mais (1 vez pode ser só uma lista de lugares).
  const ruasDoBairro = new Set([...ruas.values()].filter((r) => r.n >= 2).map((r) => r.chave));
  return {
    total: props.length,
    porGrupo,
    vereadores: ranking(vereadores, 5),
    tipos: ranking(tipos, 8),
    ruas: ranking(ruas, 10).map(({ rotulo, n }) => ({ nome: rotulo, n })),
    repetidos: (d.repetidos || []).filter((r) => ruasDoBairro.has(normalizar(limparRua(r.rua)))),
    recentes: [...props].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.id).localeCompare(String(a.id))).slice(0, 15),
    obras: ((d.obras && d.obras.lista) || []).filter((o) => procura.some(([nome, maiores]) => obraCitaBairro(`${o.titulo || ''} ${o.objeto || ''}`, nome, maiores))),
  };
}
