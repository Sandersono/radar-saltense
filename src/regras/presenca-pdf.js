import { agruparLinhas, textoDe } from './linhas.js';

const MARCA = /^(P|A|AJ)$/;

export function lerPresenca(itens) {
  const linhas = agruparLinhas(itens);
  const iCab = linhas.findIndex((l) => l.itens.some((i) => /^VEREADOR$/i.test(i.str.trim())));
  if (iCab < 0) return { sessoes: [], linhas: [] };
  const colunas = linhas[iCab].itens
    .filter((i) => /^\d{1,2}\/\d{1,2}$/.test(i.str.trim()))
    .map((i) => ({ data: i.str.trim(), x: i.x }));
  const resultado = [];
  for (const l of linhas.slice(iCab + 1)) {
    if (/^LEGENDA/i.test(textoDe(l.itens))) break;
    const nome = textoDe(l.itens.filter((i) => !MARCA.test(i.str.trim())));
    if (!nome) continue;
    const marcas = colunas.map(() => null);
    for (const i of l.itens.filter((i) => MARCA.test(i.str.trim()))) {
      let melhor = -1;
      let dist = Infinity;
      colunas.forEach((c, k) => {
        const d = Math.abs(c.x - i.x);
        if (d < dist) { dist = d; melhor = k; }
      });
      if (melhor >= 0 && dist < 25) marcas[melhor] = i.str.trim();
    }
    resultado.push({ nome, marcas });
  }
  return { sessoes: colunas.map((c) => c.data), linhas: resultado };
}
