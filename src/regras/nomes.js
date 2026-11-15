import { normalizar } from '../util/texto.js';

export function primeiroNome(nome) {
  return normalizar(nome).replace(/[^a-z ]/g, ' ').trim().split(/\s+/)[0] || '';
}

// Partículas e sufixos de geração não contam como sobrenome para casar um nome.
const NAO_SIGNIFICATIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'filho', 'filha', 'neto', 'neta', 'junior', 'jr', 'sobrinho', 'sobrinha', 'segundo', 'terceiro']);

// Títulos e um "e" solto no fim (sobra de lista "Fulano e") não contam para casar um apelido.
const TITULOS = new Set(['dr', 'dra', 'prof', 'profa', 'professor', 'professora', 'vereador', 'vereadora']);
const chaveApelido = (nome) => {
  const t = normalizar(nome).replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter((x) => x && !TITULOS.has(x));
  if (t.length > 1 && t[t.length - 1] === 'e') t.pop();
  return t.join(' ');
};

const fichas = (nome) => {
  const t = normalizar(nome).replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return { primeiro: t[0] || '', extras: t.slice(1).filter((x) => x.length >= 3 && !NAO_SIGNIFICATIVOS.has(x)) };
};

// outrosNomes: { id: ['grafia', ...] } com erros de digitação conferidos à mão.
export function criarCasador(vereadores, outrosNomes = {}) {
  const apelidos = new Map(); // chave -> id (null quando dois vereadores usam o mesmo apelido)
  for (const v of vereadores) {
    for (const a of [v.apelido, ...(outrosNomes[v.id] || [])]) {
      const k = a ? chaveApelido(a) : '';
      if (!k) continue;
      apelidos.set(k, apelidos.has(k) && apelidos.get(k) !== v.id ? null : v.id);
    }
  }
  const mapa = new Map();
  for (const v of vereadores) {
    const f = fichas(v.nome);
    if (!f.primeiro) throw new Error('Vereador sem nome na lista de vereadores.');
    if (mapa.has(f.primeiro)) throw new Error(`Primeiro nome repetido entre vereadores: "${f.primeiro}". Revise a regra de nomes.`);
    mapa.set(f.primeiro, { id: v.id, extras: new Set(f.extras) });
  }
  // Com sobrenome informado, o primeiro nome sozinho não basta (há suplentes com o mesmo primeiro nome).
  return (nome) => {
    const k = chaveApelido(nome);
    if (k && apelidos.has(k)) return apelidos.get(k);
    const f = fichas(nome);
    const alvo = f.primeiro ? mapa.get(f.primeiro) : null;
    if (!alvo) return null;
    if (f.extras.length && !f.extras.some((x) => alvo.extras.has(x))) return null;
    return alvo.id;
  };
}

export function dividirNomes(texto) {
  return String(texto ?? '')
    .split(/\s*(?:,|;|\s+e\s+)\s*/)
    .map((s) => s.trim().replace(/^e\s+/i, '').trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter(Boolean);
}
