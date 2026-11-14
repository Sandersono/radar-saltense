import { normalizar } from '../util/texto.js';

export function primeiroNome(nome) {
  return normalizar(nome).split(' ')[0] || '';
}

export function criarCasador(vereadores) {
  const mapa = new Map();
  for (const v of vereadores) {
    const p = primeiroNome(v.nome);
    if (!p) throw new Error('Vereador sem nome na lista de vereadores.');
    if (mapa.has(p)) throw new Error(`Primeiro nome repetido entre vereadores: "${p}". Revise a regra de nomes.`);
    mapa.set(p, v.id);
  }
  return (nome) => { const p = primeiroNome(nome); return p ? mapa.get(p) ?? null : null; };
}

export function dividirNomes(texto) {
  return String(texto ?? '')
    .split(/\s*(?:,|;|\s+e\s+)\s*/)
    .map((s) => s.trim().replace(/^e\s+/i, '').trim())
    .filter(Boolean);
}
