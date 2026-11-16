import { normalizar } from '../util/texto.js';
import { criarCasador } from './nomes.js';

export const GRUPOS_FOLHA = { vereadores: 'Vereadores', assessores: 'Assessores dos vereadores', servidores: 'Servidores da Câmara' };

const M = (s) => normalizar(s).toUpperCase();
const centavos = (v) => Math.round(v * 100) / 100;

export function valorFolha(s) {
  const t = String(s ?? '').trim();
  if (!t || t === '-') return 0;
  if (!/^-?[\d.]*\d(,\d+)?$/.test(t)) throw new Error(`Valor da folha inválido: "${s}"`);
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

export function lerCsvFolha(texto) {
  const linhas = String(texto ?? '').replace(new RegExp('^' + String.fromCharCode(0xfeff)), '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const tira = (c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
  const cab = linhas[0].split(';').map(tira);
  // O portal acrescenta ao CSV uma linha de totais e o rodapé "1 - 44", sem nome: não são pessoas.
  return linhas.slice(1).map((l) => {
    const c = l.split(';').map(tira);
    return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? '']));
  }).filter((l) => l['Nome']);
}

export function grupoFolha(l) {
  const cargo = M(l['Cargo']);
  if (M(l['Regime']) === 'VEREADORES' || /^(VEREADOR|PRESIDENTE)/.test(cargo)) return 'vereadores';
  if (/ASSESSOR PARLAMENTAR|CHEFE DE GABINETE/.test(cargo)) return 'assessores';
  return 'servidores';
}

// Só agregados; o único nome que sai é o id do vereador.
export function resumirFolha(linhas, vereadores) {
  const casar = criarCasador(vereadores);
  const grupos = Object.fromEntries(Object.keys(GRUPOS_FOLHA).map((g) => [g, { total: 0, pessoas: 0 }]));
  const porVereador = {};
  const pessoas = new Set();
  let indenizacoes = 0;
  for (const l of linhas) {
    const g = grupoFolha(l);
    const bruto = valorFolha(l['Salário Bruto']);
    grupos[g].total += bruto;
    indenizacoes += valorFolha(l['Indenizações']);
    const chave = `${g}|${l['Matrícula'] || l['Nome']}`;
    if (!pessoas.has(chave)) { pessoas.add(chave); grupos[g].pessoas++; }
    if (g === 'vereadores') {
      const id = casar(l['Nome']);
      if (id) porVereador[id] = centavos((porVereador[id] || 0) + bruto);
    }
  }
  for (const g of Object.values(grupos)) g.total = centavos(g.total);
  return { grupos, porVereador, indenizacoes: centavos(indenizacoes) };
}

export function mesclarFolha(salvo, novos) {
  const r = { ...salvo };
  for (const [mes, v] of Object.entries(novos)) if (v !== null && v !== undefined) r[mes] = v;
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
}
