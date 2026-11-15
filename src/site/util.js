import { normalizar } from '../util/texto.js';

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter((p) => p && !PARTICULAS.has(normalizar(p)));
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

export function percentual(parte, total) {
  return total > 0 ? Math.floor((parte / total) * 100) : 0;
}

export function sugestoesBairros(locais, n = 6) {
  return locais
    .filter((l) => l.tipo === 'bairro')
    .sort((a, b) => b.idx.length - a.idx.length || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, n)
    .map((l) => l.nome);
}

// Recorte quadrado das fotos oficiais: largura inteira, colado no topo (a cabeça
// fica perto da borda de cima) e com uma folga acima, preenchida esticando a 1ª linha.
export function geometriaRecorte(largura, altura, respiro = 0.1) {
  const lado = Math.min(largura, altura);
  const folga = Math.round(lado * respiro);
  return { esquerda: Math.floor((largura - lado) / 2), lado, folga, alturaCorpo: lado - folga };
}

export const fotoSite = (fotoLocal) => fotoLocal.replace(/\.[^./]+$/, '.webp');
