import { normalizar } from '../util/texto.js';

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter((p) => p && !PARTICULAS.has(normalizar(p)));
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

export function percentual(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function sugestoesBairros(locais, n = 6) {
  return locais
    .filter((l) => l.tipo === 'bairro')
    .sort((a, b) => b.idx.length - a.idx.length || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, n)
    .map((l) => l.nome);
}
