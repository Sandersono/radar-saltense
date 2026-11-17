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

// Agrupa os bairros citados nas propostas. apelidos: { "chave da variação": "Nome canônico" }.
// Cada proposta conta uma vez por bairro. Devolve do bairro mais citado para o menos citado.
export function montarBairros(proposituras, apelidos = {}) {
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
    return { nome: destinos.get(g.chave) || grafias[0], chave: g.chave, idx: [...g.idx].sort((a, b) => a - b), total: g.idx.size, grafias };
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

// Grafias dos outros bairros que contêm o nome deste como palavras inteiras.
export function nomesMaiores(bairro, todos) {
  const k = normalizar(bairro.nome);
  const re = new RegExp(palavraInteira(k));
  return [...new Set(todos.filter((o) => o.chave !== bairro.chave).flatMap((o) => [o.nome, ...(o.grafias || [])]).map(normalizar))]
    .filter((n) => n !== k && re.test(n));
}

// Rua lida do texto às vezes vem com sobra ("Rua Japão e o", "Rua Botucatu com a Rua Campinas"): fica só a primeira rua.
export const limparRua = (nome) => String(nome ?? '')
  .replace(/\s+(?:com|e|esquina)\s+(?:(?:a|o|com)\s+)*(?:rua|avenida|av\.?|travessa|estrada|alameda)\b.*$/i, '')
  .replace(/(?:\s+(?:e|ao|à|a|o|do|da|no|na|para|pelo|pela))+$/i, '')
  .trim();

// Contagem por chave, do maior para o menor (empate: ordem alfabética do rótulo).
const ranking = (mapa, n) => [...mapa.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR')).slice(0, n);

// Tudo o que a página de um bairro mostra, a partir das propostas dele. Sem HTML.
// todos: a lista completa de montarBairros (para não confundir "Barnabé" com "Residencial Barnabé" nas obras).
export function resumoBairro(bairro, d, todos = []) {
  const maiores = nomesMaiores(bairro, todos);
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
  const ruasDoBairro = new Set(ruas.keys());
  return {
    total: props.length,
    porGrupo,
    vereadores: ranking(vereadores, 5),
    tipos: ranking(tipos, 8),
    ruas: ranking(ruas, 10).map(({ rotulo, n }) => ({ nome: rotulo, n })),
    repetidos: (d.repetidos || []).filter((r) => ruasDoBairro.has(normalizar(r.rua))),
    recentes: [...props].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.id).localeCompare(String(a.id))).slice(0, 15),
    obras: ((d.obras && d.obras.lista) || []).filter((o) => obraCitaBairro(`${o.titulo || ''} ${o.objeto || ''}`, bairro.nome, maiores)),
  };
}
