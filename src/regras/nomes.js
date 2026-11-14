import { normalizar } from '../util/texto.js';

export function primeiroNome(nome) {
  return normalizar(nome).replace(/[^a-z ]/g, ' ').trim().split(/\s+/)[0] || '';
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos']);

const fichas = (nome) => {
  const t = normalizar(nome).replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return { primeiro: t[0] || '', extras: t.slice(1).filter((x) => x.length >= 3 && !PARTICULAS.has(x)) };
};

export function criarCasador(vereadores) {
  const mapa = new Map();
  for (const v of vereadores) {
    const f = fichas(v.nome);
    if (!f.primeiro) throw new Error('Vereador sem nome na lista de vereadores.');
    if (mapa.has(f.primeiro)) throw new Error(`Primeiro nome repetido entre vereadores: "${f.primeiro}". Revise a regra de nomes.`);
    mapa.set(f.primeiro, { id: v.id, extras: new Set(f.extras) });
  }
  // Com sobrenome informado, o primeiro nome sozinho não basta (há suplentes com o mesmo primeiro nome).
  return (nome) => {
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
